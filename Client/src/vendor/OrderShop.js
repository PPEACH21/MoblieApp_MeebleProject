// src/Vendor/OrderShop.jsx
import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  View, Text, FlatList, ActivityIndicator, RefreshControl, Pressable, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { api } from "../axios";
import { BaseColor as c } from "../components/Color";

/* ---------- canonical statuses ---------- */
const CANON = ["prepare", "ongoing", "done"];

const FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "prepare", label: "กำลังทำ" },
  { key: "ongoing", label: "พร้อมส่ง/รับ" },
  { key: "done", label: "เสร็จสิ้น" }, // <- ดึงจาก history
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
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short" }).format(d);
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

const normStatus = (s) => {
  const x = String(s || "").trim().toLowerCase();
  if (x === "prepare" || x === "preparing") return "prepare";
  if (x === "on-going" || x === "ongoing" || x === "on_going" || x === "in-progress" || x === "in progress")
    return "ongoing";
  if (x === "done" || x === "complete" || x === "completed" || x === "finish" || x === "finished")
    return "done";
  return x || "prepare";
};

const normalizeRows = (data) => {
  let list = [];
  if (!data) return list;
  if (Array.isArray(data)) list = data;
  else if (Array.isArray(data.orders)) list = data.orders;
  else if (Array.isArray(data.history)) list = data.history; // ✅ รองรับ {history: []}
  else if (Array.isArray(data.items)) list = data.items;
  else if (Array.isArray(data.data)) list = data.data;

  return (list || []).map((o, i) => {
    const id = o.id || o.ID || o.order_id || o.historyId || String(i);
    const status = normStatus(o.status || o.state || o.order_status || "prepare");
    const createdAt = o.createdAt || o.created_at || o.time || o.timestamp || o.orderedAt;
    const customer =
      o.customerName || o.customer_name || o.user_name || o.buyer || o.raw?.customer?.name || "-";
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
    case "ongoing":
      return { bg: c.S2, fg: c.fullwhite };
    case "done":
      return { bg: "rgba(43,116,36,0.12)", fg: c.green };
    default:
      return { bg: c.S4, fg: c.black };
  }
};

/* ---------- main ---------- */
export default function OrderShop(props) {
  const route = useRoute();
  const navigation = useNavigation();              // ✅ ใช้นำทางไปหน้า OrderDetail
  const shopId = route?.params?.shopId ?? props?.shopId ?? "";

  const token = useSelector((s) => s?.auth?.token ?? "");
  const reqHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [filter, setFilter] = useState("all");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);
  const [acting, setActing] = useState({});

  const fetchRows = useCallback(async () => {
    if (!shopId) {
      setErr({ status: 400, message: "ไม่พบ shopId" });
      setRows([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setErr(null);
      setLoading(true);

      const isHistory = filter === "done";
      const basePath = isHistory
        ? `/shops/${shopId}/history/orders`
        : `/shops/${shopId}/orders`;

      const params =
        !isHistory && filter !== "all" && CANON.includes(filter)
          ? { status: filter }
          : {};

      let res;
      try {
        res = await api.get(basePath, { params, headers: reqHeaders });
      } catch (e1) {
        const alt = isHistory ? `/shops/${shopId}/history` : `/shops/${shopId}/orders`;
        res = await api.get(alt, { params, headers: reqHeaders });
      }

      // console.log(`📦 [API] GET ${basePath}`, res?.data);

      const list = normalizeRows(res?.data);
      const normalized = isHistory ? list.map((r) => ({ ...r, status: "done" })) : list;
      const filtered = filter === "all" ? normalized : normalized.filter((o) => o.status === filter);

      // console.log(`✅ [NORMALIZED x FILTER=${filter}]`, filtered);
      setRows(filtered);
    } catch (e) {
      const er = toErr(e, "โหลดข้อมูลไม่สำเร็จ");
      console.error("❌ [FETCH ERROR]", er);
      setErr(er);
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shopId, filter, token]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRows();
  }, [fetchRows]);

  const updateStatus = async (orderId, next) => {
    try {
      if (!orderId) return;
      if (!CANON.includes(next)) return;
      if (filter === "done") return; // ประวัติไม่ควรแก้สถานะ

      setActing((m) => ({ ...m, [orderId]: true }));
      await api.put(`/orders/${orderId}/status`, { status: next }, { headers: reqHeaders });
      setRows((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: next } : o)));
    } catch (e) {
      const er = toErr(e, "อัปเดตสถานะออเดอร์ไม่สำเร็จ");
      Alert.alert(`อัปเดตไม่สำเร็จ${er.status ? ` (HTTP ${er.status})` : ""}`, er.message);
    } finally {
      setActing((m) => ({ ...m, [orderId]: false }));
    }
  };

  const renderActions = (o) => {
    if (filter === "done") return null;
    const s = o.status;
    const busy = !!acting[o.id];
    const Btn = ({ label, onPress }) => (
      <Pressable
        onPress={onPress}
        disabled={busy}
        style={{
          paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, marginLeft: 8,
          backgroundColor: c.S5, opacity: busy ? 0.6 : 1,
        }}
      >
        <Text style={{ color: c.fullwhite, fontWeight: "800", fontSize: 12 }}>
          {busy ? "..." : label}
        </Text>
      </Pressable>
    );
    if (s === "prepare") return <View style={{ flexDirection: "row" }}>
      <Btn label="พร้อมส่ง/รับ" onPress={() => updateStatus(o.id, "ongoing")} />
    </View>;
    if (s === "ongoing") return <View style={{ flexDirection: "row" }}>
      <Btn label="เสร็จสิ้น" onPress={() => updateStatus(o.id, "done")} />
    </View>;
    return null;
  };

  const renderItem = ({ item: o }) => {
    const { bg, fg } = chipColor(o.status);

    const goDetail = () => {
      navigation.navigate("OrderDetail", {
        orderId: o.id,
        shopId,
        source: (filter === "done" ? "history" : "orders"),  // ✅ บอกที่มาว่าดูจากไหน
      });
    };

    return (
      <Pressable onPress={goDetail} android_ripple={{ color: "#eee" }}>
        <View style={{ backgroundColor: c.fullwhite, padding: 14, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: c.S3 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 16, fontWeight: "900", color: c.black }}>
              {filter === "done" ? "ประวัติ #" : "ออเดอร์ #"}{o.id?.slice(-6) || "-"}
            </Text>
            <View style={{
              paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: bg,
              borderWidth: bg === c.S2 ? 0 : 1, borderColor: bg === c.S2 ? "transparent" : c.S3,
            }}>
              <Text style={{ color: fg, fontWeight: "800", fontSize: 12 }}>{o.status}</Text>
            </View>
          </View>

          <Text style={{ marginTop: 6, color: c.black, opacity: 0.7 }}>
            ลูกค้า: <Text style={{ color: c.black, fontWeight: "700" }}>{o.customer || "-"}</Text>
          </Text>
          <Text style={{ marginTop: 2, color: c.black, opacity: 0.7 }}>
            เวลา: <Text style={{ color: c.black, fontWeight: "700" }}>{fmtTime(o.createdAt)}</Text>
          </Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10, alignItems: "center" }}>
            <Text style={{ color: c.black }}>
              รายการ: <Text style={{ fontWeight: "800" }}>{o.itemsCount}</Text>
            </Text>
            <Text style={{ color: c.black, fontWeight: "900", fontSize: 16 }}>
              {currencyTHB(o.total)}
            </Text>
          </View>

          <View style={{ marginTop: 12 }}>{renderActions(o)}</View>
        </View>
      </Pressable>
    );
  };

  const Tabs = () => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, gap: 8 }}>
      {FILTERS.map((f) => {
        const active = filter === f.key;
        return (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={{
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
              backgroundColor: active ? c.S2 : c.S3, borderWidth: active ? 0 : 1, borderColor: c.S3,
            }}
          >
            <Text style={{ color: active ? c.fullwhite : c.black, fontWeight: "800", fontSize: 12 }}>
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const totals = useMemo(() => {
    const count = rows.length;
    const sum = rows.reduce((acc, o) => acc + toNum(o.total), 0);
    return { count, sum };
  }, [rows]);

  if (!shopId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.fullwhite }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: c.red, textAlign: "center" }}>
            ไม่พบ shopId — กรุณาเปิดผ่านเมนูที่ส่งค่า shopId มายังหน้านี้
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.fullwhite }} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: c.black }}>
          {filter === "done" ? "ประวัติออเดอร์ร้าน" : "ออเดอร์ร้าน"}
        </Text>
        <Text style={{ color: c.black, opacity: 0.7, marginTop: 2 }}>
          {filter === "all" ? "ทุกรายการ" : `สถานะ: ${filter}`} • {totals.count} รายการ • รวม {currencyTHB(totals.sum)}
        </Text>
      </View>

      <Tabs />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={c.S2} />
          <Text style={{ marginTop: 8, color: c.black, opacity: 0.7 }}>กำลังโหลด…</Text>
        </View>
      ) : err ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          {!!err.status && <Text style={{ color: c.red }}>HTTP {err.status}</Text>}
          <Text style={{ color: c.red, marginTop: 4, textAlign: "center" }}>{err.message}</Text>
          <Pressable
            onPress={fetchRows}
            style={{ marginTop: 12, backgroundColor: c.S2, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
          >
            <Text style={{ color: c.fullwhite, fontWeight: "800" }}>ลองใหม่</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(o, i) => String(o.id || i)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.S2]} />}
          ListEmptyComponent={() => (
            <View style={{ alignItems: "center", marginTop: 24 }}>
              <Text style={{ color: c.black, opacity: 0.7 }}>
                {filter === "done" ? "ยังไม่มีประวัติออเดอร์" : "ไม่มีออเดอร์ขณะนี้"}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
