// src/Vendor/ReserveShop.jsx
import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { api } from "../axios";

/* ---------- config ---------- */
const SHOP_ID = "qIcsHxOuL5uAtW4TwAeV";

/** ตัวเลือกกรองบน UI (ไม่มีสถานะแล้ว) */
const FILTERS = [
  { key: "today", label: "วันนี้" },
  { key: "upcoming", label: "ถัดไป" },
  { key: "past", label: "ผ่านมาแล้ว" },
  { key: "all", label: "ทั้งหมด" },
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
    // ถ้าเป็น Firestore Timestamp ที่เป็น toDate():
    // if (typeof v.toDate === "function") return v.toDate();
  }
  const d = new Date(v);
  return isNaN(+d) ? null : d;
};

const fmtDateTime = (v) => {
  const d = toDate(v);
  if (!d) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
};

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** ทำทรง reservation ให้สม่ำเสมอ (ไม่มี status แล้ว) */
const normalizeReservations = (data) => {
  let list = [];
  if (!data) return list;
  if (Array.isArray(data)) list = data;
  else if (Array.isArray(data.reservations)) list = data.reservations;
  else if (Array.isArray(data.items)) list = data.items;
  else if (Array.isArray(data.data)) list = data.data;

  return (list || []).map((r, i) => {
    const id = r.id || r.ID || r.reservation_id || String(i);
    const start = r.startAt || r.start_at || r.datetime || r.date || r.reserve_time;

    return {
      id,
      startAt: start,
      people: Number(
        r.people ?? r.party_size ?? r.guests ?? r.qty ?? r.count ?? r.pax ?? 1
      ) || 1,
      user_id: r.user_id || r.userId || r.customer_id || "-",
      phone: r.phone || r.customerPhone || r.customer_phone || "",
      note: r.note || r.notes || r.remark || "",
      createdAt: r.createdAt || r.created_at || r.timestamp || null,
    };
  });
};

/* ---------- main ---------- */
export default function ReserveShop() {
  const [filter, setFilter] = useState("today");
  const [resv, setResv] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);

  const fetchReservations = useCallback(async () => {
    if (!SHOP_ID) return;
    try {
      setErr(null);
      setLoading(true);

      // เส้นทางหลัก
      let res;
      try {
        res = await api.get(`/shops/${SHOP_ID}/reservations`, {
          withCredentials: true,
          headers: { "Cache-Control": "no-cache" },
        });
      } catch (e1) {
        if (e1?.response?.status === 404) {
          // ไม่มีรายการ -> เคลียร์รายการแล้วจบแบบไม่เป็น error
          setResv([]);
          setErr(null);
          setLoading(false);
          setRefreshing(false);
          return;
        }
        // สำรอง (ถ้าระบบคุณยังใช้ /shop/)
        try {
          res = await api.get(`/shop/${SHOP_ID}/reservations`, {
            withCredentials: true,
            headers: { "Cache-Control": "no-cache" },
          });
        } catch (e2) {
          if (e2?.response?.status === 404) {
            setResv([]);
            setErr(null);
            setLoading(false);
            setRefreshing(false);
            return;
          }
          throw e2;
        }
      }

      const list = normalizeReservations(res?.data);

      // กรองตามแท็บ (เวลา)
      const now = new Date();
      const todayList = [];
      const upcomingList = [];
      const pastList = [];

      for (const r of list) {
        const start = toDate(r.startAt);
        if (!start) continue;
        if (sameDay(start, now)) todayList.push(r);
        else if (start > now) upcomingList.push(r);
        else pastList.push(r);
      }

      let finalList = list;
      if (filter === "today") finalList = todayList;
      else if (filter === "upcoming") finalList = upcomingList;
      else if (filter === "past") finalList = pastList;

      // เรียงเวลาน้อย -> มาก
      finalList.sort((a, b) => {
        const da = +toDate(a.startAt) || 0;
        const db = +toDate(b.startAt) || 0;
        return da - db;
      });

      setResv(finalList);
    } catch (e) {
      setErr(toErr(e, "โหลดรายการจองไม่สำเร็จ"));
      setResv([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReservations();
  }, [fetchReservations]);

  /* ---------- UI blocks ---------- */
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

  const renderItem = ({ item: r }) => (
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
      {/* header */}
      <Text style={{ fontSize: 16, fontWeight: "800", color: "#111827" }}>
        การจอง #{r.id?.slice(-6) || "-"}
      </Text>

      {/* meta */}
      <Text style={{ marginTop: 6, color: "#6b7280" }}>
        ผู้จอง:{" "}
        <Text style={{ color: "#111827", fontWeight: "600" }}>
          {r.user_id || "-"}
        </Text>
      </Text>

      <Text style={{ marginTop: 2, color: "#6b7280" }}>
        เวลา:{" "}
        <Text style={{ color: "#111827", fontWeight: "600" }}>
          {fmtDateTime(r.startAt)}
        </Text>
      </Text>

      <Text style={{ marginTop: 2, color: "#6b7280" }}>
        จำนวนคน:{" "}
        <Text style={{ color: "#111827", fontWeight: "700" }}>{r.people}</Text>
      </Text>

      {!!r.phone && (
        <Text style={{ marginTop: 2, color: "#6b7280" }}>โทร: {r.phone}</Text>
      )}
      {!!r.note && (
        <Text style={{ marginTop: 6, color: "#374151" }}>หมายเหตุ: {r.note}</Text>
      )}
    </View>
  );

  const totals = useMemo(() => {
    const count = resv.length;
    const people = resv.reduce((acc, r) => acc + (Number(r.people) || 0), 0);
    return { count, people };
  }, [resv]);

  /* ---------- render ---------- */
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }} edges={["top"]}>
      <StatusBar style="dark" />
      {/* header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: "#111827" }}>
          รายการจองเข้าร้าน
        </Text>
        <Text style={{ color: "#6b7280", marginTop: 2 }}>
          {filter === "all"
            ? "ทั้งหมด"
            : filter === "today"
            ? "วันนี้"
            : filter === "upcoming"
            ? "ถัดไป"
            : "ที่ผ่านมาแล้ว"}
          {" • "}
          {totals.count} รายการ • {totals.people} คน
        </Text>
      </View>

      <Tabs />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8, color: "#6b7280" }}>
            กำลังโหลดรายการจอง…
          </Text>
        </View>
      ) : err ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          {!!err.status && <Text style={{ color: "#ef4444" }}>HTTP {err.status}</Text>}
          <Text style={{ color: "#ef4444", marginTop: 4, textAlign: "center" }}>
            {err.message}
          </Text>
          <Pressable
            onPress={fetchReservations}
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
          data={resv}
          keyExtractor={(r, i) => String(r.id || i)}
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
              <Text style={{ color: "#6b7280" }}>ยังไม่มีการจองขณะนี้</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
