// src/pages/AuthCallback.jsx
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthCallback() {
  const navigate = useNavigate();
  const handledRef = useRef(false); // ✅ StrictMode 중복 실행 방지

  useEffect(() => {
    // 콜백 경로가 아니면 아무 것도 하지 않음 (부모/레이아웃 겹침 방지)
    if (!window.location.pathname.endsWith("/auth/callback")) return;

    if (handledRef.current) return;   // ✅ 두번째 실행 차단
    handledRef.current = true;

    console.log("[AuthCallback] href:", window.location.href);
    console.log("[AuthCallback] search:", window.location.search);
    console.log("[AuthCallback] hash:", window.location.hash);

    // 1) ?access_token=...
    const url = new URL(window.location.href);
    let token = url.searchParams.get("access_token");

    // 2) #access_token=...
    if (!token && window.location.hash) {
      const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      token = h.get("access_token");
    }

    if (token) {
      localStorage.setItem("access_token", token);
      // 토큰이 URL에 남지 않도록 replace로 깨끗하게 이동
      navigate("/test/chat", { replace: true });
    } else {
      // 여기까지 오면 진짜 토큰이 없음
      alert("토큰이 존재하지 않습니다. 다시 로그인해주세요.");
      navigate("/test/login", { replace: true });
    }
  }, [navigate]);

  return <div style={{ textAlign: "center", marginTop: 160 }}>로그인 처리 중…</div>;
}