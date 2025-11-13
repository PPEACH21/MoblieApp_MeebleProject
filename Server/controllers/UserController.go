package controllers

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/PPEACH21/MoblieApp_MeebleProject/config"
	"github.com/PPEACH21/MoblieApp_MeebleProject/models"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"google.golang.org/api/iterator"
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
	// รับ payload หลัก
	var req models.AddToCartRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "BodyParser error", "msg": err.Error(),
		})
	}

	// รองรับกรณี FE ส่ง shopName แทน shop_name
	// (อ่านทับอีกครั้งเฉพาะฟิลด์ shopName)
	var alias struct {
		ShopName string `json:"shopName"`
	}
	_ = c.BodyParser(&alias)
	if strings.TrimSpace(req.Shop_name) == "" && strings.TrimSpace(alias.ShopName) != "" {
		req.Shop_name = alias.ShopName
	}

	// ตรวจ required fields แบบที่คุณต้องการจริง ๆ
	missing := []string{}
	if strings.TrimSpace(req.CustomerID) == "" {
		missing = append(missing, "customerId")
	}
	if strings.TrimSpace(req.ShopID) == "" {
		missing = append(missing, "shopId")
	}
	if strings.TrimSpace(req.Shop_name) == "" {
		missing = append(missing, "shop_name")
	}
	if strings.TrimSpace(req.Item.MenuID) == "" {
		missing = append(missing, "item.menuId")
	}
	if req.Qty <= 0 {
		missing = append(missing, "qty (> 0)")
	}
	if len(missing) > 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing required fields",
			"missing": missing,
			"exampleBody": map[string]any{
				"customerId": "user123",
				"shopId":     "9WRq2etVYWSISP1pJUAS",
				"shop_name":  "TOWN in TOWN",
				"item": map[string]any{
					"menuId":      "LW0EwC50rlKk4cZ4SZkH",
					"name":        "กุ้งๆๆๆ",
					"price":       200,
					"image":       "https://...",
					"description": "กุ้งๆๆ",
				},
				"qty": 1,
			},
			"note": "รองรับทั้ง shop_name และ shopName; qty ต้องมากกว่า 0",
		})
	}

	ref := topCartDoc(req.CustomerID)

	err := config.Client.RunTransaction(config.Ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		// โหลดตะกร้าเดิม
		var cart models.Cart
		snap, err := tx.Get(ref)
		if err != nil || !snap.Exists() {
			cart = models.Cart{
				CustomerID: req.CustomerID,
				Shop_name:  req.Shop_name,
				ShopID:     req.ShopID,
				Items:      []models.CartItem{},
				Total:      0,
				UpdatedAt:  time.Now(),
			}
		} else if err := snap.DataTo(&cart); err != nil {
			return err
		}

		// 🔒 ล็อกตะกร้าให้สั่งได้จากร้านเดียว
		existingShop := cart.ShopID
		incomingShop := req.ShopID
		if len(cart.Items) > 0 {
			if existingShop == "" && incomingShop != "" {
				existingShop = incomingShop
			}
			if incomingShop == "" || existingShop == "" || existingShop != incomingShop {
				return fiber.NewError(
					fiber.StatusConflict,
					fmt.Sprintf("CART_SHOP_CONFLICT: cart locked to shop=%s, incoming shop=%s", existingShop, incomingShop),
				)
			}
		}
		// อัปเดตข้อมูลระดับ cart ให้ตรงกับร้านที่กำลังสั่ง
		cart.ShopID = req.ShopID
		cart.Shop_name = req.Shop_name

		// รวมรายการซ้ำ (ตาม shopId + menuId)
		found := false
		for i := range cart.Items {
			if cart.Items[i].ShopID == req.ShopID && cart.Items[i].ID == req.Item.MenuID {
				cart.Items[i].Qty += req.Qty
				// อัปเดตราคา/ชื่อ/รูป/คำอธิบาย ถ้าส่งมา
				if req.Item.Price > 0 {
					cart.Items[i].Price = req.Item.Price
				}
				if req.Item.Name != "" && cart.Items[i].Name == "" {
					cart.Items[i].Name = req.Item.Name
				}
				if req.Item.Image != "" && cart.Items[i].Image == "" {
					cart.Items[i].Image = req.Item.Image
				}
				if req.Item.Description != "" && cart.Items[i].Description == "" {
					cart.Items[i].Description = req.Item.Description
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
				ShopID:      req.ShopID,
				// VendorID/MenuRef ไม่ใช้แล้ว -> ปล่อยว่าง
			})
		}

		// คำนวณยอดรวมใหม่
		var total float64
		for _, it := range cart.Items {
			total += float64(it.Qty) * it.Price
		}
		cart.Total = total
		cart.UpdatedAt = time.Now()

		// เขียนกลับเฉพาะฟิลด์ที่ FE ใช้จริง
		writeData := map[string]interface{}{
			"customerId": cart.CustomerID,
			"shopId":     cart.ShopID,
			"shop_name":  cart.Shop_name,
			"items":      cart.Items,
			"total":      cart.Total,
			"updatedAt":  cart.UpdatedAt,
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
func toLimit(v string, def int) int {
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return def
	}
	if n > 200 {
		n = 200
	}
	return n
}

func ListUserHistory(c *fiber.Ctx) error {
	userId := c.Params("userId")
	if userId == "" {
		return c.Status(400).JSON(fiber.Map{"error": "userId required"})
	}
	status := c.Query("status", "")             // เช่น completed, canceled
	limit := toLimit(c.Query("limit"), 20)      // default 20
	startAfterId := c.Query("startAfterId", "") // ใช้ doc id ทำหน้า next page

	col := config.Client.Collection("users").Doc(userId).Collection("history")

	// เลือก field สำหรับ sort: ถ้ามี movedToHistoryAt ให้ใช้เป็นหลัก
	// (ถ้าบางเอกสารไม่มี ฟังก์ชันนี้ยังดึงได้ เพราะเรา fallback ด้วย get field จาก snapshot เดิม)
	q := col.OrderBy("movedToHistoryAt", firestore.Desc).Limit(limit)
	if status != "" {
		q = q.Where("status", "==", status)
	}

	// pagination
	if startAfterId != "" {
		snap, err := col.Doc(startAfterId).Get(config.Ctx)
		if err == nil {
			// ใช้ค่า movedToHistoryAt ของ doc ที่อ้างอิงเป็น anchor
			mv := snap.Data()["movedToHistoryAt"]
			q = q.StartAfter(mv)
		}
	}

	iter := q.Documents(config.Ctx)
	defer iter.Stop()

	out := make([]models.HistoryItem, 0, limit)
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		var it models.HistoryItem
		if err := doc.DataTo(&it); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "parse error: " + err.Error()})
		}
		// fallback: ถ้าไม่มี movedToHistoryAt (เวอร์ชันเก่า)
		if it.MovedToHistoryAt.IsZero() {
			// ใช้ updatedAt ถ้าไม่มีอีก ใช้ createdAt
			if !it.UpdatedAt.IsZero() {
				it.MovedToHistoryAt = it.UpdatedAt
			} else if !it.CreatedAt.IsZero() {
				it.MovedToHistoryAt = it.CreatedAt
			}
		}
		it.ID = doc.Ref.ID
		out = append(out, it)
	}

	return c.JSON(fiber.Map{
		"userId":  userId,
		"history": out,
	})
}

func UpdateProfile(c *fiber.Ctx) error {
	userID := c.Params("id")
	var newdata models.User
	if err := c.BodyParser(&newdata); err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("cannot parse JSON")
	}

	docRef := config.User.Doc(userID)
	docSnap, err := docRef.Get(config.Ctx)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "user not found",
		})
	}

	var dbuser models.User
	if err := docSnap.DataTo(&dbuser); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to parse existing data",
		})
	}

	updateData := make(map[string]interface{})
	if newdata.Firstname != "" && newdata.Firstname != dbuser.Firstname {
		updateData["firstname"] = newdata.Firstname
	}
	if newdata.Lastname != "" && newdata.Lastname != dbuser.Lastname {
		updateData["lastname"] = newdata.Lastname
	}
	if newdata.Avatar != "" && newdata.Avatar != dbuser.Avatar {
		updateData["avatar"] = newdata.Avatar
	}

	if len(updateData) == 0 {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"message": "no changes detected",
			"user":    dbuser,
		})
	}

	_, err = docRef.Set(config.Ctx, updateData, firestore.MergeAll)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to update user",
		})
	}

	for key, val := range updateData {
		switch key {
		case "Firstname":
			dbuser.Firstname = val.(string)
		case "Lastname":
			dbuser.Lastname = val.(string)
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "profile updated successfully",
		"user":    dbuser,
	})
}
func GetUserReservations(c *fiber.Ctx) error {
	userId := c.Params("userId")
	if userId == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "userId required",
		})
	}

	ctx := config.Ctx
	client := config.Client

	q := client.Collection("users").Doc(userId).Collection("reservations")
	docs, err := q.Documents(ctx).GetAll()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to query reservations",
			"msg":   err.Error(),
		})
	}

	out := make([]models.Reservation, 0, len(docs))
	for _, doc := range docs {
		var r models.Reservation
		if err := doc.DataTo(&r); err != nil {
			continue
		}

		if r.ID == "" {
			r.ID = doc.Ref.ID
		}

		out = append(out, r)
	}

	return c.JSON(fiber.Map{
		"ok":    true,
		"items": out,
	})
}
func GetShopNameById(c *fiber.Ctx) error {
	shopId := c.Params("shopId")
	if shopId == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "shopId required",
		})
	}

	doc, err := config.Client.Collection("shops").Doc(shopId).Get(config.Ctx)
	if err != nil || !doc.Exists() {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"error": "shop not found",
		})
	}

	// อ่าน field 'name'
	name, err := doc.DataAt("name")
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "name field missing in shop doc",
		})
	}

	return c.JSON(fiber.Map{
		"shop_id":   shopId,
		"shop_name": name,
	})
}
