import { profileLoading,getProfileFailed,getProfileSuccess } from "../slices/profileSlice"
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
        
        await dispatch(getProfileSuccess({
            firstname:res.data.firstname||"",
            lastname:res.data.lastname||"",
            username:res.data.username||"" ,
            email:res.data.email||"",
            avatar:res.data.avatar||"",
        }));
        console.log(res.data)
        console.log("GetProfile Success")
        return res.data;
        
    } catch (error) {
        console.log("Error fetching profile:", error);
        dispatch(getProfileFailed(error));
    }
}