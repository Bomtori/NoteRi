import axios from "axios";
import { API_BASE_URL } from "../config";

// ✅ Axios 인스턴스 (쿠키 포함)
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true, // refresh_token 쿠키 자동 포함
});

// ✅ 메모리/LocalStorage에서 access_token 관리
let accessToken = localStorage.getItem("access_token") || null;

// ✅ 요청 시 Authorization 자동 주입
apiClient.interceptors.request.use(
    (config) => {
        if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
        return config;
    },
    (error) => Promise.reject(error)
);

// ✅ 응답 시 401 → /auth/refresh 로 자동 재발급
apiClient.interceptors.response.use(
    (res) => res,
    async (error) => {
        if (error.response?.status === 401) {
            console.warn("🔁 AccessToken 만료 → refresh 요청");
            try {
                // refresh_token 쿠키를 이용해 새 access_token 요청
                const refreshRes = await axios.post(
                    `${API_BASE_URL}/auth/refresh`,
                    {},
                    { withCredentials: true }
                );

                const newToken = refreshRes.data.access_token;
                if (newToken) {
                    accessToken = newToken;
                    localStorage.setItem("access_token", newToken);
                    error.config.headers.Authorization = `Bearer ${newToken}`;
                    // ✅ 실패한 요청 다시 시도
                    return apiClient.request(error.config);
                }
            } catch (err) {
                console.error("⚠️ 토큰 재발급 실패:", err);
                localStorage.removeItem("access_token");
                localStorage.removeItem("user");
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;