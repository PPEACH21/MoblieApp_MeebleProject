// src/redux/actions/authActions.js
import { api } from "../../api/axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginFailed,loginSuccess, registerSuccess,registerFailed ,loadingProcess} from "../slices/authSlice";
import { getProfile } from "./profileAction";

export const loginUser = (credentials) => async (dispatch) => {
  try {
    dispatch(loadingProcess());

    const res = await api.post(`/login`, credentials);
    await AsyncStorage.setItem("access_token", res.data.token);

    dispatch(loginSuccess(res.data));
  } catch (err) {
    const message = err.response?.data?.message || "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูล";
    dispatch(loginFailed(message));
  }
};


export const registerID = (data) => async (dispatch) => {
  try {
    dispatch(loadingProcess());
    const res = await api.post(`/register`, { ...data});
    if (res.data.token) {
      await AsyncStorage.setItem("access_token", res.data.token);
    }
    dispatch(registerSuccess(res.data)); // สำเร็จ
  } catch (err) {
    const message = err.response?.data?.message || "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูล";
      dispatch(registerFailed(message));
    }
  };
