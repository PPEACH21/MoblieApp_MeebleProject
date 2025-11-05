import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Switch,
  ActivityIndicator,
  Alert,
  Pressable,
  Image,
  StatusBar
} from "react-native";
import { api } from "../axios";
import { SafeAreaView } from "react-native-safe-area-context";
import { styles } from "../Styles/createShopStyle";

const SHOP_ID = "qIcsHxOuL5uAtW4TwAeV";
const STATUS_OPEN = "open";
const STATUS_CLOSED = "closed";

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

const normalizeShop = (s) =>
  s
    ? {
        ...s,
        order_active: !!toBool(s.order_active),
        reserve_active: !!toBool(s.reserve_active),
        status:
          (s.status || s.shop_status || s.State || STATUS_OPEN)
            .toString()
            .toLowerCase() === STATUS_CLOSED
            ? STATUS_CLOSED
            : STATUS_OPEN,
      }
    : s;

export default function HomeShop() {
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({ shop: false, order: false, reserve: false });
  const [err, setErr] = useState(null);

  const fetchShop = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      const res = await api.get(`/shop/${SHOP_ID}`);
      const found = res?.data?.shop ?? res?.data ?? null;
      if (!found) {
        setErr({ status: 404, message: "ยังไม่มีร้าน โปรดสร้างร้านก่อน" });
      }
      const norm = normalizeShop(found);
      setShop(norm);
    } catch (e) {
      setErr(toErr(e, "โหลดข้อมูลร้านไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShop();
  }, [fetchShop]);

 const updateShopPartial = useCallback(
  async (patch) => {
    const id = shop?.ID || shop?.id || SHOP_ID;
    await api.put(`/shop/${id}/update`, patch);
    setShop((prev) => (prev ? { ...prev, ...patch } : prev));
  },
  [shop]
);

  const isOpen = (shop?.status || STATUS_OPEN) === STATUS_OPEN;

  const onToggleShop = async (val) => {
    // val = true => เปิดร้าน, false => ปิดร้าน
    try {
      setSaving((s) => ({ ...s, shop: true }));
      if (val) {
        // เปิดร้าน: เปลี่ยนเฉพาะ status เป็น open (ไม่ไปยุ่งกับสวิตช์อื่น)
        await updateShopPartial({ status: STATUS_OPEN });
      } else {
        // ปิดร้าน: ปิดรับออเดอร์และรับการจองด้วย เพื่อความสอดคล้อง
        await updateShopPartial({
          status: STATUS_CLOSED,
          order_active: false,
          reserve_active: false,
        });
      }
    } catch (e) {
      const er = toErr(e, "อัปเดตสถานะร้านไม่สำเร็จ");
      setErr(er);
      Alert.alert(
        `อัปเดตไม่สำเร็จ${er.status ? ` (HTTP ${er.status})` : ""}`,
        er.message
      );
    } finally {
      setSaving((s) => ({ ...s, shop: false }));
    }
  };

  const onToggleOrder = async (val) => {
    if (!isOpen) {
      Alert.alert("ไม่สามารถเปิดได้", "ร้านปิดอยู่ กรุณาเปิดร้านก่อน");
      return;
    }
    try {
      setSaving((s) => ({ ...s, order: true }));
      await updateShopPartial({ order_active: !!val });
    } catch (e) {
      const er = toErr(e, "อัปเดตสถานะรับออเดอร์ไม่สำเร็จ");
      setErr(er);
      Alert.alert(
        `อัปเดตไม่สำเร็จ${er.status ? ` (HTTP ${er.status})` : ""}`,
        er.message
      );
    } finally {
      setSaving((s) => ({ ...s, order: false }));
    }
  };

  const onToggleReserve = async (val) => {
    if (!isOpen) {
      Alert.alert("ไม่สามารถเปิดได้", "ร้านปิดอยู่ กรุณาเปิดร้านก่อน");
      return;
    }
    try {
      setSaving((s) => ({ ...s, reserve: true }));
      await updateShopPartial({ reserve_active: !!val });
    } catch (e) {
      const er = toErr(e, "อัปเดตสถานะรับการจองไม่สำเร็จ");
      setErr(er);
      Alert.alert(
        `อัปเดตไม่สำเร็จ${er.status ? ` (HTTP ${er.status})` : ""}`,
        er.message
      );
    } finally {
      setSaving((s) => ({ ...s, reserve: false }));
    }
  };

  const shopName = useMemo(() => shop?.shop_name || shop?.name || "—", [shop]);
  const shopImg =
    shop?.image && String(shop?.image).trim().length > 0
      ? String(shop.image)
      : null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>กำลังโหลดข้อมูล…</Text>
      </View>
    );
  }

  if (err && !shop) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>ร้านของฉัน</Text>
        {!!err?.status && <Text style={styles.error}>HTTP {err.status}</Text>}
        <Text style={styles.error}>{err?.message}</Text>
        <Pressable onPress={fetchShop} style={styles.retryBtn}>
          <Text style={styles.retryText}>ลองใหม่</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <StatusBar></StatusBar>
      <View style={styles.container}>
        {shopImg ? (
          <Image
            source={{ uri: shopImg }}
            style={{ width: "100%", height: 200, borderRadius: 12 }}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.noImage, { height: 200, borderRadius: 12 }]}>
            <Text style={{ color: "#9ca3af" }}>ไม่มีรูปภาพ</Text>
          </View>
        )}

        <Text style={styles.title}>ร้านของฉัน</Text>

        <View style={styles.card}>
          {/* แถว: ชื่อร้าน */}
          <View className="row" style={styles.row}>
            <Text style={styles.label}>ชื่อร้าน</Text>
            <Text style={styles.value}>{shopName}</Text>
          </View>

          {/* แถว: สถานะร้าน (open/closed) */}
          <View style={styles.row}>
            <View style={styles.left}>
              <Text style={styles.label}>สถานะร้าน</Text>
              <Text
                style={[
                  styles.badge,
                  { backgroundColor: isOpen ? "#16a34a" : "#ef4444" },
                ]}
              >
                {isOpen ? "เปิด" : "ปิด"}
              </Text>
            </View>
            <View style={styles.right}>
              {saving.shop ? (
                <ActivityIndicator />
              ) : (
                <Switch
                  value={isOpen}
                  onValueChange={onToggleShop}
                />
              )}
            </View>
          </View>

          {/* แถว: รับออเดอร์ */}
          <View style={styles.row}>
            <View style={styles.left}>
              <Text style={styles.label}>รับออเดอร์</Text>
              <Text
                style={[
                  styles.badge,
                  {
                    backgroundColor: toBool(shop?.order_active) && isOpen
                      ? "#16a34a"
                      : "#9ca3af",
                  },
                ]}
              >
                {toBool(shop?.order_active) && isOpen ? "เปิด" : "ปิด"}
              </Text>
            </View>
            <View style={styles.right}>
              {saving.order ? (
                <ActivityIndicator />
              ) : (
                <Switch
                  value={!!toBool(shop?.order_active) && isOpen}
                  onValueChange={onToggleOrder}
                  disabled={!isOpen}
                />
              )}
            </View>
          </View>

          {/* แถว: รับการจอง */}
          <View style={styles.row}>
            <View style={styles.left}>
              <Text style={styles.label}>รับการจอง</Text>
              <Text
                style={[
                  styles.badge,
                  {
                    backgroundColor: toBool(shop?.reserve_active) && isOpen
                      ? "#6d28d9"
                      : "#9ca3af",
                  },
                ]}
              >
                {toBool(shop?.reserve_active) && isOpen ? "เปิด" : "ปิด"}
              </Text>
            </View>
            <View style={styles.right}>
              {saving.reserve ? (
                <ActivityIndicator />
              ) : (
                <Switch
                  value={!!toBool(shop?.reserve_active) && isOpen}
                  onValueChange={onToggleReserve}
                  disabled={!isOpen}
                />
              )}
            </View>
          </View>

          {!!err && (
            <Text style={[styles.error, { marginTop: 12 }]}>
              {err.status ? `HTTP ${err.status}: ` : ""}
              {err.message}
            </Text>
          )}

        </View>
      </View>
    </SafeAreaView>
  );
}
