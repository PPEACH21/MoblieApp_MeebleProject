package controllers

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/gofiber/fiber/v2"

	"github.com/PPEACH21/MoblieApp_MeebleProject/config"
	"github.com/PPEACH21/MoblieApp_MeebleProject/models"
)

// ---------- helpers ----------
func badRequest(c *fiber.Ctx, msg string) error {
	return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": msg})
}

// ---------- handlers (PUBLIC) ----------
func CreateShop(c *fiber.Ctx) error {
	var in models.Shop
	if err := c.BodyParser(&in); err != nil {
		return badRequest(c, "invalid body: "+err.Error())
	}

	// validate หลัก ๆ
	if in.ShopName == "" {
		return badRequest(c, "shop_name required")
	}
	if !models.AllowedTypes[in.Type] {
		return badRequest(c, "type must be one of: Appetizer, Beverage, Fast food, Main course, Dessert")
	}
	// ไม่บังคับให้มี price_min/price_max; ถ้าส่งมาก็เช็คความสมเหตุสมผล
	if in.PriceMin < 0 || in.PriceMax < 0 {
		return badRequest(c, "price_min/price_max must be >= 0")
	}
	if in.PriceMax > 0 && in.PriceMin > in.PriceMax {
		return badRequest(c, "price_min must be <= price_max")
	}
	if in.Status == "" {
		in.Status = "open"
	}

	now := time.Now()
	in.CreatedAt = now
	in.UpdatedAt = now

	// เขียนลง Firestore
	docRef, _, err := config.DB.Collection("shops").Add(config.Ctx, in)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"message": "shop created",
		"id":      docRef.ID,
	})
}

func GetAllShops(c *fiber.Ctx) error {
	ds, err := config.DB.Collection("shops").Documents(config.Ctx).GetAll()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	out := make([]models.Shop, 0, len(ds))
	for _, d := range ds {
		var s models.Shop
		if err := d.DataTo(&s); err != nil {
			continue
		}
		s.ID = d.Ref.ID
		out = append(out, s)
	}

	return c.JSON(fiber.Map{"shops": out})
}

func GetShopByID(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return badRequest(c, "id required")
	}

	d, err := config.DB.Collection("shops").Doc(id).Get(config.Ctx)
	if err != nil || !d.Exists() {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "shop not found"})
	}

	var s models.Shop
	if err := d.DataTo(&s); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "decode error"})
	}
	s.ID = d.Ref.ID

	return c.JSON(s)
}

func UpdateShop(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return badRequest(c, "id required")
	}

	// ✅ partial update: รับเป็น map แล้วอัปเดตเฉพาะฟิลด์ที่ส่งมา
	var in map[string]any
	if err := c.BodyParser(&in); err != nil {
		return badRequest(c, "invalid body: "+err.Error())
	}

	// validate บางส่วน
	if t, ok := in["type"].(string); ok && t != "" {
		if !models.AllowedTypes[t] {
			return badRequest(c, "type must be one of: Appetizer, Beverage, Fast food, Main course, Dessert")
		}
	}
	if pmn, ok := in["price_min"]; ok {
		if f, ok2 := pmn.(float64); ok2 && f < 0 {
			return badRequest(c, "price_min must be >= 0")
		}
	}
	if pmx, ok := in["price_max"]; ok {
		if f, ok2 := pmx.(float64); ok2 && f < 0 {
			return badRequest(c, "price_max must be >= 0")
		}
	}

	in["updatedAt"] = time.Now()

	// แปลงเป็น []firestore.Update
	updates := make([]firestore.Update, 0, len(in))
	for k, v := range in {
		updates = append(updates, firestore.Update{Path: k, Value: v})
	}

	_, err := config.DB.Collection("shops").Doc(id).Update(config.Ctx, updates)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "shop updated"})
}

func DeleteShop(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return badRequest(c, "id required")
	}
	_, err := config.DB.Collection("shops").Doc(id).Delete(config.Ctx)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "shop deleted"})
}
func trim(s string) string { return strings.TrimSpace(s) }

func isURL(u string) bool {
	if trim(u) == "" {
		return false
	}
	pu, err := url.Parse(u)
	if err != nil {
		return false
	}
	return pu.Scheme == "http" || pu.Scheme == "https"
}

// POST /shop/:id/menu
func CreateMenuItem(c *fiber.Ctx) error {
	shopId := c.Params("id")
	if shopId == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "shop id is required"})
	}

	// (ออปชัน) ตรวจว่ายังมีร้านอยู่จริง
	shopDoc, err := config.Client.Collection(models.ColShops).Doc(shopId).Get(config.Ctx)
	if err != nil || !shopDoc.Exists() {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "shop not found"})
	}

	var body models.CreateMenuReq
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body", "msg": err.Error()})
	}

	// validate
	name := trim(body.Name)
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "`name` is required"})
	}
	if body.Price == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "`price` is required"})
	}
	price := *body.Price
	if price < 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "`price` must be >= 0"})
	}
	img := trim(body.Image)
	if img != "" && !isURL(img) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "`image` must be http(s) url"})
	}

	active := true
	if body.Active != nil {
		active = *body.Active
	}
	now := time.Now()

	menuCol := config.Client.Collection(models.ColShops).Doc(shopId).Collection(models.SubColMenu)
	docRef := menuCol.NewDoc()

	item := models.MenuItem{
		ID:          docRef.ID,
		ShopID:      shopId,
		Name:        name,
		Description: trim(body.Description),
		Image:       img,
		Price:       price,
		Active:      active,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if _, err := docRef.Set(config.Ctx, item); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create menu item", "msg": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"item": item})
}

// GET /shop/:id/menu
func ListMenuItems(c *fiber.Ctx) error {
	shopId := c.Params("id")
	if shopId == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "shop id is required"})
	}

	// ✅ ระบุ path ชัด ๆ เอาไว้ debug
	colRef := config.Client.Collection(models.ColShops).Doc(shopId).Collection(models.SubColMenu)

	docs, err := colRef.Documents(config.Ctx).GetAll()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to list menu",
			"msg":   err.Error(),
			"path":  fmt.Sprintf("shops/%s/%s", shopId, models.SubColMenu),
		})
	}

	out := make([]map[string]any, 0, len(docs))
	for _, d := range docs {
		m := d.Data()
		// ✅ ใส่ id เอกสารกลับไปให้ client
		m["id"] = d.Ref.ID

		// 🧰 normalize ชื่อ field เผื่อฝั่ง client อยากใช้ lower-case
		if v, ok := m["Name"]; ok {
			m["name"] = v
		}
		if v, ok := m["Price"]; ok {
			m["price"] = v
		}
		if v, ok := m["Image"]; ok {
			m["image"] = v
		}
		if v, ok := m["Description"]; ok {
			m["description"] = v
		}
		if v, ok := m["CreatedAt"]; ok {
			m["createdAt"] = v
		}
		if v, ok := m["UpdatedAt"]; ok {
			m["updatedAt"] = v
		}

		out = append(out, m)
	}

	return c.JSON(fiber.Map{
		"items": out,
		"count": len(out),
		"path":  fmt.Sprintf("shops/%s/%s", shopId, models.SubColMenu),
	})
}

// PUT /shop/:id/menu/:menuId
func UpdateMenuItem(c *fiber.Ctx) error {
	shopId := c.Params("id")
	menuId := c.Params("menuId")
	if shopId == "" || menuId == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "shop id and menu id are required"})
	}

	var body models.UpdateMenuReq
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body", "msg": err.Error()})
	}

	updates := []firestore.Update{
		{Path: "updatedAt", Value: time.Now()},
	}
	if body.Name != nil {
		n := trim(*body.Name)
		if n == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "`name` cannot be empty"})
		}
		updates = append(updates, firestore.Update{Path: "name", Value: n})
	}
	if body.Description != nil {
		updates = append(updates, firestore.Update{Path: "description", Value: trim(*body.Description)})
	}
	if body.Image != nil {
		img := trim(*body.Image)
		if img != "" && !isURL(img) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "`image` must be http(s) url"})
		}
		updates = append(updates, firestore.Update{Path: "image", Value: img})
	}
	if body.Price != nil {
		if *body.Price < 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "`price` must be >= 0"})
		}
		updates = append(updates, firestore.Update{Path: "price", Value: *body.Price})
	}
	if body.Active != nil {
		updates = append(updates, firestore.Update{Path: "active", Value: *body.Active})
	}

	docRef := config.Client.Collection(models.ColShops).
		Doc(shopId).
		Collection(models.SubColMenu).
		Doc(menuId)

	if _, err := docRef.Update(config.Ctx, updates); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update menu item", "msg": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "updated"})
}

// DELETE /shop/:id/menu/:menuId
func DeleteMenuItem(c *fiber.Ctx) error {
	shopId := c.Params("id")
	menuId := c.Params("menuId")
	if shopId == "" || menuId == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "shop id and menu id are required"})
	}

	docRef := config.Client.Collection(models.ColShops).
		Doc(shopId).
		Collection(models.SubColMenu).
		Doc(menuId)

	if _, err := docRef.Delete(config.Ctx); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete menu item", "msg": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "deleted"})
}
func UpdateShopBasic(c *fiber.Ctx) error {
	shopId := c.Params("id")
	if shopId == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "shopId required"})
	}

	var body models.UpdateShopBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid json"})
	}

	updates := make([]firestore.Update, 0, 8)
	now := time.Now()

	if body.ShopName != nil {
		name := strings.TrimSpace(*body.ShopName)
		if name == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "shop_name cannot be empty"})
		}
		updates = append(updates, firestore.Update{Path: "shop_name", Value: name})
	}

	if body.Description != nil {
		updates = append(updates, firestore.Update{
			Path:  "description",
			Value: strings.TrimSpace(*body.Description),
		})
	}

	if body.Type != nil {
		t := strings.TrimSpace(*body.Type)
		if !models.IsAllowedType(t) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "type must be one of: MainCourse, Beverage, FastFoods, Appetizer, Dessert",
			})
		}
		updates = append(updates, firestore.Update{Path: "type", Value: t})
	}

	if body.Image != nil {
		updates = append(updates, firestore.Update{
			Path:  "image",
			Value: strings.TrimSpace(*body.Image),
		})
	}

	if body.Address != nil {
		// ใช้แบบ object ธรรมดา ตาม model ของคุณ (หรือเปลี่ยนเป็น GeoPoint ได้)
		addr := map[string]any{}
		if body.Address.Latitude != 0 || body.Address.Longitude != 0 {
			addr["latitude"] = body.Address.Latitude
			addr["longitude"] = body.Address.Longitude
			updates = append(updates, firestore.Update{Path: "address", Value: addr})
		}
	}

	// ❌ จงใจไม่รองรับ status / order_active / reserve_active ในไฟล์นี้
	// if body.Status != nil || body.OrderActive != nil || body.ReserveActive != nil { ... ไม่ทำ ... }

	updates = append(updates, firestore.Update{Path: "updatedAt", Value: now})

	docRef := config.Client.Collection(models.ColShops).Doc(shopId)
	if len(updates) > 0 {
		if _, err := docRef.Update(config.Ctx, updates); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to update shop",
				"msg":   err.Error(),
			})
		}
	}

	snap, err := docRef.Get(config.Ctx)
	if err != nil || !snap.Exists() {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "shop not found after update"})
	}
	out := snap.Data()
	out["id"] = snap.Ref.ID
	return c.JSON(fiber.Map{"shop": out})
}
func ListAllOrders(c *fiber.Ctx) error {
	iter := config.Client.Collection(ColOrders).OrderBy("CreatedAt", firestore.Desc).Documents(config.Ctx)
	docs, err := iter.GetAll()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list orders", "msg": err.Error()})
	}

	orders := make([]models.Order, 0, len(docs))
	for _, d := range docs {
		var o models.Order
		if err := d.DataTo(&o); err == nil {
			o.ID = d.Ref.ID
			orders = append(orders, o)
		}
	}
	return c.JSON(fiber.Map{"orders": orders})
}
