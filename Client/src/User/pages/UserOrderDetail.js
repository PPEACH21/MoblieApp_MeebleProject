// src/User/pages/UserOrderDetail.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Image,
  Pressable,
  Alert,
  ScrollView,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { api } from "../../api/axios";
import { m } from "../../paraglide/messages";

const fmtTHB = (n) =>
  (Number(n) || 0).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const fmtDate = (v) => {
  try {
    const d =
      typeof v === "object" && v?.seconds ? new Date(v.seconds * 1000) : new Date(v);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
};

const StatusPill = ({ status }) => {
  const map = {
    prepare: { bg: "#fff7ed", fg: "#9a3412", label:m.processing() },
    ready: { bg: "#ecfeff", fg: "#155e75", label: m.ongoing() },
    completed: { bg: "#ecfdf5", fg: "#065f46", label: m.success() },
    canceled: { bg: "#fee2e2", fg: "#991b1b", label: m.cancel() },
  };
  const sty = map[status] || { bg: "#eef2ff", fg: "#3730a3", label: status || "-" };
  return (
    <View
      style={{
        backgroundColor: sty.bg,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
      }}
    >
      <Text style={{ color: sty.fg, fontWeight: "800" }}>{sty.label}</Text>
    </View>
  );
};

export default function UserOrderDetail() {
  const route = useRoute();
  const nav = useNavigation();
  const Auth = useSelector((s) => s.auth);
  const orderId = String(route?.params?.orderId || "").trim();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);

  const canCancel = useMemo(() => {
    const s = String(order?.status || "").toLowerCase();
    return s === "prepare";
  }, [order?.status]);

  const fetchOrder = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      if (!orderId) throw new Error(m.no_order_found());
      let res = await api.get(`/orders/${orderId}`);
      if (!res?.data || res?.status === 404) {
        res = await api.get(`/order/${orderId}`);
      }
      const raw = res?.data?.order || res?.data || {};
      const items = Array.isArray(raw.items) ? raw.items : [];
      setOrder({
        id: raw.id || raw.ID || orderId,
        shop_name: raw.shop_name || raw.ShopName || "-",
        shop_id: raw.shop_id || raw.shopId || "",
        customer_id: raw.customer_id || raw.customerId || "",
        status: raw.status || "-",
        note: raw.note || "",
        total: Number(raw.total) || items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0),
        createdAt: raw.createdAt || raw.created_at || raw.timestamp || null,
        updatedAt: raw.updatedAt || raw.updated_at || null,
        items: items.map((it, i) => ({
          id: it.id || it.menuId || String(i),
          name: it.name || "-",
          qty: Number(it.qty) || 0,
          price: Number(it.price) || 0,
          image: it.image || "",
          description: it.description || "",
        })),
      });
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || m.Failedorders());
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrder().catch(() => {});
    setRefreshing(false);
  }, [fetchOrder]);


  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8, color: "#64748b" }}>{m.loading()}...</Text>
      </View>
    );
  }

  if (err) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}>
        <Text style={{ color: "#b91c1c", textAlign: "center", marginBottom: 12 }}>
          {m.error_occurred()}: {String(err)}
        </Text>
        <Pressable
          onPress={fetchOrder}
          style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: "#2563eb" }}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>{m.tryagain()}</Text>
        </Pressable>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#64748b" }}>{m.no_order_found()}</Text>
      </View>
    );
  }

  const renderItem = ({ item }) => (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: "#e5e7eb",
      }}
    >
      <Image
        source={{
          uri: item.image?.startsWith("http")
            ? item.image
            : "https://via.placeholder.com/80x80.png?text=%20",
        }}
        style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: "#f1f5f9" }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "800", color: "#0f172a" }} numberOfLines={1}>
          {item.name}
        </Text>
        {!!item.description && (
          <Text style={{ color: "#64748b", marginTop: 2 }} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
          <Text style={{ color: "#334155" }}>
            x{item.qty}
          </Text>
          <Text style={{ fontWeight: "800", color: "#111827" }}>
            {fmtTHB((Number(item.qty) || 0) * (Number(item.price) || 0))}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16 }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#0f172a" }} numberOfLines={1}>
              {order.shop_name || m.Orders}
            </Text>
            <Text style={{ color: "#64748b", marginTop: 2 }}>{m.No()} : {order.id}</Text>
            <Text style={{ color: "#64748b", marginTop: 2 }}>{m.createdAt()} : {fmtDate(order.createdAt)}</Text>
          </View>
          <StatusPill status={order.status} />
        </View>

        {!!order.note && (
          <View
            style={{
              marginTop: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: "#fde68a",
              backgroundColor: "#fffbeb",
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#92400e", fontWeight: "800", marginBottom: 4 }}>{m.Note()}</Text>
            <Text style={{ color: "#92400e" }}>{order.note}</Text>
          </View>
        )}

        <View style={{ marginTop: 16, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12 }}>
          <FlatList
            data={order.items || []}
            keyExtractor={(it, i) => String(it.id ?? i)}
            renderItem={renderItem}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 0 }} />}
            ListEmptyComponent={
              <View style={{ padding: 16, alignItems: "center" }}>
                <Text style={{ color: "#64748b" }}>{m.noitemorders()}</Text>
              </View>
            }
          />
        </View>

        <View
          style={{
            marginTop: 16,
            padding: 12,
            borderTopWidth: 1,
            borderColor: "#e5e7eb",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#334155" }}>{m.total_all()}</Text>
          <Text style={{ fontSize: 18, fontWeight: "900", color: "#0f172a" }}>
            {fmtTHB(order.total)}
          </Text>
        </View>

        <View style={{ marginTop: 12, flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#e5e7eb",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#ffffff",
            }}
          >
            <Text style={{ fontWeight: "800", color: "#0f172a" }}>{m.back()}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
