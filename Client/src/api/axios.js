import axios from "axios";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import AsyncStorage from "@react-native-async-storage/async-storage";

const extra =
  Constants?.expoConfig?.extra ||
  Updates?.manifest?.extra ||
  Constants?.manifestExtra ||
  null;

if (!extra?.apiBase) {
  console.log("❌ Expo extra missing:", {
    expoConfig: Constants?.expoConfig?.extra,
    updates: Updates?.manifest?.extra,
    manifestExtra: Constants?.manifestExtra,
  });
  throw new Error(
    "[Config] Missing extra.apiBase. Check app.config.js, .env, and restart with `expo start -c`."
  );
}

export const API_BASE = `${extra.apiBase}`;
console.log("🌐 API_BASE =", API_BASE);

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});


api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});