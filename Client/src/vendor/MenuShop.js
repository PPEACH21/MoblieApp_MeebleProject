import React, { useCallback, useState } from "react";
import {
  View, Text, FlatList, ActivityIndicator, Image, Pressable, Modal,
  TextInput, Alert, Keyboard, TouchableWithoutFeedback,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import Constants from "expo-constants";
import { api } from "../axios";

/* ---------- config ---------- */
const { imgbbKey } = (Constants?.expoConfig?.extra ?? {});
const IMGBB_API_KEY = imgbbKey || "";

/* ---------- helpers ---------- */
const currencyTHB = (n) =>
  (Number(n) || 0).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const toErr = (e, fallback = "เกิดข้อผิดพลาด") => {
  const status = e?.response?.status ?? null;
  const message =
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.message ||
    fallback;
  return { status, message: String(message) };
};

// robust: URI -> base64 (รองรับ content://, ph://)
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

// upload to imgbb
async function uploadToImgbb(base64) {
  if (!IMGBB_API_KEY) throw new Error("ยังไม่ได้ตั้งค่า imgbbKey ใน app.config.js");
  const fd = new FormData();
  fd.append("key", IMGBB_API_KEY);
  fd.append("image", base64);
  const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: fd });
  const json = await res.json();
  if (!json?.success) {
    const msg = json?.error?.message || json?.data?.error?.message || "อัปโหลดรูปไป imgbb ไม่สำเร็จ";
    throw new Error(msg);
  }
  return json?.data?.display_url || json?.data?.url;
}

// รองรับ response หลายทรง -> list array
function normalizeMenuResponse(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.menu)) return data.menu;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.docs)) {
    return data.docs.map((d) => ({ id: d.id || d.ID, ...(d.data || d) }));
  }
  if (typeof data === "object") {
    const maybeItem = data.item || data.menuItem || data.items || data.data || null;
    if (maybeItem && !Array.isArray(maybeItem)) return [maybeItem];
  }
  return [];
}

// ดึง id จาก item ให้ชัด
const getId = (it) => it?.id || it?.ID || it?._id || null;

/* ---------- component ---------- */
export default function MenuShop() {
  const route = useRoute();

  // ✅ อ่าน shopId จาก params หรือ fallback
  const shopId = route?.params?.shopId ?? "qIcsHxOuL5uAtW4TwAeV";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);

  // Modal & form state (ใช้ร่วม Create/Edit)
  const [openModal, setOpenModal] = useState(false);
  const [mode, setMode] = useState("create"); // "create" | "edit"
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({ name: "", price: "", image: "", description: "" });
  const [localImageUri, setLocalImageUri] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchMenu = useCallback(async () => {
    if (!shopId) {
      setErr({ message: "ไม่พบ shopId" });
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setErr(null);
      const { data } = await api.get(`/shop/${shopId}/menu`, {
        withCredentials: true,
        headers: { "Cache-Control": "no-cache" },
        params: { _ts: Date.now() },
      });
      const list = normalizeMenuResponse(data);
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(toErr(e, "โหลดเมนูไม่สำเร็จ"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shopId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchMenu();
    }, [fetchMenu])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMenu();
  }, [fetchMenu]);

  /* ---------- Create ---------- */
  const openCreate = () => {
    setMode("create");
    setEditingId(null);
    setForm({ name: "", price: "", image: "", description: "" });
    setLocalImageUri("");
    setOpenModal(true);
  };

  /* ---------- Edit ---------- */
  const openEdit = (it) => {
    const id = getId(it);
    if (!id) {
      Alert.alert("แก้ไขไม่ได้", "ไม่พบรหัสเมนู (id) ของรายการนี้");
      return;
    }
    setMode("edit");
    setEditingId(id);
    setForm({
      name: String(it?.name ?? it?.Name ?? ""),
      price: String(it?.price ?? it?.Price ?? ""),
      image: String(it?.image ?? it?.Image ?? ""),
      description: String(it?.description ?? it?.Description ?? ""),
    });
    setLocalImageUri(String(it?.image ?? it?.Image ?? ""));
    setOpenModal(true);
  };

  /* ---------- Delete ---------- */
  const confirmDelete = (it) => {
    const id = getId(it);
    if (!id) {
      Alert.alert("ลบไม่ได้", "ไม่พบรหัสเมนู (id) ของรายการนี้");
      return;
    }
    Alert.alert(
      "ยืนยันการลบ",
      `ต้องการลบ “${it?.name || it?.Name || "เมนูนี้"}” ใช่ไหม?`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ลบ",
          style: "destructive",
          onPress: () => onDelete(id),
        },
      ]
    );
  };

  const onDelete = async (menuId) => {
    try {
      // optimistic remove
      setItems((prev) => prev.filter((x) => getId(x) !== menuId));

      await api.delete(`/shop/${shopId}/menu/${menuId}`, {
        withCredentials: true,
      });

      // sync จริง
      await fetchMenu();
    } catch (e) {
      const er = toErr(e, "ลบเมนูไม่สำเร็จ");
      Alert.alert(
        `ลบเมนูไม่สำเร็จ${er.status ? ` (HTTP ${er.status})` : ""}`,
        er.message
      );
      // rollback (รีโหลดใหม่)
      fetchMenu();
    }
  };

  /* ---------- Image Picker ---------- */
  const onPickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("ต้องการสิทธิ์เข้าถึงรูปภาพ", "โปรดอนุญาตการเข้าถึงคลังรูปภาพ");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        base64: true,
        exif: false,
      });
      if (result.canceled) return;

      const asset = result.assets?.[0];
      const uri = asset?.uri;
      if (!uri) return;

      setLocalImageUri(uri);
      setUploadingImage(true);

      const base64 = asset?.base64 || (await uriToBase64(uri));
      if (!base64) throw new Error("ไม่พบข้อมูล base64 ของรูปภาพ");

      const url = await uploadToImgbb(base64);
      setForm((s) => ({ ...s, image: url }));
    } catch (e) {
      Alert.alert("อัปโหลดรูปไม่สำเร็จ", e?.message || String(e));
    } finally {
      setUploadingImage(false);
    }
  };

  /* ---------- Submit (Create/Edit) ---------- */
  const onSubmit = async () => {
    const priceNum = Number(form.price);
    if (!form.name.trim()) {
      Alert.alert("กรอกไม่ครบ", "กรุณากรอกชื่อเมนู");
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 0) {
      Alert.alert("ราคาไม่ถูกต้อง", "กรุณากรอกราคาเป็นตัวเลข ≥ 0");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: form.name.trim(),
        price: priceNum,
        image: (form.image || "").trim(),
        description: form.description.trim(),
      };

      if (mode === "create") {
        const res = await api.post(`/shop/${shopId}/menu`, payload, {
          withCredentials: true,
        });
        const created =
          res?.data?.item || res?.data?.data || res?.data?.menuItem || res?.data || null;
        if (created && typeof created === "object") {
          setItems((prev) => [created, ...prev]);
        }
      } else {
        const menuId = editingId;
        if (!menuId) {
          Alert.alert("แก้ไขไม่ได้", "ไม่พบรหัสเมนู (id)");
          return;
        }

        // optimistic update ก่อน
        setItems((prev) =>
          prev.map((x) =>
            getId(x) === menuId ? { ...x, ...payload, id: getId(x) } : x
          )
        );

        const res = await api.put(`/shop/${shopId}/menu/${menuId}`, payload, {
          withCredentials: true,
        });

        // ถ้า server คืนของเวอร์ชันล่าสุดมาก็ซิงก์ตาม
        const updated = res?.data?.item || res?.data?.data || res?.data || null;
        if (updated && typeof updated === "object") {
          setItems((prev) =>
            prev.map((x) => (getId(x) === menuId ? { ...x, ...updated } : x))
          );
        } else {
          // หรือรีเฟรชเพื่อความชัวร์
          await fetchMenu();
        }
      }

      setOpenModal(false);
      await fetchMenu();
    } catch (e) {
      const er = toErr(e, mode === "create" ? "สร้างเมนูไม่สำเร็จ" : "อัปเดตเมนูไม่สำเร็จ");
      Alert.alert(
        `${mode === "create" ? "สร้างเมนูไม่สำเร็จ" : "อัปเดตเมนูไม่สำเร็จ"}${er.status ? ` (HTTP ${er.status})` : ""}`,
        er.message
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- Render ---------- */
  const renderItem = ({ item }) => {
    const img = String(item?.image || item?.Image || "").trim();
    const id = getId(item);

    return (
      <Pressable
        onPress={() => openEdit(item)} // ✅ แตะรายการเพื่อแก้ไข
        style={{
          flexDirection: "row",
          backgroundColor: "#f8fafc",
          borderRadius: 14,
          padding: 12,
          marginBottom: 10,
          alignItems: "center",
        }}
      >
        {img ? (
          <Image
            source={{ uri: img }}
            style={{ width: 68, height: 68, borderRadius: 12, backgroundColor: "#e5e7eb" }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: 68, height: 68, borderRadius: 12,
              backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ color: "#9ca3af", fontSize: 12 }}>ไม่มีรูป</Text>
          </View>
        )}

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>
            {item?.name ?? item?.Name ?? "-"}
          </Text>
          {!!(item?.description ?? item?.Description) && (
            <Text style={{ color: "#6b7280", marginTop: 2 }} numberOfLines={2}>
              {item?.description ?? item?.Description}
            </Text>
          )}
          <Text style={{ color: "#111827", marginTop: 6, fontWeight: "700" }}>
            {currencyTHB(item?.price ?? item?.Price)}
          </Text>
        </View>

        {/* ปุ่มลบทางขวา */}
        {!!id && (
          <Pressable
            onPress={() => confirmDelete(item)}
            style={{ paddingHorizontal: 10, paddingVertical: 6 }}
          >
            <Text style={{ color: "#ef4444", fontWeight: "700" }}>ลบ</Text>
          </Pressable>
        )}
      </Pressable>
    );
  };

  /* ---------- UI ---------- */
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>
          <FlatList
            data={items}
            keyExtractor={(it, i) => String(getId(it) || `${it?.name || it?.Name}-${i}`)}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
            refreshing={refreshing}
            onRefresh={onRefresh}
            keyboardShouldPersistTaps="handled"
            alwaysBounceVertical={true}
            overScrollMode="always"
            ListHeaderComponent={
              <View
                style={{
                  paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6,
                  flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 20, fontWeight: "800" }}>เมนูในร้าน</Text>
                <Pressable
                  onPress={openCreate}
                  style={{
                    backgroundColor: "#111827", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>+ สร้างเมนู</Text>
                </Pressable>
              </View>
            }
            ListEmptyComponent={() => (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                {loading ? (
                  <>
                    <ActivityIndicator size="large" />
                    <Text style={{ marginTop: 8, color: "#6b7280" }}>กำลังโหลดเมนู…</Text>
                  </>
                ) : err ? (
                  <View style={{ alignItems: "center", paddingHorizontal: 24 }}>
                    {!!err.status && <Text style={{ color: "#ef4444" }}>HTTP {err.status}</Text>}
                    <Text style={{ color: "#ef4444", marginTop: 4, textAlign: "center" }}>
                      {err.message}
                    </Text>
                    <Pressable
                      onPress={fetchMenu}
                      style={{
                        marginTop: 12, backgroundColor: "#111827", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                      }}
                    >
                      <Text style={{ color: "#fff" }}>ลองใหม่</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={{ color: "#6b7280" }}>ยังไม่มีเมนู — ปัดลงเพื่อรีเฟรช</Text>
                )}
              </View>
            )}
          />

          {/* Modal: Create/Edit */}
          <Modal
            visible={openModal}
            transparent
            animationType="slide"
            onRequestClose={() => setOpenModal(false)}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View
                style={{
                  flex: 1, backgroundColor: "rgba(0,0,0,0.25)",
                  alignItems: "center", justifyContent: "flex-end",
                }}
              >
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%" }}>
                  <ScrollView
                    contentContainerStyle={{
                      backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16,
                    }}
                    keyboardShouldPersistTaps="handled"
                  >
                    <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 12 }}>
                      {mode === "create" ? "สร้างเมนูใหม่" : "แก้ไขเมนู"}
                    </Text>

                    {/* รูปภาพ + ปุ่มเลือกรูป */}
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                      {localImageUri ? (
                        <Image source={{ uri: localImageUri }} style={{ width: 80, height: 80, borderRadius: 12, backgroundColor: "#e5e7eb" }} />
                      ) : form.image ? (
                        <Image source={{ uri: form.image }} style={{ width: 80, height: 80, borderRadius: 12, backgroundColor: "#e5e7eb" }} />
                      ) : (
                        <View style={{ width: 80, height: 80, borderRadius: 12, backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: "#9ca3af", fontSize: 12 }}>ไม่มีรูป</Text>
                        </View>
                      )}

                      <Pressable
                        onPress={onPickImage}
                        style={{
                          marginLeft: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
                          backgroundColor: "#111827", opacity: uploadingImage ? 0.7 : 1,
                        }}
                        disabled={uploadingImage}
                      >
                        <Text style={{ color: "#fff", fontWeight: "600" }}>
                          {uploadingImage ? "กำลังอัปโหลด…" : (mode === "create" ? "เลือกรูปจากเครื่อง" : "เปลี่ยนรูป")}
                        </Text>
                      </Pressable>
                    </View>

                    <Text style={{ color: "#374151", marginBottom: 6 }}>ชื่อเมนู</Text>
                    <TextInput
                      value={form.name}
                      onChangeText={(t) => setForm((s) => ({ ...s, name: t }))}
                      placeholder="เช่น ลาเต้เย็น"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 }}
                    />

                    <Text style={{ color: "#374151", marginBottom: 6 }}>ราคา (บาท)</Text>
                    <TextInput
                      value={form.price}
                      onChangeText={(t) => setForm((s) => ({ ...s, price: t }))}
                      placeholder="เช่น 65"
                      keyboardType="numeric"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 }}
                    />

                    <Text style={{ color: "#374151", marginBottom: 6 }}>
                      ลิงก์รูปภาพ (ถูกเติมอัตโนมัติหลังอัปโหลด)
                    </Text>
                    <TextInput
                      value={form.image}
                      onChangeText={(t) => setForm((s) => ({ ...s, image: t }))}
                      placeholder="https://…"
                      autoCapitalize="none"
                      editable={false}
                      style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, backgroundColor: "#f3f4f6" }}
                    />

                    <Text style={{ color: "#374151", marginBottom: 6 }}>คำอธิบาย (ไม่บังคับ)</Text>
                    <TextInput
                      value={form.description}
                      onChangeText={(t) => setForm((s) => ({ ...s, description: t }))}
                      placeholder="รายละเอียดเมนู"
                      multiline
                      blurOnSubmit={true}
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 80 }}
                    />

                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14 }}>
                      {/* ปุ่มลบ เฉพาะโหมดแก้ไข */}
                      {mode === "edit" ? (
                        <Pressable
                          onPress={() => confirmDelete({ id: editingId, name: form.name })}
                          style={{
                            paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                            backgroundColor: "#fee2e2",
                          }}
                          disabled={submitting || uploadingImage}
                        >
                          <Text style={{ color: "#b91c1c", fontWeight: "700" }}>ลบเมนู</Text>
                        </Pressable>
                      ) : (
                        <View />
                      )}

                      <View style={{ flexDirection: "row" }}>
                        <Pressable
                          onPress={() => setOpenModal(false)}
                          style={{
                            paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                            backgroundColor: "#e5e7eb", marginRight: 8,
                          }}
                          disabled={submitting || uploadingImage}
                        >
                          <Text style={{ color: "#111827" }}>ยกเลิก</Text>
                        </Pressable>

                        <Pressable
                          onPress={onSubmit}
                          style={{
                            paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                            backgroundColor: "#111827", opacity: submitting || uploadingImage ? 0.7 : 1,
                          }}
                          disabled={submitting || uploadingImage}
                        >
                          <Text style={{ color: "#fff", fontWeight: "700" }}>
                            {submitting ? "กำลังบันทึก…" : (mode === "create" ? "บันทึก" : "อัปเดต")}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </ScrollView>
                </KeyboardAvoidingView>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}
