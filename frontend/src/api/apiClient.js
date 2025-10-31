import axios from "axios";
import { API_BASE_URL } from "../config";

console.log("🌐 VITE_API_URL =", import.meta.env.VITE_API_URL);

// 🔹 Axios 인스턴스 (쿠키 포함)
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // refresh_token 쿠키 자동 포함
  headers: {
    "Content-Type": "application/json",
  },
});

// 🔹 메모리/LocalStorage에서 access_token 관리
let accessToken = localStorage.getItem("access_token") || null;

// 🔹 요청 시 Authorization 자동 주입
apiClient.interceptors.request.use(
  (config) => {
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// 🔹 응답 시 401 → /auth/refresh 자동 재발급
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    // AccessToken 만료로 인한 401일 때
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      console.warn("🔁 AccessToken 만료 → refresh 요청");

      try {
        // ✅ refresh_token은 HttpOnly 쿠키로 자동 포함됨
        const refreshRes = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });

        const newToken = refreshRes.data.access_token;
        if (newToken) {
          console.log("✅ 새 AccessToken 발급 완료");
          accessToken = newToken;
          localStorage.setItem("access_token", newToken);

          // 새 토큰으로 원래 요청 재시도
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (err) {
        console.error("⚠️ 토큰 재발급 실패:", err);
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");

        // 보호된 페이지라면 로그인 페이지로 리다이렉트
        const protectedPaths = ["/record", "/folder", "/new", "/user", "/payments"];
        const currentPath = window.location.pathname;
        const needsLogin = protectedPaths.some((p) => currentPath.startsWith(p));

        if (needsLogin) {
          window.location.href = "/login";
        } else {
          console.log("🔓 Public route, stay on current page");
        }
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
