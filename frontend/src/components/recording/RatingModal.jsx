import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";

export default function RatingModal({ show, onClose, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);

  useEffect(() => {
    if (!show) setRating(0);
  }, [show]);

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative w-[340px] rounded-2xl p-6 text-center shadow-xl bg-white/30 backdrop-blur-2xl border border-white/40"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            이번 요약은 어떠셨나요?
          </h3>
          <p className="text-sm text-gray-600 mb-5">
            별점을 눌러 피드백을 남겨주세요!
          </p>

          {/* 별점 */}
          <div className="flex justify-center gap-2 mb-5">
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
                  className={`w-8 h-8 cursor-pointer transition-colors duration-150
                    ${
                      num <= (hovered || rating)
                        ? "fill-[#7E37F9] text-[#7E37F9] drop-shadow-[0_0_6px_rgba(126,55,249,0.5)]"
                        : "text-gray-300 hover:text-[#9E77FF]"
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
              onClose();
            }}
            className="w-full py-2.5 rounded-lg bg-[#7E37F9]/90 text-white font-medium
                       shadow-[0_4px_15px_rgba(126,55,249,0.3)]
                       hover:bg-[#682be0] transition disabled:opacity-40"
          >
            제출하기
          </button>

          {/* 닫기 버튼 */}
          <button
            onClick={onClose}
            className="absolute top-3 right-4 text-gray-400 hover:text-gray-600 text-sm"
          >
            ✕
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
