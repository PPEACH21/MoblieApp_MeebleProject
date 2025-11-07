package controllers

import (
	"fmt"
	"os"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/PPEACH21/MoblieApp_MeebleProject/config"
	"github.com/PPEACH21/MoblieApp_MeebleProject/models"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func VerifiedUser(c *fiber.Ctx) error {
	userId := c.Params("id")
	if userId == "" {
		return c.Status(fiber.StatusBadRequest).SendString("missing id")
	}

	accountType := strings.ToLower(c.Query("type", "")) // "user", "vendor", หรือ ""
	var (
		docRef  *firestore.DocumentSnapshot
		role    string
		err     error
		dataRef *firestore.DocumentRef
	)

	// ✅ helper ฟังก์ชันอัปเดต verified
	updateVerified := func(ref *firestore.DocumentRef) (*firestore.DocumentSnapshot, error) {
		snap, err := ref.Get(config.Ctx)
		if err != nil || !snap.Exists() {
			return nil, fiber.ErrNotFound
		}
		if _, err := ref.Update(config.Ctx, []firestore.Update{
			{Path: "verified", Value: true},
		}); err != nil {
			return nil, err
		}
		return ref.Get(config.Ctx)
	}

	// ✅ ตรวจประเภทบัญชี
	switch accountType {
	case "vendor":
		dataRef = config.Vendor.Doc(userId)
		docRef, err = updateVerified(dataRef)
		role = "vendor"

	case "user":
		dataRef = config.User.Doc(userId)
		docRef, err = updateVerified(dataRef)
		role = "user"

	default:
		// auto detect
		if snap, e := config.User.Doc(userId).Get(config.Ctx); e == nil && snap.Exists() {
			dataRef = config.User.Doc(userId)
			docRef, err = updateVerified(dataRef)
			role = "user"
		} else if snap, e := config.Vendor.Doc(userId).Get(config.Ctx); e == nil && snap.Exists() {
			dataRef = config.Vendor.Doc(userId)
			docRef, err = updateVerified(dataRef)
			role = "vendor"
		} else {
			return c.Status(404).SendString("Account not found in users or vendors")
		}
	}

	if err != nil {
		return c.Status(400).SendString(fmt.Sprintf("Update error: %v", err))
	}

	// ✅ แปลงข้อมูล
	var member models.User
	if err := docRef.DataTo(&member); err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("Error parsing user data")
	}

	// ✅ สร้าง JWT ใหม่
	claims := jwt.MapClaims{
		"user_id":  docRef.Ref.ID,
		"email":    member.Email,
		"username": member.Username,
		"verified": member.Verified,
		"role":     role,
		"exp":      time.Now().Add(60 * time.Minute).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	secret := os.Getenv("JWT_SECRET")
	t, err := token.SignedString([]byte(secret))
	if err != nil {
		return c.SendStatus(fiber.StatusInternalServerError)
	}

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"success":  true,
		"message":  "Verified successfully",
		"role":     role,
		"token":  t,
		"user_id":  docRef.Ref.ID,
		"email":    member.Email,
		"username": member.Username,
	})
}