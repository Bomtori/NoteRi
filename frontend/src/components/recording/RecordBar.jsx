import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPause, FaStop, FaPlay, FaShareAlt } from "react-icons/fa";
import { FaBars } from "react-icons/fa6";
import { BsRecordCircle } from "react-icons/bs";
import RecordShareModal from "./RecordShareModal";

export default function RecordBar({
                                      boardId = null, // ✅ 문법 수정: 기본값 정의만
                                      recordingState = "idle",
                                      onStart,
                                      onPause,
                                      onResume,
                                      onStop,
                                      onCreateTemplate,
                                      onTogglePanel, // 사이드바 열기 버튼
                                      boardTitle,          // 👈 추가
                                      summaries = [],      // 👈 추가
                                      refinedScript = [],  // 👈 추가
                                      memo = null,         // 👈 추가
                                  }) {
    const [state, setState] = useState(recordingState);
    const [elapsed, setElapsed] = useState(0);
    const [showShareModal, setShowShareModal] = useState(false);

    useEffect(() => {
        let timer;
        if (state === "recording") {
            timer = setInterval(() => setElapsed((t) => t + 1), 1000);
        } else {
            clearInterval(timer);
        }
        return () => clearInterval(timer);
    }, [state]);

    useEffect(() => setState(recordingState), [recordingState]);

    const formatTime = (sec) => {
        const m = String(Math.floor(sec / 60)).padStart(2, "0");
        const s = String(sec % 60).padStart(2, "0");
        return `${m}:${s}`;
    };

    return (
        <>
            <motion.div
                key="record-bar"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                transition={{ duration: 0.25 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 flex justify-center z-50"
            >
                <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm shadow-md border border-gray-200 rounded-full px-5 py-2 transition-all">
                    <AnimatePresence mode="wait">
                        {state === "idle" && (
                            <motion.div
                                key="idle"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-center gap-3"
                            >
                                <button
                                    onClick={() => {
                                        setState("recording");
                                        onStart?.();
                                    }}
                                    className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all"
                                >
                                    <BsRecordCircle className="text-lg" />
                                </button>
                                <button
                                    onClick={() => setShowShareModal(true)}
                                    className="p-2 text-gray-600 hover:text-black transition-all"
                                >
                                    <FaShareAlt />
                                </button>
                                {/* ✅ 사이드바 열기 */}
                                <button
                                    onClick={onTogglePanel}
                                    className="p-2 text-gray-600 hover:text-[#7E37F9] transition-all"
                                >
                                    <FaBars />
                                </button>
                            </motion.div>
                        )}

                        {state === "recording" && (
                            <motion.div
                                key="recording"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-center gap-3"
                            >
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                <button
                                    onClick={() => {
                                        setState("paused");
                                        onPause?.();
                                    }}
                                    className="p-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-all"
                                >
                                    <FaPause />
                                </button>
                                <button
                                    onClick={() => {
                                        setState("stopped");
                                        onStop?.();
                                    }}
                                    className="p-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-all"
                                >
                                    <FaStop />
                                </button>
                                <span className="text-xs font-medium text-gray-600">
                  {formatTime(elapsed)}
                </span>
                                {/* ✅ 사이드바 열기 버튼 */}
                                <button
                                    onClick={onTogglePanel}
                                    className="p-2 text-gray-600 hover:text-[#7E37F9] transition-all"
                                    title="메모 / GPT 열기"
                                >
                                    <FaBars />
                                </button>
                            </motion.div>
                        )}

                        {state === "paused" && (
                            <motion.div
                                key="paused"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-center gap-3"
                            >
                                <button
                                    onClick={() => {
                                        setState("recording");
                                        onResume?.();
                                    }}
                                    className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-all"
                                >
                                    <FaPlay />
                                </button>
                                <button
                                    onClick={() => {
                                        setState("stopped");
                                        onStop?.();
                                    }}
                                    className="p-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-all"
                                >
                                    <FaStop />
                                </button>
                                <span className="text-xs font-medium text-gray-600">
                  {formatTime(elapsed)}
                </span>
                            </motion.div>
                        )}

                        {["stopped", "replay"].includes(state) && (
                            <motion.div
                                key="stopped"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-center gap-3"
                            >
                                <button
                                    onClick={() => setShowShareModal(true)}
                                    className="p-2 text-gray-700 hover:text-black transition-all"
                                >
                                    <FaShareAlt />
                                </button>
                                <button
                                    onClick={onCreateTemplate}
                                    className="px-4 py-1.5 bg-black text-white rounded-full text-sm hover:bg-gray-800 transition-all"
                                >
                                    템플릿 추가
                                </button>
                                {/* ✅ 사이드바 열기 버튼 */}
                                <button
                                    onClick={onTogglePanel}
                                    className="p-2 text-gray-600 hover:text-[#7E37F9] transition-all"
                                    title="메모 / GPT 열기"
                                >
                                    <FaBars />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ✅ 공유 모달 */}
                <AnimatePresence>
                    {showShareModal && (
                        <RecordShareModal
                            isOpen={showShareModal}
                            onClose={() => setShowShareModal(false)}
                            boardId={boardId}
                            // 👇 새로 받은 props 전달
                            boardTitle={boardTitle}
                            summaries={summaries}
                            refinedScript={refinedScript}
                            memo={memo}
                        />
                    )}
                </AnimatePresence>
            </motion.div>
        </>
    );
}
