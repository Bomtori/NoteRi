import { motion, AnimatePresence } from "framer-motion";

const splitSummaryLines = (text = "") => {
    // 1 줄바꿈 정규화
    const normalized = String(text).replace(/\r\n/g, "\n").trim();
    // 2 "•"나 "·"를 줄바꿈으로 변환
    const injectedBreaks = normalized.replace(/[•·]\s*/g, "\n");
    // 3 최종 분리
    return injectedBreaks
        .split(/\n+/)
        .map(s => s.trim())
        .filter(Boolean);
};
const formatTime = (isoString) => {
    const date = new Date(isoString);
    // const month = String(date.getMonth() + 1).padStart(2, "0");
    // const day = String(date.getDate()).padStart(2, "0");
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const period = hours < 12 ? "오전" : "오후";
    const hour12 = hours % 12 || 12;
    return `${period} ${hour12}:${minutes}`;
};
export default function RecordSection({
                                          activeTab,
                                          summaries = [],
                                          liveLines,
                                          liveText,
                                          recordingState,
                                          allHistory = [],
                                          finalSummary = null,
                                      }) {
    console.log("🟣 summaries:", summaries);
    console.log("🟣 allHistory:", allHistory);
    const isRecording = recordingState === "recording";
    const words = liveText ? liveText.split(" ") : [];


    // ----------------------------
    // 회의기록 탭
    // ----------------------------
    if (activeTab === "record") {
        return (
            <div className="flex flex-col gap-4 mt-4 overflow-y-auto flex-1">
                {/* 1분 요약 카드 렌더링 */}
                <AnimatePresence>
                    {summaries.map((item, idx) => (
                        <motion.div
                            key={`summary-${item.id || idx}`}
                            layout
                            initial={{
                                opacity: 0,
                                y: 30,
                                scale: 0.97,
                                backgroundColor: "#F9F7FF", // 보라색 시작
                            }}
                            animate={{
                                opacity: 1,
                                y: 0,
                                scale: 1,
                                backgroundColor: "rgba(255,255,255,0)", // ✅ 들어오고 난 뒤 배경 투명
                            }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{
                                opacity: { duration: 0.6, ease: [0.25, 0.6, 0.3, 1] },
                                y: { duration: 0.6, ease: [0.25, 0.6, 0.3, 1] },
                                scale: { duration: 0.6 },
                                backgroundColor: {
                                    delay: 0.3 + idx * 0.15, // ✅ 살짝 늦게 사라지게 (보라색 유지 시간)
                                    duration: 1.2,
                                    ease: "easeOut",
                                },
                                delay: idx * 0.15, // 카드별 등장 순서
                            }}
                            className="relative border border-[#E5E1FF] bg-[#F9F7FF] rounded-2xl p-5 text-[15px] text-gray-800 leading-relaxed shadow-sm overflow-hidden"
                        >
                            {/* 반짝 라인 효과 */}
                            <motion.div
                                initial={{ x: "-100%", opacity: 0.8 }}
                                animate={{ x: "100%", opacity: 0 }}
                                transition={{
                                    duration: 1.4,
                                    ease: "easeInOut",
                                    delay: 0.2 + idx * 0.1, // 카드별로 살짝씩 늦게
                                }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent z-20 pointer-events-none"
                            />
                            <p className="text-xs text-gray-400 mb-2">
                                {formatTime(item.interval_start_at)} ~ {formatTime(item.interval_end_at)}
                            </p>
                            {/* bullets 배열로 렌더링 */}
                            <motion.ul
                                className="list-disc list-outside pl-5 space-y-2 relative z-10 marker:text-[#333333]"
                                variants={{
                                    visible: { transition: { staggerChildren: 0.15 } },
                                    hidden: {},
                                }}
                                initial="hidden"
                                animate="visible"
                            >
                                {item.bullets && item.bullets.length > 0
                                    ? item.bullets.map((bullet, i) => (
                                        <motion.li
                                            key={`line-${item.id || idx}-${i}`}
                                            variants={{
                                                hidden: { opacity: 0, x: -8 },
                                                visible: { opacity: 1, x: 0 },
                                            }}
                                            transition={{ duration: 0.4, ease: "easeOut" }}
                                            className="leading-relaxed break-keep text-gray-800"
                                        >
                                            {String(bullet).replace(/^[•·\-\*\d.]\s*/, "")}
                                        </motion.li>
                                    ))
                                    : splitSummaryLines(item.summary).map((line, i) => (
                                        <motion.li
                                            key={`line-${item.id || idx}-s-${i}`}
                                            variants={{
                                                hidden: { opacity: 0, x: -8 },
                                                visible: { opacity: 1, x: 0 },
                                            }}
                                            transition={{ duration: 0.4, ease: "easeOut" }}
                                            className="leading-relaxed break-keep text-gray-800"
                                        >
                                            {line.replace(/^[•·\-\*\d.]\s*/, "")}
                                        </motion.li>
                                    ))}
                            </motion.ul>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* 실시간 STT만 표시 */}
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

    if (activeTab === "script") {
        const groupedScript = [];
        const safeSummaries = Array.isArray(summaries) ? summaries : [];
        const safeAllHistory = Array.isArray(allHistory) ? allHistory : [];

        // 🔹 summaries와 allHistory 모두 있을 때
        if (safeSummaries.length > 0 && safeAllHistory.length > 0) {
            console.log(summaries, allHistory)
            safeSummaries.forEach((summary, idx) => {
                const start = new Date(summary.interval_start_at + "Z").getTime();
                const end = new Date(summary.interval_end_at + "Z").getTime();

                // 1초 오차 보정
                const adjustedStart = start - 1000;
                const adjustedEnd = end + 1000;

                // 요약 구간과 겹치는 STT만 포함
                const chunk = safeAllHistory.filter((line) => {
                    const startField = line.started_at || line.start_time;
                    const endField = line.ended_at || line.end_time;
                    if (!startField || !endField) return false;
                    const s = new Date(startField + "Z").getTime();
                    const e = new Date(endField + "Z").getTime();
                    return e >= adjustedStart && s <= adjustedEnd;
                });



                if (chunk.length > 0) {
                    groupedScript.push({
                        title: `${formatTime(summary.interval_start_at)} - ${formatTime(summary.interval_end_at)}`,
                        lines: chunk.map((l) => l.text || ""),
                    });
                }
            });

            // 🔹 마지막 요약 이후의 남은 스크립트
            const lastEnd = Math.max(
                ...safeSummaries.map((s) => new Date(s.interval_end_at).getTime())
            );
            const leftover = safeAllHistory.filter((line) => {
                    const startField = line.started_at || line.start_time;
                    if (!startField) return false;
                    return new Date(startField).getTime() > lastEnd;
                });
            if (leftover.length > 0) {
                groupedScript.push({
                    title: "마지막 이후 구간",
                    lines: leftover.map((l) => l.text || ""),
                });
            }
        } else {
            // 🔹 요약이 없을 때 전체 스크립트로 표시
            groupedScript.push({
                title: "전체 스크립트",
                lines: safeAllHistory.map((l) => l.text || ""),
            });
        }

        // 🔹 렌더링
        return (
            <div className="flex flex-col gap-6 mt-4 overflow-y-auto flex-1 px-2">
                {groupedScript.length > 0 ? (
                    groupedScript.map((chunk, idx) => (
                        <motion.div
                            key={`chunk-${idx}`}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className="border-l-4 border-[#E5E1FF] pl-4 py-3 bg-white/50 rounded-lg"
                        >
                            <h4 className="text-[#999] mb-2 text-[11px] italic font-normal tracking-wide">
                                {chunk.title
                                    .replace(/^요약\s*\d+\s*/, "")
                                    .replace(/[()]/g, "")
                                    .trim()}
                            </h4>
                            <div className="text-sm text-gray-700 leading-relaxed space-y-1">
                                {chunk.lines.map((line, i) => (
                                    <p key={i} className="break-keep">{line}</p>
                                ))}
                            </div>
                        </motion.div>
                    ))
                ) : (
                    <div className="flex items-center justify-center flex-1 text-gray-400 text-sm">
                        아직 확정된 스크립트가 없습니다.
                    </div>
                )}
            </div>
        );
    }


    return null;
}