// src/User/pages/Cart.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { api } from "../../api/axios";
import { BaseColor as c } from "../../components/Color";
import { Ionicons } from "@expo/vector-icons";
import { m } from "../../paraglide/messages";

/* ---------- helpers ---------- */
const fmtTHB = (n) =>
  (Number(n) || 0).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export default function Cart() {
  const nav = useNavigation();
  const Auth = useSelector((s) => s.auth);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [items, setItems] = useState([]); // {id,name,price,qty,image,description,shopId,...}
  const [shopName, setShopName] = useState("");
  const [shopId, setShopId] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const total = useMemo(
    () =>
      items.reduce(
        (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0),
        0
      ),
    [items]
  );

  // ---------- Navigation helper: ไปแท็บ Orders ให้ได้ไม่ว่าซ้อนยังไง ----------
  // NOTE: ถ้า RootStack ของคุณตั้งชื่อหน้าที่ห่อ Tab ว่าอย่างอื่น (เช่น "U_ButtonNav")
  // ให้เปลี่ยน "UserTabs" ด้านล่างให้ตรงกับชื่อหน้าจริงใน RootStack
  const gotoOrders = useCallback(() => {
    const parent = nav.getParent?.();
    const parentHasOrders = parent?.getState?.()?.routeNames?.includes("Orders");
    const selfHasOrders = nav.getState?.()?.routeNames?.includes("Orders");

    if (parentHasOrders) {
      // Cart อยู่ใต้ Tab เดียวกัน
      parent.navigate("Orders");
      return;
    }
    if (selfHasOrders) {
      // (กรณีน้อย) navigator ปัจจุบันมี Orders
      nav.navigate("Orders");
      return;
    }
    // RootStack → Tab
    // เปลี่ยน "UserTabs" ให้ตรงกับชื่อหน้าที่ห่อ BottomTab ของผู้ใช้
    nav.navigate("UserTabs", { screen: "Orders" });
  }, [nav]);

  // ---------- Data ----------
  const fetchCart = useCallback(async () => {
    try {
      setErr(null);
      if (!refreshing) setLoading(true);
      const customerId = Auth.user;
      if (!customerId) throw new Error(m.unauthorized());

      const res = await api.get("/cart", { params: { customerId } });
      const data = res?.data || {};
      const list = Array.isArray(data.items) ? data.items : [];

      setItems(
        list.map((x) => ({
          id: x.id, // == menuId
          name: x.name,
          price: Number(x.price) || 0,
          qty: Number(x.qty) || 0,
          image: x.image,
          description: x.description,
          shopId: x.shopId,
          vendorId: x.vendorId,
        }))
      );
      setShopName(data.shop_name || "");
      setShopId(data.shopId || "");
      setUpdatedAt(data.updatedAt || null);
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || m.shop_not_found());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [Auth?.user, refreshing]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCart().catch(() => {});
  }, [fetchCart]);

  // --- optimistic update helpers ---
  const applyQtyLocal = (menuId, nextQty) => {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === menuId);
      if (idx === -1) return prev;
      const clone = [...prev];
      if (nextQty <= 0) clone.splice(idx, 1);
      else clone[idx] = { ...clone[idx], qty: nextQty };
      return clone;
    });
  };

  const updateQty = async (menuId, nextQty) => {
    const customerId = Auth.user;
    try {
      applyQtyLocal(menuId, nextQty); // optimistic
      await api.patch("/cart/qty", {
        customerId,
        menuId,
        qty: Number(nextQty) || 0,
      });
    } catch (e) {
      await fetchCart(); // rollback by reload
      const msg =
        e?.response?.data?.error || e?.message || m.add_to_cart_invalid_qty();
      Alert.alert(m.error_occurred(), msg);
    }
  };

  const increase = (it) => updateQty(it.id, (Number(it.qty) || 0) + 1);
  const decrease = (it) => updateQty(it.id, (Number(it.qty) || 0) - 1);
  const removeItem = (it) =>
    Alert.alert(m.delete(), `${m.delete()} "${it.name}" ${m.RemovefromCart()}?`, [
      { text: m.cancel() },
      { text: m.delete(), style: "destructive", onPress: () => updateQty(it.id, 0) },
    ]);

  const gotoShop = () => {
    if (!shopId) return;
    nav.navigate("UserShopDetail", { shopId });
  };

  const checkout = async () => {
    const userId = Auth.user;
    const customerId = Auth.user;
    if (!userId || !customerId) {
      Alert.alert(m.unauthorized(), m.MustLogin());
      return;
    }
    if (items.length === 0) {
      Alert.alert("ตะกร้าว่าง", "ยังไม่มีสินค้าในตะกร้า");
      return;
    }

    try {
      setCheckingOut(true);
      const res = await api.post("/cart/checkout", { userId, customerId });
      const historyId = res?.data?.historyId;

      // เคลียร์ตะกร้า (ตอบสนองไว)
      setItems([]);
      setUpdatedAt(new Date().toISOString());

      Alert.alert(
        "ชำระเงินสำเร็จ",
        `สร้างรายการสั่งซื้อเรียบร้อย\nเลขที่: ${historyId || "-"}`,
        [{ text: "ตกลง", onPress: gotoOrders }]
      );
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "ชำระเงินไม่สำเร็จ";
      Alert.alert("ผิดพลาด", msg);
    } finally {
      setCheckingOut(false);
    }
  };

  // ---------- UI ----------
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={c.S2} />
        <Text style={{ color: c.S5, marginTop: 8 }}>กำลังโหลดตะกร้า...</Text>
      </View>
    );
  }
  if (err) {
    return (
      <View style={styles.center}>
        <Text style={{ color: c.black, marginBottom: 12 }}>
          เกิดข้อผิดพลาด: {String(err)}
        </Text>
        <Pressable style={styles.primaryBtn} onPress={fetchCart}>
          <Text style={styles.primaryBtnTxt}>ลองใหม่</Text>
        </Pressable>
      </View>
    );
  }

  const Empty = () => (
    <View style={styles.emptyWrap}>
      <Ionicons name="cart-outline" size={48} color="#94a3b8" />
      <Text style={styles.emptyTxt}>ตะกร้ายังว่างเปล่า</Text>
      <Pressable style={[styles.ghostBtn]} onPress={() => nav.goBack()}>
        <Text style={[styles.ghostBtnTxt]}>เลือกสินค้าเพิ่ม</Text>
      </Pressable>
    </View>
  );

  const Header = () => (
    <View style={styles.headerWrap}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>ตะกร้าสินค้า</Text>
        {!!shopName && (
          <Pressable onPress={gotoShop}>
            <Text style={styles.subTitle}>
              ร้าน: <Text style={{ fontWeight: "800" }}>{shopName}</Text>
            </Text>
            <Text style={styles.subHint}>แตะเพื่อกลับไปหน้าร้าน</Text>
          </Pressable>
        )}
      </View>
      <Ionicons name="bag" size={28} color={c.S2} />
    </View>
  );

  const Footer = () => (
    <View style={styles.footer}>
      <View style={{ flex: 1 }}>
        <Text style={styles.totalLabel}>ยอดรวม</Text>
        <Text style={styles.totalPrice}>{fmtTHB(total)}</Text>
      </View>

      <Pressable
        style={[
          styles.primaryBtn,
          {
            minWidth: 160,
            backgroundColor: checkingOut ? "#9ca3af" : c.S2,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          },
        ]}
        onPress={!checkingOut ? checkout : undefined}
        disabled={checkingOut}
      >
        {checkingOut && <ActivityIndicator size="small" color={c.fullwhite} />}
        <Text style={styles.primaryBtnTxt}>
          {checkingOut ? "กำลังชำระ..." : "ชำระเงิน"}
        </Text>
      </Pressable>
    </View>
  );

  const renderItem = ({ item }) => (
    <View style={styles.itemCard}>
      <Image source={{ uri: item.image }} style={styles.itemImg} />
      <View style={{ flex: 1 }}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        {!!item.description && (
          <Text style={styles.itemDesc} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <Text style={styles.itemPrice}>{fmtTHB(item.price)}</Text>

        <View style={styles.rowBetween}>
          <View style={styles.qtyBox}>
            <Pressable style={styles.qtyBtn} onPress={() => decrease(item)}>
              <Text style={styles.qtyBtnTxt}>−</Text>
            </Pressable>
            <Text style={styles.qtyTxt}>{item.qty}</Text>
            <Pressable style={styles.qtyBtn} onPress={() => increase(item)}>
              <Text style={styles.qtyBtnTxt}>+</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => removeItem(item)} style={styles.removeBtn}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
            <Text style={styles.removeTxt}>ลบ</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header />
      <FlatList
        data={items}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 120,
          flexGrow: 1,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={<Empty />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[c.S2]}
            progressViewOffset={Platform.OS === "android" ? 64 : 0}
          />
        }
      />
      {items.length > 0 && <Footer />}
    </View>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.fullwhite },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  headerWrap: {
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: { fontSize: 20, fontWeight: "800", color: c.black },
  subTitle: { color: "#334155", marginTop: 2 },
  subHint: { color: "#94a3b8", fontSize: 12 },

  itemCard: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "white",
  },
  itemImg: {
    width: 84,
    height: 84,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  itemName: { fontWeight: "800", color: c.black },
  itemDesc: { color: "#64748b", marginTop: 2 },
  itemPrice: { color: c.S2, fontWeight: "800", marginTop: 6 },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  qtyBox: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnTxt: { fontSize: 18, fontWeight: "900", color: c.black },
  qtyTxt: {
    minWidth: 26,
    textAlign: "center",
    fontWeight: "800",
    color: c.black,
  },

  removeBtn: { flexDirection: "row", alignItems: "center", gap: 6, padding: 6 },
  removeTxt: { color: "#ef4444", fontWeight: "700" },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  totalLabel: { color: "#64748b", fontSize: 12 },
  totalPrice: { color: c.black, fontSize: 18, fontWeight: "900" },

  primaryBtn: {
    backgroundColor: c.S2,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnTxt: { color: c.fullwhite, fontWeight: "800" },

  ghostBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginTop: 8,
  },
  ghostBtnTxt: { color: "#0f172a", fontWeight: "700" },

  emptyWrap: { alignItems: "center", gap: 8, marginTop: 60 },
  emptyTxt: { color: "#64748b", marginTop: 8 },
});
