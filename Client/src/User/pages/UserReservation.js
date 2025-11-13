import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from "react-native";
import { useSelector } from "react-redux";
import { api } from "../../api/axios";
import { BaseColor as c } from "../../components/Color";
import { m } from "../../paraglide/messages";
/* ---------- format date ---------- */
const fmtDateOnly = (v) => {
  try {
    const d =
      typeof v === "object" && v?.seconds
        ? new Date(v.seconds * 1000)
        : v instanceof Date
        ? v
        : new Date(v);

    if (isNaN(d.getTime())) return "-";

    return d.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "-";
  }
};

/* ---------- status pill ---------- */
const StatusPill = ({ status }) => {
  const map = {
    pending: { bg: "#eff6ff", fg: "#1d4ed8", label: "รอยืนยัน" },
    confirmed: { bg: "#ecfdf5", fg: "#047857", label: "ยืนยันแล้ว" },
    canceled: { bg: "#fee2e2", fg: "#b91c1c", label: "ยกเลิก" },
    completed: { bg: "#f5f3ff", fg: "#6d28d9", label: "เสร็จสิ้น" },
  };

  const key = String(status || "").toLowerCase();
  const sty = map[key] || {
    bg: "#e5e7eb",
    fg: "#374151",
    label: status || "ไม่ระบุ",
  };

  return (
    <View
      style={{
        backgroundColor: sty.bg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
      }}
    >
      <Text style={{ color: sty.fg, fontWeight: "700", fontSize: 12 }}>
        {sty.label}
      </Text>
    </View>
  );
};

/* ---------- normalize Firestore data ---------- */
const normalizeReservation = (raw) => ({
  id: raw.id || raw.ID || raw.docId,

  shop_id: raw.shop_id || raw.shopId || "",
  shop_name: raw.shop_name || raw.shopName || "ไม่ระบุชื่อร้าน",

  user_id: raw.user_id || raw.userId || "",

  people: Number(raw.people || 1) || 1,

  // Firestore ไม่ส่ง date → ใช้ createdAt / dayKey สำรอง
  date:
    raw.date ||
    raw.reserveDate ||
    raw.reserved_at ||
    raw.reservedDate ||
    raw.dayKey ||
    raw.createdAt ||
    null,

  note: raw.note || "",

  status: raw.status || "pending",

  createdAt: raw.createdAt || null,
});

/* ---------- main screen ---------- */
export default function UserReserveScreen() {
  const Auth = useSelector((s) => s.auth);
  const [reserves, setReserves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);

  const fetchReserves = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);

      const userId = Auth.user;
      if (!userId) {
        setReserves([]);
        return;
      }

      // ดึงข้อมูลจาก BE: GET /users/:userId/reservations
      const res = await api.get(`/users/${userId}/reservations`);

      const data = res?.data;
      const list = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : [];

      // แปลง field ให้เป็นรูปเดียวกันก่อน
      const base = list.map(normalizeReservation).filter((x) => x.id);

      // ---------- ดึงชื่อร้านจาก shop_id ทั้งหมด ----------
      const shopIds = Array.from(
        new Set(base.map((x) => x.shop_id).filter(Boolean))
      );

      const shopNameMap = {};
      await Promise.all(
        shopIds.map(async (sid) => {
          try {
            const r = await api.get(`/shop/${sid}`);
            const name =
              r?.data?.shop?.name ||
              r?.data?.name ||
              r?.data?.shop_name ||
              "ไม่ระบุชื่อร้าน";
            shopNameMap[sid] = name;
          } catch (e) {
            console.log("โหลดชื่อร้านไม่สำเร็จ shopId =", sid, e?.message);
            shopNameMap[sid] = "ไม่ระบุชื่อร้าน";
          }
        })
      );

      // เอาชื่อร้านใส่กลับเข้าไปในรายการจอง
      const normalized = base.map((rsv) => ({
        ...rsv,
        shop_name:
          shopNameMap[rsv.shop_id] || rsv.shop_name || "ไม่ระบุชื่อร้าน",
      }));

      // ---------- sort จากใหม่ → เก่า ----------
      normalized.sort((a, b) => {
        const da = a.createdAt?.seconds
          ? a.createdAt.seconds * 1000
          : Date.parse(a.createdAt || a.date || 0);

        const db = b.createdAt?.seconds
          ? b.createdAt.seconds * 1000
          : Date.parse(b.createdAt || b.date || 0);

        return db - da;
      });

      setReserves(normalized);
    } catch (e) {
      console.log("โหลดข้อมูลการจองไม่สำเร็จ", e?.message || e);
      setErr(
        e?.response?.data?.error || e?.message || "โหลดข้อมูลการจองไม่สำเร็จ"
      );
      setReserves([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [Auth.user]);

  useEffect(() => {
    fetchReserves();
  }, [fetchReserves]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchReserves().catch(() => {});
    setRefreshing(false);
  }, [fetchReserves]);

  const renderItem = ({ item }) => (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        marginBottom: 10,
        backgroundColor: "white",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text
            style={{
              fontWeight: "800",
              fontSize: 16,
              color: "#0f172a",
            }}
            numberOfLines={1}
          >
            {item.shop_name}
          </Text>
          <Text style={{ color: "#6b7280", marginTop: 2 }}>
            วันที่จอง: {item.date ? fmtDateOnly(item.date) : "-"}
          </Text>

          <Text style={{ color: "#6b7280", marginTop: 8, fontWeight: "600" }}>
            เบอร์โทร: {item.phone}
          </Text>

          <Text style={{ color: "#6b7280", marginTop: 2 }}>
            จำนวนคน: {item.people}
          </Text>
        </View>

        <StatusPill status={item.status} />
      </View>

      {!!item.note && (
        <View
          style={{
            marginTop: 8,
            padding: 8,
            borderRadius: 8,
            backgroundColor: "#f9fafb",
          }}
        >
          <Text style={{ fontSize: 12, color: "#4b5563" }}>
            หมายเหตุ: {item.note}
          </Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={c.S2} />
        <Text style={{ marginTop: 8, color: "#6b7280" }}>
          กำลังโหลดข้อมูลการจอง...
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
          {err}
        </Text>
        <Pressable
          onPress={fetchReserves}
          style={{
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: c.S2,
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>ลองใหม่</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.fullwhite }}>
      <Text
        style={{
          fontSize: 23,
          fontWeight: "bold",
          marginLeft: 10,
          padding: 10,
          marginTop: 20,
        }}
        allowFontScaling={false}
      >
        {m.Reservations()}
      </Text>
      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        data={reserves}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={{ paddingTop: 40, alignItems: "center" }}>
            <Text style={{ color: "#6b7280" }}>ยังไม่มีประวัติการจองร้าน</Text>
          </View>
        }
      />
    </View>
  );
}
