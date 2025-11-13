package controllers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/gofiber/fiber/v2"
	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/PPEACH21/MoblieApp_MeebleProject/config"
	"github.com/PPEACH21/MoblieApp_MeebleProject/models"
)

const (
	OrderPrepare   = "prepare"
	OrderReady     = "ongoing"
	OrderCompleted = "done"
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

// GET /shops/:shopId/orders?status=prepare
func ListOrdersByShop(c *fiber.Ctx) error {
	shopId := c.Params("shopId")
	if shopId == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "shopId required"})
	}
	status := c.Query("status", "")

	q := config.Client.Collection("orders").
		Where("shopId", "==", shopId)

	if status != "" {
		q = q.Where("status", "==", status)
	}

	snaps, err := q.Documents(config.Ctx).GetAll()
	if err != nil {
		fmt.Printf("🔥 [ListOrdersByShop] shopId=%s status=%s err=%v\n", shopId, status, err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to list orders",
			"msg":   err.Error(),
		})
	}

	out := make([]models.Order, 0, len(snaps))
	for _, d := range snaps {
		var ord models.Order
		if err := d.DataTo(&ord); err == nil {
			ord.ID = d.Ref.ID
			out = append(out, ord)
		}
	}
	return c.JSON(fiber.Map{"orders": out})
}

// PUT /orders/:orderId/status   { "status": "prepare" }
func UpdateOrderStatus(c *fiber.Ctx) error {
	orderId := c.Params("orderId")
	if orderId == "" {
		return c.Status(400).JSON(fiber.Map{"error": "orderId required"})
	}

	var body models.UpdateOrderStatusReq
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	newStatus := body.Status
	if !models.AllowedOrderStatus[newStatus] {
		return c.Status(400).JSON(fiber.Map{
			"error": fmt.Sprintf("status must be one of %v", keys(models.AllowedOrderStatus)),
		})
	}

	ref := config.Client.Collection(ColOrders).Doc(orderId)

	var out models.Order
	err := config.Client.RunTransaction(config.Ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		// 1) อ่านเอกสารเดิม
		snap, err := tx.Get(ref)
		if err != nil {
			if strings.Contains(err.Error(), "NotFound") {
				return fiber.NewError(404, "order not found")
			}
			return fiber.NewError(500, "failed to get order: "+err.Error())
		}

		// 2) map ไป struct สำหรับฟิลด์หลัก
		var ord models.Order
		if err := snap.DataTo(&ord); err != nil {
			return fiber.NewError(500, "failed to parse order: "+err.Error())
		}
		dataMap := snap.Data()

		// fallback shopId / customerId (userId)
		if ord.ShopID == "" {
			if v, ok := dataMap["shopId"].(string); ok {
				ord.ShopID = v
			}
		}
		if ord.CustomerID == "" {
			if v, ok := dataMap["customerId"].(string); ok {
				ord.CustomerID = v
			} else if v, ok := dataMap["userId"].(string); ok {
				ord.CustomerID = v
			}
		}

		// -------- NEW: หา shop_name ให้แน่นอน --------
		shopName := ""
		if v, ok := dataMap["shop_name"].(string); ok && strings.TrimSpace(v) != "" {
			shopName = v
		} else if v, ok := dataMap["shopName"].(string); ok && strings.TrimSpace(v) != "" {
			shopName = v
		}
		// ถ้ายังไม่มี ลองอ่าน shops/{shopId} ภายใน transaction
		if shopName == "" && ord.ShopID != "" {
			shopRef := config.Client.Collection("shops").Doc(ord.ShopID)
			shopSnap, err := tx.Get(shopRef)
			if err == nil && shopSnap.Exists() {
				if s, ok := shopSnap.Data()["name"].(string); ok && strings.TrimSpace(s) != "" {
					shopName = s
				} else if s, ok := shopSnap.Data()["shop_name"].(string); ok && strings.TrimSpace(s) != "" {
					shopName = s
				} else if s, ok := shopSnap.Data()["title"].(string); ok && strings.TrimSpace(s) != "" {
					shopName = s
				}
			}
		}
		// ---------------------------------------------

		// 3) เตรียม normalize รายการเมนู (qty=int, price=float64, เก็บ extras)
		mapToItem := func(m map[string]interface{}) models.OrderItem {
			it := models.OrderItem{}

			// id (menuId)
			if s, ok := m["id"].(string); ok && s != "" {
				it.ID = s
			}
			if it.ID == "" {
				if s, ok := m["menuId"].(string); ok && s != "" {
					it.ID = s
				}
			}

			if s, ok := m["name"].(string); ok {
				it.Name = s
			}
			if s, ok := m["image"].(string); ok {
				it.Image = s
			}
			if s, ok := m["description"].(string); ok {
				it.Description = s
			}

			// price -> float64
			switch v := m["price"].(type) {
			case float64:
				it.Price = v
			case int:
				it.Price = float64(v)
			case int64:
				it.Price = float64(v)
			}

			// qty -> int
			switch v := m["qty"].(type) {
			case int:
				it.Qty = v
			case int64:
				it.Qty = int(v)
			case float64:
				it.Qty = int(v)
			}

			// extras (อะไรก็ได้)
			if ex, ok := m["extras"]; ok {
				it.Extras = ex
			}

			return it
		}

		normalizeItems := func(raw any) []models.OrderItem {
			out := make([]models.OrderItem, 0)
			switch v := raw.(type) {
			case []interface{}:
				for _, one := range v {
					m, ok := one.(map[string]interface{})
					if !ok {
						continue
					}
					out = append(out, mapToItem(m))
				}
			case []map[string]interface{}:
				for _, m := range v {
					out = append(out, mapToItem(m))
				}
			default:
				// unsupported -> empty
			}
			return out
		}

		var items []models.OrderItem
		if raw, ok := dataMap["items"]; ok && raw != nil {
			items = normalizeItems(raw)
		} else if raw, ok := dataMap["order_items"]; ok && raw != nil { // เผื่อชื่ออื่น
			items = normalizeItems(raw)
		}

		// 4) ตั้งค่าจะส่งคืน + อัปเดตเวลา
		ord.ID = snap.Ref.ID
		ord.Status = newStatus
		ord.UpdatedAt = now()

		// 5) ถ้า completed → ย้ายไป history (shop + user) แล้วลบจาก orders
		if newStatus == "completed" {
			if ord.ShopID == "" {
				return fiber.NewError(400, "order missing shopId")
			}
			if ord.CustomerID == "" {
				return fiber.NewError(400, "order missing customerId")
			}

			shopHistoryRef := config.Client.Collection("shops").Doc(ord.ShopID).Collection("history").Doc(orderId)
			userHistoryRef := config.Client.Collection("users").Doc(ord.CustomerID).Collection("history").Doc(orderId)

			payload := map[string]interface{}{
				"historyId":        orderId,
				"orderId":          ord.ID,
				"userId":           ord.CustomerID,
				"shopId":           ord.ShopID,
				"shop_name":        shopName, // ✅ ใส่ชื่อร้าน
				"status":           ord.Status,
				"total":            ord.Total,
				"createdAt":        ord.CreatedAt, // เก็บของเดิม
				"updatedAt":        ord.UpdatedAt, // เวลาที่อัปเดตล่าสุด
				"movedToHistoryAt": now(),         // เวลาเข้า history
				"items":            items,         // แนบรายการเมนู
				"item_count":       len(items),    // (ออปชัน) สำหรับสรุปเร็ว ๆ
			}

			if err := tx.Set(shopHistoryRef, payload, firestore.MergeAll); err != nil {
				return fiber.NewError(500, "failed to write shop history: "+err.Error())
			}
			if err := tx.Set(userHistoryRef, payload, firestore.MergeAll); err != nil {
				return fiber.NewError(500, "failed to write user history: "+err.Error())
			}
			if err := tx.Delete(ref); err != nil {
				return fiber.NewError(500, "failed to delete original order: "+err.Error())
			}

			out = ord
			return nil
		}

		// 6) ไม่ใช่ completed → อัปเดตสถานะใน orders
		if err := tx.Update(ref, []firestore.Update{
			{Path: "status", Value: newStatus},
			{Path: "updatedAt", Value: ord.UpdatedAt},
		}); err != nil {
			return fiber.NewError(500, "failed to update: "+err.Error())
		}

		out = ord
		return nil
	})

	if err != nil {
		if fe, ok := err.(*fiber.Error); ok {
			return c.Status(fe.Code).JSON(fiber.Map{"error": fe.Message})
		}
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"order": out})
}

func ListHistoryByShop(c *fiber.Ctx) error {
	shopId := c.Params("shopId")
	if shopId == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "shopId required"})
	}

	limit := c.QueryInt("limit", 50)
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	var cursor time.Time
	if s := c.Query("startAfter", ""); s != "" {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			cursor = t
		}
	}

	col := config.Client.Collection("shops").Doc(shopId).Collection("history")

	q := col.OrderBy("movedToHistoryAt", firestore.Desc).Limit(limit)
	if !cursor.IsZero() {
		q = q.StartAfter(cursor)
	}

	iter := q.Documents(config.Ctx)
	defer iter.Stop()

	var out []models.Order
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}

		var o models.Order
		if err := doc.DataTo(&o); err != nil {
			continue
		}
		o.ID = doc.Ref.ID

		out = append(out, o)
	}

	resp := fiber.Map{
		"shopId":  shopId,
		"history": out,
	}
	if len(out) > 0 {
		last := out[len(out)-1]
		// ใช้ createdAt หรือ movedToHistoryAt แล้วแต่ field ที่มี
		ts := last.UpdatedAt
		if ts.IsZero() {
			ts = last.CreatedAt
		}
		resp["nextStartAfter"] = ts.Format(time.RFC3339)
	}

	return c.JSON(resp)
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
	if body.People <= 0 {
		body.People = 1
	}

	col := config.Client.Collection(models.ColReservations)
	doc := col.NewDoc()

	resv := models.Reservation{
		ID:        doc.ID,
		ShopID:    shopId,
		UserID:    body.UserID,
		People:    body.People,
		Note:      body.Note,
		CreatedAt: now(),
	}

	if _, err := doc.Set(config.Ctx, resv); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create reservation",
			"msg":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"ok":      true,
		"message": "จองสำเร็จทันที",
		"data":    resv,
	})
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
