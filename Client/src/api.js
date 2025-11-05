// src/api.js
import axios from "axios";
import { API_BASE } from "./config";



export const api = axios.create({
  baseURL: API_BASE, 
  headers: { "Content-Type": "application/json" },
});

// ใส่ (หรือเอาออก) Authorization: Bearer <token>
export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

// ดึงรายการโน้ต
export async function fetchNotes(path = "/notes") {
  const res = await api.get(path);
  return res.data;
}
