package controllers

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/PPEACH21/MoblieApp_MeebleProject/config"
	"github.com/PPEACH21/MoblieApp_MeebleProject/models"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func VerifiedUser(c *fiber.Ctx) error {
	userId := c.Params("id")
	if userId == "" {
		return c.Status(fiber.StatusBadRequest).SendString("missing id")
	}

	accountType := strings.ToLower(c.Query("type", "")) // "user", "vendor", หรือ ""
	var (
		docRef  *firestore.DocumentSnapshot
		role    string
		err     error
		dataRef *firestore.DocumentRef
	)

	// ✅ helper ฟังก์ชันอัปเดต verified
	updateVerified := func(ref *firestore.DocumentRef) (*firestore.DocumentSnapshot, error) {
		snap, err := ref.Get(config.Ctx)
		if err != nil || !snap.Exists() {
			return nil, fiber.ErrNotFound
		}
		if _, err := ref.Update(config.Ctx, []firestore.Update{
			{Path: "verified", Value: true},
		}); err != nil {
			return nil, err
		}
		return ref.Get(config.Ctx)
	}

	// ✅ ตรวจประเภทบัญชี
	switch accountType {
	case "vendor":
		dataRef = config.Vendor.Doc(userId)
		docRef, err = updateVerified(dataRef)
		role = "vendor"

	case "user":
		dataRef = config.User.Doc(userId)
		docRef, err = updateVerified(dataRef)
		role = "user"

	default:
		// auto detect
		if snap, e := config.User.Doc(userId).Get(config.Ctx); e == nil && snap.Exists() {
			dataRef = config.User.Doc(userId)
			docRef, err = updateVerified(dataRef)
			role = "user"
		} else if snap, e := config.Vendor.Doc(userId).Get(config.Ctx); e == nil && snap.Exists() {
			dataRef = config.Vendor.Doc(userId)
			docRef, err = updateVerified(dataRef)
			role = "vendor"
		} else {
			return c.Status(404).SendString("Account not found in users or vendors")
		}
	}

	if err != nil {
		return c.Status(400).SendString(fmt.Sprintf("Update error: %v", err))
	}

	// ✅ แปลงข้อมูล
	var member models.User
	if err := docRef.DataTo(&member); err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("Error parsing user data")
	}

	// ✅ สร้าง JWT ใหม่
	claims := jwt.MapClaims{
		"user_id":  docRef.Ref.ID,
		"email":    member.Email,
		"username": member.Username,
		"verified": member.Verified,
		"role":     role,
		"exp":      time.Now().Add(60 * time.Minute).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	secret := os.Getenv("JWT_SECRET")
	t, err := token.SignedString([]byte(secret))
	if err != nil {
		return c.SendStatus(fiber.StatusInternalServerError)
	}

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"success":  true,
		"message":  "Verified successfully",
		"role":     role,
		"token":    t,
		"user_id":  docRef.Ref.ID,
		"email":    member.Email,
		"username": member.Username,
	})
}
func topCartDoc(customerID string) *firestore.DocumentRef {
	if customerID == "" {
		customerID = "anon"
	}
	return config.Client.Collection("cart").Doc(customerID)
}

func ordersCol(vendorID, shopID string) *firestore.CollectionRef {
	return config.Client.
		Collection("vendors").Doc(vendorID).
		Collection("shops").Doc(shopID).
		Collection("orders")
}

func loadMenuByID(vendorID, menuID string) (*models.Menu, error) {
	snap, err := config.Client.
		Collection("vendors").Doc(vendorID).
		Collection("menu").Doc(menuID).
		Get(config.Ctx)
	if err != nil || !snap.Exists() {
		return nil, fmt.Errorf("menu not found")
	}
	var m models.Menu
	if err := snap.DataTo(&m); err != nil {
		return nil, err
	}
	m.ID = menuID
	return &m, nil
}

func toFloat(v interface{}) float64 {
	switch t := v.(type) {
	case int:
		return float64(t)
	case int64:
		return float64(t)
	case float64:
		return t
	case float32:
		return float64(t)
	case string:
		var f float64
		_, _ = fmt.Sscan(t, &f)
		return f
	default:
		return 0
	}
}
func toInt(v interface{}) int {
	switch t := v.(type) {
	case int:
		return t
	case int64:
		return int(t)
	case float64:
		return int(t)
	case float32:
		return int(t)
	case string:
		var i int
		_, _ = fmt.Sscan(t, &i)
		return i
	default:
		return 0
	}
}

// GET /api/cart?customerId=
func GetCart(c *fiber.Ctx) error {
	customerID := c.Query("customerId")
	if customerID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "customerId is required"})
	}

	snap, err := topCartDoc(customerID).Get(config.Ctx)
	if err != nil || !snap.Exists() {
		// ยังไม่มี cart -> คืนว่าง (key เล็กให้ตรง FE)
		return c.JSON(fiber.Map{
			"customerId": customerID,
			"shop_name":  "",
			"items":      []models.CartItem{},
			"total":      0,
			"updatedAt":  time.Now(),
		})
	}

	// คืน map จาก Firestore ตรง ๆ เพื่อรักษา key เป็นตัวเล็ก
	return c.JSON(snap.Data())
}

// POST /api/cart/add
func AddToCart(c *fiber.Ctx) error {
	var req models.AddToCartRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "BodyParser error", "msg": err.Error(),
		})
	}

	// ตรวจ required fields
	missing := []string{}
	if strings.TrimSpace(req.CustomerID) == "" {
		missing = append(missing, "customerId")
	}
	if strings.TrimSpace(req.UserID) == "" {
		missing = append(missing, "userId")
	}
	if strings.TrimSpace(req.ShopID) == "" {
		missing = append(missing, "shopId")
	}
	if strings.TrimSpace(req.Shop_name) == "" {
		// รองรับ FE ส่ง shopName
		if v := reflect.ValueOf(req).FieldByName("ShopName"); v.IsValid() {
			if s, ok := v.Interface().(string); ok && strings.TrimSpace(s) != "" {
				req.Shop_name = s
			}
		}
		if strings.TrimSpace(req.Shop_name) == "" {
			missing = append(missing, "shop_name")
		}
	}
	if strings.TrimSpace(req.Item.MenuID) == "" {
		missing = append(missing, "menuId")
	}
	if req.Qty <= 0 {
		missing = append(missing, "qty (> 0)")
	}
	if len(missing) > 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing required fields",
			"missing": missing,
			"exampleBody": map[string]any{
				"customerId": "peach",
				"userId":     "abc123",
				"shopId":     "Shop01",
				"shop_name":  "KU Canteen",
				"item": map[string]any{
					"menuId": "MENU001",
				},
				"qty": 1,
			},
			"note": "รองรับทั้ง shop_name และ shopName; qty ต้องมากกว่า 0",
		})
	}

	// เติมข้อมูลเมนูถ้าขาด (optional)
	if (req.Item.Name == "" || req.Item.Price <= 0 || req.Item.Image == "" || req.Item.Description == "") && req.VendorID != "" {
		if m, err := loadMenuByID(req.VendorID, req.Item.MenuID); err == nil {
			if req.Item.Name == "" {
				req.Item.Name = m.Name
			}
			if req.Item.Price <= 0 {
				req.Item.Price = m.Price
			}
			if req.Item.Image == "" {
				req.Item.Image = m.Image
			}
			if req.Item.Description == "" {
				req.Item.Description = m.Description
			}
		}
	}

	userRef := config.Client.Collection("users").Doc(req.UserID)

	var menuRef *firestore.DocumentRef
	if req.VendorID != "" {
		menuRef = config.Client.Collection("vendors").Doc(req.VendorID).
			Collection("menu").Doc(req.Item.MenuID)
	}

	ref := topCartDoc(req.CustomerID)

	err := config.Client.RunTransaction(config.Ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		var cart models.Cart
		snap, err := tx.Get(ref)
		if err != nil || !snap.Exists() {
			cart = models.Cart{
				CustomerID: req.CustomerID,
				Shop_name:  req.Shop_name,
				Items:      []models.CartItem{},
				Total:      0,
				UpdatedAt:  time.Now(),
			}
		} else if err := snap.DataTo(&cart); err != nil {
			return err
		}

		// Lock ด้วย shopId
		existingShop := ""
		if len(cart.Items) > 0 {
			existingShop = cart.Items[0].ShopID
		}
		incomingShop := req.ShopID
		if len(cart.Items) > 0 {
			if existingShop == "" && incomingShop != "" {
				existingShop = incomingShop
			}
			if incomingShop == "" || existingShop == "" || existingShop != incomingShop {
				return fiber.NewError(fiber.StatusConflict,
					fmt.Sprintf("CART_SHOP_CONFLICT: cart locked to shop=%s, incoming shop=%s", existingShop, incomingShop))
			}
		}

		// รวมรายการซ้ำ (shopId + menuId)
		found := false
		for i := range cart.Items {
			if cart.Items[i].ShopID == req.ShopID && cart.Items[i].ID == req.Item.MenuID {
				cart.Items[i].Qty += req.Qty
				if req.Item.Price > 0 {
					cart.Items[i].Price = req.Item.Price
				}
				if cart.Items[i].Name == "" {
					cart.Items[i].Name = req.Item.Name
				}
				if cart.Items[i].Image == "" {
					cart.Items[i].Image = req.Item.Image
				}
				if cart.Items[i].Description == "" {
					cart.Items[i].Description = req.Item.Description
				}
				if cart.Items[i].VendorID == "" {
					cart.Items[i].VendorID = req.VendorID
				}
				if cart.Items[i].MenuRef == nil {
					cart.Items[i].MenuRef = menuRef
				}
				found = true
				break
			}
		}
		if !found {
			cart.Items = append(cart.Items, models.CartItem{
				ID:          req.Item.MenuID,
				Name:        req.Item.Name,
				Qty:         req.Qty,
				Price:       req.Item.Price,
				Image:       req.Item.Image,
				Description: req.Item.Description,
				VendorID:    req.VendorID,
				ShopID:      req.ShopID,
				MenuRef:     menuRef,
			})
		}

		// รวมยอด
		var total float64
		for _, it := range cart.Items {
			total += float64(it.Qty) * it.Price
		}
		cart.Total = total
		cart.UpdatedAt = time.Now()

		// เขียนกลับด้วยคีย์ตัวเล็ก (ตรงกับ FE)
		writeData := map[string]interface{}{
			"user_id":    userRef,
			"customerId": cart.CustomerID,
			"shop_name":  req.Shop_name,
			"items":      cart.Items,
			"total":      cart.Total,
			"updatedAt":  cart.UpdatedAt,
			"shopId":     req.ShopID, // lock shop
		}
		if req.VendorID != "" {
			writeData["vendorId"] = req.VendorID
		}
		return tx.Set(ref, writeData)
	})

	if err != nil {
		if fe, ok := err.(*fiber.Error); ok && fe.Code == fiber.StatusConflict {
			return c.Status(fe.Code).JSON(fiber.Map{
				"error": "ตะกร้าถูกล็อกไว้ที่ร้านเดิม โปรดชำระ/ลบของเดิมก่อนสั่งร้านอื่น",
				"code":  "CART_SHOP_CONFLICT",
				"msg":   fe.Message,
			})
		}
		return c.Status(500).JSON(fiber.Map{"error": "failed to add to cart", "msg": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "added to cart"})
}

// POST /api/cart/checkout
// Body: { userId, customerId }
func CheckoutCartFromDB(c *fiber.Ctx) error {
	type Req struct {
		UserID     string `json:"userId"`
		CustomerID string `json:"customerId"`
	}
	var req Req
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "BodyParser error", "msg": err.Error()})
	}
	if strings.TrimSpace(req.UserID) == "" || strings.TrimSpace(req.CustomerID) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "userId/customerId is required"})
	}

	cartRef := config.Client.Collection("cart").Doc(req.CustomerID)
	userRef := config.Client.Collection("users").Doc(req.UserID)

	var createdHistoryID string

	err := config.Client.RunTransaction(config.Ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		// load cart
		cs, err := tx.Get(cartRef)
		if err != nil || !cs.Exists() {
			return fiber.NewError(fiber.StatusNotFound, "cart not found")
		}
		var cart struct {
			CustomerID string                   `firestore:"customerId"`
			UserIDPath interface{}              `firestore:"user_id"`
			ShopID     string                   `firestore:"shopId"`
			ShopName   string                   `firestore:"shop_name"`
			Items      []map[string]interface{} `firestore:"items"`
			Total      interface{}              `firestore:"total"`
		}
		if err := cs.DataTo(&cart); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "invalid cart data")
		}
		if len(cart.Items) == 0 {
			return fiber.NewError(fiber.StatusBadRequest, "cart empty")
		}

		// recompute total
		var recomputed float64
		for _, it := range cart.Items {
			price := toFloat(it["price"])
			if price == 0 {
				price = toFloat(it["Price"])
			}
			qty := toInt(it["qty"])
			if qty == 0 {
				qty = toInt(it["Qty"])
			}
			if price > 0 && qty > 0 {
				recomputed += price * float64(qty)
			}
		}
		if recomputed <= 0 {
			recomputed = toFloat(cart.Total) // fallback
		}
		if recomputed <= 0 {
			return fiber.NewError(fiber.StatusBadRequest, "cannot compute total")
		}

		// check user balance
		us, err := tx.Get(userRef)
		if err != nil || !us.Exists() {
			return fiber.NewError(fiber.StatusNotFound, "user not found")
		}
		var currentCost float64
		if v, ok := us.Data()["Cost"]; ok && v != nil {
			switch t := v.(type) {
			case int64:
				currentCost = float64(t)
			case int:
				currentCost = float64(t)
			case float64:
				currentCost = t
			case string:
				currentCost = toFloat(t)
			default:
				return fiber.NewError(fiber.StatusInternalServerError, "invalid Cost type on user")
			}
		}
		if currentCost < recomputed {
			return fiber.NewError(402, fmt.Sprintf("insufficient funds: have %.2f, need %.2f", currentCost, recomputed))
		}

		// create history (orders collection level-top)
		historyRef := config.Client.Collection("orders").NewDoc()
		createdHistoryID = historyRef.ID
		if err := tx.Set(historyRef, map[string]interface{}{
			"historyId":  createdHistoryID,
			"userId":     req.UserID,
			"userRef":    userRef,
			"customerId": req.CustomerID,
			"shopId":     cart.ShopID,
			"shop_name":  cart.ShopName,
			"items":      cart.Items,
			"total":      recomputed,
			"status":     "prepare",
			"createdAt":  time.Now(),
			"updatedAt":  time.Now(),
		}); err != nil {
			return err
		}

		// charge user
		if err := tx.Update(userRef, []firestore.Update{
			{Path: "Cost", Value: currentCost - recomputed},
			{Path: "updatedAt", Value: time.Now()},
		}); err != nil {
			return err
		}

		// clear cart
		return tx.Set(cartRef, map[string]interface{}{
			"user_id":    cart.UserIDPath,
			"customerId": req.CustomerID,
			"shopId":     "",
			"shop_name":  "",
			"items":      []interface{}{},
			"total":      0,
			"updatedAt":  time.Now(),
		}, firestore.MergeAll)
	})

	if err != nil {
		if fe, ok := err.(*fiber.Error); ok {
			return c.Status(fe.Code).JSON(fiber.Map{"error": fe.Message})
		}
		return c.Status(500).JSON(fiber.Map{"error": "checkout failed", "msg": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":   "history created & user charged & cart cleared",
		"historyId": createdHistoryID,
	})
}

// PATCH /api/cart/qty
// body: { vendorId, shopId, customerId, menuId, qty }
func UpdateCartQty(c *fiber.Ctx) error {
	var req models.UpdateQtyRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "BodyParser error", "msg": err.Error()})
	}
	if req.CustomerID == "" || req.MenuID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "customerId/menuId is required"})
	}

	ref := topCartDoc(req.CustomerID)

	err := config.Client.RunTransaction(config.Ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snap, err := tx.Get(ref)
		if err != nil || !snap.Exists() {
			return fiber.ErrNotFound
		}
		var cart models.Cart
		if err := snap.DataTo(&cart); err != nil {
			return err
		}

		// หา item ตาม menuId (== CartItem.ID)
		idx := -1
		for i, it := range cart.Items {
			if it.ID == req.MenuID {
				idx = i
				break
			}
		}
		if idx == -1 {
			return fiber.ErrNotFound
		}

		// ปรับรายการ
		if req.Qty <= 0 {
			// ลบรายการ
			cart.Items = append(cart.Items[:idx], cart.Items[idx+1:]...)
		} else {
			// อัปเดตจำนวน
			cart.Items[idx].Qty = req.Qty
			// meta optional
			if cart.Items[idx].VendorID == "" && req.VendorID != "" {
				cart.Items[idx].VendorID = req.VendorID
			}
			if cart.Items[idx].ShopID == "" && req.ShopID != "" {
				cart.Items[idx].ShopID = req.ShopID
			}
		}

		// รวมยอด
		var total float64
		for _, it := range cart.Items {
			total += float64(it.Qty) * it.Price
		}

		updates := []firestore.Update{
			{Path: "customerId", Value: cart.CustomerID},
			{Path: "items", Value: cart.Items},
			{Path: "total", Value: total},
			{Path: "updatedAt", Value: time.Now()},
		}

		// ถ้าตะกร้าว่าง → ล้างชื่อร้าน
		if len(cart.Items) == 0 || total <= 0 {
			updates = append(updates, firestore.Update{Path: "shop_name", Value: ""})
		}

		return tx.Update(ref, updates)
	})

	if err != nil {
		if err == fiber.ErrNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "cart or item not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "update qty failed", "msg": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "ok"})
}
