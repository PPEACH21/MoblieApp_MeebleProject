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
	OrderReady     = "ongoing"
	OrderCompleted = "success"
)

var AllowedOrderStatus = map[string]bool{
	OrderPrepare:   true,
	OrderReady:     true,
	OrderCompleted: true,
}

/* =========================== Collections =========================== */
const (
	ColOrders        = "orders"         // คิวงานปัจจุบัน
	ColOrdersArchive = "orders_archive" // ประวัติรวม (ออปชัน แต่ผมใส่ให้)
	ColUsers         = "users"
	ColShops         = "shops"
)

/* ============================== Helpers ============================ */

func now() time.Time { return time.Now() }

// รวมยอดเป็น float64 ตรงตาม struct ใหม่
func computeTotal(items []models.OrderItem) float64 {
	var s float64
	for _, it := range items {
		q := it.Qty
		if q <= 0 {
			q = 1
		}
		if it.Price < 0 {
			continue // กันค่าติดลบ
		}
		s += it.Price * float64(q)
	}
	// ถ้าต้องการปัดทศนิยม 2 ตำแหน่ง ค่อย round ภายหลังที่ client แสดงผล
	return s
}

func keys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

/* ========================= Create an order ========================= */
// POST /orders
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
	t := now()

	// สถานะเริ่มต้น = prepare
	status := models.OrderPrepare

	order := models.Order{
		ID:           doc.ID, // doc id (ไม่เก็บใน field Firestore)
		ShopID:       body.ShopID,
		CustomerID:   body.CustomerID,
		Status:       status,
		Items:        body.Items,
		Note:         body.Note,
		Total:        total,
		CreatedAt:    t,
		UpdatedAt:    t,
		CustomerName: body.CustomerName,
	}

	// เก็บเฉพาะ field Firestore (camelCase ตาม struct tag)
	data := map[string]any{
		"shopId":        order.ShopID,
		"customer_id":   order.CustomerID,
		"status":        order.Status,
		"items":         order.Items,
		"note":          order.Note,
		"total":         order.Total,
		"createdAt":     order.CreatedAt,
		"updatedAt":     order.UpdatedAt,
		"customer_name": order.CustomerName,
		// "shop_name":  ใส่ได้ถ้ามี
	}

	if _, err := doc.Set(config.Ctx, data); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create order", "msg": err.Error(),
		})
	}

	order.ID = doc.ID
	return c.Status(http.StatusCreated).JSON(fiber.Map{"order": order})
}

/* =========================== Get by id ============================= */
// GET /orders/:orderId
func GetOrderByID(c *fiber.Ctx) error {
	orderId := c.Params("orderId")
	if orderId == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "orderId required"})
	}

	doc, err := config.Client.Collection(ColOrders).Doc(orderId).Get(config.Ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "order not found"})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get order", "msg": err.Error()})
	}

	var ord models.Order
	if err := doc.DataTo(&ord); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to parse order", "msg": err.Error()})
	}
	ord.ID = doc.Ref.ID
	return c.JSON(fiber.Map{"order": ord})
}

// GET /shops/:shopId/orders?status=prepare|on-going|done
func ListOrdersByShop(c *fiber.Ctx) error {
	shopId := c.Params("shopId")
	if shopId == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "shopId required"})
	}

	// normalize status (optional)
	raw := c.Query("status", "")
	var canon string
	if raw != "" {
		v, ok := models.NormalizeOrderStatus(raw)
		if !ok {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error": "status must be one of: prepare | ongoing | done",
			})
		}
		canon = v
	}

	col := config.Client.Collection(ColOrders)

	// --- สร้างคิวรีหลัก: where shop_id + orderBy createdAt (camelCase) ---
	q := col.Where("shopId", "==", shopId)
	if canon != "" {
		q = q.Where("status", "==", canon)
	}
	q = q.OrderBy("createdAt", firestore.Desc)

	// --- ดึงข้อมูล พร้อม fallback ---
	docs, err := q.Documents(config.Ctx).GetAll()
	if err != nil {
		code := status.Code(err)

		// กรณี index ไม่พร้อม หรือ field ผิดเคส ⇒ ลอง fallback
		// 1) ลอง orderBy แบบ lowercase แล้ว (ใช้แล้ว)
		// 2) ถ้ายังพัง ลองไม่ใส่ OrderBy
		if code == codes.FailedPrecondition || strings.Contains(err.Error(), "requires an index") {
			// fallback #1: ไม่ orderBy (ให้ได้ผลลัพธ์ก่อน)
			q2 := col.Where("shopId", "==", shopId)
			if canon != "" {
				q2 = q2.Where("status", "==", canon)
			}
			if docs2, err2 := q2.Documents(config.Ctx).GetAll(); err2 == nil {
				orders := make([]models.Order, 0, len(docs2))
				for _, d := range docs2 {
					var ord models.Order
					if err := d.DataTo(&ord); err == nil {
						ord.ID = d.Ref.ID
						orders = append(orders, ord)
					}
				}
				// แจ้งฝั่ง client ว่ากำลังใช้ fallback (debug)
				return c.JSON(fiber.Map{
					"orders": orders,
					"note":   "fallback: missing composite index for (shopId==, orderBy createdAt desc)",
				})
			}
		}

		// case อื่น ๆ ⇒ ส่ง error ชัด ๆ (จะมีลิงก์สร้าง index ถ้า Firestore คืนมา)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to list orders",
			"msg":   err.Error(),
			"code":  code.String(),
		})
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

/* ======================= Update order status ======================= */
// PUT /orders/:orderId/status   { "status": "on-going" | "done" | "prepare" }
func UpdateOrderStatus(c *fiber.Ctx) error {
	orderId := c.Params("orderId")
	if orderId == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "orderId required"})
	}

	var body models.UpdateOrderStatusReq
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}

	canon, ok := models.NormalizeOrderStatus(body.Status)
	if !ok {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "status must be one of: prepare | on-going | done",
		})
	}

	ref := config.Client.Collection(ColOrders).Doc(orderId)
	doc, err := ref.Get(config.Ctx)
	if err != nil {
		if strings.Contains(err.Error(), "NotFound") || status.Code(err) == codes.NotFound {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "order not found"})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to get order", "msg": err.Error(),
		})
	}

	// ยังไม่จบ → แค่อัปเดตสถานะ
	if canon != models.OrderDone {
		_, err = ref.Update(config.Ctx, []firestore.Update{
			{Path: "status", Value: canon},
			{Path: "updatedAt", Value: now()},
		})
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to update", "msg": err.Error(),
			})
		}

		var ord models.Order
		if err := doc.DataTo(&ord); err == nil {
			ord.Status = canon
			ord.UpdatedAt = now()
			ord.ID = doc.Ref.ID
			return c.JSON(fiber.Map{"order": ord})
		}
		return c.JSON(fiber.Map{"ok": true})
	}

	// เป็น done → archive & delete
	if err := archiveAndDeleteOrder(orderId); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to archive", "msg": err.Error(),
		})
	}
	return c.JSON(fiber.Map{"message": "order archived"})
}

/* ====================== Complete (force done) ====================== */
// PUT /orders/:orderId/complete
func CompleteOrder(c *fiber.Ctx) error {
	orderId := c.Params("orderId")
	if orderId == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "orderId required"})
	}
	if err := archiveAndDeleteOrder(orderId); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to archive", "msg": err.Error(),
		})
	}
	return c.JSON(fiber.Map{"message": "order archived"})
}

/* ============================ Histories =========================== */
// GET /users/:userId/history/orders
func ListUserOrderHistory(c *fiber.Ctx) error {
	uid := c.Params("userId")
	if uid == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "userId required"})
	}

	q := config.Client.Collection(ColUsers).Doc(uid).
		Collection("history").
		OrderBy("createdAt", firestore.Desc)

	docs, err := q.Documents(config.Ctx).GetAll()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list history", "msg": err.Error()})
	}

	out := make([]map[string]any, 0, len(docs))
	for _, d := range docs {
		m := d.Data()
		m["id"] = d.Ref.ID
		out = append(out, m)
	}
	return c.JSON(fiber.Map{"history": out})
}

// GET /shops/:shopId/history/orders
func ListShopOrderHistory(c *fiber.Ctx) error {
	shopId := c.Params("shopId")
	if shopId == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "shopId required"})
	}

	q := config.Client.Collection(ColShops).Doc(shopId).
		Collection("history").
		OrderBy("createdAt", firestore.Desc)

	docs, err := q.Documents(config.Ctx).GetAll()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list history", "msg": err.Error()})
	}

	out := make([]map[string]any, 0, len(docs))
	for _, d := range docs {
		m := d.Data()
		m["id"] = d.Ref.ID
		out = append(out, m)
	}
	return c.JSON(fiber.Map{"history": out})
}

/* ====================== Archive & delete order ===================== */
// ย้าย order → (1) orders_archive, (2) users/{uid}/history, (3) shops/{shopId}/history แล้วลบจาก orders
func archiveAndDeleteOrder(orderId string) error {
	return config.Client.RunTransaction(config.Ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		ref := config.Client.Collection(ColOrders).Doc(orderId)

		doc, err := tx.Get(ref)
		if err != nil {
			if status.Code(err) == codes.NotFound || strings.Contains(err.Error(), "NotFound") {
				return fmt.Errorf("order not found")
			}
			return err
		}

		data := doc.Data()

		// set เป็น done + อัปเดตเวลา (ใช้ camelCase)
		data["status"] = models.OrderDone
		data["updatedAt"] = now()

		// อ่านค่าใช้อ้างอิง
		uid, _ := data["customerId"].(string)
		shopId, _ := data["shopId"].(string)

		// 1) global archive
		archRef := config.Client.Collection(ColOrdersArchive).Doc(doc.Ref.ID)
		if err := tx.Set(archRef, data, firestore.MergeAll); err != nil {
			return err
		}

		// 2) user history
		if uid != "" {
			uRef := config.Client.Collection(ColUsers).Doc(uid).Collection("history").Doc(doc.Ref.ID)
			if err := tx.Set(uRef, data, firestore.MergeAll); err != nil {
				return err
			}
		}

		// 3) shop history
		if shopId != "" {
			sRef := config.Client.Collection(ColShops).Doc(shopId).Collection("history").Doc(doc.Ref.ID)
			if err := tx.Set(sRef, data, firestore.MergeAll); err != nil {
				return err
			}
		}

		// 4) ลบออกจากคิว
		if err := tx.Delete(ref); err != nil {
			return err
		}
		return nil
	})
}
