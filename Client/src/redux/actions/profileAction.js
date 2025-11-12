import { profileLoading,updateProfile,getProfileFailed,getProfileSuccess } from "../slices/profileSlice"
import { api } from "../../api/axios"
import AsyncStorage from "@react-native-async-storage/async-storage";

export const getProfile=()=>async(dispatch)=>{
    dispatch(profileLoading())
    try{
        const token = await AsyncStorage.getItem("access_token");
        if (!token) {
            console.warn("❌ No token found in AsyncStorage");
            return;
        }
        const res = await api.get('/profile',{
        headers: {
            'Authorization': `Bearer ${token}`
            }
        })
        
        const profileData = {
            firstname: res.data.firstname || "",
            lastname: res.data.lastname || "",
            username: res.data.username || "",
            email: res.data.email || "",
            avatar: res.data.avatar || "",
        };
        dispatch(getProfileSuccess(profileData));
        return profileData;
    } catch (error) {
        console.log("Error fetching profile:", error);
        dispatch(getProfileFailed(error));
        return error
    }
}


export const UpdateProfile=({data})=>async(dispatch,getState)=>{
    dispatch(profileLoading())
    try{
        const Auth = getState().auth
        const profileData = {
            firstname: data.firstname || "",
            lastname: data.lastname || "",
            avatar: data.avatar || "",
        };
        const res = await api.put(`/profile/${Auth.user}`, profileData)
        dispatch(updateProfile(profileData));
        return profileData;
    }catch(err){
        console.log("Error Update profile:", err);
        const message = err.response?.data?.message || err.message || "Unknown error";
        dispatch(getProfileFailed(message));
        return message
    }
}