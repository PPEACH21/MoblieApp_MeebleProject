// src/Vendor/HomeShop.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Switch,
  ActivityIndicator,
  Alert,
  Pressable,
  Image,
  Modal,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { api } from "../axios";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import Constants from "expo-constants";
import { BaseColor } from "../components/Color";

/* ---------- constants ---------- */
const STATUS_OPEN = "open";
const STATUS_CLOSED = "closed";

/** 🔁 ให้ตรงกับ backend (models.AllowedTypes) */
const TYPES = ["MainCourse", "Beverage", "FastFoods", "Appetizer", "Dessert"];
const TYPE_LABEL = {
  MainCourse: "Main Course",
  Beverage: "Beverage",
  FastFoods: "Fast Foods",
  Appetizer: "Appetizer",
  Dessert: "Dessert",
};

/* ---------- styles ---------- */
const baseStyles = {
  container: { flex: 1, padding: 16, backgroundColor: "white" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "800", color: BaseColor.black },
  error: { color: BaseColor.red, marginTop: 6, textAlign: "center" },
  retryBtn: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: BaseColor.S2,
  },
  retryText: { color: BaseColor.fullwhite, fontWeight: "700" },
  card: {
    marginTop: 12,
    backgroundColor: BaseColor.fullwhite,
    borderRadius: 14,
    padding: 14,
    shadowColor: BaseColor.fullblack,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BaseColor.S3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: { flexDirection: "row", alignItems: "center" },
  right: { flexDirection: "row", alignItems: "center" },
  label: { color: BaseColor.black, fontWeight: "700", marginRight: 8 },
  value: { color: BaseColor.black, fontWeight: "600" },
  badge: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    color: BaseColor.fullwhite,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  noImage: {
    width: "100%",
    backgroundColor: BaseColor.S3,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
};

const styles = {
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: BaseColor.S2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryText: { color: BaseColor.fullwhite, fontWeight: "700" },
  ghostBtn: {
    backgroundColor: BaseColor.S3,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ghostText: { color: BaseColor.black, fontWeight: "700" },
  modalSheet: {
    backgroundColor: BaseColor.fullwhite,
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "90%",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "flex-end",
  },
  optRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BaseColor.S4,
  },
  fieldWrap: { marginBottom: 12 },
  fieldLabelNice: { color: BaseColor.black, fontWeight: "700", marginBottom: 6 },
  fieldBox: {
    backgroundColor: BaseColor.fullwhite,
    borderWidth: 1.5,
    borderColor: BaseColor.S3,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: BaseColor.fullblack,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  fieldBoxFocused: { borderColor: BaseColor.S2 },
  inputNice: { fontSize: 16, color: BaseColor.black },
  textareaNice: { fontSize: 16, color: BaseColor.black, minHeight: 96, textAlignVertical: "top" },
  selectBox: {
    backgroundColor: BaseColor.fullwhite,
    borderWidth: 1.5,
    borderColor: BaseColor.S3,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: BaseColor.fullblack,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  selectBoxFocused: { borderColor: BaseColor.S2 },
  selectValueNice: { color: BaseColor.black, fontWeight: "600", fontSize: 16 },
  selectPlaceholderNice: { color: "#9ca3af", fontSize: 16 },
  chevron: { marginLeft: 8, opacity: 0.5, fontSize: 16, color: BaseColor.black },
};

/* ---------- utils ---------- */
const toErr = (e, fallback = "เกิดข้อผิดพลาด") => {
  const status = e?.response?.status ?? null;
  const message =
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.message ||
    fallback;
  return { status, message: String(message) };
};

const toBool = (v) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes" || s === "open" || s === "enabled";
  }
  return false;
};

const normalizeShop = (s) => {
  if (!s) return s;
  const rawStatus = s.status ?? s.shop_status ?? s.State ?? s.is_open ?? s.open ?? s.enabled;
  const statusIsClosed =
    (typeof rawStatus === "string" && rawStatus.toLowerCase() === "closed") ||
    (typeof rawStatus !== "string" && !toBool(rawStatus));
  return {
    ...s,
    order_active: toBool(
      s.order_active ?? s.orderActive ?? s.accept_order ?? s.is_order_open
    ),
    reserve_active: toBool(
      s.reserve_active ?? s.reserveActive ?? s.accept_reserve ?? s.is_reserve_open
    ),
    status: statusIsClosed ? STATUS_CLOSED : STATUS_OPEN,
  };
};

/* ---------- image helpers ---------- */
function guessMimeFromUri(uri = "") {
  const lower = uri.split("?")[0].toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
}

async function uriToBase64(uri) {
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    const filename = uri.split("/").pop()?.split("?")[0] || `picked_${Date.now()}.jpg`;
    const dest = FileSystem.cacheDirectory + filename;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return await FileSystem.readAsStringAsync(dest, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
}

async function ensureBase64(image) {
  if (!image) return { base64: null, passthroughUrl: null };
  if (/^https?:\/\//i.test(image)) return { base64: null, passthroughUrl: image };
  if (/^data:/i.test(image)) {
    const b64 = image.split(",")[1] || "";
    return { base64: b64, passthroughUrl: null };
  }
  const b64 = await uriToBase64(image);
  return { base64: b64, passthroughUrl: null };
}

async function uploadToImgbb(base64) {
  const key =
    process.env.EXPO_PUBLIC_IMGBB_KEY ||
    (Constants?.expoConfig?.extra?.imgbbKey ?? "");
  if (!key) throw new Error("ยังไม่ได้ตั้งค่า IMGBB KEY");

  const fd = new FormData();
  fd.append("key", key);
  fd.append("image", base64);

  const resp = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: fd,
  });
  const json = await resp.json();
  if (!json?.success) {
    const msg =
      json?.error?.message ||
      json?.data?.error?.message ||
      "อัปโหลดรูปไป imgbb ไม่สำเร็จ";
    throw new Error(msg);
  }
  return json?.data?.display_url || json?.data?.url;
}

/* ---------- component ---------- */
export default function HomeShop(props) {
  const route = useRoute();
  const shopId = route?.params?.shopId ?? props?.shopId ?? "";

  // token จาก Redux (ไม่มี Firebase Auth)
  const token = useSelector((s) => s?.auth?.token ?? "");
  const buildHeaders = useCallback(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({ shop: false, order: false, reserve: false });
  const [err, setErr] = useState(null);

  // edit modal
  const [openEdit, setOpenEdit] = useState(false);
  const [edit, setEdit] = useState({ shop_name: "", description: "", type: "", image: "" });
  const [localImg, setLocalImg] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const [typePickerOpen, setTypePickerOpen] = useState(false);

  /* ---------- fetch shop ---------- */
  const fetchShop = useCallback(async () => {
    if (!shopId) {
      setErr({ status: 400, message: "ไม่พบ shopId (ต้องส่งจาก route/props)" });
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setErr(null);
      const res = await api.get(`/shop/${shopId}`, {
        headers: { ...buildHeaders(), "Cache-Control": "no-cache" },
        params: { _ts: Date.now() },
      });
      const found = res?.data?.shop ?? res?.data ?? null;
      if (!found) {
        setErr({ status: 404, message: "ยังไม่มีร้าน โปรดสร้างร้านก่อน" });
      }
      setShop(normalizeShop(found));
    } catch (e) {
      setErr(toErr(e, "โหลดข้อมูลร้านไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [shopId, buildHeaders]);

  useEffect(() => {
    fetchShop();
  }, [fetchShop]);

  /* ---------- update (สำหรับสวิตช์ ใช้ /shop/:id) ---------- */
  const updateFlags = useCallback(
    async (patch) => {
      const id = shop?.ID || shop?.id || shopId;
      if (!id) throw new Error("no shop id");
      await api.put(`/shop/${id}`, patch, { headers: buildHeaders() });
      await fetchShop();
    },
    [shop, shopId, buildHeaders, fetchShop]
  );

  const isOpen = (shop?.status || STATUS_OPEN) === STATUS_OPEN;

  /* ---------- toggles ---------- */
  const onToggleShop = async (val) => {
    try {
      setSaving((s) => ({ ...s, shop: true }));
      if (val) {
        await updateFlags({ status: STATUS_OPEN });
      } else {
        await updateFlags({
          status: STATUS_CLOSED,
          order_active: false,
          reserve_active: false,
        });
      }
    } catch (e) {
      const er = toErr(e, "อัปเดตสถานะร้านไม่สำเร็จ");
      setErr(er);
      Alert.alert(`อัปเดตไม่สำเร็จ${er.status ? ` (HTTP ${er.status})` : ""}`, er.message);
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
      await updateFlags({ order_active: !!val });
    } catch (e) {
      const er = toErr(e, "อัปเดตสถานะรับออเดอร์ไม่สำเร็จ");
      setErr(er);
      Alert.alert(`อัปเดตไม่สำเร็จ${er.status ? ` (HTTP ${er.status})` : ""}`, er.message);
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
      await updateFlags({ reserve_active: !!val });
    } catch (e) {
      const er = toErr(e, "อัปเดตสถานะรับการจองไม่สำเร็จ");
      setErr(er);
      Alert.alert(`อัปเดตไม่สำเร็จ${er.status ? ` (HTTP ${er.status})` : ""}`, er.message);
    } finally {
      setSaving((s) => ({ ...s, reserve: false }));
    }
  };

  /* ---------- computed ---------- */
  const shopName = useMemo(() => shop?.shop_name || shop?.name || "—", [shop]);
  const shopImg =
    shop?.image && String(shop?.image).trim().length > 0 ? String(shop.image) : null;

  /* ---------- edit modal ---------- */
  const openEditModal = () => {
    setEdit({
      shop_name: String(shop?.shop_name || shop?.name || ""),
      description: String(shop?.description || ""),
      type: String(shop?.type || ""),
      image: String(shop?.image || ""),
    });
    setLocalImg(String(shop?.image || ""));
    setTypePickerOpen(false);
    setOpenEdit(true);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("ต้องการสิทธิ์", "กรุณาอนุญาตเข้าถึงคลังภาพ");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      const a = result.assets[0];
      if (a.base64) {
        const mime = a.mimeType || guessMimeFromUri(a.uri);
        const dataUrl = `data:${mime};base64,${a.base64}`;
        setLocalImg(dataUrl);
        setEdit((s) => ({ ...s, image: dataUrl }));
      } else if (a.uri) {
        setLocalImg(a.uri);
        setEdit((s) => ({ ...s, image: a.uri }));
      }
    }
  };

  const onSaveEdit = async () => {
    if (!edit.shop_name.trim()) {
      Alert.alert("กรอกไม่ครบ", "กรุณากรอกชื่อร้าน");
      return;
    }
    if (!edit.type) {
      Alert.alert("กรอกไม่ครบ", "กรุณาเลือกประเภท");
      return;
    }
    try {
      setSubmittingEdit(true);

      let imageUrl = "";
      const { base64, passthroughUrl } = await ensureBase64(edit.image);
      if (passthroughUrl) imageUrl = passthroughUrl;
      else if (base64) {
        setUploadingImage(true);
        imageUrl = await uploadToImgbb(base64);
      }

      const patch = {
        shop_name: edit.shop_name.trim(),
        description: edit.description.trim(),
        type: edit.type,
        image: imageUrl || "",
      };
      const id = shop?.ID || shop?.id || shopId;

      // optimistic
      setShop((prev) => (prev ? { ...prev, ...patch } : prev));
      await api.put(`/shop/${id}/update`, patch, { headers: buildHeaders() });
      setOpenEdit(false);
      await fetchShop();
    } catch (e) {
      const er = toErr(e, "อัปเดตร้านไม่สำเร็จ");
      Alert.alert(`อัปเดตไม่สำเร็จ${er.status ? ` (HTTP ${er.status})` : ""}`, er.message);
    } finally {
      setSubmittingEdit(false);
      setUploadingImage(false);
    }
  };

  /* ---------- renders ---------- */
  if (!shopId) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={baseStyles.center}>
          <Text style={baseStyles.error}>ไม่พบ shopId — ต้องส่งผ่าน route/props</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={baseStyles.center}>
        <ActivityIndicator size="large" color={BaseColor.S2} />
        <Text style={{ marginTop: 8, color: BaseColor.black }}>กำลังโหลดข้อมูล…</Text>
      </View>
    );
  }

  if (err && !shop) {
    return (
      <View style={baseStyles.center}>
        <Text style={baseStyles.title}>ร้านของฉัน</Text>
        {!!err?.status && <Text style={baseStyles.error}>HTTP {err.status}</Text>}
        <Text style={baseStyles.error}>{err?.message}</Text>
        <Pressable onPress={fetchShop} style={baseStyles.retryBtn}>
          <Text style={baseStyles.retryText}>ลองใหม่</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={baseStyles.container}>
        {shopImg ? (
          <Image
            source={{ uri: shopImg }}
            style={{ width: "100%", height: 200, borderRadius: 12 }}
            resizeMode="cover"
          />
        ) : (
          <View style={[baseStyles.noImage, { height: 200, borderRadius: 12 }]}>
            <Text style={{ color: "#9ca3af" }}>ไม่มีรูปภาพ</Text>
          </View>
        )}

        <View style={styles.headerRow}>
          <Text style={baseStyles.title}>ร้านของฉัน</Text>
          <Pressable onPress={openEditModal} style={styles.primaryBtn}>
            <Text style={styles.primaryText}>แก้ไขร้าน</Text>
          </Pressable>
        </View>

        <View style={baseStyles.card}>
          {/* ชื่อร้าน */}
          <View style={baseStyles.row}>
            <Text style={baseStyles.label}>ชื่อร้าน</Text>
            <Text style={baseStyles.value}>{shopName}</Text>
          </View>

          {/* สถานะร้าน */}
          <View style={baseStyles.row}>
            <View style={baseStyles.left}>
              <Text style={baseStyles.label}>สถานะร้าน</Text>
              <Text
                style={[
                  baseStyles.badge,
                  { backgroundColor: isOpen ? BaseColor.green : BaseColor.red },
                ]}
              >
                {isOpen ? "เปิด" : "ปิด"}
              </Text>
            </View>
            <View style={baseStyles.right}>
              {saving.shop ? (
                <ActivityIndicator color={BaseColor.S2} />
              ) : (
                <Switch
                  value={isOpen}
                  onValueChange={onToggleShop}
                  trackColor={{ false: BaseColor.S3, true: BaseColor.S1 }}
                  thumbColor={isOpen ? BaseColor.S2 : BaseColor.fullwhite}
                />
              )}
            </View>
          </View>

          {/* รับออเดอร์ */}
          <View style={baseStyles.row}>
            <View style={baseStyles.left}>
              <Text style={baseStyles.label}>รับออเดอร์</Text>
              <Text
                style={[
                  baseStyles.badge,
                  {
                    backgroundColor:
                      toBool(shop?.order_active) && isOpen ? BaseColor.green : BaseColor.S3,
                    color:
                      toBool(shop?.order_active) && isOpen
                        ? BaseColor.fullwhite
                        : BaseColor.black,
                  },
                ]}
              >
                {toBool(shop?.order_active) && isOpen ? "เปิด" : "ปิด"}
              </Text>
            </View>
            <View style={baseStyles.right}>
              {saving.order ? (
                <ActivityIndicator color={BaseColor.S2} />
              ) : (
                <Switch
                  value={!!toBool(shop?.order_active) && isOpen}
                  onValueChange={onToggleOrder}
                  disabled={!isOpen}
                  trackColor={{ false: BaseColor.S3, true: BaseColor.S1 }}
                  thumbColor={
                    !!toBool(shop?.order_active) && isOpen
                      ? BaseColor.S2
                      : BaseColor.fullwhite
                  }
                />
              )}
            </View>
          </View>

          {/* รับการจอง */}
          <View style={baseStyles.row}>
            <View style={baseStyles.left}>
              <Text style={baseStyles.label}>รับการจอง</Text>
              <Text
                style={[
                  baseStyles.badge,
                  {
                    backgroundColor:
                      toBool(shop?.reserve_active) && isOpen ? BaseColor.blue : BaseColor.S3,
                    color:
                      toBool(shop?.reserve_active) && isOpen
                        ? BaseColor.fullwhite
                        : BaseColor.black,
                  },
                ]}
              >
                {toBool(shop?.reserve_active) && isOpen ? "เปิด" : "ปิด"}
              </Text>
            </View>
            <View style={baseStyles.right}>
              {saving.reserve ? (
                <ActivityIndicator color={BaseColor.S2} />
              ) : (
                <Switch
                  value={!!toBool(shop?.reserve_active) && isOpen}
                  onValueChange={onToggleReserve}
                  disabled={!isOpen}
                  trackColor={{ false: BaseColor.S3, true: BaseColor.S1 }}
                  thumbColor={
                    !!toBool(shop?.reserve_active) && isOpen
                      ? BaseColor.S2
                      : BaseColor.fullwhite
                  }
                />
              )}
            </View>
          </View>

          <View style={baseStyles.row}>
            <View style={baseStyles.left}>
              <Text style={baseStyles.label}>ประเภท:</Text>
              <Text style={baseStyles.value}>
                {TYPE_LABEL[shop?.type] || shop?.type || "—"}
              </Text>
            </View>
          </View>

          {!!err && (
            <Text style={[baseStyles.error, { marginTop: 12 }]}>
              {err.status ? `HTTP ${err.status}: ` : ""}
              {err.message}
            </Text>
          )}
        </View>
      </View>

      {/* โมดัลแก้ไขร้าน */}
      <Modal
        transparent
        visible={openEdit}
        animationType="slide"
        onRequestClose={() => setOpenEdit(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 12, color: BaseColor.black }}>
                แก้ไขข้อมูลร้าน
              </Text>

              <ScrollView keyboardShouldPersistTaps="handled">
                {/* รูป */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                  {localImg ? (
                    <Image
                      source={{ uri: localImg }}
                      style={{ width: 80, height: 80, borderRadius: 12, backgroundColor: BaseColor.S3 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 12,
                        backgroundColor: BaseColor.S3,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#9ca3af", fontSize: 12 }}>ไม่มีรูป</Text>
                    </View>
                  )}
                  <Pressable
                    onPress={pickImage}
                    style={[styles.primaryBtn, { marginLeft: 12, opacity: uploadingImage ? 0.7 : 1 }]}
                    disabled={uploadingImage}
                  >
                    <Text style={styles.primaryText}>
                      {uploadingImage ? "กำลังอัปโหลด…" : "เปลี่ยนรูป"}
                    </Text>
                  </Pressable>
                </View>

                {/* ชื่อร้าน */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabelNice}>ชื่อร้าน *</Text>
                  <View style={[styles.fieldBox, edit._nameFocus && styles.fieldBoxFocused]}>
                    <TextInput
                      value={edit.shop_name}
                      onChangeText={(t) => setEdit((s) => ({ ...s, shop_name: t }))}
                      placeholder="เช่น Fin Café"
                      placeholderTextColor="#9ca3af"
                      style={styles.inputNice}
                      onFocus={() => setEdit((s) => ({ ...s, _nameFocus: true }))}
                      onBlur={() => setEdit((s) => ({ ...s, _nameFocus: false }))}
                      returnKeyType="done"
                    />
                  </View>
                </View>

                {/* คำอธิบาย */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabelNice}>คำอธิบาย</Text>
                  <View style={[styles.fieldBox, edit._descFocus && styles.fieldBoxFocused]}>
                    <TextInput
                      value={edit.description}
                      onChangeText={(t) => setEdit((s) => ({ ...s, description: t }))}
                      placeholder="รายละเอียดร้าน"
                      placeholderTextColor="#9ca3af"
                      style={styles.textareaNice}
                      multiline
                      onFocus={() => setEdit((s) => ({ ...s, _descFocus: true }))}
                      onBlur={() => setEdit((s) => ({ ...s, _descFocus: false }))}
                    />
                  </View>
                </View>

                {/* ประเภท */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabelNice}>ประเภท *</Text>
                  <TouchableOpacity
                    style={[styles.selectBox, typePickerOpen && styles.selectBoxFocused]}
                    onPress={() => setTypePickerOpen((v) => !v)}
                    activeOpacity={0.85}
                  >
                    <Text style={edit.type ? styles.selectValueNice : styles.selectPlaceholderNice}>
                      {edit.type ? TYPE_LABEL[edit.type] || edit.type : "— เลือกประเภท —"}
                    </Text>
                    <Text style={styles.chevron}>▼</Text>
                  </TouchableOpacity>

                  {typePickerOpen && (
                    <View
                      style={{
                        borderWidth: 1.5,
                        borderColor: BaseColor.S3,
                        borderRadius: 12,
                        marginTop: 8,
                        overflow: "hidden",
                        backgroundColor: BaseColor.fullwhite,
                        shadowColor: BaseColor.fullblack,
                        shadowOpacity: 0.04,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: 2,
                      }}
                    >
                      {TYPES.map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.optRow, { paddingHorizontal: 14 }]}
                          onPress={() => {
                            setEdit((s) => ({ ...s, type: t }));
                            setTypePickerOpen(false);
                          }}
                          activeOpacity={0.9}
                        >
                          <Text style={{ color: BaseColor.black, fontSize: 16 }}>
                            {TYPE_LABEL[t] || t}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* ปุ่มล่าง */}
                <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 18 }}>
                  <Pressable
                    onPress={() => setOpenEdit(false)}
                    style={[styles.ghostBtn, { marginRight: 8 }]}
                    disabled={submittingEdit || uploadingImage}
                  >
                    <Text style={styles.ghostText}>ยกเลิก</Text>
                  </Pressable>
                  <Pressable
                    onPress={onSaveEdit}
                    style={[styles.primaryBtn, { opacity: submittingEdit || uploadingImage ? 0.7 : 1 }]}
                    disabled={submittingEdit || uploadingImage}
                  >
                    <Text style={styles.primaryText}>
                      {submittingEdit ? "กำลังบันทึก…" : "บันทึก"}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}
