import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {setCredentials} from "@/features/auth/authSlice.js";
import { useDispatch } from "react-redux";
import apiClient from "@/api/apiClient.js";

export default function AuthCallbackPage() {
    const navigate = useNavigate();
    const handledRef = useRef(false);
    const dispatch = useDispatch();


    const [showModal, setShowModal] = useState(false);
    const [email, setEmail] = useState("");
    const [registeredProvider, setRegisteredProvider] = useState("");

    useEffect(() => {
        if (handledRef.current) return;
        handledRef.current = true;

        const params = new URLSearchParams(window.location.search);
        const error = params.get("error");
        const accessToken = params.get("access_token");
        const emailParam = params.get("email");
        const providerParam = params.get("registered_provider");
        const token = localStorage.getItem("access_token");


        console.log("Error", error);
        console.log("Email", emailParam);
        console.log("Registered", providerParam);

        // /admin라우트에서 토큰기반 자동 로그인
        if (token) {
            apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
            apiClient.get("/users/me").then((res) => {
                const user = res.data;
                if (!user.is_active) {
                    alert(`🚫 차단된 계정입니다.\n사유: ${user.banned_reason || "관리자 조치"}\n해제일: ${user.banned_until || "영구"}`);
                    localStorage.removeItem("access_token");
                    navigate("/login", { replace: true });
                    return;
                }
                dispatch(setCredentials({ user, token }));
            });
            // apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
            // apiClient.get("/users/me").then((res) => {
            //     dispatch(setCredentials({ user: res.data, token }));
            // });
        }
        // ✅ 정상 로그인
        if (accessToken) {
            localStorage.setItem("access_token", accessToken);
            navigate("/user", { replace: true });
            return;
        }

        // ✅ 중복 계정 에러 (provider_conflict)
        if (error === "provider_conflict") {
            setEmail(emailParam || "");
            setRegisteredProvider(providerParam || "");
            setShowModal(true);
            return;
        }

        // ✅ 기타 에러
        if (error === "internal_error") {
            alert("⚠️ 로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
            navigate("/login", { replace: true });
            return;
        }

        navigate("/login", { replace: true });
    }, [navigate]);

    const handleCloseModal = () => {
        setShowModal(false);
        navigate("/login", { replace: true });
    };

    return (
        <div className="flex items-center justify-center h-screen text-gray-600">
            로그인 처리 중...
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-2xl shadow-lg p-6 w-[90%] max-w-md animate-fadeIn">
                        <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">
                            이미 가입된 이메일이에요
                        </h2>
                        <p className="text-sm text-gray-600 text-center mb-4">
                            {email ? (
                                <>
                                    <span className="font-medium text-purple-600">{email}</span> 은(는) 이미{" "}
                                    <span className="font-semibold text-purple-600">
                    {registeredProvider || "다른"}
                  </span>{" "}
                                    계정으로 가입되어 있어요.
                                </>
                            ) : (
                                "이미 다른 계정으로 가입된 이메일이에요."
                            )}
                        </p>

                        <div className="flex justify-center">
                            <button
                                onClick={handleCloseModal}
                                className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-all"
                            >
                                로그인으로 돌아가기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
