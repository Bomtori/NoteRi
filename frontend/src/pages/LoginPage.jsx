import { useEffect, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { SiNaver, SiKakaotalk } from "react-icons/si";
import { API_BASE_URL } from "../config";

export default function LoginPage() {
  const [warming, setWarming] = useState(true);
  const [warmupError, setWarmupError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetch(`${API_BASE_URL}/auth/kakao/session-warmup`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
      } catch (e) {
        if (!cancelled) {
          setWarmupError("세션 웜업에 실패했어요. 그래도 로그인은 시도할 수 있어요.");
        }
      } finally {
        if (!cancelled) setWarming(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSocialLogin = (provider) => {
    // 가드: 예상치 못한 provider 문자열 방지(옵셔널)
    if (!["google", "naver", "kakao"].includes(provider)) return;
    window.location.assign(`${API_BASE_URL}/auth/${provider}/login`);
  };

  return (
    <div className="text-center">
      <h2 className="text-2xl font-semibold text-gray-800 mb-8">소셜 계정으로 로그인</h2>

      {warmupError && <p className="text-sm text-amber-600 mb-4">{warmupError}</p>}

      <div className="flex flex-col gap-4">
        <button
          type="button"
          disabled={warming}
          onClick={() => handleSocialLogin("google")}
          className={`flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-3 transition-all ${
            warming ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-50"
          }`}
          aria-label="Sign in with Google"
        >
          <FcGoogle size={22} />
          <span className="font-medium text-gray-700">Google로 계속하기</span>
        </button>

        <button
          type="button"
          disabled={warming}
          onClick={() => handleSocialLogin("naver")}
          className={`flex items-center justify-center gap-3 rounded-lg py-3 transition-all ${
            warming ? "opacity-60 cursor-not-allowed" : "hover:bg-[#02b352]"
          } bg-[#03C75A] text-white`}
          aria-label="Sign in with Naver"
        >
          <SiNaver size={20} />
          <span className="font-medium">Naver로 계속하기</span>
        </button>

        <button
          type="button"
          disabled={warming}
          onClick={() => handleSocialLogin("kakao")}
          className={`flex items-center justify-center gap-3 rounded-lg py-3 transition-all ${
            warming ? "opacity-60 cursor-not-allowed" : "hover:bg-[#fcd900]"
          } bg-[#FEE500] text-[#3A1D1D]`}
          aria-label="Sign in with Kakao"
        >
          <SiKakaotalk size={22} />
          <span className="font-medium">Kakao로 계속하기</span>
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-8">
        로그인 시 NoteRi의 서비스 이용약관 및 개인정보처리방침에 동의하게 됩니다.
      </p>
    </div>
  );
}
