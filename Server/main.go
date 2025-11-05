// main.go
package main

import (
	"log"

	"github.com/PPEACH21/MoblieApp_MeebleProject/config"
	"github.com/PPEACH21/MoblieApp_MeebleProject/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func main() {
	config.InitFirebase()

	app := fiber.New()

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Authorization, Content-Type",
	}))

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true})
	})

	// ✅ เรียกใช้ routes จากไฟล์ route.go
	routes.SetupRoutes(app)
	log.Println("🚀 Server running on http://localhost:8080")
	log.Fatal(app.Listen(":8080"))
}
