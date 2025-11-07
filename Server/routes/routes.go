package routes

import (
	"github.com/PPEACH21/MoblieApp_MeebleProject/controllers"
	"github.com/PPEACH21/MoblieApp_MeebleProject/middlewares"
	"github.com/PPEACH21/MoblieApp_MeebleProject/service"
	"github.com/gofiber/fiber/v2"
)

func Routes(app *fiber.App) {
	app.Get("/profile", middlewares.Profile)
	app.Post("/sendotp", service.OTPvertify())
	app.Put("/verifiedEmail/:id", controllers.VerifiedUser)
}
