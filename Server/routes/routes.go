package routes

import (
	"github.com/PPEACH21/MoblieApp_MeebleProject/controllers"
	"github.com/PPEACH21/MoblieApp_MeebleProject/middlewares"
	"github.com/PPEACH21/MoblieApp_MeebleProject/service"
	"github.com/gofiber/fiber/v2"
)

func Routes(app *fiber.App) {
	app.Get("/profile", middlewares.Profile)
	app.Put("/profile/:id",controllers.UpdateProfile)
	app.Post("/sendotp", service.OTPvertify())
	app.Put("/verifiedEmail/:id", controllers.VerifiedUser)

	/* ---------- SHOP ---------- */
	app.Post("/shop/create", controllers.CreateShop)
	app.Get("/shops", controllers.GetAllShops)
	app.Get("/shop/by-id/:id", controllers.GetShopByID)
	app.Get("/shop/:id", controllers.GetShopByShopID)
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
	app.Get("/shop/:shopId/orders", controllers.ListOrdersByShop)
	app.Get("/orders/:orderId", controllers.GetOrderByID)
	app.Put("/orders/:orderId/status", controllers.UpdateOrderStatus)
	app.Get("/shop/:shopId/history", controllers.ListHistoryByShop)

	/* ---------- RESERVATIONS ---------- */
	app.Post("/shops/:id/reservations", controllers.CreateReservation)
	app.Get("/shops/:id/reservations", controllers.ListReservationsByShop)
	app.Delete("/reservations/:id", controllers.DeleteReservation)
	/* ---------- CART ---------- */
	app.Get("/cart", controllers.GetCart)
	app.Post("/cart/add", controllers.AddToCart)
	app.Patch("/cart/qty", controllers.UpdateCartQty)
	app.Post("/cart/checkout", controllers.CheckoutCartFromDB)
}
