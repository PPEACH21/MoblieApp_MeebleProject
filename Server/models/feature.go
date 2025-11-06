package models

import "time"

type OrderItem struct {
	ID          string  `json:"id" firestore:"id"` // menuId
	Name        string  `json:"name" firestore:"name"`
	Image       string  `json:"image,omitempty" firestore:"image,omitempty"`
	Description string  `json:"description,omitempty" firestore:"description,omitempty"`
	Price       float64 `json:"price" firestore:"price"`
	Qty         int     `json:"qty" firestore:"qty"`
	Extras      any     `json:"extras,omitempty" firestore:"extras,omitempty"`
}

type Order struct {
	ID         string      `json:"id" firestore:"-"` // Firestore DocID
	ShopID     string      `json:"shop_id" firestore:"shop_id"`
	CustomerID string      `json:"customer_id" firestore:"customer_id"`
	Status     string      `json:"status" firestore:"status"`
	Items      []OrderItem `json:"items" firestore:"items"`
	Note       string      `json:"note,omitempty" firestore:"note,omitempty"`

	Total     float64   `json:"total" firestore:"total"`
	CreatedAt time.Time `json:"createdAt" firestore:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt" firestore:"updatedAt"`

	// optional display only (ไม่บังคับ)
	CustomerName string `json:"customer_name,omitempty" firestore:"customer_name,omitempty"`
	ShopName     string `json:"shop_name,omitempty" firestore:"shop_name,omitempty"`
}

type CreateOrderReq struct {
	ShopID       string      `json:"shop_id"`
	CustomerID   string      `json:"customer_id"`
	Items        []OrderItem `json:"items"`
	Note         string      `json:"note"`
	CustomerName string      `json:"customer_name,omitempty"`
}

type UpdateOrderStatusReq struct {
	Status string `json:"status"`
}

const (
	OrderPending   = "pending"
	OrderConfirmed = "confirmed" // เผื่อใช้ในอนาคต
	OrderPrepare   = "prepare"
	OrderReady     = "ready"
	OrderCompleted = "completed"
	OrderCancelled = "cancelled"
)

var AllowedOrderStatus = map[string]bool{
	OrderPending:   true,
	OrderConfirmed: true,
	OrderPrepare:   true,
	OrderReady:     true,
	OrderCompleted: true,
	OrderCancelled: true,
}

type Reservation struct {
	ID        string    `json:"id,omitempty" firestore:"-"`
	ShopID    string    `json:"shop_id" firestore:"shop_id"`
	UserID    string    `json:"user_id" firestore:"user_id"`
	People    int       `json:"people" firestore:"people"`
	Phone     string    `json:"phone,omitempty" firestore:"phone,omitempty"`
	Note      string    `json:"note,omitempty" firestore:"note,omitempty"`
	StartAt   time.Time `json:"startAt" firestore:"startAt"`
	DayKey    string    `json:"dayKey" firestore:"dayKey"`
	CreatedAt time.Time `json:"createdAt" firestore:"createdAt"`
}

type CreateReservationReq struct {
	UserID  string    `json:"user_id"`
	People  int       `json:"people"`
	Phone   string    `json:"phone,omitempty"`
	Note    string    `json:"note,omitempty"`
	StartAt time.Time `json:"startAt"`
}

const ColReservations = "reservations"
