// src/Vendor/ReserveShop.jsx
import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { api } from "../../api/axios";
import { BaseColor as c } from "../../components/Color";
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

const toDate = (v) => {
  if (!v) return null;
  if (typeof v === "object" && ("seconds" in v || "_seconds" in v)) {
    const s = v.seconds ?? v._seconds;
    return new Date(s * 1000);
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

/** ทำทรง reservation ให้สม่ำเสมอ (ไม่สน status แล้ว) */
const normalizeReservations = (data) => {
  let list = [];
  if (!data) return list;
  if (Array.isArray(data)) list = data;
  else if (Array.isArray(data.reservations)) list = data.reservations;
  else if (Array.isArray(data.items)) list = data.items;
  else if (Array.isArray(data.data)) list = data.data;

  return (list || []).map((r, i) => {
    const id = r.id || r.ID || r.reservation_id || String(i);
    const start =
      r.startAt ||
      r.start_at ||
      r.datetime ||
      r.date ||
      r.reserve_time ||
      r.dayKey ||
      r.createdAt;

    return {
      id,
      startAt: start,
      people:
        Number(
          r.people ??
            r.party_size ??
            r.guests ??
            r.qty ??
            r.count ??
            r.pax ??
            1
        ) || 1,
      user_id: r.user_id || r.userId || r.customer_id || "-",
      phone: r.phone || r.customerPhone || r.customer_phone || "",
      note: r.note || r.notes || r.remark || "",
      createdAt: r.createdAt || r.created_at || r.timestamp || null,
    };
  });
};

/* ---------- main component ---------- */
export default function ReserveShop() {
  const Auth = useSelector((state) => state.auth);

  const [shopId, setShopId] = useState(null);
  const [resv, setResv] = useState([]);
  const [loading, setLoading] = useState(true);      // โหลดครั้งแรก
  const [refreshing, setRefreshing] = useState(false); // pull-to-refresh
  const [err, setErr] = useState(null);

  // memo header กัน object ใหม่ทุก render (กัน useEffect ลูป)
  const headers = useMemo(
    () =>
      Auth?.token
        ? { Authorization: `Bearer ${Auth.token}` }
        : undefined,
    [Auth?.token]
  );

  /* ---------- ดึง shopId จาก vendor (Auth.user) ---------- */
  const fetchShopId = useCallback(async () => {
    try {
      if (!Auth?.user) return;
      const { data } = await api.get(`/shop/by-id/${Auth.user}`, {
        headers,
      });
      const id =
        data?.id ||
        data?.shopId ||
        data?.shop_id ||
        data?.shop?.id ||
        data?.shop?.shopId ||
        null;
      setShopId(id);
      console.log("[ReserveShop] shopId =", id);
    } catch (e) {
      console.log("[ReserveShop] get shop by vendor failed:", e?.message);
      setShopId(null);
    }
  }, [Auth?.user, headers]);

  useEffect(() => {
    fetchShopId();
  }, [fetchShopId]);

  /* ---------- ดึงรายการจอง ---------- */
  const fetchReservations = useCallback(async () => {
    if (!shopId) return;
    try {
      setErr(null);
      setLoading(true);

      let res;
      try {
        // ตาม route ที่มี: /shops/:id/reservations
        res = await api.get(`/shop/${shopId}/reservations`, {
          headers: { "Cache-Control": "no-cache", ...headers },
        });
        console.log(res.data)
      } catch (e1) {
        if (e1?.response?.status === 404) {
          setResv([]);
          setErr(null);
          return;
        }
        // fallback: /shop/:id/reservations
        try {
          res = await api.get(`/shop/${shopId}/reservations`, {
            headers: { "Cache-Control": "no-cache", ...headers },
          });
        } catch (e2) {
          if (e2?.response?.status === 404) {
            setResv([]);
            setErr(null);
            return;
          }
          throw e2;
        }
      }

      const list = normalizeReservations(res?.data);

      // 🔁 sort ทั้งหมดตามเวลา (startAt > createdAt)
      const sorted = [...list].sort((a, b) => {
        const da = +toDate(a.startAt || a.createdAt) || 0;
        const db = +toDate(b.startAt || b.createdAt) || 0;
        return da - db; // เก่าสุด → ใหม่สุด (ถ้าอยากให้ใหม่สุดอยู่บน เปลี่ยนเป็น db - da)
      });

      setResv(sorted);
    } catch (e) {
      setErr(toErr(e, "โหลดรายการจองไม่สำเร็จ"));
      setResv([]);
    } finally {
      setLoading(false);
      // ❌ ไม่ไปยุ่งกับ refreshing ตรงนี้ ปล่อยให้ onRefresh จัดการเอง
    }
  }, [shopId, headers]);

  // โหลดรายการจองเมื่อรู้ shopId แล้ว
  useEffect(() => {
    if (!shopId) return;
    fetchReservations();
  }, [shopId, fetchReservations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);          // spinner ด้านบนเริ่มหมุน
    await fetchReservations();    // ใช้ฟังก์ชันเดียวกัน
    setRefreshing(false);         // ดับ spinner
  }, [fetchReservations]);

  const renderItem = ({ item: r }) => (
    <View
      style={{
        backgroundColor: c.fullwhite,
        padding: 14,
        borderRadius: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: c.S3,
      }}
    >
      {/* header */}
      <Text style={{ fontSize: 16, fontWeight: "900", color: c.black }}>
        การจอง #{r.id?.slice(-6) || "-"}
      </Text>

      {/* meta */}
      <Text style={{ marginTop: 6, color: c.black, opacity: 0.7 }}>
        ผู้จอง (userId):{" "}
        <Text style={{ color: c.black, fontWeight: "700" }}>
          {r.user_id || "-"}
        </Text>
      </Text>

      <Text style={{ marginTop: 2, color: c.black, opacity: 0.7 }}>
        เวลา:{" "}
        <Text style={{ color: c.black, fontWeight: "700" }}>
          {fmtDateTime(r.startAt || r.createdAt)}
        </Text>
      </Text>

      <Text style={{ marginTop: 2, color: c.black, opacity: 0.7 }}>
        จำนวนคน:{" "}
        <Text style={{ color: c.black, fontWeight: "900" }}>{r.people}</Text>
      </Text>

      {!!r.phone && (
        <Text style={{ marginTop: 2, color: c.black, opacity: 0.7 }}>
          โทร: {r.phone}
        </Text>
      )}
      {!!r.note && (
        <Text style={{ marginTop: 6, color: c.black }}>
          หมายเหตุ: {r.note}
        </Text>
      )}
    </View>
  );

  const totals = useMemo(() => {
    const count = resv.length;
    const people = resv.reduce(
      (acc, r) => acc + (Number(r.people) || 0),
      0
    );
    return { count, people };
  }, [resv]);

  /* ---------- render ---------- */
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.fullwhite }}
      edges={["top"]}
    >
      <StatusBar style="dark" />

      {/* header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: c.black }}>
          รายการจองเข้าร้าน
        </Text>
        <Text style={{ color: c.black, opacity: 0.7, marginTop: 2 }}>
          ทั้งหมด • {totals.count} รายการ • {totals.people} คน
        </Text>
      </View>

      {/* ถ้า shopId ยังไม่รู้เลย */}
      {!shopId && loading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color={c.S2} />
          <Text style={{ marginTop: 8, color: c.black, opacity: 0.7 }}>
            กำลังเตรียมข้อมูลร้าน…
          </Text>
        </View>
      ) : loading && !refreshing ? (
        // โหลดครั้งแรก (มี shopId แล้ว แต่ยังดึง reservations อยู่)
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator size="large" color={c.S2} />
          <Text style={{ marginTop: 8, color: c.black, opacity: 0.7 }}>
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
          {!!err.status && (
            <Text style={{ color: c.red }}>HTTP {err.status}</Text>
          )}
          <Text
            style={{
              color: c.red,
              marginTop: 4,
              textAlign: "center",
            }}
          >
            {err.message}
          </Text>
          <Pressable
            onPress={fetchReservations}
            style={{
              marginTop: 12,
              backgroundColor: c.S2,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: c.fullwhite, fontWeight: "800" }}>
              ลองใหม่
            </Text>
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
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[c.S2]}
            />
          }
          ListEmptyComponent={() => (
            <View style={{ alignItems: "center", marginTop: 24 }}>
              <Text style={{ color: c.black, opacity: 0.7 }}>
                ยังไม่มีการจองขณะนี้
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
