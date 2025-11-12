// src/redux/slices/authSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  firstname:"",
  lastname:"",
  username:"" ,
  email:"",
  avatar:"",
  loading:false,
};


const profileSlice = createSlice({
  name: "profile",
  initialState,
  reducers: {
    profileLoading : (state) => {
        state.loading = true;
    },
    updateProfile:(state,action)=>{
        state.loading=false;
        state.firstname=action.payload.firstname;
        state.lastname=action.payload.lastname;
        state.avatar=action.payload.avatar;
    },
    getProfileSuccess:(state,action)=>{
        state.loading=false;
        state.firstname=action.payload.firstname;
        state.lastname=action.payload.lastname;
        state.username=action.payload.username;
        state.email=action.payload.email;
        state.avatar=action.payload.avatar;
    },
    getProfileFailed: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
  },
});

export const { profileLoading,updateProfile, getProfileSuccess, getProfileFailed} = profileSlice.actions;
export default profileSlice.reducer;
