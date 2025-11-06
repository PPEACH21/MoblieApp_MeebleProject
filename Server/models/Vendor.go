package models

import (
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/genproto/googleapis/type/latlng"
)

type Shop struct {
	ID             string                 `json:"id" firestore:"-"`
	Address        *latlng.LatLng         `json:"address" firestore:"address"`
	Create_at      time.Time              `json:"createAt" firestore:"createAt"`
	Description    string                 `json:"description" firestore:"description"`
	Order_active   bool                   `json:"order_active" firestore:"order_active"`
	Rate           float32                `json:"rate" firestore:"rate"`
	Reserve_active bool                   `json:"reserve_active" firestore:"reserve_active"`
	Shop_name      string                 `json:"shop_name" firestore:"shop_name"`
	Status         bool                   `json:"status" firestore:"status"`
	Type           string                 `json:"type" firestore:"type"`   // เลือกได้ 1 จาก 5 ประเภท
	Image          string                 `json:"image" firestore:"image"` // ✅ เพิ่ม field รูป
	Vendor_ref     *firestore.DocumentRef `json:"-" firestore:"vendor_id"`
	Vendor_id      string                 `json:"vendor_id" firestore:"-"`
	PriceMin       *float64               `json:"price_min" firestore:"price_min"`
	PriceMax       *float64               `json:"price_max" firestore:"price_max"`
}

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
	VendorID   string `json:"vendorId"`   // optional
	Shop_name  string `json:"shop_name"`  // optional
	ShopID     string `json:"shopId"`     // optional
	CustomerID string `json:"customerId"` // REQUIRED: username
	UserID     string `json:"userId"`     // REQUIRED: auth.user_id (doc id)
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

type Order struct {
	Items      []CartItem `json:"items" firestore:"items"`
	Total      float64    `json:"total" firestore:"total"`
	Status     string     `json:"status" firestore:"status"` // e.g. pending | paid | cancelled
	CreatedAt  time.Time  `json:"createdAt" firestore:"createdAt"`
	CustomerID string     `json:"customerId" firestore:"customerId"`
}

type Reservation struct {
	ID         string                 `json:"id,omitempty"`
	ShopID     string                 `json:"shopId"`
	ShopName   string                 `json:"shop_name,omitempty"`
	UserID     string                 `json:"userId"`
	CustomerID string                 `json:"customerId"`
	Date       string                 `json:"date"`   // YYYY-MM-DD
	Status     string                 `json:"status"` // pending|confirmed|canceled|done
	Note       string                 `json:"note,omitempty"`
	Phone      string                 `json:"phone,omitempty"`
	CreatedAt  time.Time              `json:"createdAt"`
	UpdatedAt  time.Time              `json:"updatedAt"`
	Raw        map[string]interface{} `json:"raw,omitempty"`
}

// ----- DTO (request bodies) -----
type CreateReservationReq struct {
	ShopID     string `json:"shopId"`
	UserID     string `json:"userId"`
	CustomerID string `json:"customerId"`
	Date       string `json:"date"` // YYYY-MM-DD
	Note       string `json:"note"`
	Phone      string `json:"phone"`
}

type UpdateReservationReq struct {
	Status string `json:"status"` // pending|confirmed|canceled|done
}
