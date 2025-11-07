import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";

/**
 * 오른쪽 하단에서 올라오는 별점 피드백 토스트
 * props:
 *  - show: boolean (표시 여부)
 *  - onClose: () => void
 *  - onSubmit: (rating: number) => void
 */
export default function RatingToast({ show, onClose, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);

  useEffect(() => {
    if (!show) setRating(0);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="rating-toast"
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="fixed bottom-6 right-6 z-[9999]"
        >
          <div
            className="w-[280px] bg-white border border-gray-100 shadow-lg 
                       rounded-2xl p-4 backdrop-blur-md"
          >
            {/* 헤더 */}
            <h3 className="text-sm font-semibold text-gray-800 mb-1">
              이번 요약은 어땠나요?
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              별점을 눌러 피드백을 남겨주세요!
            </p>

            {/* 별점 */}
            <div className="flex justify-center gap-2 mb-3">
              {[1, 2, 3, 4, 5].map((num) => (
                <motion.div
                  key={num}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Star
                    onMouseEnter={() => setHovered(num)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => setRating(num)}
                    className={`w-6 h-6 cursor-pointer transition-all ${
                      num <= (hovered || rating)
                        ? "fill-[#7E37F9] text-[#7E37F9] drop-shadow-[0_0_5px_rgba(126,55,249,0.5)]"
                        : "text-gray-300 hover:text-[#B68CFF]"
                    }`}
                  />
                </motion.div>
              ))}
            </div>

            {/* 제출 버튼 */}
            <button
              disabled={!rating}
              onClick={() => {
                onSubmit?.(rating);
                onClose?.();
              }}
              className="w-full py-1.5 rounded-lg bg-[#7E37F9] text-white text-sm font-medium
                         shadow-[0_3px_10px_rgba(126,55,249,0.25)]
                         hover:bg-[#6b2de4] transition disabled:opacity-40"
            >
              제출하기
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
