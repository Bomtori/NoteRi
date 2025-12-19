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
    // 로그인 성공 (AuthCallbackPage, 토큰 재발급 등에서 호출)
    setCredentials: (state, action) => {
      const payload = action.payload || {};
      const user = payload.user;
      const token = payload.token || payload.access_token;

      if (!user || !token) {
        console.warn("setCredentials: user 또는 token이 없습니다.", payload);
        return;
      }

      state.user = user;
      state.token = token;
      state.isAuthenticated = true;

      // 로컬스토리지에도 저장 (access_token만)
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("access_token", token);

      // ❌ refresh_token 은 HttpOnly 쿠키로만 관리하므로
      // localStorage 에 따로 저장하지 않습니다.
    },

    // 새로고침 시 복원
    restoreSession: (state) => {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("access_token");

      if (storedUser && storedToken) {
        state.user = JSON.parse(storedUser);
        state.token = storedToken;
        state.isAuthenticated = true;
      } else {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
      }
    },

    // 로그아웃
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;

      localStorage.removeItem("user");
      localStorage.removeItem("access_token");
      // refresh_token 쿠키는 /auth/logout 같은 백엔드 엔드포인트에서 삭제

      window.location.href = "/";
    },
  },
});

export const { setCredentials, restoreSession, logout } = authSlice.actions;
export default authSlice.reducer;
