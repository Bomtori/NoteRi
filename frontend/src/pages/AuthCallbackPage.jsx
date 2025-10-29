import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setCredentials } from "../features/auth/authSlice";
import apiClient from "../api/apiClient";

export default function AuthCallbackPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const dispatch = useDispatch();

    useEffect(() => {
        const token = searchParams.get("access_token");

        if (token) {
            // 토큰 저장 + axios에 반영
            localStorage.setItem("access_token", token);
            apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;

            // 사용자 정보 요청
            apiClient
                .get("/users/me")
                .then((res) => {
                    dispatch(setCredentials({ user: res.data, token }));
                    navigate("/record");
                })
                .catch((err) => {
                    console.error("사용자 정보 요청 실패:", err);
                    navigate("/login");
                });
        } else {
            navigate("/login");
        }
    }, [dispatch, navigate, searchParams]);

    return (
        <div className="flex flex-col items-center justify-center h-screen text-gray-600">
            <div className="text-lg font-medium mb-4">로그인 중입니다...</div>
            <div className="text-sm text-gray-400">잠시만 기다려주세요 ⏳</div>
        </div>
    );
}
