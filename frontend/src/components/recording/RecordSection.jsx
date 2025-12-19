import { motion, AnimatePresence } from "framer-motion";
import FinalSummarySection from "./FinalSummarySection";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";

const splitSummaryLines = (text = "") => {
    const normalized = String(text).replace(/\r\n/g, "\n").trim();
    const injectedBreaks = normalized.replace(/[•·]\s*/g, "\n");
    return injectedBreaks
        .split(/\n+/)
        .map(s => s.trim())
        .filter(Boolean);
};

const formatTime = (isoString) => {
    const date = new Date(isoString);
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
    finalSummaries = [],
    dynamicTemplates = {}, // { tabId: { content: "markdown string" } }
}) {
    const isRecording = recordingState === "recording";
    const words = liveText ? liveText.split(" ") : [];

    // 동적 탭 렌더링
    if (dynamicTemplates[activeTab]) {
        const templateData = dynamicTemplates[activeTab];
        
        return (
            <div className="flex flex-col gap-4 mt-4 overflow-y-auto flex-1">
                {templateData.isLoading ? (
                    // 로딩 상태
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-12 text-gray-500"
                    >
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7E37F9] mb-4"></div>
                        <p>템플릿 생성 중...</p>
                    </motion.div>
                ) : (
                    // 콘텐츠 표시
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="prose prose-gray max-w-none bg-white rounded-xl p-6 border border-gray-100"
                    >
                        <ReactMarkdown
                            children={templateData.content || "콘텐츠가 없습니다."}
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw, rehypeHighlight]}
                        />
                    </motion.div>
                )}
            </div>
        );
    }

    // 회의기록 탭
    if (activeTab === "record") {
        return (
            <div className="flex flex-col gap-4 mt-4 overflow-y-auto flex-1">
                <AnimatePresence>
                    {summaries.map((item, idx) => (
                        <motion.div
                            key={`summary-${item.id || idx}`}
                            layout
                            initial={{
                                opacity: 0,
                                y: 30,
                                scale: 0.97,
                                backgroundColor: "#F9F7FF",
                            }}
                            animate={{
                                opacity: 1,
                                y: 0,
                                scale: 1,
                                backgroundColor: "rgba(255,255,255,0)", 
                            }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{
                                opacity: { duration: 0.6, ease: [0.25, 0.6, 0.3, 1] },
                                y: { duration: 0.6, ease: [0.25, 0.6, 0.3, 1] },
                                scale: { duration: 0.6 },
                                backgroundColor: {
                                    delay: 0.3 + idx * 0.15,
                                    duration: 1.2,
                                    ease: "easeOut",
                                },
                                delay: idx * 0.15,
                            }}
                            className="relative border border-[#E5E1FF] bg-[#F9F7FF] rounded-2xl p-5 text-[15px] text-gray-800 leading-relaxed shadow-sm overflow-hidden"
                        >
                            <motion.div
                                initial={{ x: "-100%", opacity: 0.8 }}
                                animate={{ x: "100%", opacity: 0 }}
                                transition={{
                                    duration: 1.4,
                                    ease: "easeInOut",
                                    delay: 0.2 + idx * 0.1,
                                }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent z-20 pointer-events-none"
                            />
                            <p className="text-xs text-gray-400 mb-2">
                                {formatTime(item.interval_start_at)} ~ {formatTime(item.interval_end_at)}
                            </p>
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

                {!isRecording && summaries.length === 0 && (
                    <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
                        <p className="text-gray-400">녹음을 시작해보세요!</p>
                    </div>
                )}
            </div>
        );
    }

    // 스크립트 탭
    if (activeTab === "script") {
        const groupedScript = [];
        const safeSummaries = Array.isArray(summaries) ? summaries : [];
        const safeAllHistory = Array.isArray(allHistory) ? allHistory : [];

        if (safeSummaries.length > 0 && safeAllHistory.length > 0) {
            safeSummaries.forEach((summary) => {
                const start = new Date(summary.interval_start_at + "Z").getTime();
                const end = new Date(summary.interval_end_at + "Z").getTime();
                const adjustedStart = start - 1000;
                const adjustedEnd = end + 1000;

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
            groupedScript.push({
                title: "전체 스크립트",
                lines: safeAllHistory.map((l) => l.text || ""),
            });
        }

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

    // 전체요약 탭
    if (activeTab === "summary") {
        return (
            <FinalSummarySection
                finalSummaries={finalSummaries}
            />
        );
    }

    return null;
}