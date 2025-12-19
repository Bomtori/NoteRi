import { motion } from "framer-motion";
import useFadeInOnScroll from "../../hooks/useFadeInOnScroll";

export default function FeatureChatbotSection() {
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
                    회의 내용을<br />쉽게 검색하고 공유해요
                </h2>
                <p className="text-gray-600 text-base md:text-lg leading-relaxed max-w-md">
                    필요한 부분만 빠르게 찾고, 팀원들과 바로 공유할 수 있습니다.
                </p>
            </motion.div>

            <motion.video
                src="/videos/chatbot.mp4"
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
                transition={{ duration: 0.9 }}
            />
        </section>
    );
}