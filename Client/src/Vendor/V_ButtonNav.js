// src/Vendor/V_ButtonNav.jsx
import React, { useEffect, useState, useMemo } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import { useSelector } from "react-redux";
import AppTabs from "../Navigation/appTab.js";
import { api } from "../axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function V_ButtonNav() {
  const authState = useSelector((s) => s.auth);

  // รองรับสองรูปแบบที่คุณเคยใช้: uid หรือ user
  const vendorId = useMemo(
    () => authState?.uid ?? authState?.user ?? "",
    [authState?.uid, authState?.user]
  );

  // token ที่แนบไปกับ header (พยายามหาให้ครบทุกแหล่ง)
  const [bearer, setBearer] = useState(authState?.token ?? "");
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // เตรียม token ถ้าใน Redux ไม่มี
  useEffect(() => {
    let cancelled = false;

    const ensureToken = async () => {
      try {
        // 1) ถ้ามีใน Redux ใช้เลย
        if (authState?.token) {
          if (!cancelled) setBearer(authState.token);
          return;
        }
        // 3) ลองดึง JWT ของระบบคุณเองจาก AsyncStorage
        const stored = await AsyncStorage.getItem("token");
        if (stored && !cancelled) {
          setBearer(stored);
          return;
        }
      } catch (e) {
        // ไม่เป็นไร แค่ไม่มี token
      }
    };

    ensureToken();
    return () => {
      cancelled = true;
    };
  }, [authState?.token]);

  // โหลดร้านจาก vendorId
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!vendorId) {
        setMsg("ยังไม่พบ vendorId ใน state");
        setLoading(false);
        return;
      }

      setLoading(true);
      setMsg("");

      const url = `/shops/vendor/${vendorId}`; // ✅ ค้นร้านจากฟิลด์ vendor_id
      const headers = bearer ? { Authorization: `Bearer ${bearer}` } : {};

      try {
        console.log("➡️ GET", url, "token?", !!bearer);
        const res = await api.get(url, { headers });
        const found = res?.data?.shop ?? null;

        if (cancelled) return;

        if (found) {
          setShop(found);
        } else {
          setMsg("ไม่พบร้านในบัญชีนี้");
        }
      } catch (e) {
        if (cancelled) return;

        const status = e?.response?.status;
        const data = e?.response?.data;
        console.log("❌ error", status, data || e?.message);

        if (status === 404) setMsg("ไม่พบร้านของบัญชีนี้ (404)");
        else if (status === 401) setMsg("ไม่ได้รับอนุญาต (401) โปรดเข้าสู่ระบบใหม่");
        else setMsg("โหลดร้านไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [vendorId, bearer]);

  // กำลังโหลด
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>กำลังโหลดร้านของคุณ...</Text>
      </View>
    );
  }

  // ไม่พบร้าน / มีข้อความแจ้งเตือน
  if (!shop) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <Text style={{ textAlign: "center" }}>{msg || "ยังไม่มีร้าน โปรดสร้างร้านใหม่"}</Text>
      </View>
    );
  }


  const shopId = shop?.id || shop?.shop_id || "";
  if (!shopId) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <Text style={{ textAlign: "center" }}>ไม่พบ Document ID ของร้าน (คาดหวัง field 'id')</Text>
      </View>
    );
  }

  // ✅ ส่งต่อเข้า AppTabs ทันที
  return <AppTabs shopId={String(shopId)} />;
}
