// src/User/pages/UserOrderScreen.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Platform,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { api } from "../../api/axios";
import { m } from "../../paraglide/messages";

const TABS = [
  { key: "active", label: m.processing() },
  { key: "history", label: m.history()},
];

const ACTIVE_STATUSES = new Set(["prepare", "ready", "unknown", "pending"]);
const HISTORY_STATUSES = new Set(["completed", "canceled"]);

const fmtTHB = (n) =>
  (Number(n) || 0).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const fmtDate = (v) => {
  try {
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

// cache ชื่อร้านกันยิงซ้ำ
const shopNameCache = new Map(); // key = shopId, value = shopName

export default function UserOrderScreen() {
  const route = useRoute();
  const nav = useNavigation();
  const Auth = useSelector((s) => s.auth);

  const highlightId = route?.params?.highlightId || null;
  const userId = useMemo(() => String(Auth?.user ?? "").trim(), [Auth?.user]);

  const [tab, setTab] = useState("active"); // "active" | "history"
  const [activeOrders, setActiveOrders] = useState([]);
  const [historyOrders, setHistoryOrders] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);

  const listRef = useRef(null);

  const normalize = (o, isHistory = false) => {
    // ตุน shopId และพยายามหา shop_name จากหลายฟิลด์
    const shopId =
      o.shopId || o.shop_id || o.shop?.id || o.shop?.shopId || "";
    let shopName =
      o.shop_name ||
      o.shopName ||
      o.shop?.name ||
      o.shop?.shop_name ||
      o.shopTitle ||
      "-";

    return {
      id: o.id || o.historyId || o.orderId,
      shopId,
      shop_name: shopName,
      total: Number(o.total) || 0,
      status: String(
        o.status || (isHistory ? "completed" : "unknown")
      ).toLowerCase(),
      createdAt: o.createdAt || o.created_at || o.timestamp || null,
    };
  };

  // ดึงชื่อร้านจาก /shop/:id และ cache ไว้
  const fetchShopName = useCallback(async (shopId) => {
    if (!shopId) return "-";
    if (shopNameCache.has(shopId)) return shopNameCache.get(shopId);

    try {
      const r = await api.get(`/shop/${shopId}`);
      const name = r?.data?.shop?.name || r?.data?.name || r?.data?.shop_name || "-";
      shopNameCache.set(shopId, name || "-");
      return name || "-";
    } catch {
      shopNameCache.set(shopId, "-");
      return "-";
    }
  }, []);

  // เติมชื่อร้านให้รายการ (เฉพาะตัวที่ยังเป็น "-" แต่มี shopId)
  const fillMissingShopNames = useCallback(
    async (list) => {
      if (!Array.isArray(list) || list.length === 0) return list;

      // หา shopId ที่ยังไม่มีชื่อ
      const needIds = Array.from(
        new Set(
          list
            .filter((x) => (x.shop_name == null || x.shop_name === "-") && x.shopId)
            .map((x) => x.shopId)
        )
      );

      if (needIds.length === 0) return list;

      // ยิงขอชื่อทุกร้านที่ขาดแบบ parallel (แต่มี cache กันซ้ำอยู่แล้ว)
      const pairs = await Promise.all(
        needIds.map(async (sid) => [sid, await fetchShopName(sid)])
      );

      const nameMap = new Map(pairs); // Map<shopId, shopName>

      // คืนลิสต์ที่ใส่ชื่อร้านแล้ว
      return list.map((x) => {
        if ((x.shop_name == null || x.shop_name === "-") && x.shopId) {
          const name = nameMap.get(x.shopId);
          if (name && name !== "-") {
            return { ...x, shop_name: name };
          }
        }
        return x;
      });
    },
    [fetchShopName]
  );

  const fetchActive = useCallback(async (uid) => {
    const res = await api.get("/userOrders", { params: { userId: uid } });
    const rows = Array.isArray(res?.data) ? res.data : res?.data?.orders || [];
    const list = rows.map((o) => normalize(o, false));
    const filtered = list.filter(
      (x) => ACTIVE_STATUSES.has(x.status) || !HISTORY_STATUSES.has(x.status)
    );
    // เติมชื่อร้านถ้าขาด
    return await fillMissingShopNames(filtered);
  }, [fillMissingShopNames]);

  const fetchHistory = useCallback(async (uid) => {
    // หลัก: /users/:uid/history
    try {
      const r = await api.get(`/users/${uid}/history`);
      const rows = Array.isArray(r?.data)
        ? r.data
        : r?.data?.history || r?.data?.orders || [];
      if (rows?.length) {
        const list = rows.map((o) => normalize(o, true));
        return await fillMissingShopNames(list);
      }
    } catch {}

    // fallback: /userOrders?status=completed
    try {
      const r2 = await api.get("/userOrders", {
        params: { userId: uid, status: "completed" },
      });
      const rows = Array.isArray(r2?.data) ? r2.data : r2?.data?.orders || [];
      if (rows?.length) {
        const list = rows.map((o) => normalize(o, true));
        return await fillMissingShopNames(list);
      }
    } catch {}

    return [];
  }, [fillMissingShopNames]);

  const fetchAll = useCallback(async () => {
    try {
      setErr(null);
      if (!refreshing) setLoading(true);
      if (!userId) throw new Error("ยังไม่ได้เข้าสู่ระบบ");

      const [act, his] = await Promise.all([
        fetchActive(userId),
        fetchHistory(userId),
      ]);

      setActiveOrders(act);
      setHistoryOrders(his);
    } catch (e) {
      setErr(
        e?.response?.data?.error || e?.message || "โหลดคำสั่งซื้อไม่สำเร็จ"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, refreshing, fetchActive, fetchHistory]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  const data = tab === "active" ? activeOrders : historyOrders;

  useEffect(() => {
    if (!highlightId || !data.length) return;
    const idx = data.findIndex((o) => String(o.id) === String(highlightId));
    if (idx >= 0 && listRef.current?.scrollToIndex) {
      setTimeout(() => {
        try {
          listRef.current.scrollToIndex({ index: idx, animated: true });
        } catch {}
      }, 200);
    }
  }, [highlightId, data]);

  const StatusPill = ({ status }) => {
      const map = {
        prepare: { bg: "#fff7ed", fg: "#9a3412", label:m.processing() },
        ongoing: { bg: "#ecfeff", fg: "#155e75", label: m.ongoing() },
        success: { bg: "#ecfdf5", fg: "#065f46", label: m.success() },
        canceled: { bg: "#fee2e2", fg: "#991b1b", label: m.cancel() },
        unknown: { bg: "#eef2ff", fg: "#3730a3", label:"unknown"},
      };
    const sty = map[status] || map.unknown;
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

  const TabBar = () => (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      {TABS.map((t) => {
        const active = tab === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: active ? "#2563eb" : "#e5e7eb",
              backgroundColor: active ? "#dbeafe" : "#ffffff",
            }}
          >
            <Text
              style={{
                color: active ? "#1d4ed8" : "#334155",
                fontWeight: "700",
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderItem = ({ item }) => {
    const isHL = highlightId && String(item.id) === String(highlightId);
    const dest = tab === "history" ? "UserHistoryDetail" : "UserOrderDetail";
    const params =
      tab === "history" ? { historyId: item.id } : { orderId: item.id };

    return (
      <Pressable
        onPress={() => nav.navigate(dest, params)}
        style={{
          padding: 14,
          borderBottomWidth: 1,
          borderColor: "#e5e7eb",
          backgroundColor: isHL ? "#fffbeb" : "white",
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontWeight: "800", color: "#0f172a" }}>
            ร้าน: {item.shop_name}
          </Text>
          <StatusPill status={item.status} />
        </View>

        <View
          style={{
            marginTop: 6,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: "#334155" }}>{m.total_all()}</Text>
          <Text style={{ fontWeight: "800", color: "#111827" }}>
            {fmtTHB(item.total)}
          </Text>
        </View>

        <Text style={{ marginTop: 4, color: "#64748b" }}>
          {tab === "history" ? m.SuccessAt() : m.createdAt()}:{" "}
          {fmtDate(item.createdAt)}
        </Text>

        {isHL && (
          <Text style={{ marginTop: 6, color: "#a16207", fontWeight: "700" }}>
            • รายการล่าสุดของคุณ
          </Text>
        )}
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8, color: "#64748b" }}>
          กำลังโหลดคำสั่งซื้อ...
        </Text>
      </View>
    );
  }

  if (err) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <Text
          style={{ color: "#b91c1c", textAlign: "center", marginBottom: 12 }}
        >
          เกิดข้อผิดพลาด: {String(err)}
        </Text>
        <Pressable
          onPress={fetchAll}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: "#2563eb",
          }}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>ลองใหม่</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      <Text style={{fontSize:23,fontWeight:"bold", padding:15}} allowFontScaling={false}>{m.Orders()}</Text>
      <TabBar />
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item, i) => String(item.id ?? i)}
        renderItem={renderItem}
        refreshing={refreshing}
        onRefresh={onRefresh}
        alwaysBounceVertical
        bounces
        progressViewOffset={Platform.OS === "android" ? 64 : 0}
        contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={{ padding: 24, alignItems: "center" }}>
            <Text style={{ color: "#64748b" }}>
              {tab === "history"
                ? "ยังไม่มีประวัติคำสั่งซื้อ"
                : "ยังไม่มีคำสั่งซื้อที่กำลังดำเนินการ"}
            </Text>
          </View>
        }
        getItemLayout={(dataArr, index) => ({
          length: 72,
          offset: 72 * index,
          index,
        })}
        initialNumToRender={10}
        windowSize={7}
        removeClippedSubviews
      />
    </View>
  );
}
