import { useNavigate } from "react-router-dom";
import {LandingFooter} from "./LandingFooter.jsx";

export default function FinalCTASection() {
    const navigate = useNavigate();

    return (
        <section className="relative py-32 flex flex-col items-center justify-center text-center overflow-hidden bg-gradient-to-b from-[#F5F0FF]/60 to-white/90">
            {/* 반투명 Glass 배경 */}
            <div className="absolute inset-0 bg-white/10 backdrop-blur-md" />

            {/* 장식용 빛 */}
            <div className="absolute top-0 left-10 w-72 h-72 bg-[#C19EF8]/40 blur-3xl rounded-full -z-10" />
            <div className="absolute bottom-0 right-10 w-96 h-96 bg-[#7E37F9]/30 blur-3xl rounded-full -z-10" />

            {/* 콘텐츠 */}
            <div className="relative z-10 px-6">
                <h2 className="text-5xl font-bold text-[#7E37F9] mb-6">
                    회의를 기록하는 가장 똑똑한 방법
                </h2>
                <p className="text-gray-700 text-lg mb-10">
                    지금 바로 NoteRi로 자동화된 회의 기록을 경험하세요.
                </p>

                <button
                    onClick={() => navigate("/login")}
                    className="bg-[#7E37F9] text-white px-10 py-4 rounded-full text-lg font-semibold shadow-[0_0_25px_rgba(126,55,249,0.4)] hover:shadow-[0_0_40px_rgba(126,55,249,0.6)] hover:bg-[#6c2fe3] transition-all duration-300"
                >
                    무료로 시작하기
                </button>
            </div>
        </section>
    );
}
