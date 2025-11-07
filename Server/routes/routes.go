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

	/* ---------- SHOP ---------- */
	app.Post("/shop/create", controllers.CreateShop)
	app.Get("/shops", controllers.GetAllShops)
	app.Get("/shops/vendor/:uid", controllers.GetShopByUserID)
	app.Put("/shop/:id/update", controllers.UpdateShopBasic) // basic fields
	app.Put("/shop/:id", controllers.UpdateShop)             // generic partial update
	app.Delete("/shop/:id", controllers.DeleteShop)
	app.Get("/shop/:id", controllers.GetShopByID)

	/* ---------- MENU ---------- */
	app.Post("/shop/:id/menu", controllers.CreateMenuItem)
	app.Get("/shop/:id/menu", controllers.ListMenuItems)
	app.Put("/shop/:id/menu/:menuId", controllers.UpdateMenuItem)
	app.Delete("/shop/:id/menu/:menuId", controllers.DeleteMenuItem)

	/* ---------- ORDERS ---------- */
	app.Post("/orders", controllers.CreateOrder)
	app.Get("/orders", controllers.ListAllOrders)
	app.Get("/shops/:shopId/orders", controllers.ListOrdersByShop)
	app.Get("/orders/:orderId", controllers.GetOrderByID)
	app.Put("/orders/:orderId/status", controllers.UpdateOrderStatus)
	app.Post("/orders", controllers.CreateOrder)
	app.Get("/orders/:orderId", controllers.GetOrderByID)
	app.Get("/shops/:shopId/orders", controllers.ListOrdersByShop)
	app.Put("/orders/:orderId/status", controllers.UpdateOrderStatus)
	app.Put("/orders/:orderId/complete", controllers.CompleteOrder)
	app.Get("/users/:userId/history/orders", controllers.ListUserOrderHistory)
	app.Get("/shops/:shopId/history/orders", controllers.ListShopOrderHistory)
	/* ---------- RESERVATIONS ---------- */
}
