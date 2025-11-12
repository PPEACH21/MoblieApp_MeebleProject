// src/Vendor/OrderShop.jsx
import { useCallback, useMemo, useState, useEffect } from "react";
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
import { api } from "../../api/axios";
import { BaseColor as c } from "../../components/Color";
import { useSelector, useDispatch } from "react-redux";
import {Btn} from "../../components/Button"

/* ---------- config ---------- */
const STATUSES = ["prepare", "ready", "completed"];
const FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "prepare", label: "กำลังทำ" },
  { key: "ready", label: "พร้อมส่ง/รับ" },
];

const mapStatus = (s) => {
  const v = String(s || "").toLowerCase();
  if (["prepare", "preparing", "processing"].includes(v)) return "prepare";
  if (["ready", "ongoing", "shipping", "to-deliver"].includes(v)) return "ready";
  if (["completed", "complete", "done", "success", "delivered"].includes(v))
    return "completed";
  return v;
};

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

const normalizeOrders = (data) => {
  let list = [];
  if (!data) return list;
  if (Array.isArray(data)) list = data;
  else if (Array.isArray(data.orders)) list = data.orders;
  else if (Array.isArray(data.items)) list = data.items;
  else if (Array.isArray(data.data)) list = data.data;
  else if (Array.isArray(data.history)) list = data.history; // <— รองรับ key "history" จาก /history

  return (list || []).map((o, i) => {
    const id = o.id || o.ID || o.order_id || String(i);
    const rawStatus = o.status || o.state || o.order_status || "prepare";
    const status = mapStatus(rawStatus);
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

    return { ...o, id, status, createdAt, customer, itemsCount, total };
  });
};

/* ---------- UI helpers ---------- */
const chipColor = (status) => {
  switch (status) {
    case "prepare":
      return { bg: c.S3, fg: c.S5 };
    case "ready":
      return { bg: c.S2, fg: c.fullwhite };
    case "completed":
      return { bg: "rgba(43,116,36,0.12)", fg: c.green };
    default:
      return { bg: c.S4, fg: c.black };
  }
};

/* ---------- component ---------- */
export default function OrderShop() {
  const [filter, setFilter] = useState("all");
  const [orders, setOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);
  const [acting, setActing] = useState({});
  const [shopId, setShopId] = useState();
  const [view, setView] = useState("orders"); // 'orders' | 'history'

  const Dispath = useDispatch();
  const Auth = useSelector((state) => state.auth);
  const headers = Auth.token ? { Authorization: `Bearer ${Auth.token}` } : undefined;

  const getShopId = useCallback(async () => {
    if (!Auth?.user || !Auth?.token) return;
    try {
      const { data } = await api.get(`/shop/by-id/${Auth.user}`, { headers });
      setShopId(data?.id ?? null);
    } catch (e) {
      console.log("Could not find shop for user", e?.message);
      setShopId(null);
    }
  }, [Auth?.user, Auth?.token]);

  useEffect(() => {
    getShopId();
  }, [getShopId]);

  const SHOP_ID = shopId;

  const fetchOrders = useCallback(async () => {
    if (!SHOP_ID) return;
    try {
      setErr(null);
      setLoading(true);

      const params =
        filter !== "all" && STATUSES.includes(filter) ? { status: filter } : {};

      let res;
      try {
        res = await api.get(`/shop/${SHOP_ID}/orders`, { headers, params });
      } catch (e1) {
        if (e1?.response?.status === 404) {
          setOrders([]);
          setErr(null);
          setLoading(false);
          setRefreshing(false);
          return;
        }
        try {
          res = await api.get(`/shops/${SHOP_ID}/orders`, { headers, params });
        } catch (e2) {
          if (e2?.response?.status === 404) {
            setOrders([]);
            setErr(null);
            setLoading(false);
            setRefreshing(false);
            return;
          }
          throw e2;
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
  }, [SHOP_ID, filter, Auth?.token]);

  const fetchHistory = useCallback(async () => {
    if (!SHOP_ID) return;
    try {
      setErr(null);
      setLoadingHistory(true);
      const res = await api.get(`/shop/${SHOP_ID}/history`, { headers });
      const list = normalizeOrders(res?.data?.history ?? res?.data);
      setHistory(list);
    } catch (e) {
      setErr(toErr(e, "โหลดประวัติไม่สำเร็จ"));
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [SHOP_ID, Auth?.token]);

  // โหลดตามมุมมอง
  useEffect(() => {
    if (!SHOP_ID) return;
    if (view === "orders") fetchOrders();
    else fetchHistory();
  }, [SHOP_ID, view, fetchOrders, fetchHistory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    const run = view === "orders" ? fetchOrders : fetchHistory;
    if (!SHOP_ID) {
      getShopId().finally(() => run().finally(() => setRefreshing(false)));
    } else {
      run().finally(() => setRefreshing(false));
    }
  }, [SHOP_ID, view, fetchOrders, fetchHistory, getShopId]);

  /* ---------- actions: update status ---------- */
  const updateStatus = async (orderId, next) => {
    try {
      if (!orderId) return;
      if (!STATUSES.includes(next)) return;

      setActing((m) => ({ ...m, [orderId]: true }));

      const body = { status: next };
      try {
        await api.put(`/orders/${orderId}/status`, body, { headers });
      } catch {
        try {
          await api.put(`/shops/${SHOP_ID}/orders/${orderId}/status`, body, { headers });
        } catch {
          await api.put(`/shop/${SHOP_ID}/orders/${orderId}/status`, body, { headers });
        }
      }

      if (next === "completed") {
        setView("history");     // สลับไปโหมดประวัติทันที
        await fetchHistory();   // แล้วดึงประวัติ
      } else {
        // อื่น ๆ อัปเดตลิสต์ปัจจุบันแบบ optimistic
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: next } : o))
        );
      }
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
          paddingHorizontal: 40,
          paddingVertical: 9,
          borderRadius: 10,
          marginLeft: 8,
          backgroundColor: c.S5,
          opacity: busy ? 0.6 : 1,
        }}
      >
        <Text style={{ color: c.fullwhite, fontWeight: "800", fontSize: 12 }}>
          {busy ? "..." : label}
        </Text>
      </Pressable>
    );

    if (s === "prepare") {
      return (
        <View style={{ flexDirection: "row" ,alignSelf:'center' }}>
          <Btn label="พร้อมส่ง/รับ" onPress={() => updateStatus(o.id, "ready")} />
        </View>
      );
    }
    if (s === "ready") {
      return (
        <View style={{ flexDirection: "row" ,alignSelf:'center' }}>
          <Btn label="เสร็จสิ้น"  onPress={() => updateStatus(o.id, "completed")} />
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
          backgroundColor: c.fullwhite,
          padding: 14,
          borderRadius: 20,
          marginBottom: 5,
          borderWidth: 2,
          borderColor: c.S3,
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
          <Text style={{ fontSize: 16, fontWeight: "900", color: c.black }}>
            ออเดอร์ #{o.id?.slice(-6) || "-"}
          </Text>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: bg,
              borderWidth: bg === c.S2 ? 0 : 1,
              borderColor: bg === c.S2 ? "transparent" : c.S3,
            }}
          >
            <Text style={{ color: fg, fontWeight: "800", fontSize: 12 }}>
              {o.status}
            </Text>
          </View>
        </View>

        {/* meta */}
        <Text style={{ marginTop: 6, color: c.black, opacity: 0.7 }}>
          ลูกค้า:{" "}
          <Text style={{ color: c.black, fontWeight: "700" }}>
            {o.customer || "-"}
          </Text>
        </Text>
        <Text style={{ marginTop: 2, color: c.black, opacity: 0.7 }}>
          เวลา:{" "}
          <Text style={{ color: c.black, fontWeight: "700" }}>
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
          <Text style={{ color: c.black }}>
            รายการ: <Text style={{ fontWeight: "800" }}>{o.itemsCount}</Text>
          </Text>
          <Text style={{ color: c.black, fontWeight: "900", fontSize: 16 }}>
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
        justifyContent:'space-evenly',
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
              borderRadius: 10,
              backgroundColor: active ? c.S1 : c.S4,
              borderWidth: active ? 0 : 1,
              borderColor: c.S3,
            }}
          >
            <Text
              style={{
                color: active ? c.fullwhite : c.black,
                fontWeight: "800",
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
    <SafeAreaView style={{ flex: 1, backgroundColor: c.fullwhite }} edges={["top"]}>
      <StatusBar style="dark" />

      {/* Header + toggle view */}
      <View style={{ paddingHorizontal: 16, paddingTop: 25, paddingBottom: 6 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: c.black }}>
          {view === "orders" ? "ออเดอร์ร้าน" : "ประวัติออเดอร์"}
        </Text>
        <Text style={{ color: c.black, opacity: 0.7, marginTop: 2 }}>
          {view === "orders"
            ? `${filter === "all" ? "ทุกรายการ" : `สถานะ: ${filter}`} • ${totals.count} ออเดอร์ • รวม ${currencyTHB(totals.sum)}`
            : `รวม ${history.length} รายการ`}
        </Text>

        <View style={{ flexDirection: "row", marginTop: 10  ,justifyContent:'space-evenly'}}>
          <Pressable
            onPress={() => { setView("orders"); fetchOrders(); }}
            style={[Btn.Btn2,{
              paddingHorizontal: 50,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: view === "orders" ? c.S1 : c.fullwhite,
              marginRight: 8,
            }]}
          >
            <Text style={{ color: view === "orders" ? c.fullwhite : c.black, fontWeight: "800" }}>
              ออเดอร์
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { setView("history"); fetchHistory(); }}
            style={[Btn.Btn2,{
                paddingHorizontal: 50,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: view === "history" ? c.S1 : c.fullwhite,
                marginRight: 8,
            }]}
          >
            <Text style={{ color: view === "history" ? c.fullwhite : c.black, fontWeight: "800" }}>
              ประวัติ
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Tabs เฉพาะโหมดออเดอร์ */}
      {view === "orders" ? <Tabs /> : null}

      {/* Lists */}
      {view === "orders" ? (
        loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={c.S1} />
            <Text style={{ marginTop: 8, color: c.black, opacity: 0.7 }}>
              กำลังโหลดออเดอร์…
            </Text>
          </View>
        ) : err ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
            {!!err.status && <Text style={{ color: c.red }}>HTTP {err.status}</Text>}
            <Text style={{ color: c.red, marginTop: 4, textAlign: "center" }}>{err.message}</Text>
            <Pressable
              onPress={fetchOrders}
              style={{ marginTop: 12, backgroundColor: c.S2, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
            >
              <Text style={{ color: c.fullwhite, fontWeight: "800" }}>ลองใหม่</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(o, i) => String(o.id || i)}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.S2]} />
            }
            ListEmptyComponent={() => (
              <View style={{ alignItems: "center", marginTop: 24 }}>
                <Text style={{ color: c.black, opacity: 0.7 }}>ไม่มีออเดอร์ขณะนี้</Text>
              </View>
            )}
          />
        )
      ) : (
        // HISTORY VIEW
        loadingHistory ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={c.S2} />
            <Text style={{ marginTop: 8, color: c.black, opacity: 0.7 }}>
              กำลังโหลดประวัติ…
            </Text>
          </View>
        ) : err ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
            {!!err.status && <Text style={{ color: c.red }}>HTTP {err.status}</Text>}
            <Text style={{ color: c.red, marginTop: 4, textAlign: "center" }}>{err.message}</Text>
            <Pressable
              onPress={fetchHistory}
              style={{ marginTop: 12, backgroundColor: c.S2, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
            >
              <Text style={{ color: c.fullwhite, fontWeight: "800" }}>ลองใหม่</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={history}
            keyExtractor={(o, i) => String(o.id || i)}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 100 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[c.S2]}
              />
            }
            ListEmptyComponent={() => (
              <View style={{ alignItems: "center", marginTop: 24 }}>
                <Text style={{ color: c.black, opacity: 0.7 }}>ยังไม่มีประวัติ</Text>
              </View>
            )}
          />
        )
      )}
    </SafeAreaView>
  );
}
