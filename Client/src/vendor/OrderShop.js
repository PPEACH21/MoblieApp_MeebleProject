import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { api } from "../axios";

/* ---------- config ---------- */
const SHOP_ID = "qIcsHxOuL5uAtW4TwAeV";

/** สถานะที่รองรับฝั่งระบบ */
const STATUSES = ["prepare", "ready", "completed"];

/** แท็บกรองบน UI */
const FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "prepare", label: "กำลังทำ" },
  { key: "ready", label: "พร้อมส่ง/รับ" },
  { key: "completed", label: "เสร็จสิ้น" },
];

/* ---------- helpers ---------- */
const toErr = (e, fallback = "เกิดข้อผิดพลาด") => {
  const status = e?.response?.status ?? null;
  const message =
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.message ||
    fallback;
  return { status, message: String(message) };
};

const toDate = (v) => {
  if (!v) return null;
  if (typeof v === "object" && ("seconds" in v || "_seconds" in v)) {
    const s = v.seconds ?? v._seconds;
    return new Date(s * 1000);
  }
  const d = new Date(v);
  return isNaN(+d) ? null : d;
};

const fmtTime = (v) => {
  const d = toDate(v);
  if (!d) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
};

const toNum = (v) => (typeof v === "number" ? v : Number(v) || 0);

const currencyTHB = (n) =>
  (Number(n) || 0).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

/** รวมยอดจาก items ได้หลายทรง */
const computeTotal = (order) => {
  const items = order?.raw?.items || order?.items || [];
  let sum = 0;
  for (const it of items) {
    const price = toNum(it.price ?? it.unitPrice ?? it.subtotal ?? 0);
    const qty = toNum(it.qty ?? it.quantity ?? 1);
    sum += price * (qty || 1);
  }
  if (sum === 0) sum = toNum(order?.total || order?.amount || 0);
  return sum;
};

/** ทำให้ทรง order สม่ำเสมอ */
const normalizeOrders = (data) => {
  let list = [];
  if (!data) return list;
  if (Array.isArray(data)) list = data;
  else if (Array.isArray(data.orders)) list = data.orders;
  else if (Array.isArray(data.items)) list = data.items;
  else if (Array.isArray(data.data)) list = data.data;

  return (list || []).map((o, i) => {
    const id = o.id || o.ID || o.order_id || String(i);
    const rawStatus = String(
      o.status || o.state || o.order_status || "prepare"
    ).toLowerCase();
    const status = STATUSES.includes(rawStatus) ? rawStatus : rawStatus; // ถ้าไม่ใช่ 3 ตัวหลัก จะเห็นเฉพาะใน "ทั้งหมด"
    const createdAt = o.createdAt || o.created_at || o.time || o.timestamp;
    const customer =
      o.customerName ||
      o.customer_name ||
      o.user_name ||
      o.buyer ||
      o.raw?.customer?.name ||
      "-";
    const itemsCount =
      (o.raw?.items || o.items || []).reduce(
        (acc, it) => acc + (toNum(it.qty ?? it.quantity ?? 1) || 1),
        0
      ) || 0;
    const total = computeTotal(o);

    return {
      ...o,
      id,
      status,
      createdAt,
      customer,
      itemsCount,
      total,
    };
  });
};

/* ---------- UI helpers ---------- */
const chipColor = (status) => {
  switch (status) {
    case "prepare":
      return { bg: "#bfdbfe", fg: "#1e3a8a" }; // ฟ้า
    case "ready":
      return { bg: "#c7d2fe", fg: "#3730a3" }; // ม่วงอ่อน
    case "completed":
      return { bg: "#bbf7d0", fg: "#166534" }; // เขียวอ่อน
    default:
      return { bg: "#e5e7eb", fg: "#111827" }; // เทา สำหรับสถานะอื่น
  }
};

/* ---------- main component ---------- */
export default function OrderShop() {
  const [filter, setFilter] = useState("all");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);
  const [acting, setActing] = useState({}); // map orderId -> bool

  const fetchOrders = useCallback(async () => {
    if (!SHOP_ID) return;
    try {
      setErr(null);
      setLoading(true);

      const params =
        filter !== "all" && STATUSES.includes(filter) ? { status: filter } : {};

      let res;
      try {
        // เส้นทางหลัก
        res = await api.get(`/shops/${SHOP_ID}/orders`, {
          params,
          withCredentials: true,
          headers: { "Cache-Control": "no-cache" },
        });
      } catch (e1) {
        // ถ้า 404 => ไม่มีออเดอร์
        if (e1?.response?.status === 404) {
          setOrders([]);
          setErr(null);
          setLoading(false);
          setRefreshing(false);
          return;
        }
        // ลองเส้นทางสำรอง
        try {
          res = await api.get(`/shop/${SHOP_ID}/orders`, {
            params,
            withCredentials: true,
            headers: { "Cache-Control": "no-cache" },
          });
        } catch (e2) {
          if (e2?.response?.status === 404) {
            setOrders([]);
            setErr(null);
            setLoading(false);
            setRefreshing(false);
            return;
          }
          throw e2; // ไม่ใช่ 404 ให้ไปจับด้านนอก
        }
      }

      const list = normalizeOrders(res?.data);
      const filtered =
        filter === "all" ? list : list.filter((o) => o.status === filter);

      setOrders(filtered);
    } catch (e) {
      setErr(toErr(e, "โหลดออเดอร์ไม่สำเร็จ"));
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  /* ---------- actions: update status ---------- */
  const updateStatus = async (orderId, next) => {
    try {
      if (!orderId) return;
      if (!STATUSES.includes(next)) return;

      setActing((m) => ({ ...m, [orderId]: true }));

      const body = { status: next };
      try {
        await api.put(`/orders/${orderId}/status`, body);
      } catch {
        try {
          await api.put(`/shops/${SHOP_ID}/orders/${orderId}/status`, body);
        } catch {
          await api.put(`/shop/${SHOP_ID}/orders/${orderId}/status`, body);
        }
      }

      // optimistic update
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: next } : o))
      );
    } catch (e) {
      const er = toErr(e, "อัปเดตสถานะออเดอร์ไม่สำเร็จ");
      Alert.alert(
        `อัปเดตไม่สำเร็จ${er.status ? ` (HTTP ${er.status})` : ""}`,
        er.message
      );
    } finally {
      setActing((m) => ({ ...m, [orderId]: false }));
    }
  };

  const renderActions = (o) => {
    const s = o.status;
    const busy = !!acting[o.id];

    const Btn = ({ label, onPress }) => (
      <Pressable
        onPress={onPress}
        disabled={busy}
        style={{
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: 10,
          marginLeft: 8,
          backgroundColor: "#111827",
          opacity: busy ? 0.6 : 1,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>
          {busy ? "..." : label}
        </Text>
      </Pressable>
    );

    if (s === "prepare") {
      return (
        <View style={{ flexDirection: "row" }}>
          <Btn label="พร้อมส่ง/รับ" onPress={() => updateStatus(o.id, "ready")} />
        </View>
      );
    }
    if (s === "ready") {
      return (
        <View style={{ flexDirection: "row" }}>
          <Btn label="เสร็จสิ้น" onPress={() => updateStatus(o.id, "completed")} />
        </View>
      );
    }
    return null; // completed ไม่มีปุ่ม
  };

  const renderItem = ({ item: o }) => {
    const { bg, fg } = chipColor(o.status);
    return (
      <View
        style={{
          backgroundColor: "#fff",
          padding: 14,
          borderRadius: 14,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: "#e5e7eb",
        }}
      >
        {/* header row */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#111827" }}>
            ออเดอร์ #{o.id?.slice(-6) || "-"}
          </Text>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: bg,
            }}
          >
            <Text style={{ color: fg, fontWeight: "700", fontSize: 12 }}>
              {o.status}
            </Text>
          </View>
        </View>

        {/* meta */}
        <Text style={{ marginTop: 6, color: "#6b7280" }}>
          ลูกค้า:{" "}
          <Text style={{ color: "#111827", fontWeight: "600" }}>
            {o.customer || "-"}
          </Text>
        </Text>
        <Text style={{ marginTop: 2, color: "#6b7280" }}>
          เวลา:{" "}
          <Text style={{ color: "#111827", fontWeight: "600" }}>
            {fmtTime(o.createdAt)}
          </Text>
        </Text>

        {/* summary */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 10,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#111827" }}>
            รายการ: <Text style={{ fontWeight: "700" }}>{o.itemsCount}</Text>
          </Text>
          <Text style={{ color: "#111827", fontWeight: "800", fontSize: 16 }}>
            {currencyTHB(o.total)}
          </Text>
        </View>

        {/* actions */}
        <View style={{ marginTop: 12 }}>{renderActions(o)}</View>
      </View>
    );
  };

  const Tabs = () => (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 6,
        gap: 8,
      }}
    >
      {FILTERS.map((f) => {
        const active = filter === f.key;
        return (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: active ? "#111827" : "#e5e7eb",
            }}
          >
            <Text
              style={{
                color: active ? "#fff" : "#111827",
                fontWeight: "700",
                fontSize: 12,
              }}
            >
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const totals = useMemo(() => {
    const count = orders.length;
    const sum = orders.reduce((acc, o) => acc + toNum(o.total), 0);
    return { count, sum };
  }, [orders]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: "#111827" }}>
          ออเดอร์ร้าน
        </Text>
        <Text style={{ color: "#6b7280", marginTop: 2 }}>
          {filter === "all" ? "ทุกรายการ" : `สถานะ: ${filter}`} • {totals.count} ออเดอร์ • รวม {currencyTHB(totals.sum)}
        </Text>
      </View>

      <Tabs />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8, color: "#6b7280" }}>กำลังโหลดออเดอร์…</Text>
        </View>
      ) : err ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          {!!err.status && <Text style={{ color: "#ef4444" }}>HTTP {err.status}</Text>}
          <Text style={{ color: "#ef4444", marginTop: 4, textAlign: "center" }}>
            {err.message}
          </Text>
          <Pressable
            onPress={fetchOrders}
            style={{
              marginTop: 12,
              backgroundColor: "#111827",
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>ลองใหม่</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o, i) => String(o.id || i)}
          renderItem={renderItem}
          contentContainerStyle={{
            padding: 16,
            paddingTop: 6,
            paddingBottom: 20,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={() => (
            <View style={{ alignItems: "center", marginTop: 24 }}>
              <Text style={{ color: "#6b7280" }}>ไม่มีออเดอร์ขณะนี้</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
