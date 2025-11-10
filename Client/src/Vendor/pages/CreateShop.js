import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system";
import Constants from "expo-constants";
import { api } from "../../axios";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { styles } from "../../Styles/createShopStyle";

/* ---------- constants ---------- */
const TYPES = ["Appetizer", "Beverage", "Fast food", "Main course", "Dessert"];
const DEFAULT_COORD = { latitude: 13.7563, longitude: 100.5018 };

/* ---------- simple dropdown (modal) ---------- */
function SelectField({ label, value, options = [], onChange }) {
  const [open, setOpen] = useState(false);
  const currentLabel =
    options.find((o) => o.value === value)?.label || "— เลือก —";

  return (
    <View style={{ marginBottom: 10 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TouchableOpacity style={styles.selectInput} onPress={() => setOpen(true)}>
        <Text style={value ? styles.selectText : styles.selectPlaceholder}>
          {currentLabel}
        </Text>
      </TouchableOpacity>

      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{label || "เลือกค่า"}</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {options.map((item) => (
                <TouchableOpacity
                  key={String(item.value)}
                  style={styles.optionRow}
                  onPress={() => {
                    onChange?.(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>{item.label}</Text>
                  {item.value === value ? (
                    <Text style={styles.optionTick}>✓</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/* ---------- image helpers: robust base64 ---------- */

// เดา MIME จากนามสกุลไฟล์
function guessMimeFromUri(uri = "") {
  const lower = uri.split("?")[0].toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
}

// อ่านไฟล์เป็น base64; ถ้าอ่านตรง ๆ ไม่ได้ (content://, ph://) ให้ก็อปไป cache ก่อน
async function uriToBase64(uri) {
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    const filename =
      uri.split("/").pop()?.split("?")[0] || `picked_${Date.now()}.jpg`;
    const dest = FileSystem.cacheDirectory + filename;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return await FileSystem.readAsStringAsync(dest, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
}

// รับค่ารูป (อาจเป็น data:, http(s)://, หรือ file/content URI) -> คืน { base64, mime }
// - http(s):// : ไม่ต้องอัปโหลด imgbb (ส่งคืน null เพื่อใช้ URL เดิมได้)
// - data:...    : ดึง base64 ต่อได้ทันที
// - file/content: อ่าน base64 จากไฟล์
async function ensureBase64AndMime(image) {
  if (!image) return { base64: null, mime: null, urlPassthrough: null };

  // เคสเป็น URL อยู่แล้ว ไม่ต้องอัปโหลด
  if (/^https?:\/\//i.test(image)) {
    return { base64: null, mime: null, urlPassthrough: image };
  }

  // เคสเป็น data URL
  if (/^data:/i.test(image)) {
    const [meta, b64] = image.split(",");
    const mimeMatch = /^data:([^;]+);base64$/i.exec(meta || "");
    const mime = mimeMatch?.[1] || "image/jpeg";
    return { base64: b64 || "", mime, urlPassthrough: null };
  }

  // เคสเป็น file://, content://, ph://
  const mime = guessMimeFromUri(image);
  const base64 = await uriToBase64(image);
  return { base64, mime, urlPassthrough: null };
}

// อัปโหลดไป imgbb (รับ base64 “ล้วน ๆ” ไม่เอา prefix data:)
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

export default function CreateShop({ navigation }) {
  const [shopName, setShopName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("");
  const [image, setImage] = useState(null); // เก็บได้ทั้ง data:, uri, หรือ url
  const [imageUploading, setImageUploading] = useState(false);

  const [coord, setCoord] = useState(DEFAULT_COORD);
  const [gettingLocation, setGettingLocation] = useState(false);
  const mapRef = useRef(null);

  // search place
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const searchTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        setGettingLocation(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = loc.coords;
        setCoord({ latitude, longitude });
      } catch {
      } finally {
        setGettingLocation(false);
      }
    })();
  }, []);

  /* ---------- image pick ---------- */
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
      base64: true, // ขอ base64 มาเลย ถ้าบางเคสไม่มี จะ fallback อ่านเอง
    });
    if (!result.canceled) {
      const a = result.assets[0];
      if (a.base64) {
        // บางแพลตฟอร์มไม่มี a.mimeType → เดาเอาจาก uri
        const mime = a.mimeType || guessMimeFromUri(a.uri);
        setImage(`data:${mime};base64,${a.base64}`);
      } else if (a.uri) {
        // เก็บ uri ไว้ก่อน เดี๋ยวไปอ่าน base64 ตอนอัปโหลด
        setImage(a.uri);
      }
    }
  };

  // คืน URL ที่พร้อมส่ง backend:
  // - ถ้าเป็น URL อยู่แล้ว → ส่งคืน URL เดิม
  // - ถ้าเป็น data:/file:/content: → แปลง base64 แล้วอัปโหลด imgbb → ส่งคืน URL ของ imgbb
  const uploadImageIfNeeded = async () => {
    if (!image) return "";
    try {
      setImageUploading(true);

      const { base64, urlPassthrough } = await ensureBase64AndMime(image);

      if (urlPassthrough) {
        // เป็น URL http(s) อยู่แล้ว
        return urlPassthrough;
      }

      if (!base64) {
        // ไม่ควรเกิด แต่กันไว้
        return "";
      }

      const url = await uploadToImgbb(base64);
      return url;
    } finally {
      setImageUploading(false);
    }
  };

  /* ---------- map ---------- */
  const handleMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setCoord({ latitude, longitude });
  };

  /* ---------- search place (Nominatim) ---------- */
  const searchPlace = (text) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text || text.trim().length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        setSearching(true);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          text
        )}&addressdetails=1&limit=6`;
        const resp = await fetch(url, {
          headers: {
            "User-Agent": "MeebleApp/1.0 (contact: you@example.com)",
            "Accept-Language": "th,en",
          },
        });
        const data = await resp.json();
        const items = (data || []).map((it) => ({
          id: it.place_id?.toString() ?? `${it.lat},${it.lon}`,
          name: it.display_name,
          lat: parseFloat(it.lat),
          lon: parseFloat(it.lon),
        }));
        setResults(items);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const selectResult = (item) => {
    setCoord({ latitude: item.lat, longitude: item.lon });
    setResults([]);
    setQuery(item.name);
    if (mapRef.current?.animateToRegion) {
      mapRef.current.animateToRegion(
        {
          latitude: item.lat,
          longitude: item.lon,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        300
      );
    }
  };

  /* ---------- submit ---------- */
  const submit = async () => {
    if (!shopName.trim()) return Alert.alert("กรอกข้อมูล", "กรุณากรอกชื่อร้าน");
    if (!type) return Alert.alert("กรอกข้อมูล", "กรุณาเลือกประเภท");

    try {
      const imageUrl = await uploadImageIfNeeded(); // ← ใช้ตัวใหม่ (robust base64)
      const payload = {
        shop_name: shopName.trim(),
        description: description.trim(),
        type,
        image: imageUrl,
        address: { latitude: coord.latitude, longitude: coord.longitude },
        status: "closed",
        order_active: false,
        reserve_active: false,
      };

      const res = await api.post("/shop/create", payload);
      Alert.alert("สำเร็จ", `สร้างร้านสำเร็จ\nID: ${res?.data?.id || "-"}`);
      if (navigation?.goBack) navigation.goBack();
    } catch (err) {
      const msg =
        err?.response?.data?.error || err?.message || "เกิดข้อผิดพลาด";
      Alert.alert("บันทึกล้มเหลว", msg);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top"]}>
      <StatusBar style="dark" hidden={false} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <Text style={styles.title}>สร้างร้าน</Text>
        <Text style={styles.subtitle}>
          ใส่ข้อมูล เลือกรูป ค้นหาสถานที่ และปักหมุดบนแผนที่
        </Text>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.label}>ชื่อร้าน *</Text>
          <TextInput
            value={shopName}
            onChangeText={setShopName}
            placeholder="เช่น Fin Café"
            style={styles.input}
          />

        <Text style={styles.label}>คำอธิบาย</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="รายละเอียดร้าน"
            style={[styles.input, styles.textarea]}
            multiline
          />

          <SelectField
            label="ประเภท *"
            value={type}
            onChange={setType}
            options={TYPES.map((t) => ({ label: t, value: t }))}
          />
        </View>

        {/* Image */}
        <View style={styles.card}>
          <Text style={styles.label}>รูปหน้าร้าน</Text>
          {image ? (
            <Image source={{ uri: image }} style={styles.preview} />
          ) : (
            <View style={[styles.preview, styles.previewPlaceholder]}>
              <Text style={styles.muted}>ยังไม่มีรูป</Text>
            </View>
          )}
          <TouchableOpacity onPress={pickImage} style={styles.button}>
            <Text style={styles.buttonText}>
              {image ? "เปลี่ยนรูป" : "เลือกจากเครื่อง"}
            </Text>
          </TouchableOpacity>
          {imageUploading && <ActivityIndicator style={{ marginTop: 6 }} />}
        </View>

        {/* Map + Search */}
        <View style={styles.card}>
          <Text style={styles.label}>ค้นหาสถานที่</Text>
          <View style={styles.searchWrap}>
            <TextInput
              value={query}
              onChangeText={searchPlace}
              placeholder="พิมพ์ชื่อสถานที่ เช่น Central World, Siam Paragon..."
              style={styles.searchInput}
            />
            {searching ? <ActivityIndicator style={{ marginTop: 6 }} /> : null}

            {results.length > 0 && (
              <View style={styles.searchDropdown}>
                <ScrollView keyboardShouldPersistTaps="handled">
                  {results.map((item, idx) => (
                    <React.Fragment key={item.id}>
                      <TouchableOpacity
                        style={styles.searchItem}
                        onPress={() => selectResult(item)}
                      >
                        <Text numberOfLines={2} style={styles.searchText}>
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                      {idx < results.length - 1 ? (
                        <View style={styles.searchSep} />
                      ) : null}
                    </React.Fragment>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <Text style={[styles.label, { marginTop: 8 }]}>ตำแหน่งร้านบนแผนที่</Text>
          <MapView
            ref={(r) => (mapRef.current = r)}
            style={styles.map}
            onPress={handleMapPress}
            initialRegion={{
              latitude: coord.latitude,
              longitude: coord.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
          >
            <Marker
              draggable
              coordinate={coord}
              onDragEnd={(e) => setCoord(e.nativeEvent.coordinate)}
            />
          </MapView>
          <View style={styles.coordsRow}>
            <Text style={styles.coords}>Lat: {coord.latitude.toFixed(6)}</Text>
            <Text style={styles.coords}>Lng: {coord.longitude.toFixed(6)}</Text>
          </View>
          {gettingLocation && <ActivityIndicator style={{ marginTop: 4 }} />}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => navigation?.goBack?.()}
            style={[styles.button, styles.ghost]}
          >
            <Text style={[styles.buttonText, styles.ghostText]}>ยกเลิก</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={submit} style={[styles.button, styles.primary]}>
            <Text style={styles.buttonText}>สร้างร้าน</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
