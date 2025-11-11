// src/redux/actions/authActions.js
import { api } from "../../api/axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginFailed,loginSuccess,resetAuth, registerSuccess,registerFailed ,loadingProcess} from "../slices/authSlice";

export const loginUser = (credentials) => async (dispatch) => {
  try {
    dispatch(resetAuth());
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
    dispatch(resetAuth());
    dispatch(loadingProcess());
    const res = await api.post(`/register`, { ...data});
    if (res.data.token) {
      await AsyncStorage.setItem("access_token", res.data.token);
    }
    dispatch(registerSuccess(res.data));
  } catch (err) {
    console.log(err)
    const message = err.response?.data?.message || "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูล";
      dispatch(registerFailed(message));
    }
  };
