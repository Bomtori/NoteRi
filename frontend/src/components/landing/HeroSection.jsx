import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { TypeAnimation } from "react-type-animation";
import LogoAnimation from "../common/LogoAnimation";
import "../../styles/HeroSection.css";

export default function HeroSection({ user }) {
    const navigate = useNavigate();
    const [showLogo, setShowLogo] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setShowLogo(false), 500);
        return () => clearTimeout(timer);
    }, []);

    const handleStart = () => {
        if (user) navigate("/record");
        else navigate("/login");
    };

    // flare 표시 함수
    const triggerFlare = () => {
        const flare = document.querySelector(".lens-flare");
        flare?.classList.add("active");
        setTimeout(() => flare?.classList.remove("active"), 700);
    };

    return (
        <section className="relative flex flex-col h-screen w-full items-center justify-center text-center h-[90vh] overflow-hidden">
            {/* 🎬 배경 영상 */}
            <video
                className="absolute object-cover object-center inset-0 w-full h-full object-cover"
                src="/assets/landing-bg-loop.mp4"
                autoPlay
                loop
                muted
                playsInline
            />

            {/* 글라스 오버레이 */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[16px]" />

            {/* 💥 렌즈 플레어 */}
            <div className="lens-flare absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full blur-3xl opacity-0 pointer-events-none z-10"></div>

            {/* 로고 애니메이션 */}
            {/*{showLogo && (*/}
            {/*    <motion.div*/}
            {/*        key="logo"*/}
            {/*        className="absolute inset-0 flex items-center justify-center z-20 bg-black/20 backdrop-blur-sm"*/}
            {/*    >*/}
            {/*        <LogoAnimation onComplete={() => setShowLogo(false)} />*/}
            {/*    </motion.div>*/}
            {/*)}*/}

            {/* Hero 콘텐츠 */}
            {!showLogo && (
                <motion.div
                    key="hero"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.3 }}
                    className="relative z-20 text-white drop-shadow-lg px-4"
                >
                    <h1 className="text-6xl md:text-7xl font-extrabold mb-8 leading-tight tracking-tight">
                        <TypeAnimation
                            sequence={[
                                () => triggerFlare(), // 💥 flare + flicker 시작
                                "Note + 利",
                                1600,
                                "노트, 그리고 이로움",
                                1800,
                                "기록이 이로움이 되는 순간 — ",
                                800,
                                "NoteRi",
                                2500,
                            ]}
                            wrapper="span"
                            speed={35}
                            repeat={Infinity}
                            cursor={false}
                            className="flicker-text"
                            style={{
                                whiteSpace: "pre-line",
                                display: "inline-block",
                            }}
                        />
                    </h1>

                    <p className="text-lg md:text-xl mb-10 text-white/90 max-w-xl mx-auto leading-relaxed">
                        회의의 시작부터 요약까지,<br />
                        <span className="text-gradient font-semibold">NoteRi</span>가 함께합니다.
                    </p>

                    <motion.button
                        onClick={handleStart}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        className="bg-white/20 backdrop-blur-md border border-white/40
                        px-10 py-3 rounded-full text-lg font-semibold hover:bg-white/30 transition"
                    >
                        시작하기
                    </motion.button>
                </motion.div>
            )}
        </section>
    );
}
