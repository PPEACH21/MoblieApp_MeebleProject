package models

import (
	"strings"
	"time"
)

/* ---------- OrderItem (ในแต่ละออเดอร์) ---------- */
type OrderItem struct {
	ID          string  `json:"id" firestore:"id"` // menuId
	Name        string  `json:"name" firestore:"name"`
	Image       string  `json:"image,omitempty" firestore:"image,omitempty"`
	Description string  `json:"description,omitempty" firestore:"description,omitempty"`
	Price       float64 `json:"price" firestore:"price"`
	Qty         int     `json:"qty" firestore:"qty"`
	Extras      any     `json:"extras,omitempty" firestore:"extras,omitempty"`
}

/* ---------- Order (เอกสารหลักใน Firestore) ---------- */
type Order struct {
	ID         string      `json:"id" firestore:"-"` // Firestore Document ID
	ShopID     string      `json:"shop_id" firestore:"shopId"`
	CustomerID string      `json:"customer_id" firestore:"customer_id"`
	Status     string      `json:"status" firestore:"status"`
	Items      []OrderItem `json:"items" firestore:"items"`
	Note       string      `json:"note,omitempty" firestore:"note,omitempty"`

	Total     float64   `json:"total" firestore:"total"`
	CreatedAt time.Time `json:"createdAt" firestore:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt" firestore:"updatedAt"`

	// Optional display fields
	CustomerName string `json:"customer_name,omitempty" firestore:"customer_name,omitempty"`
	ShopName     string `json:"shop_name,omitempty" firestore:"shop_name,omitempty"`
}

/* ---------- Request Struct ---------- */
type CreateOrderReq struct {
	ShopID       string      `json:"shopId"`
	CustomerID   string      `json:"customer_id"`
	Items        []OrderItem `json:"items"`
	Note         string      `json:"note"`
	CustomerName string      `json:"customer_name,omitempty"`
}

type UpdateOrderStatusReq struct {
	Status string `json:"status"`
}

/* ---------- Enum สถานะออเดอร์ ---------- */
const (
	OrderPrepare = "prepare"
	OrderOnGoing = "ongoing"
	OrderDone    = "done"
)

var AllowedOrderStatus = map[string]bool{
	OrderPrepare: true,
	OrderOnGoing: true,
	OrderDone:    true,
}

/* ---------- Helpers ---------- */

// NormalizeOrderStatus คืนค่า canonical (prepare | on-going | done)
func NormalizeOrderStatus(s string) (string, bool) {
	x := strings.TrimSpace(strings.ToLower(s))
	switch x {
	case "prepare", "preparing":
		return OrderPrepare, true
	case "ongoing", "on-going", "on_going", "in-progress", "in progress":
		return OrderOnGoing, true
	case "done", "completed", "complete", "finish", "finished":
		return OrderDone, true
	default:
		return "", false
	}
}

func IsOrderDone(s string) bool {
	canon, ok := NormalizeOrderStatus(s)
	return ok && canon == OrderDone
}
