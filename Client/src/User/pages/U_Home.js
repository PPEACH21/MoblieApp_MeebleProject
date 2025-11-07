// src/User/pages/U_Home.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, FlatList, Image, TouchableOpacity, RefreshControl,
  ActivityIndicator, StyleSheet, Platform, Modal, Pressable, TextInput
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { BaseColor as c } from "../../components/Color";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../../api/axios";

const CHIP_H = 34;

const U_Home = () => {
  const navigation = useNavigation();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 🔎 ค้นหา + ท็อกเกิล
  const [query, setQuery] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [type, setType] = useState("all");
  const [typePickerVisible, setTypePickerVisible] = useState(false);

  // ✅ ต้อง return state.auth
  const auth = useSelector((state) => state.auth);

  // ✅ ดึงร้าน (แนบ Bearer ที่นี่เลย)
  const fetchShops = useCallback(async () => {
    try {
      setLoading(true);

      // 1) เตรียม Bearer token จาก Redux → AsyncStorage (เผื่อ Redux ยังไม่ทัน)
      let token = auth?.token ?? null;
      if (!token) {
        try {
          const stored = await AsyncStorage.getItem("token");
          if (stored) token = stored;
        } catch {}
      }
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      // debug สั้น ๆ (ไม่โชว์ทั้ง token)
      console.log("[U_Home] call /shops with bearer?", !!token);

      // 2) ลองหลาย endpoint ตามหลังบ้าน
      const endpoints = ["/shops", "/shop/list", "/shop", "/api/shops"];

      // 3) ช่วยแงะทรงข้อมูล
      const pickListFrom = (data) => {
        if (Array.isArray(data?.shops)) return data.shops;
        if (Array.isArray(data?.items)) return data.items;
        if (Array.isArray(data)) return data;
        if (data && typeof data === "object") {
          return Object.entries(data).map(([id, v]) => ({ id, ...(v || {}) }));
        }
        return [];
      };

      // 4) normalize ให้ใช้ต่อหน้า UI ได้เลย
      const normalize = (raw) => ({
        id: raw?.id ?? raw?.shop_id ?? raw?.shopId ?? raw?.docId ?? raw?._id ?? null,
        shop_name: raw?.shop_name ?? raw?.name ?? "ร้านไม่มีชื่อ",
        description: raw?.description ?? "",
        type: raw?.type ?? "ทั่วไป",
        status:
          typeof raw?.status === "string"
            ? raw.status
            : (raw?.state || raw?.is_open) ? "open" : "closed",
        image:
          raw?.image?.startsWith?.("http")
            ? raw.image
            : raw?.image || raw?.cover || raw?.thumbnail || null,
        price_min: raw?.price_min ?? raw?.min_price ?? null,
        price_max: raw?.price_max ?? raw?.max_price ?? null,
      });

      let list = [];
      let lastErr = null;

      for (const url of endpoints) {
        try {
          // ⬇⬇⬇ แนบ token “ในหน้านี้” ชัดเจน
          const res = await api.get(url, { headers, params: { _ts: Date.now() } });
          const raw = res?.data ?? null;
          const picked = pickListFrom(raw);
          if (Array.isArray(picked)) {
            list = picked.map(normalize).filter((x) => x && x.id);
            console.log("[U_Home] fetched from", url, "count:", list.length);
            break; // สำเร็จแล้วหยุด
          }
        } catch (e) {
          lastErr = e;
        }
      }

      setShops(list);

      // 5) ถ้า 401 ให้ล้าง token และรีเซ็ตไป Splash
      if (!list.length && lastErr?.response?.status === 401) {
        console.warn("[U_Home] 401 — token invalid/expired, go Splash");
        try { await AsyncStorage.removeItem("token"); } catch {}
        navigation.reset({ index: 0, routes: [{ name: "Splash" }] });
        return;
      }

      if (!list.length && lastErr) {
        console.warn("[U_Home] load shops error:", lastErr?.response?.status, lastErr?.message);
      }
    } catch (err) {
      console.warn("โหลดร้านไม่สำเร็จ:", err?.message);
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, [auth?.token, navigation]);

  // ✅ ยิงครั้งแรก
  useEffect(() => { fetchShops(); }, [fetchShops]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchShops();
    setRefreshing(false);
  };

  // ประเภทจากข้อมูลจริง
  const typeOptions = useMemo(() => {
    const s = new Set();
    (shops || []).forEach((it) => it?.type && s.add(String(it.type)));
    return ["all", ...Array.from(s)];
  }, [shops]);

  // กรอง
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (shops || []).filter((it) => {
      const status = (it.status || "").toLowerCase();
      const isOpen = status === "open" || status === "active";

      if (q) {
        const hay = `${it.shop_name || it.name || ""} ${it.description || ""} ${it.type || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (onlyOpen && !isOpen) return false;
      if (type !== "all" && String(it.type) !== type) return false;
      return true;
    });
  }, [shops, query, onlyOpen, type]);

  // การ์ด
  const renderShop = ({ item }) => {
    const s = (item.status || "").toLowerCase();
    const isOpen = s === "open" || s === "active";
    const isClosed = !isOpen;

    return (
      <TouchableOpacity
        style={[styles.card, isClosed && styles.cardDisabled]}
        activeOpacity={0.9}
        disabled={isClosed}
        onPress={() => navigation.navigate("UserShopDetail", { shopId: item.id, shop: item })}
      >
        <View style={styles.imageWrap}>
          <Image
            source={{
              uri: item.image?.startsWith("http")
                ? item.image
                : "https://sandermechanical.com/wp-content/uploads/2016/02/shop-placeholder-300x300.png",
            }}
            style={styles.image}
          />
          <View style={styles.badgesRow}>
            <View style={[styles.badge, isOpen ? styles.badgeOpen : styles.badgeClosed]}>
              <Text style={[styles.badgeTxt, isOpen ? styles.badgeTxtOpen : styles.badgeTxtClosed]} allowFontScaling={false}>
                {isOpen ? "เปิดอยู่" : "ปิดอยู่"}
              </Text>
            </View>
          </View>
          {isClosed && <View style={styles.dimOverlay} />}
        </View>

        <View style={styles.info}>
          <Text numberOfLines={1} style={styles.title} allowFontScaling={false}>
            {item.shop_name || item.name || "ร้านไม่มีชื่อ"}
          </Text>
          <Text numberOfLines={1} style={styles.desc} allowFontScaling={false}>
            {item.description || "ไม่มีคำอธิบาย"}
          </Text>

          <View style={styles.meta}>
            <Text style={styles.type} allowFontScaling={false}>{item.type || "ทั่วไป"}</Text>
            <Text style={styles.price} allowFontScaling={false}>
              {item.price_min != null && item.price_max != null ? `${item.price_min} - ${item.price_max} ฿` : "-"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={c.S2} />
        <Text style={{ color: c.S5, marginTop: 8 }} allowFontScaling={false}>กำลังโหลดร้านค้า...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header} allowFontScaling={false}>ร้านทั้งหมด</Text>

      {/* 🔎 Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={c.S5} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ค้นหาร้าน / คำอธิบาย / ประเภท"
          placeholderTextColor="#9aa2a9"
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </Pressable>
        )}
      </View>

      {/* 🔘 Toggles */}
      <View style={styles.togglesRow}>
        {/* เปิดอยู่ */}
        <Pressable
          onPress={() => setOnlyOpen((v) => !v)}
          style={[
            styles.togglePill,
            onlyOpen && { backgroundColor: c.green, borderColor: c.green },
          ]}
          android_ripple={{ color: "#00000011" }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons
            name={onlyOpen ? "checkmark-circle" : "radio-button-off"}
            size={16}
            color={onlyOpen ? c.fullwhite : c.S5}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.toggleTxt, onlyOpen && { color: c.fullwhite }]} allowFontScaling={false}>
            เปิดอยู่
          </Text>
        </Pressable>

        {/* เลือกประเภท — ข้อความล้วน */}
        <Pressable
          onPress={() => setTypePickerVisible(true)}
          style={[styles.typeSelector, { flex: 1 }]}
          android_ripple={{ color: "#00000011" }}
        >
          <Ionicons name="restaurant" size={16} color={c.S5} style={{ marginRight: 6 }} />
          <Text style={styles.typeSelectorTxt} numberOfLines={1} allowFontScaling={false}>
            {type === "all" ? "ทุกประเภท" : type}
          </Text>
          <Ionicons name="chevron-down" size={16} color={c.S5} />
        </Pressable>
      </View>

      {/* 📋 รายการร้าน */}
      <FlatList
        data={filtered}
        keyExtractor={(item, idx) =>
          String(item.id ?? item.shop_id ?? item.shopId ?? `${item.shop_name ?? "shop"}-${idx}`)
        }
        renderItem={renderShop}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.S2} />}
        ListEmptyComponent={<Text style={styles.emptyText} allowFontScaling={false}>ไม่พบร้านตามเงื่อนไข</Text>}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS === "android"}
        windowSize={5}
        initialNumToRender={8}
      />

      {/* 🔽 Modal เลือกประเภท */}
      <Modal
        transparent
        visible={typePickerVisible}
        animationType="fade"
        onRequestClose={() => setTypePickerVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setTypePickerVisible(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle} allowFontScaling={false}>เลือกประเภทอาหาร</Text>

            <FlatList
              data={typeOptions}
              keyExtractor={(it, i) => String(`${it}-${i}`)}
              renderItem={({ item }) => {
                const selected = type === item;
                const label = item === "all" ? "ทุกประเภท" : String(item || "");
                return (
                  <Pressable
                    onPress={() => {
                      setType(item);
                      setTypePickerVisible(false);
                    }}
                    style={[styles.typeRow]}
                  >
                    <Text
                      style={[
                        styles.typeRowTxt,
                        selected && { fontWeight: "800", textDecorationLine: "underline" },
                      ]}
                      allowFontScaling={false}
                    >
                      {label}
                    </Text>
                    {selected ? <Ionicons name="checkmark" size={18} color={c.S2} /> : null}
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              contentContainerStyle={{ paddingVertical: 8 }}
            />

            <Pressable style={styles.modalClose} onPress={() => setTypePickerVisible(false)}>
              <Text style={styles.modalCloseTxt} allowFontScaling={false}>ปิด</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default U_Home;

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.fullwhite },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.fullwhite },
  header: {
    fontSize: 22, fontWeight: "700", color: c.black,
    marginTop: 10, marginLeft: 16, marginBottom: 6,
  },
  /* Search */
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: c.fullwhite,
    borderWidth: 1,
    borderColor: c.S4,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 42,
  },
  searchInput: { flex: 1, paddingHorizontal: 8, color: c.black },
  clearBtn: { paddingLeft: 6, paddingVertical: 4 },
  /* Toggles */
  togglesRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  togglePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    minHeight: CHIP_H,
    borderRadius: CHIP_H / 2,
    borderWidth: 1,
    borderColor: c.S4,
    backgroundColor: c.fullwhite,
    marginRight: 8,
  },
  toggleTxt: {
    color: c.black, fontWeight: "700", fontSize: 12, lineHeight: 16, includeFontPadding: false,
  },
  typeSelector: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    minHeight: CHIP_H,
    borderRadius: CHIP_H / 2,
    borderWidth: 1,
    borderColor: c.S4,
    backgroundColor: c.fullwhite,
    justifyContent: "space-between",
  },
  typeSelectorTxt: { flex: 1, color: c.black, fontWeight: "700", fontSize: 12 },
  /* Card */
  card: {
    backgroundColor: c.white,
    borderRadius: 14,
    marginTop: 4,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: c.S4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardDisabled: { opacity: 0.85 },
  imageWrap: { position: "relative", width: "100%", height: 160, backgroundColor: c.S3 },
  image: { width: "100%", height: "100%" },
  dimOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.28)" },
  badgesRow: { position: "absolute", left: 10, bottom: 10, flexDirection: "row" },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginRight: 8, minHeight: 26, justifyContent: "center" },
  badgeOpen: { backgroundColor: "#dcfce7" },
  badgeClosed: { backgroundColor: "#fee2e2" },
  badgeTxt: { fontSize: 12, fontWeight: "800", lineHeight: 14, includeFontPadding: false },
  badgeTxtOpen: { color: "#166534" },
  badgeTxtClosed: { color: "#991b1b" },
  info: { padding: 12 },
  title: { fontSize: 16, fontWeight: "700", color: c.black },
  desc: { color: "#555", fontSize: 13, marginTop: 2 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  type: { color: c.S5, fontWeight: "500" },
  price: { color: c.S2, fontWeight: "600" },
  emptyText: { textAlign: "center", color: c.S5, marginTop: 30 },
  /* Modal */
  modalRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  modalSheet: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: c.fullwhite,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: c.S4,
  },
  modalTitle: { fontWeight: "800", color: c.black, fontSize: 16, marginBottom: 8 },
  typeRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 12, borderWidth: 1, borderColor: c.S4, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: c.fullwhite,
  },
  typeRowTxt: { color: c.black, fontWeight: "600", fontSize: 13 },
  modalClose: {
    marginTop: 10, alignSelf: "flex-end", paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, backgroundColor: c.S2,
  },
  modalCloseTxt: { color: c.fullwhite, fontWeight: "800" },
});
