import { motion } from "framer-motion";
import useFadeInOnScroll from "../../hooks/useFadeInOnScroll";

export default function FeatureChatbotSection() {
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
                    회의 내용을<br />쉽게 검색하고 공유해요
                </h2>
                <p className="text-gray-600 text-lg leading-relaxed max-w-md">
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
                w-[90%]               
                max-w-[800px]         
                aspect-[16/10]        
                rounded-3xl           
                object-cover
                shadow-[0_20px_60px_rgba(0,0,0,0.15)] 
                "
                initial={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
                animate={isVisible ? { opacity: 1, scale: 1, filter: "blur(0px)" } : {}}
                transition={{ duration: 0.9 }}
            />
        </section>
    );
}
