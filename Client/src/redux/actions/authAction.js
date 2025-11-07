// src/redux/actions/authActions.js
import axios from "../../api/axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginStart,loginFailed,loginSuccess } from "../slices/authSlice";
import { API_BASE } from "../../axios";

    const API_URL = API_BASE; 
// หรือ "http://localhost:8080"

import { loginFailed,loginSuccess, registerSuccess,registerFailed, loadingProcess } from "../slices/authSlice";

export const loginUser = (credentials) => async (dispatch) => {
  try {
    dispatch(loadingProcess());
    const res = await axios.post(`/login`, credentials);
    await AsyncStorage.setItem("access_token", res.data.token);
    dispatch(loginSuccess(res.data));
  } catch (err) {
    const message = err.response?.data?.message || "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูล";
    dispatch(loginFailed(message));
  }
};


export const registerID = (data,role) => async (dispatch) => {
  try {
    dispatch(loadingProcess());
    const res = await axios.post(`/register`, { ...data, Role:"user" });
    
    if (res.data.token) {
      await AsyncStorage.setItem("access_token", res.data.token);
    }
    dispatch(registerSuccess(res.data)); // สำเร็จ
  } catch (err) {
    const message = err.response?.data?.message || "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูล";
      dispatch(registerFailed(message));
    }
  };
