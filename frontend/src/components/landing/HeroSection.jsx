import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/apiClient";
import { API_BASE_URL } from "../../config";
import LogoAnimation from "../common/LogoAnimation";

export default function HeroSection() {
    const navigate = useNavigate();
    const [showLogo, setShowLogo] = useState(true);
    const [user, setUser] = useState(null);

    // ✅ 로그인 상태 확인
    useEffect(() => {
        async function checkUser() {
            try {
                const res = await apiClient.get(`${API_BASE_URL}/users/me`, { withCredentials: true });
                setUser(res.data);
            } catch {
                setUser(null);
            }
        }
        checkUser();
    }, []);

    // ✅ 로고 애니메이션 종료 타이머
    useEffect(() => {
        const timer = setTimeout(() => setShowLogo(false), 4000);
        return () => clearTimeout(timer);
    }, []);

    const handleStart = () => {
        if (user) navigate("/record");
        else navigate("/login");
    };

    return (
        <section className="relative flex flex-col items-center justify-center text-center h-[90vh] overflow-hidden">
            {/* 🎬 배경 영상 */}
            <video
                className="absolute inset-0 w-full h-full object-cover"
                src="/assets/landing-bg-loop.mp4"
                autoPlay
                loop
                muted
                playsInline
            />

            {/* 글라스 오버레이 */}
            <div className="absolute inset-0 bg-white/10 backdrop-blur-[16px]" />

            {/* 로고 애니메이션 */}
            {showLogo && (
                <motion.div
                    key="logo"
                    className="absolute inset-0 flex items-center justify-center z-20 bg-black/20 backdrop-blur-sm"
                >
                    <LogoAnimation onComplete={() => setShowLogo(false)} />
                </motion.div>
            )}

            {/* Hero 콘텐츠 */}
            {!showLogo && (
                <motion.div
                    key="hero"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="relative z-10 text-white drop-shadow-lg px-4"
                >
                    <h1 className="text-5xl font-bold mb-6 leading-snug">
                        회의는 녹음하세요,<br />정리는 AI가 합니다.
                    </h1>
                    <p className="text-lg mb-10 text-white/90">
                        음성 기록부터 요약까지 한 번에, NoteRi가 대신해드립니다.
                    </p>
                    <button
                        onClick={handleStart}
                        className="bg-white/20 backdrop-blur-md border border-white/40
            px-10 py-3 rounded-full text-lg font-semibold hover:bg-white/30 transition"
                    >
                        시작하기
                    </button>
                </motion.div>
            )}
        </section>
    );
}
