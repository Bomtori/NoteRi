import { motion, AnimatePresence } from "framer-motion";

export default function RecordSection({
                                          activeTab,
                                          summaries,
                                          liveLines,
                                          liveText,
                                          recordingState,
                                          allHistory = [],
                                          finalSummary = null, // ✅ 전체 요약 데이터
                                      }) {
    const isRecording = recordingState === "recording";
    const words = liveText ? liveText.split(" ") : [];

    // 🔹 회의기록 탭
    if (activeTab === "record") {
        return (
            <div className="flex flex-col gap-4 mt-4 overflow-y-auto flex-1">
                {/* ✅ 1분 요약 카드 */}
                <AnimatePresence>
                    {summaries.map((item) => (
                        <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, y: 20, scale: 0.98 }}
                            animate={{
                                opacity: 1,
                                y: 0,
                                scale: 1,
                                boxShadow: [
                                    "0 0 0 rgba(126,55,249,0)",
                                    "0 0 14px rgba(126,55,249,0.25)",
                                    "0 0 0 rgba(126,55,249,0)",
                                ],
                            }}
                            transition={{ duration: 1, ease: [0.22, 0.61, 0.36, 1] }}
                            className="relative border border-gray-200 bg-[#F9F6FF] rounded-xl p-5 text-sm text-gray-800 leading-relaxed shadow-sm overflow-hidden"
                        >
                            {/* ✨ 반짝 라인 효과 */}
                            <motion.div
                                initial={{ x: "-100%" }}
                                animate={{ x: "100%" }}
                                transition={{
                                    duration: 1.2,
                                    ease: "easeInOut",
                                    delay: 0.3,
                                }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none"
                            />

                            {/* ✏️ 불릿 단위로 줄바꿈 표시 */}
                            <motion.ul
                                className="list-disc ml-4 space-y-2 relative z-10"
                                variants={{
                                    visible: { transition: { staggerChildren: 0.15 } },
                                    hidden: {},
                                }}
                                initial="hidden"
                                animate="visible"
                            >
                                {item.summary
                                    ?.split(/\n+/) // 여러 개의 \n도 처리
                                    .map((line) => line.trim())
                                    .filter((line) => line && line !== "")
                                    .map((line, i) => {
                                        // 불릿 문자 제거 (•, ·, -, *, 숫자. 등)
                                        const cleaned = line.replace(/^[•·\-*\d.]\s*/, "");
                                        return (
                                            <motion.li
                                                key={i}
                                                variants={{
                                                    hidden: { opacity: 0, x: -8 },
                                                    visible: { opacity: 1, x: 0 },
                                                }}
                                                transition={{ duration: 0.4, ease: "easeOut" }}
                                                className="leading-relaxed break-keep text-gray-800"
                                            >
                                                {cleaned}
                                            </motion.li>
                                        );
                                    })}
                            </motion.ul>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* ✅ 실시간 STT만 표시 */}
                {isRecording && (
                    <motion.div
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm"
                    >

                        <div className="text-sm leading-relaxed text-gray-700">
                            <p className="flex flex-wrap gap-x-[4px] gap-y-[2px]">
                                <AnimatePresence>
                                    {words.map((word, i) => (
                                        <motion.span
                                            key={`${word}-${i}`}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2, ease: "easeOut" }}
                                            className="text-gray-600"
                                        >
                                            {word}
                                        </motion.span>
                                    ))}
                                </AnimatePresence>
                            </p>
                        </div>
                    </motion.div>
                )}

                {/* 녹음 중이 아닐 때 안내 */}
                {!isRecording && summaries.length === 0 && (
                    <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
                        <p className="text-gray-400">녹음을 시작해보세요!</p>
                    </div>
                )}
            </div>
        );
    }

    // 🔹 스크립트 탭
    if (activeTab === "script") {
        return (
            <div className="flex flex-col gap-6 mt-4 overflow-y-auto flex-1 px-2">
                {allHistory.length > 0 ? (
                    <div className="text-sm text-gray-700 leading-relaxed space-y-1">
                        {allHistory.map((line, i) => (
                            <span key={i}>
                                {line.replace(/^•\s*/, "")}{" "}
                            </span>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center justify-center flex-1 text-gray-400 text-sm">
                        아직 확정된 스크립트가 없습니다.
                    </div>
                )}

                {/* 녹음 중일 때만 "현재 진행 중" */}
                {isRecording && liveLines.length > 0 && (
                    <div className="border-t-2 border-dashed border-[#7E37F9]/30 pt-4 mt-2">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-medium text-[#7E37F9] bg-[#F9F6FF] px-3 py-1 rounded-full flex items-center gap-1">
                                <span className="animate-pulse">🎙️</span>
                                현재 진행 중
                            </span>
                        </div>
                        <div className="text-sm text-gray-600 leading-relaxed">
                            {liveLines.map((line, i) => (
                                <span key={i}>
                                    {line.replace(/^•\s*/, "")}{" "}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // 🔹 전체 요약 탭
    if (activeTab === "summary") {
        return (
            <div className="flex flex-col gap-4 mt-4 overflow-y-auto flex-1">
                <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-3">🧾 현재 진행 중</h3>
                    {finalSummary ? (
                        <div className="space-y-4">
                            {/* 제목 */}
                            {finalSummary.title && (
                                <div className="pb-3 border-b border-gray-200">
                                    <h4 className="text-lg font-bold text-gray-900">
                                        {finalSummary.title}
                                    </h4>
                                </div>
                            )}

                            {/* 주요 내용 */}
                            {finalSummary.bullets?.length > 0 && (
                                <div>
                                    <p className="font-semibold text-gray-700 mb-2">📌 주요 내용</p>
                                    <ul className="list-disc ml-5 space-y-1 text-sm text-gray-800">
                                        {finalSummary.bullets.map((bullet, i) => (
                                            <li key={i} className="leading-relaxed">
                                                {bullet}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* 후속 조치 */}
                            {finalSummary.actions?.length > 0 && (
                                <div>
                                    <p className="font-semibold text-gray-700 mb-2">✅ 후속 조치</p>
                                    <ul className="list-disc ml-5 space-y-1 text-sm text-gray-700">
                                        {finalSummary.actions.map((action, i) => (
                                            <li key={i} className="leading-relaxed">
                                                {action}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-sm">
                            녹음을 종료하면 전체 요약이 생성됩니다.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return null;
}