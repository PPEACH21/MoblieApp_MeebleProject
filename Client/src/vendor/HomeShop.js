// src/Vendor/HomeShop.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Pressable,
  RefreshControl,     // ⬅️ เพิ่ม
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { BaseColor as c } from "../components/Color";
import { api } from "../axios";

/* ---------- DEBUG ---------- */
const DEBUG = false;

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
const toNum  = (v) => (typeof v === "number" ? v : Number(v) || 0);
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

/* เวลา/วันท้องถิ่น */
const toDate = (v) => {
  if (!v) return null;
  if (typeof v === "object") {
    if ("seconds" in v)   return new Date(v.seconds * 1000);
    if ("_seconds" in v)  return new Date(v._seconds * 1000);
  }
  const d = new Date(v);
  return isNaN(+d) ? null : d;
};
const isSameDayLocal = (a, b = new Date()) => {
  if (!a) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

/* แปลง orders/reservations/history ให้เป็นรูปแบบที่อ่านง่าย */
const normalizeOrders = (arr = []) =>
  arr.map((o) => ({
    id: o.id || o.orderId || Math.random().toString(36).slice(2),
    customer: o.customerName || o.customer || "ลูกค้า",
    status: (o.status || "").toString().toLowerCase(),
    createdAt:
      toDate(o.createdAt) ||
      toDate(o.createAt) ||
      toDate(o.created_at) ||
      toDate(o.time) ||
      null,
    total: toNum(o.total ?? o.amount ?? o.price ?? 0),
  }));

const normalizeHistory = (arr = []) =>
  arr.map((o) => ({
    id: o.id || o.orderId || Math.random().toString(36).slice(2),
    customer: o.customerName || o.customer || "ลูกค้า",
    status: "done",
    createdAt:
      toDate(o.createdAt) ||
      toDate(o.createAt) ||
      toDate(o.created_at) ||
      toDate(o.time) ||
      null,
    total: toNum(o.total ?? o.amount ?? o.price ?? 0),
  }));

const normalizeReserves = (arr = []) =>
  arr.map((r) => ({
    id: r.id || r.reserveId || Math.random().toString(36).slice(2),
    name: r.name || r.customerName || "ลูกค้า",
    people: toNum(r.people || r.seats || 0),
    startAt: toDate(r.startAt) || toDate(r.time) || toDate(r.createdAt) || null,
  }));

// ยอดขาย (เฉพาะจาก history)
const sumSalesFromHistory = (rows = [], { onlyToday = false } = {}) =>
  rows.reduce((acc, o) => {
    const d = toDate(o.createdAt);
    if (onlyToday && !isSameDayLocal(d)) return acc;
    return acc + toNum(o.total);
  }, 0);

/* ---------- component ---------- */
export default function HomeShop(props) {
  const route  = useRoute();
  const shopId = route?.params?.shopId ?? props?.shopId ?? "";

  const token = useSelector((s) => s?.auth?.token ?? "");
  const requestHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]       = useState(null);

  // KPI states
  const [stats, setStats] = useState({
    todaySales: 0,
    orderCount: 0,
    reserveCount: 0,
    totalSales: 0,
  });

  // Data sources
  const [ordersRecent, setOrdersRecent] = useState([]);
  const [ordersAllLive, setOrdersAllLive] = useState([]);
  const [historyAll, setHistoryAll] = useState([]);
  const [reservesToday, setReservesToday] = useState([]);

  // Loading flags
  const [ordersLoading, setOrdersLoading]   = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [reservesLoading, setReservesLoading] = useState(true);

  // Refresh flags
  const [refreshing, setRefreshing] = useState(false); // ⬅️ state สำหรับ pull-to-refresh / ปุ่มรีเฟรช

  const tryGet = async (url) => {
    try {
      const { data } = await api.get(url, requestHeaders ? { headers: requestHeaders } : undefined);
      return data;
    } catch (e) {
      if (DEBUG) console.log("⚠️ tryGet failed:", url, toErr(e));
      return null;
    }
  };

  const fetchShop = useCallback(async () => {
    if (!shopId) {
      setLoading(false);
      setErr({ status: 400, message: "ไม่พบรหัสร้าน (shopId) จากหน้าก่อนหน้า" });
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      if (DEBUG) console.groupCollapsed("🏪 fetchShop", shopId);
      const { data } = await api.get(`/shop/${shopId}`, requestHeaders ? { headers: requestHeaders } : undefined);
      if (DEBUG) console.log("RAW /shop/:id =", data);
      const shopData = data?.shop || data || null;
      if (!shopData) throw new Error("ยังไม่มีร้าน โปรดสร้างร้านก่อน");
      const norm = normalizeShop(shopData);
      if (DEBUG) console.log("NORMALIZED shop =", norm);
      setShop(norm);
    } catch (e) {
      const er = toErr(e, "โหลดข้อมูลร้านไม่สำเร็จ");
      if (DEBUG) console.error("❌ fetchShop error:", er);
      setErr(er);
    } finally {
      if (DEBUG) console.groupEnd();
      setLoading(false);
    }
  }, [shopId, token]);

  const fetchOrdersForKPI = useCallback(async () => {
    if (!shopId) return;
    setOrdersLoading(true);
    try {
      if (DEBUG) console.groupCollapsed("📦 fetchOrders (live)", shopId);
      const { data } = await api.get(`/shops/${shopId}/orders`, requestHeaders ? { headers: requestHeaders } : undefined);
      if (DEBUG) console.log("RAW /shops/:id/orders =", data);
      const list = Array.isArray(data) ? data : data?.orders || [];
      const live = normalizeOrders(list);
      if (DEBUG) {
        console.log("NORMALIZED live len =", live.length);
        if (live[0]) console.log("SAMPLE live[0] =", live[0]);
      }
      setOrdersAllLive(live);
      setOrdersRecent(live.slice(0, 8));
    } catch (e) {
      const er = toErr(e, "โหลด orders ไม่สำเร็จ");
      if (DEBUG) console.error("❌ fetchOrders error:", er);
      setOrdersAllLive([]);
      setOrdersRecent([]);
    } finally {
      if (DEBUG) console.groupEnd();
      setOrdersLoading(false);
    }
  }, [shopId, token]);

  const fetchHistoryAll = useCallback(async () => {
    if (!shopId) return;
    setHistoryLoading(true);
    try {
      if (DEBUG) console.groupCollapsed("🗂️ fetchHistory", shopId);
      const { data } = await api.get(`/shops/${shopId}/history/orders`, requestHeaders ? { headers: requestHeaders } : undefined);
      if (DEBUG) console.log("RAW /shops/:id/history/orders =", data);
      const list = Array.isArray(data) ? data : data?.history || [];
      const hist = normalizeHistory(list);
      if (DEBUG) {
        console.log("NORMALIZED history len =", hist.length);
        if (hist[0]) console.log("SAMPLE history[0] =", hist[0]);
      }
      setHistoryAll(hist);
    } catch (e) {
      const er = toErr(e, "โหลด history ไม่สำเร็จ");
      if (DEBUG) console.error("❌ fetchHistory error:", er);
      setHistoryAll([]);
    } finally {
      if (DEBUG) console.groupEnd();
      setHistoryLoading(false);
    }
  }, [shopId, token]);

  const fetchReservesToday = useCallback(async () => {
    if (!shopId) return;
    setReservesLoading(true);
    try {
      if (DEBUG) console.groupCollapsed("📘 fetchReservesToday", shopId);
      // (เตรียม endpoint ไว้—เพิ่มจริงภายหลัง)
      const candidates = [
        // `/shops/${shopId}/reservations?date=today`,
      ];
      let list = null;
      for (const u of candidates) {
        const got = await tryGet(u);
        if (got?.reservations || Array.isArray(got)) {
          list = normalizeReserves(got.reservations || got);
          break;
        }
      }
      setReservesToday(list || []);
      if (DEBUG) console.log("reservesToday len =", (list || []).length);
    } catch (e) {
      const er = toErr(e, "โหลดการจองวันนี้ไม่สำเร็จ");
      if (DEBUG) console.error("❌ fetchReservesToday error:", er);
      setReservesToday([]);
    } finally {
      if (DEBUG) console.groupEnd();
      setReservesLoading(false);
    }
  }, [shopId, token]);

  // โหลดครั้งแรก
  useEffect(() => {
    fetchShop();
    fetchOrdersForKPI();
    fetchHistoryAll();
    fetchReservesToday();
  }, [fetchShop, fetchOrdersForKPI, fetchHistoryAll, fetchReservesToday]);

  // คำนวณ KPI
  useEffect(() => {
    const todaySales   = sumSalesFromHistory(historyAll, { onlyToday: true });
    const orderCount   = (ordersAllLive?.length || 0) + (historyAll?.length || 0);
    const reserveCount = reservesToday?.length || 0;
    const totalSales   = sumSalesFromHistory(historyAll, { onlyToday: false });

    if (DEBUG) {
      console.groupCollapsed("📊 KPI computed");
      console.log("todaySales =", todaySales);
      console.log("orderCount =", orderCount, "(live:", ordersAllLive.length, ", history:", historyAll.length, ")");
      console.log("reserveCount =", reserveCount);
      console.log("totalSales =", totalSales);
      console.groupEnd();
    }
    setStats({ todaySales, orderCount, reserveCount, totalSales });
  }, [ordersAllLive, historyAll, reservesToday]);

  const shopName = useMemo(() => shop?.shop_name || "—", [shop]);

  // 🔄 ฟังก์ชันรีเฟรชรวม
  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchShop(),
        fetchOrdersForKPI(),
        fetchHistoryAll(),
        fetchReservesToday(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchShop, fetchOrdersForKPI, fetchHistoryAll, fetchReservesToday]);

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
        <Text style={{ fontSize: 16, fontWeight: "700", color: c.black }}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );

  if (!shopId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: c.red, textAlign: "center" }}>
            ไม่พบ shopId — กรุณาเปิดผ่านเมนูที่ส่งค่า shopId มายังหน้านี้
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
      <StatusBar barStyle="dark-content" />

      {/* 🧰 DEBUG BOX */}
      {DEBUG && (
        <View
          style={{
            margin: 12,
            padding: 10,
            borderRadius: 12,
            backgroundColor: "#fff7ed",
            borderWidth: 1,
            borderColor: "#fdba74",
          }}
        >
          <Text style={{ color: "#7c2d12", fontWeight: "800", marginBottom: 6 }}>
            🛠 DEBUG (ไม่แสดงในโปรดักชัน)
          </Text>
          <Text style={{ color: "#7c2d12" }}>shopId: {String(shopId)}</Text>
          <Text style={{ color: "#7c2d12" }}>
            live: {ordersAllLive.length} | history: {historyAll.length} | reservesToday: {reservesToday.length}
          </Text>
          <Text style={{ color: "#7c2d12" }}>
            KPI → today: {currencyTHB(stats.todaySales)} | total: {currencyTHB(stats.totalSales)} | orders: {stats.orderCount} | reserves: {stats.reserveCount}
          </Text>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 10, paddingLeft: 20, paddingRight: 20, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={doRefresh}       // ⬅️ ดึงลงเพื่อรีเฟรช
            colors={[c.S2]}
            tintColor={c.S2}
          />
        }
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Text style={{ fontSize: 20, color: c.black }}>ร้าน: {shopName}</Text>

          {/* ปุ่มรีเฟรชบน Header (เผื่ออยากกดจากบนสุด) */}
          <Pressable
            onPress={doRefresh}
            style={{
              backgroundColor: c.S2,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              opacity: refreshing ? 0.7 : 1,
            }}
            disabled={refreshing}
          >
            <Text style={{ color: c.fullwhite, fontWeight: "800" }}>
              {refreshing ? "รีเฟรช..." : "รีเฟรช"}
            </Text>
          </Pressable>
        </View>

        {/* โหลด/แสดง error ร้าน */}
        {loading && (
          <View style={{ paddingVertical: 16 }}>
            <ActivityIndicator size="large" color={c.S2} />
            <Text style={{ marginTop: 8, color: c.black, opacity: 0.6 }}>กำลังโหลดข้อมูลร้าน…</Text>
          </View>
        )}
        {!loading && err && (
          <View style={{ paddingVertical: 12 }}>
            {!!err.status && <Text style={{ color: c.red, marginBottom: 4 }}>HTTP {err.status}</Text>}
            <Text style={{ color: c.red }}>{err.message}</Text>
            <Pressable
              onPress={doRefresh}
              style={{
                marginTop: 10,
                alignSelf: "flex-start",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: c.S2,
              }}
            >
              <Text style={{ color: c.fullwhite, fontWeight: "700" }}>ลองใหม่</Text>
            </Pressable>
          </View>
        )}

        {/* KPI 4 ช่อง */}
        {!err && (
          <Section title="ภาพรวมวันนี้" mt={6}>
            {ordersLoading || historyLoading || reservesLoading ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator size="small" color={c.S2} />
                <Text style={{ marginTop: 6, color: c.black, opacity: 0.6 }}>กำลังโหลดสถิติ…</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 12 }}>
                {[
                  { key: "todaySales",   label: "ยอดขายวันนี้",  value: currencyTHB(stats.todaySales),  bg: c.S1 },
                  { key: "orderCount",   label: "จำนวนออเดอร์",  value: `${stats.orderCount} รายการ`,    bg: c.S2 },
                  { key: "reserveCount", label: "จำนวนคนจอง",    value: `${stats.reserveCount} รายการ`, bg: c.S5 },
                  { key: "totalSales",   label: "ยอดขายทั้งหมด", value: currencyTHB(stats.totalSales),  bg: c.blue },
                ].map((k) => (
                  <View
                    key={k.key}
                    style={{
                      backgroundColor: k.bg,
                      width: 240,
                      height: 110,
                      marginRight: 12,
                      borderRadius: 16,
                      padding: 14,
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={{ color: c.fullwhite, opacity: 0.9, fontSize: 13 }}>{k.label}</Text>
                    <Text style={{ color: c.fullwhite, fontSize: 22, fontWeight: "800" }}>{k.value}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </Section>
        )}

        {/* ออเดอร์ล่าสุด (จาก live) */}
        <Section
          title="ออเดอร์ล่าสุด"
          right={
            <Pressable onPress={doRefresh}>
              <Text style={{ color: c.black, opacity: 0.6 }}>{refreshing ? "กำลังรีเฟรช…" : "รีเฟรช"}</Text>
            </Pressable>
          }
        >
          {ordersLoading ? (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator size="small" color={c.S2} />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 12 }}>
              {ordersRecent.length === 0 && (
                <View style={{ paddingVertical: 12 }}>
                  <Text style={{ color: c.black, opacity: 0.6 }}>ยังไม่มีออเดอร์วันนี้</Text>
                </View>
              )}
              {ordersRecent.map((o) => (
                <Pressable
                  key={o.id}
                  onPress={() => {}}
                  style={{
                    width: 260,
                    height: 120,
                    borderRadius: 16,
                    backgroundColor: c.fullwhite,
                    borderWidth: 1,
                    borderColor: c.S3,
                    padding: 14,
                    justifyContent: "space-between",
                    marginRight: 12,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: c.black }}>{o.customer}</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: c.black, opacity: 0.6 }}>{o.status || "รอดำเนินการ"}</Text>
                    <Text style={{ color: c.black, opacity: 0.6 }}>
                      {o.createdAt
                        ? o.createdAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
                        : "--:--"}
                    </Text>
                  </View>
                  <Text style={{ color: c.black, fontWeight: "800" }}>{currencyTHB(o.total)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Section>

        {/* การจองวันนี้ */}
        <Section
          title="การจองวันนี้"
          right={
            <Pressable onPress={doRefresh}>
              <Text style={{ color: c.S1, fontWeight: "700" }}>{refreshing ? "รีเฟรช…" : "รีเฟรช"}</Text>
            </Pressable>
          }
        >
          {reservesLoading ? (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator size="small" color={c.S2} />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 12 }}>
              {reservesToday.length === 0 && (
                <View style={{ paddingVertical: 12 }}>
                  <Text style={{ color: c.black, opacity: 0.6 }}>ยังไม่มีการจองวันนี้</Text>
                </View>
              )}
              {reservesToday.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => {}}
                  style={{
                    width: 220,
                    height: 100,
                    borderRadius: 16,
                    backgroundColor: c.fullwhite,
                    borderWidth: 1,
                    borderColor: c.S3,
                    padding: 14,
                    justifyContent: "space-between",
                    marginRight: 12,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: c.black }}>{r.name}</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: c.black, opacity: 0.6 }}>{r.people} ที่นั่ง</Text>
                    <Text style={{ color: c.black, opacity: 0.6 }}>
                      {r.startAt
                        ? r.startAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
                        : "--:--"}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Section>
      </ScrollView>

      {/* 🔘 ปุ่มรีเฟรชลอย (มุมขวาล่าง) */}
      <Pressable
        onPress={doRefresh}
        disabled={refreshing}
        style={{
          position: "absolute",
          right: 18,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: c.S2,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 4,
          elevation: 4,
          opacity: refreshing ? 0.7 : 1,
        }}
      >
        <Text style={{ color: c.fullwhite, fontWeight: "900" }}>
          {refreshing ? "↻" : "⟳"}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
