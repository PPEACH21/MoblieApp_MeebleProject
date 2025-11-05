package controllers

import (
	"net/http"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/gofiber/fiber/v2"

	"github.com/PPEACH21/MoblieApp_MeebleProject/config"
	"github.com/PPEACH21/MoblieApp_MeebleProject/models"
)

// ---------- helpers ----------
func badRequest(c *fiber.Ctx, msg string) error {
	return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": msg})
}

// ---------- handlers (PUBLIC) ----------
func CreateShop(c *fiber.Ctx) error {
	var in models.Shop
	if err := c.BodyParser(&in); err != nil {
		return badRequest(c, "invalid body: "+err.Error())
	}

	// validate หลัก ๆ
	if in.ShopName == "" {
		return badRequest(c, "shop_name required")
	}
	if !models.AllowedTypes[in.Type] {
		return badRequest(c, "type must be one of: Appetizer, Beverage, Fast food, Main course, Dessert")
	}
	// ไม่บังคับให้มี price_min/price_max; ถ้าส่งมาก็เช็คความสมเหตุสมผล
	if in.PriceMin < 0 || in.PriceMax < 0 {
		return badRequest(c, "price_min/price_max must be >= 0")
	}
	if in.PriceMax > 0 && in.PriceMin > in.PriceMax {
		return badRequest(c, "price_min must be <= price_max")
	}
	if in.Status == "" {
		in.Status = "open"
	}

	now := time.Now()
	in.CreatedAt = now
	in.UpdatedAt = now

	// เขียนลง Firestore
	docRef, _, err := config.DB.Collection("shops").Add(config.Ctx, in)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"message": "shop created",
		"id":      docRef.ID,
	})
}

func GetAllShops(c *fiber.Ctx) error {
	ds, err := config.DB.Collection("shops").Documents(config.Ctx).GetAll()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	out := make([]models.Shop, 0, len(ds))
	for _, d := range ds {
		var s models.Shop
		if err := d.DataTo(&s); err != nil {
			continue
		}
		s.ID = d.Ref.ID
		out = append(out, s)
	}

	return c.JSON(fiber.Map{"shops": out})
}

func GetShopByID(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return badRequest(c, "id required")
	}

	d, err := config.DB.Collection("shops").Doc(id).Get(config.Ctx)
	if err != nil || !d.Exists() {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "shop not found"})
	}

	var s models.Shop
	if err := d.DataTo(&s); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "decode error"})
	}
	s.ID = d.Ref.ID

	return c.JSON(s)
}

func UpdateShop(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return badRequest(c, "id required")
	}

	// ✅ partial update: รับเป็น map แล้วอัปเดตเฉพาะฟิลด์ที่ส่งมา
	var in map[string]any
	if err := c.BodyParser(&in); err != nil {
		return badRequest(c, "invalid body: "+err.Error())
	}

	// validate บางส่วน
	if t, ok := in["type"].(string); ok && t != "" {
		if !models.AllowedTypes[t] {
			return badRequest(c, "type must be one of: Appetizer, Beverage, Fast food, Main course, Dessert")
		}
	}
	if pmn, ok := in["price_min"]; ok {
		if f, ok2 := pmn.(float64); ok2 && f < 0 {
			return badRequest(c, "price_min must be >= 0")
		}
	}
	if pmx, ok := in["price_max"]; ok {
		if f, ok2 := pmx.(float64); ok2 && f < 0 {
			return badRequest(c, "price_max must be >= 0")
		}
	}

	in["updatedAt"] = time.Now()

	// แปลงเป็น []firestore.Update
	updates := make([]firestore.Update, 0, len(in))
	for k, v := range in {
		updates = append(updates, firestore.Update{Path: k, Value: v})
	}

	_, err := config.DB.Collection("shops").Doc(id).Update(config.Ctx, updates)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "shop updated"})
}

func DeleteShop(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return badRequest(c, "id required")
	}
	_, err := config.DB.Collection("shops").Doc(id).Delete(config.Ctx)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "shop deleted"})
}
