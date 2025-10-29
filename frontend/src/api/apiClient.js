import axios from "axios";
import { API_BASE_URL } from "../config";
console.log("🌐 VITE_API_URL =", import.meta.env.VITE_API_URL);
// 🔹 Axios 인스턴스 (쿠키 포함)
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true, // refresh_token 쿠키 자동 포함
    headers: {
        "Content-Type": "application/json", // headers 포함하기
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

// 🔹 응답 시 401 → /auth/refresh 로 자동 재발급
apiClient.interceptors.response.use(
    (res) => res,
    async (error) => {
        const originalRequest = error.config;

        // ❗ 비로그인 상태거나 refresh_token 없는 경우 → refresh 시도하지 않음
        if (error.response?.status === 401 && !originalRequest._retry) {
            const hasAccess = localStorage.getItem("access_token");
            const hasRefresh = document.cookie.includes("refresh_token=");
            if (!hasAccess && !hasRefresh) {
                console.log("🚫 No tokens — skip refresh and stay on page");
                return Promise.reject(error);
            }

            originalRequest._retry = true;
            console.warn("🔁 AccessToken 만료 → refresh 요청");

            try {
                const refreshRes = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
                const newToken = refreshRes.data.access_token;
                if (newToken) {
                    accessToken = newToken;
                    localStorage.setItem("access_token", newToken);
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return apiClient(originalRequest);
                }
            } catch (err) {
                console.error("⚠️ 토큰 재발급 실패:", err);
                localStorage.removeItem("access_token");
                localStorage.removeItem("user");

                // 🔹 보호된 경로에서만 로그인 페이지로 리디렉트
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
