package middlewares

import (
	"os"

	"github.com/PPEACH21/MoblieApp_MeebleProject/config"
	jwtware "github.com/gofiber/contrib/jwt"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func ProtectedAuth() fiber.Handler {
	return jwtware.New(jwtware.Config{
		SigningKey:   jwtware.SigningKey{Key: []byte(os.Getenv("JWT_SECRET"))},
		TokenLookup:  "header:Authorization",
		AuthScheme:   "Bearer",
		ErrorHandler: jwtError,
	})
}

func Profile(c *fiber.Ctx) error {
	user := c.Locals("user").(*jwt.Token)
	claims := user.Claims.(jwt.MapClaims)
	userID := claims["user_id"].(string)
	role := claims["role"].(string)

	// fmt.Println("user:", user)
	doc, err := config.User.Doc(userID).Get(config.Ctx)
	if err != nil {
		doc, err = config.Vendor.Doc(userID).Get(config.Ctx)
		if err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "User not found",
			})
		}
	}
	data := doc.Data()

	return c.JSON(fiber.Map{
		"user_id":   userID,
		"email":     data["email"],
		"username":  data["username"],
		"firstname": data["firstname"],
		"lastname":  data["lastname"],
		"avatar":    data["avatar"],
		"phone":     data["phone"],
		"coin":      data["Cost"],
		"role":      role,
		"verified":  data["verified"],
	})
}

func jwtError(c *fiber.Ctx, err error) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
		"error": "Unauthorized",
	})
}
