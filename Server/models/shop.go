package models

import "time"

var AllowedTypes = map[string]bool{
	"MainCourse": true,
	"Beverage":   true,
	"FastFoods":  true,
	"Appetizer":  true,
	"Dessert":    true,
}

type GeoPoint struct {
	Latitude  float64 `json:"latitude" firestore:"latitude"`
	Longitude float64 `json:"longitude" firestore:"longitude"`
}

type Shop struct {
	ID            string    `json:"id,omitempty" firestore:"-"`
	ShopName      string    `json:"shop_name" firestore:"shop_name"`
	Description   string    `json:"description,omitempty" firestore:"description,omitempty"`
	Type          string    `json:"type" firestore:"type"`
	Image         string    `json:"image,omitempty" firestore:"image,omitempty"`
	PriceMin      float64   `json:"price_min" firestore:"price_min"`
	PriceMax      float64   `json:"price_max" firestore:"price_max"`
	Address       *GeoPoint `json:"address,omitempty" firestore:"address,omitempty"`
	VendorID      string    `json:"vendor_id,omitempty" firestore:"vendor_id,omitempty"`
	OrderActive   bool      `json:"order_active" firestore:"order_active"`
	ReserveActive bool      `json:"reserve_active" firestore:"reserve_active"`
	Status        string    `json:"status" firestore:"status"` // "open" | "closed"
	CreatedAt     time.Time `json:"createdAt" firestore:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt" firestore:"updatedAt"`
}
