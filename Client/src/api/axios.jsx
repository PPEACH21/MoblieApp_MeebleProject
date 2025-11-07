import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://158.108.97.238:8080"; // ไม่มี /api ก็ได้ ถ้ามีใส่ได้เช่น http://10.64.96.166:8080/api

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

// ✅ Interceptor: แนบ Bearer Token ทุกครั้ง
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
