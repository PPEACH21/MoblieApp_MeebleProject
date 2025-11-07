// src/Vendor/V_ButtonNav.jsx
import React, { useEffect, useState, useMemo } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import AppTabs from "../Navigation/appTab.js";
import { api } from "../axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
// (ถ้ามี action logout ใน slice ให้เปิดบรรทัดนี้)
// import { logout } from "../redux/slices/authSlice";

export default function V_ButtonNav() {
  const dispatch = useDispatch();
  const authState = useSelector((s) => s.auth);

  // ✅ รองรับทั้ง uid เป็นสตริง หรือ user เป็น object ({ uid: "..." })
  const vendorId = useMemo(() => {
    const a = authState?.uid;
    const b = authState?.user;
    if (typeof a === "string" && a) return a;
    if (typeof b === "string" && b) return b;
    if (b && typeof b === "object" && b.uid) return String(b.uid);
    return "";
  }, [authState?.uid, authState?.user]);

  const [bearer, setBearer] = useState(authState?.token ?? "");
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // ✅ เติม: มี token ไหม (memo)
  const hasToken = useMemo(() => !!(bearer && String(bearer).trim()), [bearer]);

  // ✅ เตรียม token จาก Redux หรือ AsyncStorage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (authState?.token) {
          if (!cancelled) setBearer(authState.token);
          return;
        }
        const stored = await AsyncStorage.getItem("token");
        if (!cancelled) setBearer(stored || "");
        if (!stored && !authState?.token && !cancelled) {
          setShop(null);
          setMsg("กรุณาเข้าสู่ระบบ");
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setBearer("");
          setShop(null);
          setMsg("กรุณาเข้าสู่ระบบ");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [authState?.token]);

  // ✅ โหลดร้านเมื่อมี token + vendorId เท่านั้น
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!hasToken) { setLoading(false); return; }
      if (!vendorId) {
        setMsg("ยังไม่พบ vendorId ใน state");
        setShop(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setMsg("");

      try {
        const headers = { Authorization: `Bearer ${bearer}` };
        const url = `/shops/vendor/${vendorId}`;
        const res = await api.get(url, { headers });
        if (cancelled) return;

        const found = res?.data?.shop ?? null;
        if (found) {
          setShop(found);
          setMsg("");
        } else {
          setShop(null);
          setMsg("ไม่พบร้านในบัญชีนี้");
        }
      } catch (e) {
        if (cancelled) return;
        const status = e?.response?.status;
        if (status === 404) {
          setMsg("ไม่พบร้านของบัญชีนี้ (404)");
          setShop(null);
        } else if (status === 401) {
          setMsg("เซสชันหมดอายุ โปรดเข้าสู่ระบบใหม่");
          setShop(null);
          // ล้าง token ที่เสีย
          await AsyncStorage.removeItem("token");
          // ถ้ามี action logout ให้ปลดคอมเมนต์:
          // dispatch(logout());
        } else {
          setMsg("โหลดร้านไม่สำเร็จ");
          setShop(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [vendorId, bearer, hasToken]);

  // ---------- Render ----------
  if (!hasToken) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8, textAlign: "center" }}>
          {msg || "กำลังออกจากระบบ…"}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>กำลังโหลดร้านของคุณ...</Text>
      </View>
    );
  }

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

  return <AppTabs shopId={String(shopId)} />;
}
