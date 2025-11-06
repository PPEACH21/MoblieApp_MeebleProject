package controllers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/gofiber/fiber/v2"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/PPEACH21/MoblieApp_MeebleProject/config"
	"github.com/PPEACH21/MoblieApp_MeebleProject/models"
)

const (
	OrderPrepare   = "prepare"
	OrderReady     = "ready"
	OrderCompleted = "completed"
)

var AllowedOrderStatus = map[string]bool{
	OrderPrepare:   true,
	OrderReady:     true,
	OrderCompleted: true,
}

const ColOrders = "orders"

// -------- helpers --------
func computeTotal(items []models.OrderItem) float64 {
	var sum float64
	for _, it := range items {
		q := it.Qty
		if q <= 0 {
			q = 1
		}
		sum += it.Price * float64(q)
	}
	return sum
}

func now() time.Time { return time.Now() }

// -------- handlers --------

// POST /orders  (กดสั่ง/สร้างออเดอร์)
func CreateOrder(c *fiber.Ctx) error {
	var body models.CreateOrderReq
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	if body.ShopID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "shop_id required"})
	}
	if body.CustomerID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "customer_id required"})
	}
	if len(body.Items) == 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "items required"})
	}

	total := computeTotal(body.Items)
	doc := config.Client.Collection(ColOrders).NewDoc()
	nowT := now()

	order := models.Order{
		ID:           doc.ID, // set back to caller
		ShopID:       body.ShopID,
		CustomerID:   body.CustomerID,
		Status:       models.OrderPending, // เริ่มที่ pending
		Items:        body.Items,
		Note:         body.Note,
		Total:        total,
		CreatedAt:    nowT,
		UpdatedAt:    nowT,
		CustomerName: body.CustomerName,
	}

	// เขียนลง Firestore
	_, err := doc.Set(config.Ctx, order)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create order", "msg": err.Error()})
	}

	// แนบ ID กลับ
	order.ID = doc.ID
	return c.Status(http.StatusCreated).JSON(fiber.Map{"order": order})
}

// GET /orders/:orderId (ดูออเดอร์เดี่ยว)
func GetOrderByID(c *fiber.Ctx) error {
	orderId := c.Params("orderId")
	if orderId == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "orderId required"})
	}

	doc, err := config.Client.Collection(ColOrders).Doc(orderId).Get(config.Ctx)
	if err != nil {
		// ⬇️ ตรวจ not-found แบบถูกต้อง
		if status.Code(err) == codes.NotFound {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "order not found"})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to get order",
			"msg":   err.Error(),
		})
	}

	var ord models.Order
	if err := doc.DataTo(&ord); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to parse order",
			"msg":   err.Error(),
		})
	}
	ord.ID = doc.Ref.ID
	return c.JSON(fiber.Map{"order": ord})
}

// GET /shops/:shopId/orders?status=prepare (ดึงออเดอร์ตามร้าน + กรองสถานะได้)
func ListOrdersByShop(c *fiber.Ctx) error {
	shopId := c.Params("shopId")
	if shopId == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "shopId required"})
	}
	status := c.Query("status", "")

	q := config.Client.Collection(ColOrders).Where("shop_id", "==", shopId).OrderBy("CreatedAt", firestore.Desc)
	if status != "" {
		q = q.Where("status", "==", status)
	}

	docs, err := q.Documents(config.Ctx).GetAll()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list orders", "msg": err.Error()})
	}

	orders := make([]models.Order, 0, len(docs))
	for _, d := range docs {
		var ord models.Order
		if err := d.DataTo(&ord); err == nil {
			ord.ID = d.Ref.ID
			orders = append(orders, ord)
		}
	}
	return c.JSON(fiber.Map{"orders": orders})
}

// PUT /orders/:orderId/status   { "status": "prepare" }
func UpdateOrderStatus(c *fiber.Ctx) error {
	orderId := c.Params("orderId")
	if orderId == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "orderId required"})
	}

	var body models.UpdateOrderStatusReq
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	newStatus := body.Status
	if !models.AllowedOrderStatus[newStatus] {
		return c.Status(http.StatusBadRequest).JSON(
			fiber.Map{"error": fmt.Sprintf("status must be one of %v", keys(models.AllowedOrderStatus))},
		)
	}

	ref := config.Client.Collection(ColOrders).Doc(orderId)

	// ตรวจว่ามีอยู่จริง
	doc, err := ref.Get(config.Ctx)
	if err != nil {
		// ⬇️ Firestore SDK ไม่มี firestore.IsNotFound — ใช้เช็คข้อความ error แทน
		if strings.Contains(err.Error(), "NotFound") {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "order not found"})
		}
		return c.Status(http.StatusInternalServerError).JSON(
			fiber.Map{"error": "failed to get order", "msg": err.Error()},
		)
	}

	// อัปเดตสถานะ + updatedAt
	_, err = ref.Update(config.Ctx, []firestore.Update{
		{Path: "status", Value: newStatus},
		{Path: "updatedAt", Value: now()},
	})
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(
			fiber.Map{"error": "failed to update", "msg": err.Error()},
		)
	}

	var ord models.Order
	if err := doc.DataTo(&ord); err == nil {
		ord.Status = newStatus
		ord.UpdatedAt = now()
		ord.ID = doc.Ref.ID
	}
	return c.JSON(fiber.Map{"order": ord})
}

// utils: ดึง key names ของ map[string]bool
func keys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

// ให้เป็นเวลาไทย (เอาไว้คำนวณ dayKey)
var tzBKK, _ = time.LoadLocation("Asia/Bangkok")

func dayKeyOf(t time.Time) string {
	return t.In(tzBKK).Format("2006-01-02")
}

// POST /shops/:id/reservations
func CreateReservation(c *fiber.Ctx) error {

	shopId := c.Params("id")
	if shopId == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "shop id required"})
	}

	var body models.CreateReservationReq
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	if body.UserID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "user_id required"})
	}
	if body.StartAt.IsZero() {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "startAt required"})
	}
	if body.People <= 0 {
		body.People = 1
	}

	dk := dayKeyOf(body.StartAt)
	col := config.Client.Collection(models.ColReservations)

	err := config.Client.RunTransaction(config.Ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		q := col.
			Where("shop_id", "==", shopId).
			Where("dayKey", "==", dk)

		snap, err := tx.Documents(q).GetAll()
		if err != nil {
			return err
		}
		if len(snap) > 0 {
			// มีการจองวันนั้นอยู่แล้ว
			var existed models.Reservation
			if err := snap[0].DataTo(&existed); err == nil {
				if existed.UserID == body.UserID {
					return fmt.Errorf("E_DUP_BY_USER")
				}
			}
			return fmt.Errorf("E_SHOP_DAY_TAKEN")
		}

		doc := col.NewDoc()
		resv := models.Reservation{
			ShopID:    shopId,
			UserID:    body.UserID,
			People:    body.People,
			Phone:     body.Phone,
			Note:      body.Note,
			StartAt:   body.StartAt,
			DayKey:    dk,
			CreatedAt: now(),
		}
		return tx.Set(doc, resv)
	})

	if err != nil {
		switch err.Error() {
		case "E_DUP_BY_USER":
			return c.Status(http.StatusConflict).JSON(fiber.Map{"error": "คุณได้จองวันนี้ไปแล้ว"})
		case "E_SHOP_DAY_TAKEN":
			return c.Status(http.StatusConflict).JSON(fiber.Map{"error": "ร้านนี้ถูกจองไปแล้วในวันนี้"})
		default:
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create reservation", "msg": err.Error()})
		}
	}

	return c.JSON(fiber.Map{"ok": true})
}

// ✅ GET /shops/:id/reservations
func ListReservationsByShop(c *fiber.Ctx) error {
	shopId := c.Params("id")
	if shopId == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "shop id required"})
	}

	col := config.Client.Collection(models.ColReservations)
	q := col.Where("shop_id", "==", shopId).OrderBy("startAt", firestore.Asc)

	docs, err := q.Documents(config.Ctx).GetAll()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list reservations", "msg": err.Error()})
	}
	if len(docs) == 0 {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "no reservations"})
	}

	items := make([]models.Reservation, 0, len(docs))
	for _, d := range docs {
		var r models.Reservation
		if err := d.DataTo(&r); err == nil {
			r.ID = d.Ref.ID
			items = append(items, r)
		}
	}
	return c.JSON(fiber.Map{"reservations": items})
}

// ✅ DELETE /reservations/:id
func DeleteReservation(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "id required"})
	}

	ref := config.Client.Collection(models.ColReservations).Doc(id)
	_, err := ref.Delete(config.Ctx)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete", "msg": err.Error()})
	}

	return c.JSON(fiber.Map{"ok": true})
}
