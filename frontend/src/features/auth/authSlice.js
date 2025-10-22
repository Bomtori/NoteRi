import { createSlice } from "@reduxjs/toolkit";

// 초기 상태 — localStorage에서 토큰 복원
const initialState = {
    user: JSON.parse(localStorage.getItem("user")) || null,
    token: localStorage.getItem("access_token") || null,
    isAuthenticated: !!localStorage.getItem("access_token"),
};

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        // 로그인 성공 (AuthCallbackPage에서 호출)
        setCredentials: (state, action) => {
            const { user, token } = action.payload;
            state.user = user;
            state.token = token;
            state.isAuthenticated = true;

            // 로컬스토리지에도 저장
            localStorage.setItem("user", JSON.stringify(user));
            localStorage.setItem("access_token", token);
        },

        // 새로고침 시 복원
        restoreSession: (state) => {
            const storedUser = localStorage.getItem("user");
            const storedToken = localStorage.getItem("access_token");
            if (storedUser && storedToken) {
                state.user = JSON.parse(storedUser);
                state.token = storedToken;
                state.isAuthenticated = true;
            }
        },

        // 로그아웃
        logout: (state) => {
            state.user = null;
            state.token = null;
            state.isAuthenticated = false;
            localStorage.removeItem("user");
            localStorage.removeItem("access_token");
            window.location.href = "/login";
        },
    },
});

export const { setCredentials, restoreSession, logout } = authSlice.actions;
export default authSlice.reducer;