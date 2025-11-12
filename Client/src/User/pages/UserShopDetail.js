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
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { BaseColor as c } from "../../components/Color";
import { api } from "../../api/axios";
import { Ionicons } from "@expo/vector-icons";
import { useSelector } from "react-redux";

const pad2 = (n) => String(n).padStart(2, "0");

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

  const [reserveVisible, setReserveVisible] = useState(false);
  const [reserveDate, setReserveDate] = useState("");
  const [reservePeople, setReservePeople] = useState("2");
  const [reserveNote, setReserveNote] = useState("");
  const [submittingReserve, setSubmittingReserve] = useState(false);

  const openReserve = useCallback(() => {
    if (!shop?.status) {
      Alert.alert("จองไม่ได้", "ร้านปิดอยู่ตอนนี้");
      return;
    }
    if (!shop?.reserve_active) {
      Alert.alert("ปิดรับจอง", "ร้านนี้ยังไม่เปิดรับการจอง");
      return;
    }
    setReserveVisible(true);
  }, [shop]);

  const parseYMD = (s) => {
    try {
      const [yy, mm, dd] = s.split("-").map(Number);
      if (!yy || !mm || !dd) return null;
      const d = new Date(yy, (mm || 1) - 1, dd || 1);
      if (d.getFullYear() !== yy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
      return d;
    } catch {
      return null;
    }
  };

  const buildRFC3339Local = (ymd, hour = 12, minute = 0, second = 0) => {
    const d = parseYMD(ymd);
    if (!d) return null;
    const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute, second, 0);
    const tzMin = -local.getTimezoneOffset();
    const sign = tzMin >= 0 ? "+" : "-";
    const abs = Math.abs(tzMin);
    const hh = pad2(Math.floor(abs / 60));
    const mm = pad2(abs % 60);
    const yyyy = local.getFullYear();
    const MM = pad2(local.getMonth() + 1);
    const dd = pad2(local.getDate());
    const HH = pad2(local.getHours());
    const mi = pad2(local.getMinutes());
    const ss = pad2(local.getSeconds());
    return `${yyyy}-${MM}-${dd}T${HH}:${mi}:${ss}${sign}${hh}:${mm}`;
  };

  const validateWithin7Days = (dStr) => {
    const d = parseYMD(dStr);
    if (!d) return { ok: false, reason: "รูปแบบวันที่ไม่ถูกต้อง" };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const chosen = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.floor((chosen - today) / 86400000);
    if (diffDays < 0) return { ok: false, reason: "ห้ามเลือกวันย้อนหลัง" };
    if (diffDays > 7) return { ok: false, reason: "จองล่วงหน้าได้ไม่เกิน 7 วัน" };
    return { ok: true };
  };

  const submitReserve = useCallback(async () => {
    try {
      if (!reserveDate) {
        Alert.alert("กรอกไม่ครบ", "กรุณาระบุวันที่ (รูปแบบ YYYY-MM-DD)");
        return;
      }
      const val = validateWithin7Days(reserveDate);
      if (!val.ok) {
        Alert.alert("วันที่ไม่ถูกต้อง", val.reason);
        return;
      }
      const startAt = buildRFC3339Local(reserveDate, 12, 0, 0);
      if (!startAt) {
        Alert.alert("รูปแบบไม่ถูกต้อง", "โปรดใช้รูปแบบวันที่ YYYY-MM-DD");
        return;
      }
      const people = Math.max(1, parseInt(reservePeople, 10) || 1);
      const payload = {
        user_id: Auth.user,
        startAt,
        people,
        note: reserveNote || "",
      };
      setSubmittingReserve(true);
      await api.post(`/shops/${shop?.id}/reservations`, payload);
      setReserveVisible(false);
      setReserveDate("");
      setReservePeople("2");
      setReserveNote("");
      Alert.alert("ส่งคำขอจองแล้ว", "โปรดรอร้านยืนยัน");
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "จองไม่สำเร็จ";
      Alert.alert("ผิดพลาด", String(msg));
    } finally {
      setSubmittingReserve(false);
    }
  }, [Auth, shop, reserveDate, reservePeople, reserveNote]);

  useLayoutEffect(() => {
    nav.setOptions({
      title: shop?.shop_name ? shop.shop_name : "รายละเอียดร้าน",
      headerTitleAlign: "center",
      headerStyle: { backgroundColor: c.S2 },
      headerTitleStyle: { color: c.fullwhite, fontWeight: "600" },
      headerTintColor: c.fullwhite,
      headerRight: () => (
        <Pressable
          onPress={openReserve}
          disabled={!shop?.reserve_active}
          style={({ pressed }) => [
            {
              opacity: !shop?.reserve_active ? 0.5 : pressed ? 0.7 : 1,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.15)",
              marginRight: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            },
          ]}
        >
          <Ionicons name="calendar" size={18} color={c.fullwhite} />
          <Text style={{ color: c.fullwhite, fontWeight: "700" }}>จอง</Text>
        </Pressable>
      ),
    });
  }, [nav, shop, openReserve]);

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
      const customerId = Auth.user;
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
      setCartShopId(res?.data?.shopId || "");
    } catch (e) {
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
          shop_name: shop?.shop_name || "",
          shopId: shop?.id || "",
          customerId: Auth.user,
          qty: n,
          item: {
            menuId: selectedMenu?.id,
            name: selectedMenu?.name,
            price: selectedMenu?.price,
            image: selectedMenu?.image,
            description: selectedMenu?.description,
          },
        };
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
        const msg = e?.response?.data?.error || e?.message || "เพิ่มตะกร้าไม่สำเร็จ";
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
          <Image source={{ uri: shop.image || placeholder }} style={styles.cover} />
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
                พิกัด: <Text style={styles.bold}>{shop.address.latitude}, {shop.address.longitude}</Text>
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
                <Pressable key={m.id} style={styles.menuCard} onPress={() => onPressMenuItem(m)}>
                  <Image source={{ uri: m.image || placeholder }} style={styles.menuImg} />
                  <View style={styles.menuInfo}>
                    <Text numberOfLines={1} style={styles.menuName}>{m.name}</Text>
                    <Text numberOfLines={2} style={styles.menuDesc}>{m.description}</Text>
                    <Text style={styles.menuPrice}>{fmtTHB(m.price)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        transparent
        visible={reserveVisible}
        animationType="fade"
        onRequestClose={() => setReserveVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setReserveVisible(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.reserveSheet}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <Text style={styles.modalTitle}>จองร้าน</Text>
            <Text style={styles.modalSubtitle}>{shop?.shop_name}</Text>

            <View style={{ gap: 10 }}>
              <View>
                <Text style={styles.inputLabel}>วันที่ (YYYY-MM-DD) • จองได้ไม่เกิน 7 วันล่วงหน้า</Text>
                <TextInput
                  value={reserveDate}
                  onChangeText={(t) => setReserveDate(t.trim())}
                  placeholder="เช่น 2025-11-15"
                  style={styles.textInput}
                  inputMode="numeric"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>จำนวนคน</Text>
                <TextInput
                  value={reservePeople}
                  onChangeText={(t) =>
                    setReservePeople((t || "1").replace(/[^0-9]/g, "") || "1")
                  }
                  style={styles.textInput}
                  keyboardType="number-pad"
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>บันทึกเพิ่มเติม (ไม่บังคับ)</Text>
                <TextInput
                  value={reserveNote}
                  onChangeText={setReserveNote}
                  style={[styles.textInput, { height: 80, textAlignVertical: "top" }]}
                  placeholder="เช่น ขอโต๊ะริมหน้าต่าง"
                  multiline
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setReserveVisible(false)}
                style={[styles.modalBtn, { backgroundColor: "#e5e7eb" }]}
                disabled={submittingReserve}
              >
                <Text style={[styles.modalBtnTxt, { color: "#111827" }]}>ยกเลิก</Text>
              </Pressable>

              <Pressable
                onPress={submitReserve}
                style={[styles.modalBtn, { backgroundColor: c.S2 }]}
                disabled={submittingReserve}
              >
                <Text style={[styles.modalBtnTxt, { color: c.fullwhite }]}>
                  {submittingReserve ? "กำลังส่ง..." : "ยืนยันจอง"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  reserveSheet: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: c.fullwhite,
    borderRadius: 16,
    padding: 16,
    maxHeight: "85%",
  },
  modalTitle: { fontWeight: "800", fontSize: 16, color: c.black },
  modalSubtitle: { color: "#64748b", marginVertical: 8 },
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
  cartBadgeTxt: { color: "white", fontSize: 10, fontWeight: "700" },
  inputLabel: { fontSize: 12, color: "#64748b", marginBottom: 6 },
  textInput: {
    height: 42,
    borderWidth: 1,
    borderColor: c.S4,
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: c.fullwhite,
  },
});
