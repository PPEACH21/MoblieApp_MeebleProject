// src/redux/slices/authSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,
  role:null,
  verified:null,
  token: null,
  loading: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loadingProcess: (state) => {
        state.loading = true;
    },
    loginSuccess: (state, action) => {
        state.loading = false;
        state.user = action.payload.user_id;
        state.verified = action.payload.verified;
        state.role = action.payload.role;
        state.token = action.payload.token;
    },
    loginFailed: (state, action) => {
        state.loading = false;
        state.error = action.payload;
    },
    logout: (state) => {
        state.user = null;
        state.verified = null;
        state.role = null;
        state.token = null;
    },
    registerSuccess: (state, action) => {
        state.loading = false;
        state.user = action.payload.user_id;
        state.verified = action.payload.verified;
        state.role = action.payload.role;
        state.token = action.payload.token;
    },
    registerFailed: (state, action) => {
        state.loading = false;
        state.error = action.payload;
    },
  },
});

export const { loadingProcess, registerFailed,loginSuccess,loginFailed, registerSuccess,logout } = authSlice.actions;
export default authSlice.reducer;
