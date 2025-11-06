package routes

import (
	"github.com/PPEACH21/MoblieApp_MeebleProject/middlewares"
	"github.com/gofiber/fiber/v2"
)

func Routes(app *fiber.App) {
	app.Get("/profile", middlewares.Profile)

}
