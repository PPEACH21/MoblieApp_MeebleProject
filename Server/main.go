package main

import (
	"log"
	"strings"
	"time"

	"cloud.google.com/go/firestore" // 👈 เพิ่มถ้ายังไม่มี (สำหรับ OrderBy)
	"github.com/PPEACH21/MoblieApp_MeebleProject/config"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func main() {
	config.InitFirebase()
	app := fiber.New()

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true})
	})

	// ✅ PUBLIC: สร้างโน้ต (ไม่ต้อง auth)
	type NoteIn struct {
		User string `json:"user"`
		Text string `json:"text"`
	}
	app.Post("/api/notes", func(c *fiber.Ctx) error {
		var b NoteIn
		if err := c.BodyParser(&b); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "bad body"})
		}
		if strings.TrimSpace(b.Text) == "" {
			return c.Status(400).JSON(fiber.Map{"error": "text required"})
		}
		data := map[string]any{
			"user":      strings.TrimSpace(b.User),
			"text":      strings.TrimSpace(b.Text),
			"createdAt": time.Now().UnixMilli(),
		}
		_, _, err := config.DB.Collection("notes").Add(c.Context(), data)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.SendStatus(201)
	})

	// ✅ PUBLIC: ดึงโน้ตล่าสุด (ไม่ต้อง auth)
	app.Get("/api/notes", func(c *fiber.Ctx) error {
		docs, err := config.DB.Collection("notes").
			OrderBy("createdAt", firestore.Desc).
			Limit(50).
			Documents(c.Context()).GetAll()
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		out := make([]map[string]any, 0, len(docs))
		for _, d := range docs {
			m := d.Data()
			m["id"] = d.Ref.ID
			out = append(out, m)
		}
		return c.JSON(out)
	})

	log.Println("🚀 Listening on :8080")
	log.Fatal(app.Listen(":8080"))
}
