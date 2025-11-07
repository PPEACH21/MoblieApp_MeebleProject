// src/redux/slices/authSlice.js
import { createSlice } from "@reduxjs/toolkit";
import { getProfile } from "../actions/authAction";

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
    loading : (state) => {
        state.loading = true;
    },
    getProfileSuccess:(state,action)=>{
        state.loading=true;
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

export const { profileLoading, getProfileSuccess, getProfileFailed ,loading} = profileSlice.actions;
export default profileSlice.reducer;
