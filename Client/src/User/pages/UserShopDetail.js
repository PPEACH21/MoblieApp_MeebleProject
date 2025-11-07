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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BaseColor as c } from "../../components/Color";
import { api } from "../../axios";

/* ---------- helpers ---------- */
const toNum = (v) => (typeof v === "number" ? v : Number(v) || 0);
const fmtTHB = (n) =>
  (Number(n) || 0).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const normalizeShop = (raw) => ({
  id: raw.id || raw.shop_id || raw.shopId || raw.docId,
  shop_name: raw.shop_name || raw.name || "ร้านไม่ระบุชื่อ",
  description: raw.description || "",
  type: raw.type || "-",
  status: raw.status || "active",
  image: raw.image || raw.cover || raw.thumbnail || null,
  price_min: raw.price_min ?? raw.min_price ?? null,
  price_max: raw.price_max ?? raw.max_price ?? null,
  rate: toNum(raw.rate ?? raw.rating ?? 0),
  order_active: !!(raw.order_active ?? raw.orderActive ?? true),
  // 🔥 ตัด reserve_active และทุกอย่างเกี่ยวกับการจองออกแล้ว
  address: raw.address || raw.location || null,
});

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

/* ---------- cart helpers (per shopId) ---------- */
const cartKey = (shopId) => `cart:${shopId}`;

async function loadCart(shopId) {
  try {
    const raw = await AsyncStorage.getItem(cartKey(shopId));
    return raw ? JSON.parse(raw) : { items: [], totalQty: 0, total: 0 };
  } catch {
    return { items: [], totalQty: 0, total: 0 };
  }
}

async function saveCart(shopId, cart) {
  await AsyncStorage.setItem(cartKey(shopId), JSON.stringify(cart));
}

async function addToCart(shopId, menuItem, qty) {
  const n = Math.max(1, Number(qty) || 1);
  const cart = await loadCart(shopId);

  const idx = cart.items.findIndex((it) => it.id === menuItem.id);
  if (idx >= 0) {
    cart.items[idx].qty += n;
    cart.items[idx].subtotal = cart.items[idx].qty * cart.items[idx].price;
  } else {
    cart.items.push({
      id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      image: menuItem.image,
      qty: n,
      subtotal: n * menuItem.price,
    });
  }

  cart.totalQty = cart.items.reduce((s, it) => s + it.qty, 0);
  cart.total = cart.items.reduce((s, it) => s + it.subtotal, 0);

  await saveCart(shopId, cart);
  return cart;
}

/* ---------- main component ---------- */
export default function UserShopDetail() {
  const nav = useNavigation();
  const route = useRoute();
  const initShop = route.params?.shop || null;
  const shopId = route.params?.shopId || initShop?.id;

  const [shop, setShop] = useState(initShop ? normalizeShop(initShop) : null);
  const [loading, setLoading] = useState(!initShop);
  const [err, setErr] = useState(null);
  const [menus, setMenus] = useState([]);
  const [menusLoading, setMenusLoading] = useState(true);
  const [menusErr, setMenusErr] = useState(null);

  const [qtyModalVisible, setQtyModalVisible] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [qty, setQty] = useState("1");

  // cart state (derived from storage)
  const [cartSummary, setCartSummary] = useState({ totalQty: 0, total: 0 });

  useLayoutEffect(() => {
    nav.setOptions({
      title: shop?.shop_name ? shop.shop_name : "รายละเอียดร้าน",
      headerTitleAlign: "center",
      headerStyle: { backgroundColor: c.S2 },
      headerTitleStyle: { color: c.fullwhite, fontWeight: "600" },
      headerTintColor: c.fullwhite,
    });
  }, [nav, shop]);

  const refreshCartSummary = useCallback(async () => {
    if (!shopId) return;
    const cart = await loadCart(shopId);
    setCartSummary({ totalQty: cart.totalQty, total: cart.total });
  }, [shopId]);

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

  useEffect(() => {
    refreshCartSummary();
  }, [refreshCartSummary]);

  const openInMaps = useCallback(() => {
    const lat = shop?.address?.latitude;
    const lng = shop?.address?.longitude;
    if (lat == null || lng == null) return;
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    Linking.openURL(url).catch(() =>
      Alert.alert("ไม่สามารถเปิดแผนที่ได้", "โปรดลองอีกครั้ง")
    );
  }, [shop]);

  const onPressMenuItem = (m) => {
    if (!m?.available) return;
    setSelectedMenu(m);
    setQty("1");
    setQtyModalVisible(true);
  };

  const handleConfirmQty = async () => {
    const n = Math.max(1, parseInt(qty, 10) || 1);
    try {
      setQtyModalVisible(false);
      await addToCart(shopId, selectedMenu, n);
      await refreshCartSummary();
      Alert.alert(
        "เพิ่มลงตะกร้าแล้ว",
        `${selectedMenu?.name} × ${n}\nราคารวมตะกร้า: ${fmtTHB(
          (cartSummary.total || 0) + (selectedMenu?.price || 0) * n
        )}`
      );
    } catch (e) {
      Alert.alert("ไม่สามารถเพิ่มตะกร้า", String(e?.message || e || "เกิดข้อผิดพลาด"));
    }
  };

  const statusBadge = useMemo(() => {
    const s = (shop?.status || "").toLowerCase();
    let bg = "#e5e7eb";
    let tx = c.black;
    if (s === "open" || s === "active") {
      bg = "#dcfce7";
      tx = "#166534";
    } else if (s === "closed") {
      bg = "#fee2e2";
      tx = "#991b1b";
    } else if (s === "pending") {
      bg = "#fef9c3";
      tx = "#854d0e";
    }
    return { bg, tx, label: shop?.status || "-" };
  }, [shop]);

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={c.S2} />
        <Text style={{ color: c.S5, marginTop: 8 }}>กำลังโหลดข้อมูลร้าน...</Text>
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
          ) : menusErr ? (
            <Text style={{ color: "#991b1b" }}>{menusErr}</Text>
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

      {/* floating mini-cart */}
      {!!cartSummary.totalQty && (
        <Pressable
          onPress={() =>
            // 🔁 เปลี่ยนชื่อ route "Cart" ให้ตรงกับของคุณ
            nav.navigate("Cart", { shopId })
          }
          style={styles.cartFloat}
        >
          <Text style={styles.cartFloatQty}>{cartSummary.totalQty}</Text>
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.cartFloatTitle}>ดูตะกร้า</Text>
            <Text style={styles.cartFloatTotal}>{fmtTHB(cartSummary.total)}</Text>
          </View>
        </Pressable>
      )}

      {/* modal เลือกจำนวน */}
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
      </Modal>
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

  // modal
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

  // floating cart
  cartFloat: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: c.black,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  cartFloatQty: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.fullwhite,
    color: c.black,
    textAlign: "center",
    textAlignVertical: "center",
    fontWeight: "800",
    overflow: "hidden",
  },
  cartFloatTitle: { color: c.fullwhite, fontWeight: "800" },
  cartFloatTotal: { color: c.fullwhite, opacity: 0.9, fontSize: 12 },
});
