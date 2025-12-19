import { motion, AnimatePresence } from "framer-motion";
import { FaTimes } from "react-icons/fa";
import { createPortal } from "react-dom";

export default function TemplateBar({ isOpen, onClose, onSelect }) {
  if (!isOpen) return null;

  const buttons = [
    { key: "lecture", label: "강의록" },
    { key: "meeting", label: "회의록" },
    { key: "interview", label: "인터뷰" },
    { key: "blog", label: "블로그" },
  ];

  const bar = (
    <AnimatePresence>
      <motion.div
        layout
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: "spring", stiffness: 250, damping: 25 }}
        className="
          fixed bottom-[120px] left-1/2 -translate-x-1/2
          z-[99999]
        "
      >
        <motion.div
          layout
          className="
            bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.1)]
            w-[90vw] max-w-[400px] p-5 border border-gray-100
          "
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold text-gray-800 text-sm">
              템플릿 유형 선택
            </span>

            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-black transition"
            >
              <FaTimes size={18} />
            </button>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-3">
            {buttons.map((btn) => (
              <button
                key={btn.key}
                onClick={() => {
                  console.log("🔥 TEMPLATE BUTTON CLICKED");
                  onSelect(btn.key);
                  onClose();
                }}
                className="
                  px-4 py-2 rounded-lg text-sm font-medium
                  bg-[#7E37F9] text-white
                  hover:bg-[#692ed9] transition
                "
              >
                {btn.label}
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(bar, document.body);
}
// import { motion, AnimatePresence } from "framer-motion";
// import { FaTimes } from "react-icons/fa";
// import { useState } from "react";
// import { createPortal } from "react-dom";

// export default function TemplateBar({ isOpen, onClose, onSelect, barCenter }) {

//   const isMobile = window.innerWidth < 1024;

//   const buttons = [
//     { key: "lecture", label: "강의록" },
//     { key: "meeting", label: "회의록" },
//     { key: "interview", label: "인터뷰" },
//     { key: "blog", label: "블로그" },
//   ];

//   return (
//     <AnimatePresence>
//       {isOpen && (
//         <motion.div
//           layout
//           initial={{ opacity: 0, y: 40 }}
//           animate={{ opacity: 1, y: 0 }}
//           exit={{ opacity: 0, y: 40 }}
//           transition={{ type: "spring", stiffness: 250, damping: 25 }}
//           className="
//             absolute bottom-[120px] left-1/2 -translate-x-1/2
//             z-[99999]
//           "
//         >
//           <motion.div
//             layout
//             className="
//               bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.1)]
//               w-[90vw] max-w-[400px] p-5 border border-gray-100
//             "
//           >
//             {/* Header */}
//             <div className="flex items-center justify-between mb-4">
//               <span className="font-semibold text-gray-800 text-sm">
//                 템플릿 유형 선택
//               </span>

//               <button
//                 onClick={onClose}
//                 className="p-2 text-gray-600 hover:text-black transition"
//               >
//                 <FaTimes size={18} />
//               </button>
//             </div>

//             {/* Buttons */}
//             <div className="grid grid-cols-2 gap-3">
//               {buttons.map((btn) => (
//                 <button
//                   key={btn.key}
//                   onClick={() => {
//                     onSelect(btn.key);
//                     onClose();
//                   }}
//                   className="
//                     px-4 py-2 rounded-lg text-sm font-medium
//                     bg-[#7E37F9] text-white
//                     hover:bg-[#692ed9] transition
//                   "
//                 >
//                   {btn.label}
//                 </button>
//               ))}
//             </div>
//           </motion.div>
//         </motion.div>
//       )}
//     </AnimatePresence>
//   );
// }
