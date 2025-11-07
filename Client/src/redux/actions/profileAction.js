import axios from "../../api/axios";
import { getProfileSuccess, getProfileFailed, loading } from "../slices/profileSlice";
import AsyncStorage from "@react-native-async-storage/async-storage";
export const getProfile = () => async (dispatch, getState) => {
  try {
    dispatch(loading());

    const { auth } = getState();
    const token = auth.token

    const res = await axios.get("/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("✅ Profile Response:", res.data);
    dispatch(getProfileSuccess({
      firstname:res.data.firstname||"",
      lastname:res.data.lastname||"",
      username:res.data.username||"" ,
      email:res.data.email||"",
      avatar:res.data.avatar||"",
    }));
  } catch (err) {
    const msg = err.response?.data?.message || "โหลดข้อมูลผู้ใช้ไม่สำเร็จ";
    console.log("❌ getProfile Error:", msg);
    dispatch(getProfileFailed(msg));
  }
};
