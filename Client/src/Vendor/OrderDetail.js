// src/Vendor/OrderDetail.jsx
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, FlatList, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { api } from "../axios";
import { BaseColor as c } from "../components/Color";

const toNum = (v) => (typeof v === "number" ? v : Number(v) || 0);
const currencyTHB = (n) =>
  (Number(n) || 0).toLocaleString("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 0, maximumFractionDigits: 0 });

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

const normStatus = (s) => {
  const x = String(s || "").trim().toLowerCase();
  if (x === "prepare" || x === "preparing") return "prepare";
  if (["on-going", "ongoing", "on_going", "in-progress", "in progress"].includes(x)) return "ongoing";
  if (["done", "complete", "completed", "finish", "finished"].includes(x)) return "done";
  return x || "prepare";
};

export default function OrderDetail() {
  const route = useRoute();
  const navigation = useNavigation();
  const { orderId, shopId, source = "active" } = route.params || {};
  // source: "active" = มาจาก /shops/:id/orders, "history" = มาจาก /shops/:id/history/orders

  const token = useSelector((s) => s?.auth?.token ?? "");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [order, setOrder] = useState(null);

  const fetchDetail = useCallback(async () => {
    if (!orderId) {
      setErr({ status: 400, message: "ไม่พบ orderId" });
      setLoading(false);
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      let res;
      if (source === "history" && shopId) {
        // เส้นทางดึงจาก history ของร้าน (ควรมี endpoint: GET /shops/:shopId/history/:orderId)
        // ถ้ายังไม่มี ให้ fallback ไป /shops/:shopId/history ทั้งก้อนแล้วหาเอาในแอป
        try {
          res = await api.get(`/shops/${shopId}/history/${orderId}`, { headers });
          const data = res?.data?.order || res?.data;
          setOrder(data ? { ...data, status: "done" } : null);
        } catch {
          // fallback: ดึงลิสต์ history แล้วกรองในแอป
          const all = await api.get(`/shops/${shopId}/history/orders`, { headers });
          const list = all?.data?.history || [];
          const found = list.find((x) => (x.id || x.ID) === orderId);
          setOrder(found ? { ...found, status: "done" } : null);
        }
      } else {
        // ออเดอร์ปัจจุบัน
        res = await api.get(`/orders/${orderId}`, { headers });
        const o = res?.data?.order || res?.data;
        if (!o) throw new Error("ไม่พบออเดอร์");
        // normalize
        const items = Array.isArray(o.items) ? o.items : [];
        const total =
          toNum(o.total) ||
          items.reduce((acc, it) => acc + toNum(it.price ?? it.unitPrice ?? 0) * (toNum(it.qty ?? it.quantity ?? 1) || 1), 0);
        setOrder({
          ...o,
          status: normStatus(o.status),
          total,
        });
      }
    } catch (e) {
      const status = e?.response?.status ?? null;
      const message = e?.response?.data?.error || e?.message || "โหลดรายละเอียดไม่สำเร็จ";
      setErr({ status, message: String(message) });
    } finally {
      setLoading(false);
    }
  }, [orderId, shopId, source, token]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const items = order?.items || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "white" }} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: c.black }}>
          รายละเอียดออเดอร์
        </Text>
        <Text style={{ color: c.black, opacity: 0.7, marginTop: 2 }}>
          #{(orderId || "").slice(-6)} • {order ? order.status : "-"}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={c.S2} />
          <Text style={{ marginTop: 8, color: c.black, opacity: 0.7 }}>กำลังโหลด…</Text>
        </View>
      ) : err ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}>
          {!!err.status && <Text style={{ color: c.red }}>HTTP {err.status}</Text>}
          <Text style={{ color: c.red, marginTop: 4, textAlign: "center" }}>{err.message}</Text>
          <Pressable
            onPress={fetchDetail}
            style={{ marginTop: 12, backgroundColor: c.S2, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
          >
            <Text style={{ color: "white", fontWeight: "800" }}>ลองใหม่</Text>
          </Pressable>
        </View>
      ) : !order ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text>ไม่พบข้อมูลออเดอร์</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
          {/* meta */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: c.black }}>ลูกค้า: <Text style={{ fontWeight: "800" }}>{order.customer_name || order.customerName || "-"}</Text></Text>
            <Text style={{ color: c.black, marginTop: 2 }}>เวลาสร้าง: <Text style={{ fontWeight: "800" }}>{fmtTime(order.createdAt || order.created_at)}</Text></Text>
            <Text style={{ color: c.black, marginTop: 2 }}>อัปเดตล่าสุด: <Text style={{ fontWeight: "800" }}>{fmtTime(order.updatedAt || order.updated_at)}</Text></Text>
            {!!order.note && <Text style={{ color: c.black, marginTop: 2 }}>หมายเหตุ: <Text style={{ fontWeight: "800" }}>{order.note}</Text></Text>}
          </View>

          {/* items */}
          <View style={{ borderWidth: 1, borderColor: c.S3, borderRadius: 12, overflow: "hidden" }}>
            <View style={{ backgroundColor: c.S3, padding: 12 }}>
              <Text style={{ fontWeight: "900", color: c.black }}>รายการอาหาร</Text>
            </View>
            {items.length === 0 ? (
              <View style={{ padding: 12 }}>
                <Text style={{ color: c.black, opacity: 0.7 }}>ไม่มีรายการ</Text>
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(it, i) => String(it.id || it.menuId || i)}
                renderItem={({ item: it }) => {
                  const qty = toNum(it.qty ?? it.quantity ?? 1) || 1;
                  const price = toNum(it.price ?? it.unitPrice ?? 0);
                  return (
                    <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: c.S3 }}>
                      <Text style={{ fontWeight: "800", color: c.black }}>{it.name || "-"}</Text>
                      {!!it.description && <Text style={{ color: c.black, opacity: 0.7 }}>{it.description}</Text>}
                      <Text style={{ color: c.black, marginTop: 4 }}>
                        {qty} × {currencyTHB(price)} = <Text style={{ fontWeight: "900" }}>{currencyTHB(qty * price)}</Text>
                      </Text>
                      {!!it.extras && (
                        <Text style={{ color: c.black, opacity: 0.8, marginTop: 4 }}>
                          เพิ่มเติม: {typeof it.extras === "string" ? it.extras : JSON.stringify(it.extras)}
                        </Text>
                      )}
                    </View>
                  );
                }}
                scrollEnabled={false}
              />
            )}
          </View>

          {/* total */}
          <View style={{ alignItems: "flex-end", marginTop: 12 }}>
            <Text style={{ color: c.black }}>
              รวมทั้งหมด: <Text style={{ fontSize: 18, fontWeight: "900" }}>{currencyTHB(order.total)}</Text>
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
    