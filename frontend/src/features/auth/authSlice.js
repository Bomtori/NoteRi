import { createSlice } from "@reduxjs/toolkit";

// 브라우저 저장소에서 토큰 읽기
const initialToken = localStorage.getItem("access_token");

const initialState = {
    user: null,
    token: initialToken || null,
    isAuthenticated: !!initialToken, // 토큰이 있으면 true
};

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        setCredentials: (state, action) => {
            const { user, token } = action.payload;
            state.user = user;
            state.token = token;
            state.isAuthenticated = true;
            localStorage.setItem("access_token", token); // 토큰을 localStorage에도 저장( 재로그인 필요 X)
        },
        logout: (state) => {
            state.user = null;
            state.token = null;
            state.isAuthenticated = false;
            localStorage.removeItem("access_token");
        },
    },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
