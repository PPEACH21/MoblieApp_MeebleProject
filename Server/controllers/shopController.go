package controllers

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/gofiber/fiber/v2"
	"google.golang.org/api/iterator"

	"github.com/PPEACH21/MoblieApp_MeebleProject/config"
	"github.com/PPEACH21/MoblieApp_MeebleProject/models"
	services "github.com/PPEACH21/MoblieApp_MeebleProject/service"
)

/* ---------------- helpers ---------------- */
func badRequest(c *fiber.Ctx, msg string) error {
	return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": msg})
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

/* ---------------- SHOP ---------------- */

// POST /shop/create
func CreateShop(c *fiber.Ctx) error {
	var in models.Shop
	if err := c.BodyParser(&in); err != nil {
		return badRequest(c, "invalid body: "+err.Error())
	}

	// validate
	if in.ShopName == "" {
		return badRequest(c, "shop_name required")
	}
	if !models.AllowedTypes[in.Type] {
		return badRequest(c, "type must be one of: Appetizer, Beverage, Fast food, Main course, Dessert")
	}
	// ถ้าใช้ pointer: อนุญาต nil ได้, ถ้าส่งมาก็ตรวจค่าบวก
	if in.PriceMin != nil && *in.PriceMin < 0 {
		return badRequest(c, "price_min must be >= 0")
	}
	if in.PriceMax != nil && *in.PriceMax < 0 {
		return badRequest(c, "price_max must be >= 0")
	}
	if in.PriceMin != nil && in.PriceMax != nil && *in.PriceMin > *in.PriceMax {
		return badRequest(c, "price_min must be <= price_max")
	}
	if in.Status == "" {
		in.Status = "open"
	}

	now := time.Now()
	in.CreatedAt = now
	in.UpdatedAt = now

	docRef, _, err := config.Client.Collection("shops").Add(config.Ctx, in)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"message": "shop created",
		"id":      docRef.ID,
	})
}

// GET /shops
func GetAllShops(c *fiber.Ctx) error {
	ds, err := config.Client.Collection("shops").Documents(config.Ctx).GetAll()
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

// GET /shops/vendor/:uid
func GetShopByUserID(c *fiber.Ctx) error {
	vendorID := strings.TrimSpace(c.Params("uid"))
	if vendorID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "vendorId is required",
		})
	}

	// ✅ สร้าง DocumentRef ของ vendor ให้ตรงกับที่เก็บใน Firestore
	vendorRef := config.Client.Collection("vendors").Doc(vendorID)

	iter := config.Client.Collection("shops").
		Where("vendor_id", "==", vendorRef). // ใช้ DocumentRef เทียบ
		Limit(1).
		Documents(c.Context())
	defer iter.Stop()

	doc, err := iter.Next()
	if err == iterator.Done {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"error": "no shop found for this vendor",
		})
	}
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "query failed: " + err.Error(),
		})
	}

	data := doc.Data()
	data["id"] = doc.Ref.ID
	return c.JSON(fiber.Map{"shop": data})
}
func GetShopByID(c *fiber.Ctx) error {
	shopID := c.Params("id")
	if shopID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "shopId required"})
	}

	doc, err := config.Client.Collection("shops").Doc(shopID).Get(c.Context())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "get failed: " + err.Error()})
	}
	if !doc.Exists() {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "shop not found"})
	}

	data := doc.Data()
	data["id"] = doc.Ref.ID
	return c.JSON(fiber.Map{"shop": data})
}

// DELETE /shop/:id
func DeleteShop(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return badRequest(c, "id required")
	}
	_, err := config.Client.Collection("shops").Doc(id).Delete(config.Ctx)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "shop deleted"})
}

/* ---------------- MENU ---------------- */

// POST /shop/:id/menu
func CreateMenuItem(c *fiber.Ctx) error {
	shopId := c.Params("id")
	if shopId == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "shop id is required"})
	}

	shopDoc, err := config.Client.Collection(models.ColShops).Doc(shopId).Get(config.Ctx)
	if err != nil || !shopDoc.Exists() {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "shop not found"})
	}

	var body models.CreateMenuReq
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body", "msg": err.Error()})
	}

	name := trim(body.Name)
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "`name` is required"})
	}
	if body.Price == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "`price` is required"})
	}
	if *body.Price < 0 {
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
		Price:       *body.Price,
		Active:      active,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if _, err := docRef.Set(config.Ctx, item); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create menu item", "msg": err.Error()})
	}

	updErr := services.UpdateShopPriceRange(config.Ctx, shopId)
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"item":                item,
		"price_range_updated": updErr == nil,
		"price_range_update_err": func() any {
			if updErr != nil {
				return updErr.Error()
			}
			return nil
		}(),
	})
}

// GET /shop/:id/menu
func ListMenuItems(c *fiber.Ctx) error {
	shopId := c.Params("id")
	if shopId == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "shop id is required"})
	}

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
		m["id"] = d.Ref.ID
		// normalize เผื่อกรณี field เคยเป็นตัวใหญ่
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

	updates := []firestore.Update{{Path: "updatedAt", Value: time.Now()}}
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

	docRef := config.Client.Collection(models.ColShops).Doc(shopId).Collection(models.SubColMenu).Doc(menuId)
	if _, err := docRef.Update(config.Ctx, updates); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update menu item", "msg": err.Error()})
	}

	updErr := services.UpdateShopPriceRange(config.Ctx, shopId)
	return c.JSON(fiber.Map{
		"message":             "updated",
		"price_range_updated": updErr == nil,
		"price_range_update_err": func() any {
			if updErr != nil {
				return updErr.Error()
			}
			return nil
		}(),
	})
}

// DELETE /shop/:id/menu/:menuId
func DeleteMenuItem(c *fiber.Ctx) error {
	shopId := c.Params("id")
	menuId := c.Params("menuId")
	if shopId == "" || menuId == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "shop id and menu id are required"})
	}

	docRef := config.Client.Collection(models.ColShops).Doc(shopId).Collection(models.SubColMenu).Doc(menuId)
	if _, err := docRef.Delete(config.Ctx); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete menu item", "msg": err.Error()})
	}

	updErr := services.UpdateShopPriceRange(config.Ctx, shopId)
	return c.JSON(fiber.Map{
		"message":             "deleted",
		"price_range_updated": updErr == nil,
		"price_range_update_err": func() any {
			if updErr != nil {
				return updErr.Error()
			}
			return nil
		}(),
	})
}

// คุณมีโมเดล orders อยู่แล้ว สมมุติใช้ models.Order
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

func toLowerTrim(s string) string {
	return strings.TrimSpace(strings.ToLower(s))
}

func normalizeBool(v any) bool {
	switch x := v.(type) {
	case bool:
		return x
	case float64: // json numbers decode to float64
		return x != 0
	case int, int64, int32:
		return x != 0
	case string:
		switch toLowerTrim(x) {
		case "1", "true", "yes", "y", "on", "open", "enabled":
			return true
		default:
			return false
		}
	default:
		return false
	}
}
func normalizeStatus(v any) string {
	// บังคับเป็น "open"|"closed"
	switch x := v.(type) {
	case string:
		s := toLowerTrim(x)
		if s == "closed" {
			return "closed"
		}
		// true/1/open/yes → open
		if s == "open" || s == "true" || s == "1" || s == "enabled" || s == "yes" {
			return "open"
		}
		return "closed"
	default:
		if normalizeBool(v) {
			return "open"
		}
		return "closed"
	}
}
func canonicalType(s string) (string, bool) {
	l := toLowerTrim(s)
	switch l {
	case "maincourse", "main course", "main_course", "mains", "main":
		return "MainCourse", true
	case "beverage", "drink", "drinks":
		return "Beverage", true
	case "fastfoods", "fast food", "fast_food", "fastfood":
		return "FastFoods", true
	case "appetizer", "starter", "starters":
		return "Appetizer", true
	case "dessert", "sweet", "sweets":
		return "Dessert", true
	default:
		// ถ้า value ที่ส่งมาตรงกับ allowed อยู่แล้วก็ผ่าน
		if models.IsAllowedType(s) {
			return s, true
		}
		return "", false
	}
}
func canonicalizeIncoming(body map[string]any) (map[string]any, error) {
	out := make(map[string]any, len(body)+2)

	// 1) ค่าพื้นฐานที่เปิดให้แก้
	if v, ok := body["shop_name"]; ok {
		if s, ok2 := v.(string); ok2 {
			out["shop_name"] = strings.TrimSpace(s)
		}
	}
	if v, ok := body["description"]; ok {
		if s, ok2 := v.(string); ok2 {
			out["description"] = strings.TrimSpace(s)
		}
	}
	if v, ok := body["image"]; ok {
		if s, ok2 := v.(string); ok2 {
			out["image"] = strings.TrimSpace(s)
		}
	}
	// address (expect object, but allow pass-through)
	if v, ok := body["address"]; ok && v != nil {
		out["address"] = v
	}

	// 2) type: รองรับหลายสไตล์
	if v, ok := body["type"]; ok {
		if s, ok2 := v.(string); ok2 && s != "" {
			if can, okCan := canonicalType(s); okCan && models.IsAllowedType(can) {
				out["type"] = can
			} else {
				return nil, fiber.NewError(http.StatusBadRequest,
					"type must be one of: MainCourse, Beverage, FastFoods, Appetizer, Dessert")
			}
		}
	}

	// 3) status + alias
	if v, ok := body["status"]; ok {
		out["status"] = normalizeStatus(v)
	}
	if v, ok := body["is_open"]; ok {
		out["status"] = normalizeStatus(v)
	}
	if v, ok := body["open"]; ok {
		out["status"] = normalizeStatus(v)
	}
	if v, ok := body["enabled"]; ok {
		out["status"] = normalizeStatus(v)
	}
	if v, ok := body["State"]; ok { // เผื่อเคยใช้ S ใหญ่ในเอกสาร
		out["status"] = normalizeStatus(v)
	}
	if v, ok := body["shop_status"]; ok {
		out["status"] = normalizeStatus(v)
	}

	// 4) order_active + alias
	ord, ordOK := body["order_active"]
	if !ordOK {
		if v, ok := body["orderActive"]; ok {
			ord, ordOK = v, true
		} else if v, ok := body["accept_order"]; ok {
			ord, ordOK = v, true
		} else if v, ok := body["is_order_open"]; ok {
			ord, ordOK = v, true
		}
	}
	if ordOK {
		out["order_active"] = normalizeBool(ord)
	}

	// 5) reserve_active + alias
	res, resOK := body["reserve_active"]
	if !resOK {
		if v, ok := body["reserveActive"]; ok {
			res, resOK = v, true
		} else if v, ok := body["accept_reserve"]; ok {
			res, resOK = v, true
		} else if v, ok := body["is_reserve_open"]; ok {
			res, resOK = v, true
		}
	}
	if resOK {
		out["reserve_active"] = normalizeBool(res)
	}

	// 6) ตัดคีย์ที่ไม่รู้จักทิ้งโดยอัตโนมัติ (whitelist)
	allowed := map[string]bool{
		"shop_name":      true,
		"description":    true,
		"type":           true,
		"image":          true,
		"address":        true,
		"status":         true,
		"order_active":   true,
		"reserve_active": true,
	}
	clean := map[string]any{}
	for k, v := range out {
		if allowed[k] {
			clean[k] = v
		}
	}

	return clean, nil
}

// PUT /shop/:id   (partial update: อนุญาต status/order_active/reserve_active + fields พื้นฐาน)
func UpdateShop(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return badRequest(c, "id required")
	}

	var in map[string]any
	if err := c.BodyParser(&in); err != nil {
		return badRequest(c, "invalid body: "+err.Error())
	}

	body, err := canonicalizeIncoming(in)
	if err != nil {
		// error จาก canonicalize (เช่น type ไม่ถูก)
		if fe, ok := err.(*fiber.Error); ok {
			return c.Status(fe.Code).JSON(fiber.Map{"error": fe.Message})
		}
		return badRequest(c, err.Error())
	}

	// ป้องกันชื่อร้านว่าง
	if v, ok := body["shop_name"]; ok {
		if strings.TrimSpace(v.(string)) == "" {
			return badRequest(c, "shop_name cannot be empty")
		}
	}

	body["updatedAt"] = time.Now()

	updates := make([]firestore.Update, 0, len(body))
	for k, v := range body {
		updates = append(updates, firestore.Update{Path: k, Value: v})
	}

	docRef := config.Client.Collection(models.ColShops).Doc(id)
	if _, err := docRef.Update(config.Ctx, updates); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	snap, err := docRef.Get(config.Ctx)
	if err != nil || !snap.Exists() {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "shop not found after update"})
	}
	data := snap.Data()
	data["id"] = snap.Ref.ID
	return c.JSON(fiber.Map{"shop": data})
}

// PUT /shop/:id/update  (basic fields only: ชื่อ, คำอธิบาย, type, image, address)
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
		updates = append(updates, firestore.Update{Path: "description", Value: strings.TrimSpace(*body.Description)})
	}
	if body.Type != nil {
		t := strings.TrimSpace(*body.Type)
		if can, ok := canonicalType(t); ok && models.IsAllowedType(can) {
			updates = append(updates, firestore.Update{Path: "type", Value: can})
		} else {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "type must be one of: MainCourse, Beverage, FastFoods, Appetizer, Dessert",
			})
		}
	}
	if body.Image != nil {
		updates = append(updates, firestore.Update{Path: "image", Value: strings.TrimSpace(*body.Image)})
	}
	if body.Address != nil {
		addr := map[string]any{}
		// เก็บเฉพาะ lat/lng ถ้าส่งมา (กัน null ทับทั้ง object)
		if body.Address.Latitude != 0 || body.Address.Longitude != 0 {
			addr["latitude"] = body.Address.Latitude
			addr["longitude"] = body.Address.Longitude
			updates = append(updates, firestore.Update{Path: "address", Value: addr})
		}
	}
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
