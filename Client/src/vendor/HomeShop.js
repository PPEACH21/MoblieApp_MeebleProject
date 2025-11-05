import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../axios";

const SHOP_ID = "qIcsHxOuL5uAtW4TwAeV";

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

const toBool = (v) => v === true || v === "true" || v === 1 || v === "1";
const toNum = (v) => (typeof v === "number" ? v : Number(v) || 0);
const currencyTHB = (n) =>
  (Number(n) || 0).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const normalizeShop = (s) =>
  s
    ? {
        ...s,
        order_active: !!toBool(s.order_active),
        reserve_active: !!toBool(s.reserve_active),
      }
    : s;

/* พยายามรองรับหลายรูปแบบสถิติจาก backend ต่างกัน */
const mapStats = (raw) => {
  if (!raw) return null;
  const todaySales =
    raw.todaySales ?? raw.sales_today ?? raw?.sales?.today ?? raw?.today?.sales ?? 0;
  const orderCount =
    raw.todayOrders ?? raw.orders_today ?? raw?.orders?.today ?? raw?.today?.orders ?? 0;
  const reserveCount =
    raw.todayReserves ?? raw.reserves_today ?? raw?.reserves?.today ?? raw?.today?.reserves ?? 0;
  const totalSales =
    raw.totalSales ?? raw.sales_total ?? raw?.sales?.total ?? raw?.total?.sales ?? 0;
  return {
    todaySales: toNum(todaySales),
    orderCount: toNum(orderCount),
    reserveCount: toNum(reserveCount),
    totalSales: toNum(totalSales),
  };
};

export default function HomeShop() {
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // สถิติ 4 ช่อง
  const [stats, setStats] = useState({
    todaySales: 0,
    orderCount: 0,
    reserveCount: 0,
    totalSales: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // ออเดอร์ล่าสุด & การจองวันนี้
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const [reserves, setReserves] = useState([]);
  const [reservesLoading, setReservesLoading] = useState(true);

  // สรุปสัปดาห์ (mock ถ้ายังไม่มี endpoint)
  const [weekSummary, setWeekSummary] = useState([
    { day: "จ.", sales: 1200, orders: 6 },
    { day: "อ.", sales: 980, orders: 4 },
    { day: "พ.", sales: 1430, orders: 7 },
    { day: "พฤ.", sales: 1100, orders: 5 },
    { day: "ศ.", sales: 1670, orders: 8 },
    { day: "ส.", sales: 950, orders: 4 },
    { day: "อา.", sales: 730, orders: 3 },
  ]);

  const tryGet = async (url) => {
    try {
      const { data } = await api.get(url);
      return data;
    } catch {
      return null;
    }
  };

  const fetchShop = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data } = await api.get(`/shop/${SHOP_ID}`);
      const shopData = data?.shop || data || null;
      if (!shopData) throw new Error("ยังไม่มีร้าน โปรดสร้างร้านก่อน");
      setShop(normalizeShop(shopData));
    } catch (e) {
      const er = toErr(e, "โหลดข้อมูลร้านไม่สำเร็จ");
      setErr(er);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    const candidates = [
      `/shop/${SHOP_ID}/stats/summary`,
      `/shop/${SHOP_ID}/stats`,
      `/shops/${SHOP_ID}/stats`,
      `/stats?shopId=${SHOP_ID}`,
    ];
    let raw = null;
    for (const u of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const got = await tryGet(u);
      if (got) {
        raw = got?.data || got?.stats || got;
        break;
      }
    }
    const mapped =
      mapStats(raw) || { todaySales: 0, orderCount: 0, reserveCount: 0, totalSales: 0 };
    setStats(mapped);
    setStatsLoading(false);
  }, []);

  const fetchRecentOrders = useCallback(async () => {
    setOrdersLoading(true);
    const candidates = [
      `/shop/${SHOP_ID}/orders/recent?limit=8`,
      `/orders/recent?shopId=${SHOP_ID}&limit=8`,
      `/shops/${SHOP_ID}/orders?recent=true&limit=8`,
    ];
    let list = null;
    for (const u of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const got = await tryGet(u);
      if (got?.orders || Array.isArray(got)) {
        list = got.orders || got;
        break;
      }
    }
    setOrders(
      (list || []).map((o) => ({
        id: o.id || o.orderId || Math.random().toString(36).slice(2),
        customer: o.customerName || o.customer || "ลูกค้า",
        status: o.status || "รอดำเนินการ",
        time:
          o.createdAt
            ? new Date(o.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
            : "--:--",
        total: toNum(o.total || o.amount || 0),
      }))
    );
    setOrdersLoading(false);
  }, []);

  const fetchTodayReserves = useCallback(async () => {
    setReservesLoading(true);
    const candidates = [
      `/shop/${SHOP_ID}/reservations/today`,
      `/reservations?shopId=${SHOP_ID}&range=today`,
      `/shops/${SHOP_ID}/reservations?date=today`,
    ];
    let list = null;
    for (const u of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const got = await tryGet(u);
      if (got?.reservations || Array.isArray(got)) {
        list = got.reservations || got;
        break;
      }
    }
    setReserves(
      (list || []).map((r) => ({
        id: r.id || r.reserveId || Math.random().toString(36).slice(2),
        name: r.name || r.customerName || "ลูกค้า",
        people: toNum(r.people || r.seats || 0),
        time:
          r.time || (r.startAt
            ? new Date(r.startAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
            : "--:--"),
      }))
    );
    setReservesLoading(false);
  }, []);

  useEffect(() => {
    fetchShop();
    fetchStats();
    fetchRecentOrders();
    fetchTodayReserves();
  }, [fetchShop, fetchStats, fetchRecentOrders, fetchTodayReserves]);

  const shopName = useMemo(() => shop?.shop_name || "—", [shop]);

  // การ์ด KPI 4 ใบ
  const kpiCards = useMemo(
    () => [
      { key: "todaySales", label: "ยอดขายวันนี้", value: currencyTHB(stats.todaySales), bg: "#10b981" },
      { key: "orderCount", label: "จำนวนออเดอร์", value: `${stats.orderCount} รายการ`, bg: "#3b82f6" },
      { key: "reserveCount", label: "จำนวนคนจอง", value: `${stats.reserveCount} รายการ`, bg: "#f59e0b" },
      { key: "totalSales", label: "ยอดขายทั้งหมด", value: currencyTHB(stats.totalSales), bg: "#6d28d9" },
    ],
    [stats]
  );

  const Section = ({ title, right, children, mt = 14 }) => (
    <View style={{ marginTop: mt }}>
      <View
        style={{
          paddingHorizontal: 4,
          marginBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "700" }}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );

  const EmptyRow = ({ text = "ยังไม่มีข้อมูล" }) => (
    <View
      style={{
        height: 96,
        borderRadius: 12,
        backgroundColor: "#f3f4f6",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
        paddingHorizontal: 16,
      }}
    >
      <Text style={{ color: "#6b7280" }}>{text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 30, paddingLeft: 20, paddingRight: 20, paddingBottom: 24 }}
      >
        {/* Header */}
        <Text style={{ fontSize: 20, marginBottom: 10 }}>ร้าน: {shopName}</Text>

        {/* โหลดร้าน */}
        {loading && (
          <View style={{ paddingVertical: 16 }}>
            <ActivityIndicator size="large" />
            <Text style={{ marginTop: 8, color: "#6b7280" }}>กำลังโหลดข้อมูลร้าน…</Text>
          </View>
        )}

        {/* error ร้าน */}
        {!loading && err && (
          <View style={{ paddingVertical: 12 }}>
            {!!err.status && (
              <Text style={{ color: "#ef4444", marginBottom: 4 }}>HTTP {err.status}</Text>
            )}
            <Text style={{ color: "#ef4444" }}>{err.message}</Text>
            <Pressable
              onPress={() => {
                fetchShop();
                fetchStats();
                fetchRecentOrders();
                fetchTodayReserves();
              }}
              style={{
                marginTop: 10,
                alignSelf: "flex-start",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: "#111827",
              }}
            >
              <Text style={{ color: "#fff" }}>ลองใหม่</Text>
            </Pressable>
          </View>
        )}

        {/* KPI 4 ช่อง (เลื่อนซ้าย-ขวา) */}
        {!err && (
          <Section title="ภาพรวมวันนี้" mt={6}>
            {statsLoading ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator size="small" />
                <Text style={{ marginTop: 6, color: "#6b7280" }}>กำลังโหลดสถิติ…</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 12 }}>
                {kpiCards.map((c) => (
                  <View
                    key={c.key}
                    style={{
                      backgroundColor: c.bg,
                      width: 240,
                      height: 110,
                      marginRight: 12,
                      borderRadius: 16,
                      padding: 14,
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={{ color: "#ffffffcc", fontSize: 13 }}>{c.label}</Text>
                    <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>{c.value}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </Section>
        )}

        {/* ออเดอร์ล่าสุด */}
        <Section
          title="ออเดอร์ล่าสุด"
          right={
            <Pressable onPress={() => {}}>
              <Text style={{ color: "#6b7280" }}>ดูทั้งหมด</Text>
            </Pressable>
          }
        >
          {ordersLoading ? (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator size="small" />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 12 }}>
              {orders.length === 0 && <EmptyRow text="ยังไม่มีออเดอร์วันนี้" />}
              {orders.map((o) => (
                <Pressable
                  key={o.id}
                  onPress={() => {}}
                  style={{
                    width: 260,
                    height: 120,
                    borderRadius: 16,
                    backgroundColor: "#f3f4f6",
                    padding: 14,
                    justifyContent: "space-between",
                    marginRight: 12,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>{o.customer}</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: "#6b7280" }}>{o.status}</Text>
                    <Text style={{ color: "#6b7280" }}>{o.time}</Text>
                  </View>
                  <Text style={{ color: "#111827", fontWeight: "700" }}>{currencyTHB(o.total)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Section>

        {/* การจองวันนี้ */}
        <Section
          title="การจองวันนี้"
          right={
            <Pressable onPress={() => {}}>
              <Text style={{ color: "#6b7280" }}>ดูทั้งหมด</Text>
            </Pressable>
          }
        >
          {reservesLoading ? (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator size="small" />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 12 }}>
              {reserves.length === 0 && <EmptyRow text="ยังไม่มีการจองวันนี้" />}
              {reserves.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => {}}
                  style={{
                    width: 220,
                    height: 100,
                    borderRadius: 16,
                    backgroundColor: "#f3f4f6",
                    padding: 14,
                    justifyContent: "space-between",
                    marginRight: 12,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>{r.name}</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: "#6b7280" }}>{r.people} ที่นั่ง</Text>
                    <Text style={{ color: "#6b7280" }}>{r.time}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Section>

      </ScrollView>
    </SafeAreaView>
  );
}
