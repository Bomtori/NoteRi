import { motion } from "framer-motion";
import useFadeInOnScroll from "../../hooks/useFadeInOnScroll";

export default function FeatureRecordSection() {
    const { ref, isVisible } = useFadeInOnScroll(0.3);

    return (
        <section
            ref={ref}
            className="relative flex items-center justify-between h-screen bg-white px-[8vw] overflow-hidden"
        >
            <motion.div
                initial={{ opacity: 0, y: 60, filter: "blur(8px)" }}
                animate={isVisible ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className="w-1/2"
            >
                <h2 className="text-[2.8rem] font-bold text-gray-900 mb-6">
                    모바일과 PC 어디서든<br />편하게 녹음해요
                </h2>
                <p className="text-gray-600 text-lg leading-relaxed max-w-md">
                    바로 녹음을 시작하고, 중요한 내용은 북마크와 메모로 남겨두세요.
                </p>
            </motion.div>

            <motion.video
                src="/videos/record.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-[45%] rounded-2xl object-cover shadow-xl"
                initial={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
                animate={isVisible ? { opacity: 1, scale: 1, filter: "blur(0px)" } : {}}
                transition={{ duration: 0.9, ease: "easeOut" }}
            />
        </section>
    );
}
