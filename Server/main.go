package main

import (
	"fmt"
	"log"
	"os"

	"github.com/PPEACH21/MoblieApp_MeebleProject/config"
	"github.com/PPEACH21/MoblieApp_MeebleProject/middlewares"
	"github.com/PPEACH21/MoblieApp_MeebleProject/routes"
	"github.com/PPEACH21/MoblieApp_MeebleProject/service"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
)


func main(){
	godotenv.Load("config/.env")
	app := fiber.New()
	
	config.InitFirebase()
	defer config.Client.Close()
	
	config.ConnectMailer(
		os.Getenv("MAILER_HOST"),
		os.Getenv("MAILER_USERNAME"),
		os.Getenv("MAILER_PASSWORD"),
	)

	app.Use(cors.New(cors.Config{
		AllowOrigins: os.Getenv("FRONTEND_URL"),
		AllowCredentials: true,
	}))

	app.Use(logger.New(logger.Config{
		Format:     "[${time}] ${status} - ${method} ${path}\n",
		TimeFormat: "2006-01-02 15:04:05",
		TimeZone:   "Asia/Bangkok",
	}))

	app.Post("/login",service.Login)
	app.Use(middlewares.ProtectedCookie())
		routes.Routes(app)

	fmt.Println("Local HTTP server running on Port:8080")
	if err := app.Listen(":8080"); err != nil {
		log.Fatal("Local server failed to start:", err)
	}
}
