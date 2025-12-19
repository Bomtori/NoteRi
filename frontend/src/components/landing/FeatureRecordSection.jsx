import { motion } from "framer-motion";
import useFadeInOnScroll from "../../hooks/useFadeInOnScroll";

export default function FeatureRecordSection() {
    const { ref, isVisible } = useFadeInOnScroll(0.2);

    return (
        <section
            ref={ref}
            className="relative flex flex-col lg:flex-row items-center justify-between min-h-screen py-16 lg:py-0 bg-white px-6 md:px-12 lg:px-[8vw] overflow-hidden"
        >
            <motion.div
                initial={{ opacity: 0, y: 60, filter: "blur(8px)" }}
                animate={isVisible ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className="w-full lg:w-1/2 mb-8 lg:mb-0"
            >
                <h2 className="text-3xl md:text-4xl lg:text-[2.8rem] font-bold text-gray-900 mb-4 md:mb-6">
                    모바일과 PC 어디서든<br />편하게 녹음해요
                </h2>
                <p className="text-gray-600 text-base md:text-lg leading-relaxed max-w-md">
                    바로 녹음을 시작하고, 중요한 내용은 폴더와 메모로 남겨두세요.
                </p>
            </motion.div>

            <motion.video
                src="/videos/record.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="
                w-full
                lg:w-[90%]
                max-w-[800px]
                aspect-video
                rounded-2xl lg:rounded-3xl
                object-cover
                shadow-[0_10px_40px_rgba(0,0,0,0.1)] lg:shadow-[0_20px_60px_rgba(0,0,0,0.15)]
                "
                initial={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
                animate={isVisible ? { opacity: 1, scale: 1, filter: "blur(0px)" } : {}}
                transition={{ duration: 0.9, ease: "easeOut" }}
            />
        </section>
    );
}
