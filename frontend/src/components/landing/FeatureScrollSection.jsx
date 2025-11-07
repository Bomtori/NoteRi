import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

const features = [
    {
        title: "모바일과 PC 어디서든 편하게 녹음해요",
        desc: "바로 녹음을 시작하고, 중요한 내용은 북마크와 메모로 남겨두세요.",
        media: "/videos/record.mp4",
    },
    {
        title: "AI가 뽑은 핵심 내용을 확인해 보세요",
        desc: "AI가 주요 주제, 다음 할 일, 요약을 자동으로 정리해 드려요.",
        media: "/videos/ai-summary.mp4",
    },
    {
        title: "회의 내용을 쉽게 검색하고 공유해요",
        desc: "필요한 부분만 빠르게 찾고 팀원과 함께 공유할 수 있어요.",
        media: "/videos/share.mp4",
    },
];

export default function FeatureScrollSection() {
    const [activeIndex, setActiveIndex] = useState(0);
    const sectionRefs = useRef([]);

    // IntersectionObserver로 현재 섹션 감지
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const index = Number(entry.target.dataset.index);
                        setActiveIndex(index);
                    }
                });
            },
            { threshold: 0.6 }
        );

        sectionRefs.current.forEach((el) => el && observer.observe(el));
        return () => observer.disconnect();
    }, []);

    // 클릭 시 스크롤 이동
    const scrollToSection = (index) => {
        sectionRefs.current[index]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    };

    return (
        <section className="relative flex w-full bg-white overflow-hidden">
            {/* 왼쪽 텍스트 영역 */}
            <div className="w-1/2 flex flex-col">
                {features.map((f, i) => (
                    <div
                        key={i}
                        data-index={i}
                        ref={(el) => (sectionRefs.current[i] = el)}
                        className="h-screen flex flex-col justify-center px-[8vw]"
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 80 }}
                            animate={{
                                opacity: activeIndex === i ? 1 : 0,
                                y: activeIndex === i ? 0 : 80,
                            }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                        >
                            <h2 className="text-[2.5rem] font-bold text-gray-900 leading-tight mb-5">
                                {f.title}
                            </h2>
                            <p className="text-gray-500 text-lg leading-relaxed max-w-md">
                                {f.desc}
                            </p>
                        </motion.div>
                    </div>
                ))}
            </div>

            {/* 오른쪽 영상 (sticky 고정) */}
            <div className="sticky top-0 right-0 h-screen w-1/2 flex items-center justify-center">
                <motion.video
                    key={features[activeIndex].media}
                    src={features[activeIndex].media}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="
                        w-[90%]               
                        max-w-[800px]         
                        aspect-[16/10]        
                        rounded-3xl           
                        object-cover
                        shadow-[0_20px_60px_rgba(0,0,0,0.15)]
                        "
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8 }}
                />
            </div>

            {/* 스크롤 내비게이션 */}
            <div className="absolute top-1/2 right-[calc(50%+40px)] -translate-y-1/2 flex flex-col gap-4">
                {features.map((f, i) => (
                    <button
                        key={i}
                        onClick={() => scrollToSection(i)}
                        className={`text-sm font-medium transition-colors ${
                            activeIndex === i
                                ? "text-[#7E37F9]"
                                : "text-gray-400 hover:text-gray-600"
                        }`}
                    >
                        {f.title.replace(/\s+/g, "").slice(0, 6)}{/* 짧은 형태 */}
                    </button>
                ))}
            </div>
        </section>
    );
}
