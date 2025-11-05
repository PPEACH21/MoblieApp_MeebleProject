package routes

import (
	"github.com/PPEACH21/MoblieApp_MeebleProject/controllers"
	"github.com/gofiber/fiber/v2"
)

func SetupRoutes(app *fiber.App) {

	// ตัวอย่าง route
	app.Post("/shop/create", controllers.CreateShop)
	app.Get("/shops", controllers.GetAllShops)
	app.Get("/shop/:id", controllers.GetShopByID)
	app.Put("shop/:id/update", controllers.UpdateShop)
}
