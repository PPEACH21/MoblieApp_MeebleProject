// src/User/pages/UserHistoryDetail.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  FlatList,
  Pressable,
  Alert,
  Platform,
  RefreshControl,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { api } from "../../api/axios";
import { BaseColor as c } from "../../components/Color";
import { Ionicons } from "@expo/vector-icons";

/* ---------- helpers ---------- */
const fmtTHB = (n) =>
  (Number(n) || 0).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const toNum = (v, d = 0) => (typeof v === "number" ? v : Number(v) || d);

const fmtDate = (v) => {
  try {
    // รองรับ Firestore Timestamp { seconds: ... }
    const d =
      typeof v === "object" && v?.seconds
        ? new Date(v.seconds * 1000)
        : new Date(v);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
};

const StatusPill = ({ status }) => {
  const map = {
    completed: { bg: "#ecfdf5", fg: "#065f46", label: "เสร็จสิ้น" },
    canceled: { bg: "#fee2e2", fg: "#991b1b", label: "ยกเลิก" },
  };
  const sty = map[status] || {
    bg: "#eef2ff",
    fg: "#3730a3",
    label: status || "-",
  };
  return (
    <View
      style={{
        backgroundColor: sty.bg,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
      }}
    >
      <Text style={{ color: sty.fg, fontWeight: "800" }}>{sty.label}</Text>
    </View>
  );
};

export default function UserHistoryDetail() {
  const nav = useNavigation();
  const route = useRoute();
  const { user: uid } = useSelector((s) => s.auth) || {};
  const historyId = String(
    route?.params?.historyId || route?.params?.orderId || ""
  ).trim();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);

  const [doc, setDoc] = useState(null);
  // doc shape: { historyId, orderId, userId, shopId, shop_name, status, total, createdAt, updatedAt, movedToHistoryAt, items: [...] }

  const computedTotal = useMemo(() => {
    if (!doc?.items?.length) return toNum(doc?.total);
    const sum = doc.items.reduce(
      (s, it) => s + toNum(it.qty) * toNum(it.price),
      0
    );
    return sum || toNum(doc?.total);
  }, [doc]);

  const fetchDetail = useCallback(async () => {
    if (!historyId || !uid) {
      setErr("ไม่พบพารามิเตอร์");
      setLoading(false);
      return;
    }
    try {
      setErr(null);
      if (!refreshing) setLoading(true);

      let data = null;

      // ✅ เส้นหลักที่คุณตั้ง route ไว้: "/:uid/history/:historyId"
      try {
        const r = await api.get(`/${uid}/history/${historyId}`);
        data = r?.data?.order || r?.data || null;
      } catch {}

      // fallback: ดึงลิสต์แล้วหาเอง
      if (!data) {
        try {
          const r2 = await api.get(`/${uid}/history`, {
            params: { limit: 200 },
          });
          const rows = r2?.data?.history || r2?.data || [];
          if (Array.isArray(rows)) {
            data =
              rows.find(
                (x) => String(x?.historyId || x?.orderId || x?.id) === historyId
              ) || null;
          }
        } catch {}
      }

      if (!data) throw new Error("ไม่พบข้อมูลประวัติ");

      const toNum = (v, d = 0) => (typeof v === "number" ? v : Number(v) || d);
      const items = Array.isArray(data.items)
        ? data.items.map((m, i) => ({
            id: m?.id ?? m?.menuId ?? `it_${i}`,
            name: m?.name ?? "-",
            qty: toNum(m?.qty),
            price: toNum(m?.price),
            image: m?.image,
            description: m?.description,
            extras: m?.extras,
          }))
        : [];

      setDoc({
        id: data?.historyId || data?.orderId || historyId,
        historyId: data?.historyId || historyId,
        orderId: data?.orderId || historyId,
        userId: data?.userId || uid,
        shopId: data?.shopId || data?.shop_id || "",
        shop_name: data?.shop_name || data?.shopName || "-",
        status: String(data?.status || "completed").toLowerCase(),
        total: toNum(data?.total),
        createdAt: data?.createdAt,
        updatedAt: data?.updatedAt,
        movedToHistoryAt:
          data?.movedToHistoryAt || data?.updatedAt || data?.createdAt,
        items,
      });
    } catch (e) {
      setErr(
        e?.response?.data?.error ||
          e?.message ||
          "โหลดรายละเอียดประวัติไม่สำเร็จ"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [historyId, uid, refreshing]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDetail();
  }, [fetchDetail]);

  const gotoShop = () => {
    if (!doc?.shopId) return;
    nav.navigate("UserShopDetail", { shopId: doc.shopId });
  };

  /* ---------- UI ---------- */
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={c.S2} />
        <Text style={{ color: c.S5, marginTop: 8 }}>
          กำลังโหลดรายละเอียด...
        </Text>
      </View>
    );
  }

  if (err) {
    return (
      <View style={styles.center}>
        <Text
          style={{ color: "#b91c1c", textAlign: "center", marginBottom: 12 }}
        >
          เกิดข้อผิดพลาด: {String(err)}
        </Text>
        <Pressable style={styles.primaryBtn} onPress={fetchDetail}>
          <Text style={styles.primaryBtnTxt}>ลองใหม่</Text>
        </Pressable>
      </View>
    );
  }

  if (!doc) {
    return (
      <View style={styles.center}>
        <Text>ไม่พบข้อมูล</Text>
      </View>
    );
  }

  const Header = () => (
    <View style={styles.headerWrap}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>ประวัติคำสั่งซื้อ</Text>
        <Text style={styles.subTitle}>เลขที่: {doc.historyId}</Text>
        <Text style={styles.subHint}>
          ย้ายเข้าประวัติ: {fmtDate(doc.movedToHistoryAt)}
        </Text>
      </View>
      <StatusPill status={doc.status} />
    </View>
  );

  const SummaryBox = () => (
    <View style={styles.infoBox}>
      <Text style={styles.infoRow}>
        ร้าน: <Text style={styles.infoBold}>{doc.shop_name || "-"}</Text>
      </Text>
      <Text style={styles.infoRow}>
        สร้างเมื่อ:{" "}
        <Text style={styles.infoBold}>{fmtDate(doc.createdAt)}</Text>
      </Text>
      <Text style={styles.infoRow}>
        อัปเดตล่าสุด:{" "}
        <Text style={styles.infoBold}>{fmtDate(doc.updatedAt)}</Text>
      </Text>
    </View>
  );

  const Footer = () => (
    <View style={styles.footer}>
      <View style={{ flex: 1 }}>
        <Text style={styles.totalLabel}>ยอดรวม</Text>
        <Text style={styles.totalPrice}>{fmtTHB(computedTotal)}</Text>
      </View>

      {doc?.shopId ? (
        <Pressable style={[styles.ghostBtn]} onPress={gotoShop}>
          <Ionicons name="storefront-outline" size={16} color={c.S2} />
          <Text style={[styles.ghostBtnTxt, { marginLeft: 6 }]}>ดูร้าน</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const renderItem = ({ item }) => {
    const sub = toNum(item.qty) * toNum(item.price);
    return (
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
          <View style={styles.rowBetween}>
            <Text style={styles.itemPrice}>{fmtTHB(item.price)}</Text>
            <Text style={styles.qtyTxt}>x {item.qty}</Text>
          </View>
          <Text style={styles.subtotalTxt}>รวม: {fmtTHB(sub)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header />
      <FlatList
        data={doc.items || []}
        keyExtractor={(it, i) => String(it.id ?? i)}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 120,
          flexGrow: 1,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={<SummaryBox />}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Text style={{ color: "#64748b" }}>ไม่มีรายการสินค้า</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[c.S2]}
            progressViewOffset={Platform.OS === "android" ? 64 : 0}
          />
        }
      />
      <Footer />
    </View>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },

  headerWrap: {
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  subTitle: { color: "#334155", marginTop: 2 },
  subHint: { color: "#94a3b8", fontSize: 12 },

  infoBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    marginTop: 6,
  },
  infoRow: { color: "#334155", marginBottom: 4 },
  infoBold: { color: "#0f172a", fontWeight: "800" },

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
  itemName: { fontWeight: "800", color: "#0f172a" },
  itemDesc: { color: "#64748b", marginTop: 2 },
  itemPrice: { color: c.S2, fontWeight: "800" },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  qtyTxt: { color: "#0f172a", fontWeight: "700" },
  subtotalTxt: { marginTop: 4, color: "#334155", fontWeight: "700" },

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
    gap: 10,
  },
  totalLabel: { color: "#64748b", fontSize: 12 },
  totalPrice: { color: "#0f172a", fontSize: 18, fontWeight: "900" },

  primaryBtn: {
    backgroundColor: c.S2,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnTxt: { color: "#fff", fontWeight: "800" },

  ghostBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
  },
  ghostBtnTxt: { color: c.S2, fontWeight: "800" },
});
