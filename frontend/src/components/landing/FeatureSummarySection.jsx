import { motion } from "framer-motion";
import useFadeInOnScroll from "../../hooks/useFadeInOnScroll";

export default function FeatureSummarySection() {
    const { ref, isVisible } = useFadeInOnScroll(0.2);

    return (
        <section
            ref={ref}
            className="relative flex flex-col lg:flex-row items-center justify-between min-h-screen py-16 lg:py-0 bg-white px-6 md:px-12 lg:px-[8vw] overflow-hidden"
        >
            <motion.div
                initial={{ opacity: 0, y: 60, filter: "blur(8px)" }}
                animate={isVisible ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                transition={{ duration: 0.9 }}
                className="w-full lg:w-1/2 mb-8 lg:mb-0"
            >
                <h2 className="text-3xl md:text-4xl lg:text-[2.8rem] font-bold text-gray-900 mb-4 md:mb-6">
                    AI가 뽑은<br />핵심 내용을 확인해 보세요
                </h2>
                <p className="text-gray-600 text-base md:text-lg leading-relaxed max-w-md">
                    AI가 회의 중 주요 주제와 다음 할 일을 자동으로 정리해 드립니다.
                </p>
            </motion.div>

            <motion.video
                src="/videos/ai-summary.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full lg:w-[45%] rounded-xl lg:rounded-2xl object-cover shadow-lg lg:shadow-xl"
                initial={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
                animate={isVisible ? { opacity: 1, scale: 1, filter: "blur(0px)" } : {}}
                transition={{ duration: 0.9 }}
            />
        </section>
    );
}