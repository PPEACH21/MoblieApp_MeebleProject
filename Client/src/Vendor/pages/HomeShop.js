// src/Vendor/HomeShop.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BaseColor as c } from "../../components/Color";
import { api } from "../../api/axios";
import { useSelector } from "react-redux";

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

/* เวลา/วันท้องถิ่น */
const toDate = (v) => {
  if (!v) return null;
  if (typeof v === "object") {
    if ("seconds" in v) return new Date(v.seconds * 1000);
    if ("_seconds" in v) return new Date(v._seconds * 1000);
  }
  const d = new Date(v);
  return isNaN(+d) ? null : d;
};
const isSameDayLocal = (a, b = new Date()) => {
  if (!a) return false;
  const d1 = a,
    d2 = b;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

/* แปลง orders/reservations ให้เป็นรูปแบบที่อ่านง่าย */
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

const normalizeReserves = (arr = []) =>
  arr.map((r) => ({
    id: r.id || r.reserveId || Math.random().toString(36).slice(2),
    name: r.name || r.customerName || "ลูกค้า",
    people: toNum(r.people || r.seats || 0),
    startAt: toDate(r.startAt) || toDate(r.time) || toDate(r.createdAt) || null,
  }));

/* นับเฉพาะสถานะที่ถือว่า “สำเร็จ/ชำระแล้ว” */
const PAID_STATUSES = new Set([
  "paid",
  "success",
  "completed",
  "complete",
  "done",
  "delivered",
  "finished",
]);

/* รวมยอดขาย */
const sumSales = (orders = [], { onlyPaid = true, onlyToday = false } = {}) =>
  orders.reduce((acc, o) => {
    if (onlyPaid && !PAID_STATUSES.has(o.status)) return acc;
    if (onlyToday && !isSameDayLocal(o.createdAt)) return acc;
    return acc + toNum(o.total);
  }, 0);

/* เลือกเฉพาะ orders วันนี้ */
const filterToday = (orders = []) =>
  orders.filter((o) => isSameDayLocal(o.createdAt));

/* ---------- component ---------- */
export default function HomeShop({ navigation }) {
  const Auth = useSelector((state) => state.auth);
  const [shop, setShop] = useState(null);
  const [shopId, setShopId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // KPI
  const [stats, setStats] = useState({
    todaySales: 0,
    orderCount: 0,
    reserveCount: 0,
    totalSales: 0,
  });

  // รายการแสดงผล
  const [ordersRecent, setOrdersRecent] = useState([]);
  const [ordersToday, setOrdersToday] = useState([]);
  const [ordersAll, setOrdersAll] = useState([]);

  // 🔹 reservations ทั้งหมด + แค่ 5 อันแรกสำหรับโชว์
  const [reservesAll, setReservesAll] = useState([]); // ใช้คำนวณ KPI (จำนวนการจองทั้งหมด)
  const [reservesPreview, setReservesPreview] = useState([]); // แสดงแค่ 5 อัน

  const [ordersLoading, setOrdersLoading] = useState(true);
  const [reservesLoading, setReservesLoading] = useState(true);

  const tryGet = async (url) => {
    try {
      const { data } = await api.get(url);
      return data;
    } catch {
      return null;
    }
  };

  const getShopId = useCallback(async () => {
    if (!Auth?.user) return;
    try {
      const { data } = await api.get(`/shop/by-id/${Auth.user}`);
      setShopId(data?.id ?? null);
    } catch (e) {
      navigation.replace("CreateShop");
      console.log("Could not find shop for user", e?.message);
      setShopId(null);
    }
  }, [Auth?.user, navigation]);

  useEffect(() => {
    getShopId();
  }, [getShopId]);

  const fetchShop = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setErr(null);
    try {
      const { data } = await api.get(`/shop/${shopId}`);
      const shopData = data?.shop || data || null;
      if (!shopData) throw new Error("ยังไม่มีร้าน โปรดสร้างร้านก่อน");
      setShop(normalizeShop(shopData));
    } catch (e) {
      setErr(toErr(e, "โหลดข้อมูลร้านไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  /* ดึง orders (recent, today, all) */
  const fetchOrdersForKPI = useCallback(async () => {
    if (!shopId) return;
    setOrdersLoading(true);

    // recent
    const candRecent = [
      `/shop/${shopId}/orders/`,
      `/orders/recent?shopId=${shopId}`,
      `/shops/${shopId}/orders?recent=&limit=8`,
    ];
    let recent = null;
    for (const u of candRecent) {
      const got = await tryGet(u);
      if (got?.orders || Array.isArray(got)) {
        recent = normalizeOrders(got.orders || got);
        break;
      }
    }
    const sortOrderRecent = (recent || []).filter(
      (data) => data.status !== "completed"
    );
    setOrdersRecent(sortOrderRecent || []);

    // today
    const candToday = [
      `/shop/${shopId}/orders?range=today`,
      `/orders?shopId=${shopId}&range=today`,
      `/shops/${shopId}/orders?date=today`,
    ];
    let todayList = null;
    for (const u of candToday) {
      const got = await tryGet(u);
      if (got?.orders || Array.isArray(got)) {
        todayList = normalizeOrders(got.orders || got);
        break;
      }
    }
    if (!todayList && recent) {
      todayList = filterToday(recent);
    }
    setOrdersToday(todayList || []);

    // all
    const candAll = [
      `/shop/${shopId}/orders?range=all`,
      `/orders?shopId=${shopId}`,
      `/shops/${shopId}/orders`,
    ];
    let allList = null;
    for (const u of candAll) {
      const got = await tryGet(u);
      if (got?.orders || Array.isArray(got)) {
        allList = normalizeOrders(got.orders || got);
        break;
      }
    }
    setOrdersAll(allList || todayList || []);

    setOrdersLoading(false);
  }, [shopId]);

  /* 🔁 ดึง "การจองทั้งหมด" แล้วเลือกมาโชว์ 5 อันล่าสุด */
  const fetchReservesAll = useCallback(async () => {
    if (!shopId) return;
    setReservesLoading(true);

    // ใช้ endpoint ที่ดึงรายการจองทั้งหมดของร้าน
    const candidates = [
      `/shops/${shopId}/reservations`,
      `/shop/${shopId}/reservations`,
      `/reservations?shopId=${shopId}`,
    ];

    let list = null;
    for (const u of candidates) {
      const got = await tryGet(u);
      if (got?.reservations || Array.isArray(got)) {
        list = normalizeReserves(got.reservations || got);
        break;
      }
    }

    const all = list || [];

    // sort ล่าสุดอยู่บน
    all.sort((a, b) => {
      const da = +toDate(a.startAt) || 0;
      const db = +toDate(b.startAt) || 0;
      return db - da; // ล่าสุด → เก่าสุด
    });

    setReservesAll(all); // ทั้งหมด (ใช้คำนวณ KPI)
    setReservesPreview(all.slice(0, 5)); // แสดงแค่ 5 อันดับแรก
    setReservesLoading(false);
  }, [shopId]);
  const fetchHistoryTotal = useCallback(async () => {
    if (!shopId) return;

    try {
      const { data } = await api.get(`/shop/${shopId}/history`);
      const list = data.history || [];
      // รวม total ทั้งหมดจาก ประวัติ
      const sum = list.reduce((acc, h) => acc + (Number(h.total) || 0), 0);

      return sum;
    } catch (e) {
      console.log("โหลดประวัติไม่สำเร็จ", e);
      return 0;
    }
  }, [shopId]);
  /* คำนวณ KPI */
  useEffect(() => {
    const calc = async () => {
      const totalHistorySales = await fetchHistoryTotal();

      const todaySales = sumSales(ordersToday, {
        onlyPaid: true,
        onlyToday: true,
      });

      setStats({
        todaySales,
        orderCount: ordersToday.length,
        reserveCount: reservesAll.length,
        totalSales: totalHistorySales, // ⬅️ ใช้ยอดขายจากประวัติแทน
      });
    };

    calc();
  }, [ordersToday, reservesAll, fetchHistoryTotal]);

  /* โหลดข้อมูลเมื่อรู้ shopId แล้ว */
  useEffect(() => {
    if (!shopId) return;
    fetchShop();
    fetchOrdersForKPI();
    fetchReservesAll();
  }, [shopId, fetchShop, fetchOrdersForKPI, fetchReservesAll]);

  /* Pull-to-refresh ทั้งหน้า */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await getShopId();
      await fetchShop();
      await fetchOrdersForKPI();
      await fetchReservesAll();
    } catch (e) {
      console.log("Refresh error", e);
    } finally {
      setRefreshing(false);
    }
  }, [getShopId, fetchShop, fetchOrdersForKPI, fetchReservesAll]);

  const shopName = useMemo(() => shop?.shop_name || "—", [shop]);

  const kpiCards = useMemo(
    () => [
      {
        key: "todaySales",
        label: "ยอดขายวันนี้",
        value: currencyTHB(stats.todaySales),
        bg: c.S1,
      },
      {
        key: "orderCount",
        label: "จำนวนออเดอร์",
        value: `${stats.orderCount} รายการ`,
        bg: c.S2,
      },
      {
        key: "reserveCount",
        label: "จำนวนคนจอง",
        value: `${stats.reserveCount} รายการ`,
        bg: c.S5,
      },
      {
        key: "totalSales",
        label: "ยอดขายทั้งหมด",
        value: currencyTHB(stats.totalSales),
        bg: c.blue,
      },
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
        <Text style={{ fontSize: 16, fontWeight: "700", color: c.black }}>
          {title}
        </Text>
        {right}
      </View>
      {children}
    </View>
  );

  const EmptyRow = ({ text = "ยังไม่มีข้อมูล" }) => (
    <View
      style={{
        width: "100%",
        height: 96,
        borderRadius: 16,
        backgroundColor: c.S4,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
      }}
    >
      <Text style={{ color: c.black, opacity: 0.6 }}>{text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[c.S2]}
          />
        }
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 30,
          paddingLeft: 20,
          paddingRight: 20,
          paddingBottom: 24,
          gap: 15,
        }}
      >
        <Text
          style={{
            fontSize: 20,
            marginBottom: 10,
            color: c.black,
            fontWeight: "bold",
          }}
        >
          ร้าน : {shopName}
        </Text>

        {/* โหลด/แสดง error ร้าน */}
        {loading && (
          <View style={{ paddingVertical: 16 }}>
            <ActivityIndicator size="large" color={c.S2} />
            <Text style={{ marginTop: 8, color: c.black, opacity: 0.6 }}>
              กำลังโหลดข้อมูลร้าน…
            </Text>
          </View>
        )}
        {!loading && err && (
          <View style={{ paddingVertical: 12 }}>
            {!!err.status && (
              <Text style={{ color: c.red, marginBottom: 4 }}>
                HTTP {err.status}
              </Text>
            )}
            <Text style={{ color: c.red }}>{err.message}</Text>
            <Pressable
              onPress={() => {
                getShopId();
                if (shopId) {
                  fetchShop();
                  fetchOrdersForKPI();
                  fetchReservesAll();
                }
              }}
              style={{
                marginTop: 10,
                alignSelf: "flex-start",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: c.S2,
              }}
            >
              <Text style={{ color: c.fullwhite, fontWeight: "700" }}>
                ลองใหม่
              </Text>
            </Pressable>
          </View>
        )}

        {/* KPI 4 ช่อง */}
        {!err && (
          <Section title="ภาพรวมวันนี้" mt={6}>
            {ordersLoading && reservesLoading ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator size="small" color={c.S2} />
                <Text style={{ marginTop: 6, color: c.black, opacity: 0.6 }}>
                  กำลังโหลดสถิติ…
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 12 }}
              >
                {kpiCards.map((k) => (
                  <View
                    key={k.key}
                    style={{
                      backgroundColor: k.bg,
                      width: 150,
                      height: 100,
                      marginRight: 10,
                      borderRadius: 20,
                      padding: 14,
                      justifyContent: "space-evenly",
                    }}
                  >
                    <Text
                      style={{
                        color: c.fullwhite,
                        textAlign: "center",
                        fontWeight: "bold",
                        opacity: 0.9,
                        fontSize: 13,
                      }}
                    >
                      {k.label}
                    </Text>
                    <Text
                      style={{
                        color: c.fullwhite,
                        fontSize: 22,
                        fontWeight: "800",
                        textAlign: "center",
                      }}
                    >
                      {k.value}
                    </Text>
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
            <Pressable onPress={() => navigation.navigate("Orders")}>
              <Text style={{ color: c.S1, fontWeight: "bold" }}>ดูทั้งหมด</Text>
            </Pressable>
          }
        >
          {ordersLoading ? (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator size="small" color={c.S2} />
            </View>
          ) : (
            <ScrollView
              style={{ height: 120, width: "100%" }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: 30,
                alignItems: "center",
                gap: 10,
              }}
            >
              {ordersRecent.length === 0 && (
                <EmptyRow text="ยังไม่มีออเดอร์วันนี้" />
              )}
              {ordersRecent.map((o) => (
                <Pressable
                  key={o.id}
                  onPress={() => {}}
                  style={{
                    width: "100%",
                    height: 90,
                    borderRadius: 16,
                    backgroundColor: c.fullwhite,
                    borderWidth: 2,
                    borderColor: c.S3,
                    padding: 12,
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ fontSize: 16, color: c.black }}>#{o.id}</Text>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={{ color: c.black, opacity: 0.6 }}>
                      {o.status || "รอดำเนินการ"}
                    </Text>
                    <Text style={{ color: c.black, opacity: 0.6 }}>
                      {o.createdAt
                        ? o.createdAt.toLocaleTimeString("th-TH", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "--:--"}
                    </Text>
                  </View>
                  <Text style={{ color: c.black, fontWeight: "800" }}>
                    {currencyTHB(o.total)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Section>

        {/* 🔁 การจองทั้งหมด (โชว์แค่ 5 รายการล่าสุด) */}
        <Section
          title="การจองทั้งหมด"
          right={
            <Pressable onPress={() => navigation.navigate("Reserve")}>
              <Text style={{ color: c.S1, fontWeight: "700" }}>ดูทั้งหมด</Text>
            </Pressable>
          }
        >
          {reservesLoading ? (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator size="small" color={c.S2} />
            </View>
          ) : (
            <ScrollView style={{ width: "100%" }}>
              {reservesPreview.length === 0 && (
                <EmptyRow text="ยังไม่มีการจอง" />
              )}
              {reservesPreview.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => {}}
                  style={{
                    flexWrap: "wrap",
                    alignContent: "center",
                    width: "100%",
                    height: 100,
                    borderRadius: 16,
                    backgroundColor: c.fullwhite,
                    borderWidth: 1,
                    borderColor: c.S3,
                    padding: 14,
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: c.black,
                    }}
                  >
                    {r.name}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={{ color: c.black, opacity: 0.6 }}>
                      {r.people} ที่นั่ง
                    </Text>
                    <Text style={{ color: c.black, opacity: 0.6 }}>
                      {r.startAt
                        ? r.startAt.toLocaleTimeString("th-TH", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "--:--"}
                    </Text>
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
