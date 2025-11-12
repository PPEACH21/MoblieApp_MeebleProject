package models

import (
	"time"

	"cloud.google.com/go/firestore"
)

type Menu struct {
	ID          string  `json:"id" firestore:"-"` // <<-- เพิ่ม: ไม่เขียนลง Firestore
	Name        string  `json:"name" firestore:"name"`
	Active      bool    `json:"active" firestore:"active"`
	Price       float64 `json:"price" firestore:"price"`
	Description string  `json:"description" firestore:"description"`
	Image       string  `json:"image" firestore:"image"`
	// ถ้ามีฟิลด์อื่น ๆ ก็ใส่ต่อได้เลย
}

type finance_date = struct {
	Date    time.Time `json:"date" firestore:"date"`
	Denied  int       `json:"denied" firestore:"denied"`
	Order   int       `json:"order" firestore:"order"`
	Success int       `json:"success" firestore:"success"`
	Total   int       `json:"total" firestore:"total"`
}

type MenuItemPayload struct {
	MenuID      string  `json:"menuId"`
	Name        string  `json:"name"`
	Price       float64 `json:"price"`
	Image       string  `json:"image"`
	Description string  `json:"description"`
}

type CreateOrderFromMenuRequest struct {
	VendorID   string          `json:"vendorId"`
	ShopID     string          `json:"shopId"`
	Qty        int             `json:"qty"`
	Item       MenuItemPayload `json:"item"`
	CustomerID string          `json:"customerId"` // optional
}

type AddToCartRequest struct {
	Shop_name  string `json:"shop_name"` // snake_case
	ShopID     string `json:"shopId"`
	CustomerID string `json:"customerId"`
	Qty        int    `json:"qty"`
	Item       struct {
		MenuID      string  `json:"menuId"`
		Name        string  `json:"name"`
		Price       float64 `json:"price"`
		Image       string  `json:"image"`
		Description string  `json:"description"`
	} `json:"item"`
}

type UpdateQtyRequest struct {
	VendorID   string `json:"vendorId"`
	ShopID     string `json:"shopId"`
	CustomerID string `json:"customerId"` // ✅ เพิ่มตรงนี้
	MenuID     string `json:"menuId"`
	Qty        int    `json:"qty"`
}

type SimpleCartRequest struct {
	VendorID   string `json:"vendorId"`
	ShopID     string `json:"shopId"`
	CustomerID string `json:"customerId"` // username
	UserID     string `json:"userId"`     // auth.user_id (doc id)
}

type CartItem struct {
	ID          string                 `json:"id" firestore:"id"` // menuId
	Name        string                 `json:"name" firestore:"name"`
	Qty         int                    `json:"qty" firestore:"qty"`
	Price       float64                `json:"price" firestore:"price"`
	Image       string                 `json:"image,omitempty" firestore:"image,omitempty"`
	Description string                 `json:"description,omitempty" firestore:"description,omitempty"`
	MenuRef     *firestore.DocumentRef `json:"-" firestore:"menuRef,omitempty"` // ref ไปยังเมนูจริง
	VendorID    string                 `json:"vendorId,omitempty" firestore:"vendorId,omitempty"`
	ShopID      string                 `json:"shopId,omitempty"   firestore:"shopId,omitempty"`
}

type Cart struct {
	CustomerID string     `json:"customerId" firestore:"customerId"` // ✅ แยกตะกร้าตาม user
	Shop_name  string     `json:"shop_name" firestore:"shop_name"`   // ✅ เพิ่มฟิลด์นี้
	VendorID   string     `json:"vendorId" firestore:"vendorId"`     // ✅ เพิ่ม
	ShopID     string     `json:"shopId" firestore:"shopId"`         // ✅ เพิ่ม
	Items      []CartItem `json:"items" firestore:"items"`           // รายการในตะกร้า
	Total      float64    `json:"total" firestore:"total"`           // ยอดรวมทั้งหมด
	UpdatedAt  time.Time  `json:"updatedAt" firestore:"updatedAt"`   // เวลาอัปเดตล่าสุด
}

// ----- DTO (request bodies) -----
