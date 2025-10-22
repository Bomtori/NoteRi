import { FcGoogle } from "react-icons/fc";
import { SiNaver, SiKakaotalk } from "react-icons/si";
import { API_BASE_URL } from "../config";

export default function LoginPage() {
    const handleSocialLogin = (provider) => {
        // 🔗 백엔드의 /auth/{provider}/login 으로 이동
        window.location.href = `${API_BASE_URL}/auth/${provider}/login`;
    };

    return (
        <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-800 mb-8">
                소셜 계정으로 로그인
            </h2>

            <div className="flex flex-col gap-4">
                <button
                    onClick={() => handleSocialLogin("google")}
                    className="flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-3 hover:bg-gray-50 transition-all"
                >
                    <FcGoogle size={22} />
                    <span className="font-medium text-gray-700">Google로 계속하기</span>
                </button>

                <button
                    onClick={() => handleSocialLogin("naver")}
                    className="flex items-center justify-center gap-3 bg-[#03C75A] text-white rounded-lg py-3 hover:bg-[#02b352] transition-all"
                >
                    <SiNaver size={20} />
                    <span className="font-medium">Naver로 계속하기</span>
                </button>

                <button
                    onClick={() => handleSocialLogin("kakao")}
                    className="flex items-center justify-center gap-3 bg-[#FEE500] text-[#3A1D1D] rounded-lg py-3 hover:bg-[#fcd900] transition-all"
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
