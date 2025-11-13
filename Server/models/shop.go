package models

import (
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/genproto/googleapis/type/latlng"
)

var AllowedTypes = map[string]bool{
	"MainCourse": true,
	"Beverage":   true,
	"FastFoods":  true,
	"Appetizer":  true,
	"Dessert":    true,
}

func IsAllowedType(t string) bool { return AllowedTypes[t] }

type GeoPoint struct {
	Latitude  float64 `json:"latitude" firestore:"latitude"`
	Longitude float64 `json:"longitude" firestore:"longitude"`
}

type Shop struct {
	ID          string `json:"id,omitempty" firestore:"-"`
	ShopName    string `json:"shop_name" firestore:"shop_name"`
	Description string `json:"description,omitempty" firestore:"description,omitempty"`
	Type        string `json:"type" firestore:"type"`
	Image       string `json:"image,omitempty" firestore:"image,omitempty"`

	// ✅ pointer รองรับ null
	PriceMin      *float64               `json:"price_min,omitempty" firestore:"price_min,omitempty"`
	PriceMax      *float64               `json:"price_max,omitempty" firestore:"price_max,omitempty"`
	MenuActiveCnt *int                   `json:"menu_active_count,omitempty" firestore:"menu_active_count,omitempty"`
	Address       *latlng.LatLng         `json:"address,omitempty" firestore:"address,omitempty"`
	VendorRef     *firestore.DocumentRef `json:"-" firestore:"vendor_id,omitempty"`

	// ✅ NEW: This field will be sent as a string in the JSON response
	VendorID      string    `json:"vendor_id,omitempty" firestore:"-"`
	OrderActive   bool      `json:"order_active" firestore:"order_active"`
	ReserveActive bool      `json:"reserve_active" firestore:"reserve_active"`
	Status        bool      `json:"status" firestore:"status"` // "open" | "closed"
	CreatedAt     time.Time `json:"createdAt" firestore:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt" firestore:"updatedAt"`
}

type UpdateShopBody struct {
	ShopName    *string `json:"shop_name,omitempty"`
	Description *string `json:"description,omitempty"`
	Type        *string `json:"type,omitempty"`
	Image       *string `json:"image,omitempty"`

	Status        *bool `json:"status,omitempty"`
	OrderActive   *bool `json:"order_active,omitempty"`
	ReserveActive *bool `json:"reserve_active,omitempty"`

	Address  *GeoPoint `json:"address,omitempty"`
	Location any       `json:"location,omitempty"` // legacy
}

const (
	ColShops   = "shops"
	SubColMenu = "menu"
)

type MenuItem struct {
	ID          string                 `json:"id" firestore:"id"`
	ShopID      string                 `json:"shop_id" firestore:"shop_id"`
	Name        string                 `json:"name" firestore:"name"`
	Description string                 `json:"description,omitempty" firestore:"description,omitempty"`
	Image       string                 `json:"image,omitempty" firestore:"image,omitempty"`
	Price       float64                `json:"price" firestore:"price"`
	Active      bool                   `json:"active" firestore:"active"`
	CreatedAt   time.Time              `json:"createdAt" firestore:"createdAt"`
	UpdatedAt   time.Time              `json:"updatedAt" firestore:"updatedAt"`
	Extra       map[string]interface{} `json:"extra,omitempty" firestore:"extra,omitempty"`
}

type CreateMenuReq struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Image       string   `json:"image"`
	Price       *float64 `json:"price"`
	Active      *bool    `json:"active"`
}

type UpdateMenuReq struct {
	Name        *string  `json:"name,omitempty"`
	Description *string  `json:"description,omitempty"`
	Image       *string  `json:"image,omitempty"`
	Price       *float64 `json:"price,omitempty"`
	Active      *bool    `json:"active,omitempty"`
}
