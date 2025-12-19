// import React from "react";
// import { motion, AnimatePresence } from "framer-motion";

// export default function TemplateModal({ isOpen, onClose, onSelect }) {
//   return (
//     <AnimatePresence>
//       {isOpen && (
//         <motion.div
//           initial={{ opacity: 0, y: 12, scale: 0.98 }}
//           animate={{ opacity: 1, y: 0, scale: 1 }}
//           exit={{ opacity: 0, y: 8, scale: 0.98 }}
//           transition={{ duration: 0.2, ease: "easeOut" }}
//           className="fixed left-1/2 -translate-x-1/2 bottom-[74px] z-[200]"
//         >
//           <div className="bg-white/95 backdrop-blur-md border border-gray-200 shadow-lg rounded-2xl p-4 w-[260px] text-center">
//             <h3 className="font-semibold text-sm mb-3 text-gray-800">템플릿 생성</h3>

//             <div className="flex flex-col gap-2 mb-3">
//               <button
//                 onClick={() => onSelect("화자분리")}
//                 className="px-4 py-2 text-sm rounded-xl bg-[#f3e8ff] hover:bg-[#e9d5ff] text-[#7E37F9] font-medium transition-colors"
//               >
//                 화자분리 결과
//               </button>
//               <button
//                 onClick={() => onSelect("요약")}
//                 className="px-4 py-2 text-sm rounded-xl bg-[#f3e8ff] hover:bg-[#e9d5ff] text-[#7E37F9] font-medium transition-colors"
//               >
//                 전체요약 결과
//               </button>
//             </div>

//             <button
//               onClick={onClose}
//               className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
//             >
//               닫기
//             </button>
//           </div>
//         </motion.div>
//       )}
//     </AnimatePresence>
//   );
// }
