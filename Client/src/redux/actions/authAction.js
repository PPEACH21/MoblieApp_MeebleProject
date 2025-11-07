// src/redux/actions/authActions.js
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginStart,loginFailed,loginSuccess } from "../slices/authSlice";
import { API_BASE } from "../../axios";

    const API_URL = API_BASE; 
// หรือ "http://localhost:8080"


export const loginUser = (credentials) => async (dispatch) => {
  try {
    dispatch(loginStart());
    const res = await axios.post(`${API_URL}/login`, credentials);
    await AsyncStorage.setItem("access_token", res.data.token);
    dispatch(loginSuccess(res.data));
  } catch (err) {
    // console.error(err);
    const message = err.response?.data?.message || "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูล";
        dispatch(loginFailed(message));
  }
};


export const getProfile = async () => {
  const token = await AsyncStorage.getItem("access_token");
  console.log(`token: ${token}`)
  try{

      res = await axios.get(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(res.data)
  }catch(err){
    console.log(err);
  }
};