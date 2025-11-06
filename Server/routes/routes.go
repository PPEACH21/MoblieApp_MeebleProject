package routes

import (
	"github.com/PPEACH21/MoblieApp_MeebleProject/controllers"
	"github.com/gofiber/fiber/v2"
)

func SetupRoutes(app *fiber.App) {

	/* ---------- SHOP ---------- */
	app.Post("/shop/create", controllers.CreateShop)
	app.Get("/shops", controllers.GetAllShops)
	app.Get("/shop/:id", controllers.GetShopByID)
	app.Put("/shop/:id/update", controllers.UpdateShopBasic) // basic fields
	app.Put("/shop/:id", controllers.UpdateShop)             // generic partial update
	app.Delete("/shop/:id", controllers.DeleteShop)

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

	/* ---------- RESERVATIONS ---------- */
	app.Post("/shops/:id/reservations", controllers.CreateReservation)
	app.Get("/shops/:id/reservations", controllers.ListReservationsByShop)
	app.Delete("/reservations/:id", controllers.DeleteReservation)
}
