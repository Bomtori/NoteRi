// import { motion, AnimatePresence } from "framer-motion";
// import { FaTimes, FaRegCopy } from "react-icons/fa";
// import ReactMarkdown from "react-markdown";
// import remarkGfm from "remark-gfm";
// import rehypeRaw from "rehype-raw";
// import rehypeHighlight from "rehype-highlight";

// export default function TemplateResultModal({ isOpen, onClose, content }) {
//   if (!isOpen) return null;

//   const copyToClipboard = async () => {
//     await navigator.clipboard.writeText(content);
//     alert("복사되었습니다!");
//   };

//   return (
//     <AnimatePresence>
//       <motion.div
//         initial={{ opacity: 0 }}
//         animate={{ opacity: 1 }}
//         exit={{ opacity: 0 }}
//         className="
//           fixed inset-0 bg-black/40 backdrop-blur-sm 
//           flex justify-center items-center z-[9999]
//         "
//       >
//         <motion.div
//           initial={{ y: 40, opacity: 0 }}
//           animate={{ y: 0, opacity: 1 }}
//           exit={{ y: 40, opacity: 0 }}
//           className="
//             bg-white rounded-xl shadow-xl max-w-3xl w-[90%]
//             max-h-[80%] overflow-y-auto p-6 relative
//           "
//         >
//           {/* 상단 버튼 */}
//           <div className="absolute top-4 right-4 flex items-center gap-3">
//             {/* 복사 버튼 */}
//             <button
//               onClick={copyToClipboard}
//               className="p-2 text-gray-600 hover:text-black transition"
//               title="복사하기"
//             >
//               <FaRegCopy size={18} />
//             </button>

//             {/* 닫기 버튼 */}
//             <button
//               onClick={onClose}
//               className="p-2 text-gray-600 hover:text-black transition"
//             >
//               <FaTimes size={18} />
//             </button>
//           </div>

//           {/* Markdown 렌더링 */}
//           <div className="prose prose-gray max-w-none">
//             <ReactMarkdown
//               children={content}
//               remarkPlugins={[remarkGfm]}
//               rehypePlugins={[rehypeRaw, rehypeHighlight]}
//             />
//           </div>
//         </motion.div>
//       </motion.div>
//     </AnimatePresence>
//   );
// }
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaRegCopy } from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import { createPortal } from "react-dom";

export default function TemplateResultModal({ isOpen, onClose, content }) {
  if (!isOpen) return null;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(content);
    alert("복사되었습니다!");
  };

  const modalUI = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="template-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-[9999]"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="bg-white rounded-xl shadow-xl max-w-3xl w-[90%] max-h-[80%] overflow-y-auto p-6 relative"
          >
            {/* 상단 버튼 */}
            <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
              <button
                onClick={copyToClipboard}
                className="p-2 text-gray-600 hover:text-black transition"
                title="복사하기"
              >
                <FaRegCopy size={18} />
              </button>

              <button
                onClick={onClose}
                className="p-2 text-gray-600 hover:text-black transition"
              >
                <FaTimes size={18} />
              </button>
            </div>

            {/* Markdown 렌더링 */}
            <div className="prose prose-gray max-w-none mt-8">
              <ReactMarkdown
                children={content}
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeHighlight]}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalUI, document.body);
}