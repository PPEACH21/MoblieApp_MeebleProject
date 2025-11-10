import { profileLoading,getProfileFailed,getProfileSuccess } from "../slices/profileSlice"
import { api } from "../../api/axios"

export const getProfile=()=>async(dispatch,getState)=>{
     const { token } = getState().auth;
     dispatch(profileLoading())

    try{
        const res = api.get('/profile',{},{
        headers: {
            'Authorization': `Bearer ${token}`
            }
        })
        console.log("GetProfile Success")
        dispatch(getProfileSuccess({
            firstname:res.data.firstname||"",
            lastname:res.data.lastname||"",
            username:res.data.username||"" ,
            email:res.data.email||"",
            avatar:res.data.avatar||"",
        }));
    
    } catch (error) {
        console.log("Error fetching profile:", error);
        dispatch(getProfileFailed(error));
    }
}