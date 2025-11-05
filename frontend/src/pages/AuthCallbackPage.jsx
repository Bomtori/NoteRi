import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { setCredentials } from "@/features/auth/authSlice.js";
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

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const error = params.get("error");
      const accessToken = params.get("access_token");
      const emailParam = params.get("email");
      const providerParam = params.get("registered_provider");

      console.log("🔍 AuthCallback - Error:", error);
      console.log("🔍 AuthCallback - AccessToken:", accessToken ? "exists" : "missing");
      console.log("🔍 AuthCallback - Email:", emailParam);
      console.log("🔍 AuthCallback - Provider:", providerParam);

      // 1) 에러 우선 처리
      if (error === "provider_conflict") {
        console.log("⚠️ Provider conflict 감지");
        setEmail(emailParam || "");
        setRegisteredProvider(providerParam || "");
        setShowModal(true);
        return;
      }

      if (error === "internal_error") {
        console.error("❌ Internal error 발생");
        alert("⚠️ 로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
        navigate("/login", { replace: true });
        return;
      }

      if (error === "missing_email") {
        console.error("❌ 이메일 누락");
        alert("⚠️ 카카오 계정에서 이메일 제공 동의가 필요합니다.");
        navigate("/login", { replace: true });
        return;
      }

      if (error === "deactivated") {
        console.error("❌ 비활성 계정");
        alert("⚠️ 탈퇴한 계정입니다. 재가입이 필요합니다.");
        navigate("/login", { replace: true });
        return;
      }

      if (error) {
        console.error("❌ 알 수 없는 에러:", error);
        alert("⚠️ 로그인 중 오류가 발생했습니다.");
        navigate("/login", { replace: true });
        return;
      }

      try {
        // 2) 콜백 쿼리에 access_token이 있으면 이 경로를 '먼저' 처리
        if (accessToken) {
          console.log("✅ AccessToken 받음, 로그인 처리 시작");

          // URL 정리 (쿼리 숨기기)
          window.history.replaceState({}, "", "/auth/callback");

          // 저장 + 헤더 세팅
          localStorage.setItem("access_token", accessToken);
          apiClient.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
          console.log("✅ LocalStorage 및 API 헤더 설정 완료");

          // 내 정보 가져와서 전역 상태 반영
          const { data: user } = await apiClient.get("/users/me", { withCredentials: true });
          console.log("✅ 사용자 정보 조회 성공:", user);

          // 차단된 계정 체크
          if (!user.is_active) {
            console.warn("⚠️ 비활성 계정:", user);
            alert(
              `🚫 차단된 계정입니다.\n사유: ${user.banned_reason || "관리자 조치"}\n해제일: ${user.banned_until || "영구"}`
            );
            localStorage.removeItem("access_token");
            delete apiClient.defaults.headers.common["Authorization"];
            navigate("/login", { replace: true });
            return;
          }

          // Redux에 저장
          dispatch(setCredentials({ user, token: accessToken }));
          console.log("✅ Redux 저장 완료, /user로 이동");
          
          navigate("/user", { replace: true });
          return;
        }

        // 3) 쿼리에 토큰이 없고, 로컬 저장소에 토큰이 이미 있으면 자동 로그인
        const saved = localStorage.getItem("access_token");
        if (saved) {
          console.log("✅ LocalStorage에 저장된 토큰 발견, 자동 로그인 시도");
          apiClient.defaults.headers.common["Authorization"] = `Bearer ${saved}`;
          
          const { data: user } = await apiClient.get("/users/me", { withCredentials: true });
          console.log("✅ 저장된 토큰으로 사용자 정보 조회 성공:", user);

          // 차단된 계정 체크
          if (!user.is_active) {
            console.warn("⚠️ 비활성 계정:", user);
            alert(
              `🚫 차단된 계정입니다.\n사유: ${user.banned_reason || "관리자 조치"}\n해제일: ${user.banned_until || "영구"}`
            );
            localStorage.removeItem("access_token");
            delete apiClient.defaults.headers.common["Authorization"];
            navigate("/login", { replace: true });
            return;
          }

          dispatch(setCredentials({ user, token: saved }));
          console.log("✅ Redux 저장 완료, /user로 이동");
          
          navigate("/user", { replace: true });
          return;
        }

        console.warn("⚠️ 토큰이 없음, 로그인 페이지로 이동");
      } catch (e) {
        console.error("❌ Auth callback 실패:", e);
        // 토큰이 있지만 만료/검증 실패 시 정리
        localStorage.removeItem("access_token");
        delete apiClient.defaults.headers.common["Authorization"];
        alert("⚠️ 인증에 실패했습니다. 다시 로그인해주세요.");
      }

      // 4) 그 외엔 로그인으로
      navigate("/login", { replace: true });
    })();
  }, [navigate, dispatch]);

  const handleCloseModal = () => {
    setShowModal(false);
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">로그인 처리 중...</p>
      </div>

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