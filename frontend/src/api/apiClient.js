// src/api/apiClient.js
import axios from "axios";
import { API_BASE_URL } from "../config";

console.log("🌐 VITE_API_URL =", import.meta.env.VITE_API_URL);

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "1",
  },
});

// 요청 인터셉터
apiClient.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("access_token");

    if (accessToken) {
      // 로그인 유저 → 기존처럼 Authorization
      config.headers.Authorization = `Bearer ${accessToken}`;
    } else {
      // 비로그인 상태 → guest_token 있는지 확인
      const url = config.url || "";

      // /boards/{boardId} 또는 /boards/{boardId}/full 같은 패턴에서 boardId 추출
      const match = url.match(/^\/boards\/(\d+)/);
      if (match) {
        const boardId = match[1];
        const guestToken = localStorage.getItem(`guest_token_board_${boardId}`);

        if (guestToken) {
          // 저장해둔 guest_token을 X-Guest-Token 헤더로 전송
          config.headers["X-Guest-Token"] = guestToken;
        }
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// 응답 인터셉터 (401 → refresh 로직은 그대로 두되, protectedPaths에 "/record" 는 빼둔 상태 유지)
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      console.warn("🔁 AccessToken 만료 → refresh 요청");

      try {
        const storedRefresh = localStorage.getItem("refresh_token");

        const refreshRes = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          storedRefresh ? { refresh_token: storedRefresh } : {}, // body에도 실어보냄
          { withCredentials: true }
        );

        const newToken = refreshRes.data.access_token;
        if (newToken) {
          console.log("새 AccessToken 발급 완료");
          localStorage.setItem("access_token", newToken);

          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (err) {
        console.error("⚠️ 토큰 재발급 실패:", err);
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");

        const protectedPaths = ["/folder", "/new", "/user", "/payments"];
        const currentPath = window.location.pathname;
        const needsLogin = protectedPaths.some((p) => currentPath.startsWith(p));

        if (needsLogin) {
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
