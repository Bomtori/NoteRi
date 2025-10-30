import { motion } from "framer-motion";
import { useEffect, useState } from "react";

function SummaryCard({ summaryText }) {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (summaryText && summaryText.trim().length > 0) {
            // summary가 들어오면 shimmer 멈추고 문장 표시
            const timer = setTimeout(() => setIsReady(true), 400);
            return () => clearTimeout(timer);
        }
    }, [summaryText]);

    const sentences = summaryText
        ?.split(/(?<=[.!?])\s+/)
        .filter((s) => s.trim() !== "") ?? [];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative border border-gray-200 rounded-xl p-5 bg-[#F9F6FF] text-gray-800 text-sm shadow-sm overflow-hidden"
        >
            {!isReady ? (
                // 💜 요약 중 (shimmer + 텍스트)
                <div className="relative flex items-center justify-center h-16 overflow-hidden rounded-lg">
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-[#E9D9FF] via-[#C19EF8]/50 to-[#E9D9FF]"
                        animate={{ backgroundPosition: ["0% 0%", "100% 0%"] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                        style={{ backgroundSize: "200% 100%" }}
                    />
                    <p className="relative text-[#7E37F9] font-medium text-sm z-10 animate-pulse">
                        노트리가 열심히 일하고있어요!
                    </p>
                </div>
            ) : (
                // 요약 완료 시 문장 순차 등장
                <motion.div
                    variants={{
                        visible: {
                            transition: { staggerChildren: 0.12 },
                        },
                    }}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-col gap-1"
                >
                    {sentences.map((sentence, i) => (
                        <motion.span
                            key={i}
                            variants={{
                                hidden: { opacity: 0, x: -10 },
                                visible: { opacity: 1, x: 0 },
                            }}
                            transition={{ duration: 0.4 }}
                        >
                            {sentence}
                        </motion.span>
                    ))}
                </motion.div>
            )}
        </motion.div>
    );
}
export default SummaryCard;





// import React from "react";
//
// export default function RecordSection({
//   activeTab,
//   liveText,
//   summaries,
//   refinedScript,
//   speakers,
//   recordingState,
// }) {
//   return (
//     <div className="flex-1 overflow-y-auto space-y-6 pb-24">
//       {/* 회의기록 탭 */}
//       {activeTab === "record" && (
//         <section className="space-y-4">
//           <div className="p-4 border bg-white rounded shadow-sm">
//             <h2 className="font-semibold mb-2">🎤 실시간</h2>
//             <p className="whitespace-pre-wrap text-gray-900">
//               {recordingState === "paused"
//                 ? "⏸️ 일시중지 중…"
//                 : liveText || "녹음을 시작해보세요!"}
//             </p>
//           </div>
//
//           <div className="p-4 border bg-white rounded shadow-sm max-h-64 overflow-y-auto">
//             <h2 className="font-semibold mb-2">⏱️ 1분 요약</h2>
//             {summaries.length ? (
//               <div className="space-y-3">
//                 {summaries.map((s, i) => (
//                   <div key={i} className="bg-gray-50 p-3 rounded">
//                     {s.paragraph && (
//                       <p className="text-xs text-gray-500 mb-1">
//                         원문: {s.paragraph}
//                       </p>
//                     )}
//                     <p className="text-gray-900">✅ {s.summary}</p>
//                   </div>
//                 ))}
//               </div>
//             ) : (
//               <p className="text-gray-500">요약 대기 중…</p>
//             )}
//           </div>
//         </section>
//       )}
//
//       {/* 스크립트 탭 */}
//       {activeTab === "script" && (
//         <section className="space-y-4">
//           <div className="p-4 border bg-white rounded shadow-sm max-h-64 overflow-y-auto">
//             <h2 className="font-semibold mb-2">📜 확정 히스토리</h2>
//             {refinedScript.length ? (
//               <ul className="list-disc pl-5 space-y-1">
//                 {refinedScript.map((line, idx) => (
//                   <li key={idx} className="text-gray-800">
//                     {line}
//                   </li>
//                 ))}
//               </ul>
//             ) : (
//               <p className="text-gray-500">아직 확정된 문장이 없습니다.</p>
//             )}
//           </div>
//         </section>
//       )}
//
//       {/* 화자분리 탭 */}
//       {activeTab === "speaker" && (
//         <section className="space-y-4">
//           <div className="p-4 border bg-white rounded shadow-sm max-h-64 overflow-y-auto">
//             <h2 className="font-semibold mb-2">🗣️ 화자 분리 결과</h2>
//             {speakers.length ? (
//               speakers.map((s, i) => (
//                 <p key={i} className="text-gray-800">
//                   <b>{s.speaker}</b>: {s.text}
//                 </p>
//               ))
//             ) : (
//               <p className="text-gray-500">결과 없음 (녹음 종료 후 실행)</p>
//             )}
//           </div>
//         </section>
//       )}
//     </div>
//   );
// }
