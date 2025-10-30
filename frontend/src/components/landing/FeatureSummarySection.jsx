import { motion } from "framer-motion";
import useFadeInOnScroll from "../../hooks/useFadeInOnScroll";

export default function FeatureSummarySection() {
    const { ref, isVisible } = useFadeInOnScroll(0.3);

    return (
        <section
            ref={ref}
            className="relative flex items-center justify-between h-screen bg-white px-[8vw] overflow-hidden"
        >
            <motion.div
                initial={{ opacity: 0, y: 60, filter: "blur(8px)" }}
                animate={isVisible ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                transition={{ duration: 0.9 }}
                className="w-1/2"
            >
                <h2 className="text-[2.8rem] font-bold text-gray-900 mb-6">
                    AI가 뽑은<br />핵심 내용을 확인해 보세요
                </h2>
                <p className="text-gray-600 text-lg leading-relaxed max-w-md">
                    AI가 회의 중 주요 주제와 다음 할 일을 자동으로 정리해 드립니다.
                </p>
            </motion.div>

            <motion.video
                src="/videos/ai-summary.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-[45%] rounded-2xl object-cover shadow-xl"
                initial={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
                animate={isVisible ? { opacity: 1, scale: 1, filter: "blur(0px)" } : {}}
                transition={{ duration: 0.9 }}
            />
        </section>
    );
}
