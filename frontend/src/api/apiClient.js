import axios from "axios";
import { API_BASE_URL } from "../config";

// 공통 axios 인스턴스 생성
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
});

// 요청 인터셉터 - Redux 또는 localStorage에서 토큰 자동 주입
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("access_token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default apiClient;
