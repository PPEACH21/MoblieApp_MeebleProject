// src/User/pages/UserShopDetail.jsx
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Pressable,
  Modal,
  TextInput,
  Linking,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { BaseColor as c } from "../../components/Color";
import { api } from "../../api/axios";
import { Ionicons } from "@expo/vector-icons";
import { useSelector } from "react-redux";

/* ---------- helpers ---------- */
const toNum = (v) => (typeof v === "number" ? v : Number(v) || 0);
const fmtTHB = (n) =>
  (Number(n) || 0).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const formatPriceRange = (min, max) => {
  if (min == null && max == null) return "–";
  const a = toNum(min ?? max);
  const b = toNum(max ?? min);
  return a === b ? fmtTHB(a) : `${fmtTHB(a)} – ${fmtTHB(b)}`;
};

const normalizeShop = (raw) => {
  const s = (raw?.status ?? "").toString().toLowerCase();
  const isOpen = s === "open" || s === "active" || s === "true" || s === "1";

  return {
    id: raw.id || raw.shop_id || raw.shopId || raw.docId,
    shop_name: raw.shop_name || raw.name || "ร้านไม่ระบุชื่อ",
    description: raw.description || "",
    type: raw.type || "-",
    status: isOpen,
    image: raw.image || raw.cover || raw.thumbnail || null,
    price_min: raw.price_min ?? raw.min_price ?? null,
    price_max: raw.price_max ?? raw.max_price ?? null,
    rate: toNum(raw.rate ?? raw.rating ?? 0),
    order_active: !!(raw.order_active ?? raw.orderActive ?? true),
    reserve_active: !!(raw.reserve_active ?? raw.reserveActive ?? false),
    address: raw.address || raw.location || null,
  };
};

const normalizeMenuItem = (raw) => ({
  id: raw.id || raw.menu_id || raw.menuId || raw.docId,
  name: raw.name || raw.title || "เมนู",
  description: raw.description || raw.desc || "",
  price: Number(raw.price ?? raw.cost ?? 0) || 0,
  image:
    raw.image ||
    raw.photo ||
    raw.thumbnail ||
    "https://sandermechanical.com/wp-content/uploads/2016/02/shop-placeholder-300x300.png",
  available: raw.active ?? raw.available ?? true,
  category: raw.category || raw.type || null,
});

const placeholder =
  "https://sandermechanical.com/wp-content/uploads/2016/02/shop-placeholder-300x300.png";

/* ---------- main component ---------- */
export default function UserShopDetail() {
  const Auth = useSelector((s) => s.auth);
  const nav = useNavigation();
  const route = useRoute();
  const initShop = route.params?.shop || null;
  const shopId = route.params?.shopId || initShop?.id;
  const [cartCount, setCartCount] = useState(0);
  const [shop, setShop] = useState(initShop ? normalizeShop(initShop) : null);
  const [loading, setLoading] = useState(!initShop);
  const [err, setErr] = useState(null);
  const [menus, setMenus] = useState([]);
  const [menusLoading, setMenusLoading] = useState(true);
  const [menusErr, setMenusErr] = useState(null);
  const [cartShopId, setCartShopId] = useState("");
  const [qtyModalVisible, setQtyModalVisible] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [qty, setQty] = useState("1");

  useLayoutEffect(() => {
    nav.setOptions({
      title: shop?.shop_name ? shop.shop_name : "รายละเอียดร้าน",
      headerTitleAlign: "center",
      headerStyle: { backgroundColor: c.S2 },
      headerTitleStyle: { color: c.fullwhite, fontWeight: "600" },
      headerTintColor: c.fullwhite,
    });
  }, [nav, shop]);

  const fetchShop = useCallback(async () => {
    if (!shopId) return;
    try {
      setErr(null);
      setLoading(true);
      const res = await api.get(`/shop/${shopId}`);
      const found = res?.data?.shop ?? res?.data ?? null;
      if (!found) throw new Error("ไม่พบข้อมูลร้าน");
      setShop(normalizeShop(found));
    } catch (e) {
      console.log("โหลดร้านไม่สำเร็จ:", e);
      setErr(e?.response?.data?.error || e?.message || "โหลดร้านไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  const fetchMenus = useCallback(async () => {
    if (!shopId) return;
    try {
      setMenusErr(null);
      setMenusLoading(true);
      const res = await api.get(`/shop/${shopId}/menu`);
      const list = Array.isArray(res?.data?.items) ? res.data.items : [];
      const normalized = list.map(normalizeMenuItem).filter(Boolean);
      setMenus(normalized);
    } catch (e) {
      console.log("โหลดเมนูไม่สำเร็จ:", e?.message);
      setMenus([]);
      setMenusErr("โหลดเมนูไม่สำเร็จ");
    } finally {
      setMenusLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    if (!shop) fetchShop();
  }, [shop, fetchShop]);

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);
  const fetchCartCount = useCallback(async () => {
    try {
      const customerId = getCustomerId();
      if (!customerId) return;
      const res = await api.get("/cart", { params: { customerId } });
      const items = res?.data?.items || [];
      const count = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
      setCartCount(count);
    } catch {}
  }, [Auth]);

  useEffect(() => {
    fetchCartCount();
  }, [fetchCartCount]);

  const openInMaps = useCallback(() => {
    const lat = shop?.address?.latitude;
    const lng = shop?.address?.longitude;
    if (lat == null || lng == null) return;
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    Linking.openURL(url).catch(() =>
      Alert.alert("ไม่สามารถเปิดแผนที่ได้", "โปรดลองอีกครั้ง")
    );
  }, [shop]);
  const fetchCartSummary = useCallback(async () => {
    try {
      const customerId = Auth.user;
      if (!customerId) return;
      const res = await api.get("/cart", { params: { customerId } });
      const items = res?.data?.items || [];
      const count = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
      setCartCount(count);
      setCartShopId(res?.data?.shopId || ""); // ต้องให้ BE ส่ง field นี้จากเอกสาร cart
    } catch (e) {
      // เงียบไว้ ไม่ต้อง alert
      setCartCount(0);
      setCartShopId("");
    }
  }, [Auth]);
  useEffect(() => {
    fetchCartSummary();
  }, [fetchCartSummary]);

  const onPressMenuItem = (m) => {
    if (!m?.available) return;
    setSelectedMenu(m);
    setQty("1");
    setQtyModalVisible(true);
  };

  const handleConfirmQty = () => {
    const n = Math.max(1, parseInt(qty, 10) || 1);
    setQtyModalVisible(false);

    (async () => {
      try {
        if (!shop?.status) {
          Alert.alert("สั่งไม่ได้", "ร้านปิดอยู่ตอนนี้");
          return;
        }

        const payload = {
          shop_name: shop?.shop_name || "", // ✅ snake_case
          shopId: shop?.id || "",
          customerId: Auth.user,
          qty: n, // ✅ > 0
          item: {
            menuId: selectedMenu?.id, // ✅ ต้องไม่ว่าง
            name: selectedMenu?.name,
            price: selectedMenu?.price,
            image: selectedMenu?.image,
            description: selectedMenu?.description,
          },
        };
        console.log(payload);
        await api.post("/cart/add", payload);
        setCartCount((prev) => prev + n);
        Alert.alert(
          "เพิ่มลงตะกร้าแล้ว",
          `${selectedMenu?.name} × ${n}\nราคารวม: ${fmtTHB(
            (selectedMenu?.price || 0) * n
          )}`
        );
      } catch (e) {
        const code = e?.response?.status;
        const msg =
          e?.response?.data?.error || e?.message || "เพิ่มตะกร้าไม่สำเร็จ";

        if (code === 409) {
          Alert.alert(
            "ตะกร้าถูกล็อกกับร้านอื่น",
            "คุณมีสินค้าในตะกร้าจากร้านอื่นอยู่ โปรดชำระ/ลบของเดิมก่อน",
            [
              { text: "ปิด" },
              { text: "ไปตะกร้า", onPress: () => nav.navigate("Cart") },
            ]
          );
        } else {
          Alert.alert("ผิดพลาด", msg);
        }
      }
    })();
  };

  const statusBadge = useMemo(() => {
    let bg = "#e5e7eb";
    let tx = c.black;
    let label = "ไม่ระบุ";

    if (shop?.status === true) {
      bg = "#dcfce7";
      tx = "#166534";
      label = "เปิดอยู่";
    } else if (shop?.status === false) {
      bg = "#fee2e2";
      tx = "#991b1b";
      label = "ปิดอยู่";
    }
    return { bg, tx, label };
  }, [shop?.status]);

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={c.S2} />
        <Text style={{ color: c.S5, marginTop: 8 }}>
          กำลังโหลดข้อมูลร้าน...
        </Text>
      </View>
    );

  if (err)
    return (
      <View style={[styles.center, { paddingHorizontal: 24 }]}>
        <Text style={{ color: c.black, textAlign: "center", marginBottom: 12 }}>
          เกิดข้อผิดพลาด: {err}
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchShop}>
          <Text style={{ color: c.fullwhite, fontWeight: "600" }}>ลองใหม่</Text>
        </TouchableOpacity>
      </View>
    );

  return (
    <>
      <ScrollView style={styles.container}>
        <View style={styles.coverWrap}>
          <Image
            source={{ uri: shop.image || placeholder }}
            style={styles.cover}
          />
          <View style={styles.badgesRow}>
            <View style={[styles.badge, { backgroundColor: statusBadge.bg }]}>
              <Text style={[styles.badgeTxt, { color: statusBadge.tx }]}>
                สถานะ: {statusBadge.label}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{shop.shop_name}</Text>

          {shop.address?.latitude && shop.address?.longitude && (
            <Pressable onPress={openInMaps} style={styles.mapBtn}>
              <Text style={styles.grayText}>
                พิกัด:{" "}
                <Text style={styles.bold}>
                  {shop.address.latitude}, {shop.address.longitude}
                </Text>
              </Text>
              <Text style={styles.mapHint}>แตะเพื่อเปิดใน Google Maps</Text>
            </Pressable>
          )}

          <Text style={styles.sectionTitle}>เมนู</Text>
          {menusLoading ? (
            <ActivityIndicator color={c.S2} />
          ) : (
            <View style={styles.menuGrid}>
              {menus.map((m) => (
                <Pressable
                  key={m.id}
                  style={styles.menuCard}
                  onPress={() => onPressMenuItem(m)}
                >
                  <Image
                    source={{ uri: m.image || placeholder }}
                    style={styles.menuImg}
                  />
                  <View style={styles.menuInfo}>
                    <Text numberOfLines={1} style={styles.menuName}>
                      {m.name}
                    </Text>
                    <Text numberOfLines={2} style={styles.menuDesc}>
                      {m.description}
                    </Text>
                    <Text style={styles.menuPrice}>{fmtTHB(m.price)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* modal */}
      <Modal
        transparent
        visible={qtyModalVisible}
        animationType="fade"
        onRequestClose={() => setQtyModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setQtyModalVisible(false)}
        />
        <View style={styles.qtySheet}>
          <Text style={styles.modalTitle}>เลือกจำนวน</Text>
          <Text style={styles.modalSubtitle}>{selectedMenu?.name}</Text>

          <View style={styles.qtyRow}>
            <Pressable
              onPress={() =>
                setQty((v) => String(Math.max(1, (parseInt(v, 10) || 1) - 1)))
              }
              style={styles.qtyBtn}
            >
              <Text style={styles.qtyBtnTxt}>−</Text>
            </Pressable>

            <TextInput
              value={qty}
              onChangeText={(t) => setQty(t.replace(/[^0-9]/g, "") || "1")}
              keyboardType="number-pad"
              style={styles.qtyInput}
            />

            <Pressable
              onPress={() =>
                setQty((v) => String(Math.max(1, (parseInt(v, 10) || 1) + 1)))
              }
              style={styles.qtyBtn}
            >
              <Text style={styles.qtyBtnTxt}>+</Text>
            </Pressable>
          </View>

          <View style={styles.modalActions}>
            <Pressable
              onPress={() => setQtyModalVisible(false)}
              style={[styles.modalBtn, { backgroundColor: "#e5e7eb" }]}
            >
              <Text style={[styles.modalBtnTxt, { color: "#111827" }]}>
                ยกเลิก
              </Text>
            </Pressable>
            <Pressable
              onPress={handleConfirmQty}
              style={[styles.modalBtn, { backgroundColor: c.S2 }]}
            >
              <Text style={[styles.modalBtnTxt, { color: c.fullwhite }]}>
                ยืนยัน
              </Text>
            </Pressable>
          </View>
        </View>
        {/* 🛒 ปุ่มตะกร้า "ซ้อนใน Modal" เพื่อให้เห็นตลอดตอนเปิด Modal */}
        <Pressable
          onPress={() => nav.navigate("Cart")}
          style={[styles.cartFab, { bottom: 24, right: 20 }]}
        >
          <Ionicons name="cart" size={24} color={c.fullwhite} />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeTxt}>{cartCount}</Text>
            </View>
          )}
        </Pressable>
      </Modal>

      <Pressable onPress={() => nav.navigate("Cart")} style={styles.cartFab}>
        <Ionicons name="cart" size={24} color={c.fullwhite} />
        {cartCount > 0 && (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeTxt}>{cartCount}</Text>
          </View>
        )}
      </Pressable>
    </>
  );
}
/* ---------- styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.fullwhite },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  retryBtn: {
    backgroundColor: c.S2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  coverWrap: { width: "100%", aspectRatio: 16 / 9, backgroundColor: c.S3 },
  cover: { width: "100%", height: "100%" },
  badgesRow: {
    position: "absolute",
    left: 12,
    bottom: 12,
    flexDirection: "row",
    gap: 8,
  },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badgeTxt: { fontSize: 12, fontWeight: "700" },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: "800", color: c.black },
  mapBtn: {
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: c.S4,
    borderRadius: 10,
  },
  mapHint: { color: "#64748b", fontSize: 12, marginTop: 2 },
  sectionTitle: {
    fontWeight: "800",
    fontSize: 16,
    color: c.black,
    marginVertical: 10,
  },
  grayText: { color: "#475569" },
  bold: { fontWeight: "700", color: c.black },
  menuGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
  menuCard: {
    width: "50%",
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  menuImg: {
    width: "100%",
    height: 120,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: c.S3,
  },
  menuInfo: {
    borderWidth: 1,
    borderColor: c.S4,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 8,
    backgroundColor: c.fullwhite,
  },
  menuName: { fontWeight: "800", color: c.black, fontSize: 14 },
  menuDesc: { color: "#64748b", fontSize: 12, marginVertical: 2 },
  menuPrice: { color: c.S2, fontWeight: "800" },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  qtySheet: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: c.fullwhite,
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: { fontWeight: "800", fontSize: 16, color: c.black },
  modalSubtitle: { color: "#64748b", marginVertical: 8 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.S4,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnTxt: { fontSize: 22, fontWeight: "900", color: c.black },
  qtyInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: c.S4,
    borderRadius: 10,
    textAlign: "center",
    fontWeight: "700",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    gap: 10,
  },
  modalBtn: {
    minWidth: 100,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnTxt: { fontWeight: "800" },
  cartFab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    backgroundColor: c.S2,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cartBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "red",
    borderRadius: 10,
    paddingHorizontal: 5,
    minWidth: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadgeTxt: {
    color: "white",
    fontSize: 10,
    fontWeight: "700",
  },
});
