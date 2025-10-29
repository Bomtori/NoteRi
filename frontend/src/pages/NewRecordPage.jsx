import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "../api/apiClient";
import { changeRecordFolder } from "../features/record/recordSlice";
import { useToast } from "../hooks/useToast";
import useRecording from "../hooks/useRecording";

// components
import RecordHeader from "../components/recording/RecordHeader";
import RecordTabs from "../components/recording/RecordTabs";
import RecordSection from "../components/recording/RecordSection";
import RecordBar from "../components/recording/RecordBar";
import RightPanel from "../components/recording/RightPanel";
import TemplateModal from "../components/recording/TemplateModal";

export default function NewRecordPage() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { folders } = useSelector((state) => state.record);

    // 🔹 상태
    const [boardId, setBoardId] = useState(null);
    const [title, setTitle] = useState(localStorage.getItem("draftTitle") || formatDefaultTitle());
    // const [tempMemo, setTempMemo] = useState(localStorage.getItem("draftMemo") || "");
    // const [tempQuestion, setTempQuestion] = useState(localStorage.getItem("draftQuestion") || "");
    const [activeTab, setActiveTab] = useState("record");
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [isPanelVisible, setIsPanelVisible] = useState(false);
    const [activeGPTTab, setActiveGPTTab] = useState("memo");
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const { toast, showToast, clearToast } = useToast();

    // 🔹 STT 관련 상태
    const [liveText, setLiveText] = useState("");
    const [summaries, setSummaries] = useState([]);
    const [refinedScript, setRefinedScript] = useState([]);
    const [speakers, setSpeakers] = useState([]);

    const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/stt";

    // 🔹 useRecording hook
    const { recordingState, startRecording, stopRecording } = useRecording({
        WS_URL,
        onData: (msg) => {
            if (msg.realtime) setLiveText(msg.realtime);
            if (msg.append) setRefinedScript((prev) => [...prev, msg.append]);
            if (msg.paragraph || msg.summary) {
                setSummaries((prev) => [
                    ...prev,
                    { paragraph: msg.paragraph || "", summary: msg.summary || "", ts: Date.now() },
                ]);
            }
        },
        onStartError: (err) => console.error("녹음 시작 실패:", err),
    });

    // 🔹 draft 저장
    // useEffect(() => localStorage.setItem("draftTitle", title), [title]);
    // useEffect(() => localStorage.setItem("draftMemo", tempMemo), [tempMemo]);
    // useEffect(() => localStorage.setItem("draftQuestion", tempQuestion), [tempQuestion]);

    // 🔹 날짜 문자열
    const dateStr = new Date().toLocaleString("ko-KR", {
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
    });

    // 🔹 녹음 시작 → board 생성 + STT 연결
    const handleStartRecording = async () => {
        try {
            if (!boardId) {
                const res = await apiClient.post("/boards", { title, description: "" });
                setBoardId(res.data.id);
                console.log("🎙️ 새 보드 생성:", res.data.id);
            }
            await startRecording();
            setIsRecording(true);
            showToast("녹음을 시작했습니다 🎧");
        } catch (err) {
            console.error("녹음 시작 실패:", err);
            showToast("녹음을 시작할 수 없습니다.");
        }
    };

    // 🔹 녹음 종료
    const handleStopRecording = () => {
        stopRecording();
        setIsRecording(false);
        if (boardId) {
            localStorage.removeItem("draftTitle");
            localStorage.removeItem("draftMemo");
            localStorage.removeItem("draftQuestion");
            navigate(`/record/${boardId}`);
        } else {
            showToast("보드 생성 중 오류가 발생했습니다.");
        }
    };

    // 🔹 페이지 이탈 시 확인
    const handleNavigateAway = () => {

            // 🔹 녹음 중이 아니고 / 아직 board 생성 전 / draft가 있는 경우
            if (!isRecording) {
                setShowLeaveModal(true);
                return;
            }

            // 그 외는 그냥 뒤로가기
        if (window.history.length <= 2) navigate("/");
        else navigate(-1);
    };

    return (
        <motion.div
            className="relative overflow-hidden min-h-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            <div className="p-6">
                <button
                    onClick={handleNavigateAway}
                    className="text-sm text-gray-400 hover:text-gray-600 mb-4"
                >
                    ← 뒤로가기
                </button>

                <div className="grid grid-cols-[1fr_360px] gap-6">
                    {/* 🔹 메인 영역 */}
                    <main className="bg-white rounded-2xl p-6 shadow-sm flex flex-col h-[calc(100vh-140px)]">
                        <RecordHeader
                            title={title}
                            setTitle={setTitle}
                            dateStr={dateStr}
                            boardId={boardId}
                            folders={folders}
                        />

                        <RecordTabs
                            tabs={[
                                { id: "record", label: "회의기록" },
                                { id: "script", label: "스크립트" },
                            ]}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                        />

                        <RecordSection
                            activeTab={activeTab}
                            liveText={liveText}
                            summaries={summaries}
                            refinedScript={refinedScript}
                            speakers={speakers}
                            recordingState={recordingState}
                        />

                        {/* 🔹 하단 컨트롤 */}
                        <div className="sticky bottom-4 relative">
                            <RecordBar
                                boardId={boardId}
                                onStart={handleStartRecording}
                                onStop={handleStopRecording}
                                onCreateTemplate={() => setShowTemplateModal(true)}
                                onTogglePanel={() => setIsPanelVisible((p) => !p)}
                            />
                            <TemplateModal
                                isOpen={showTemplateModal}
                                onClose={() => setShowTemplateModal(false)}
                                onSelect={() => setShowTemplateModal(false)}
                            />
                        </div>
                    </main>

                    {/* 🔹 오른쪽 패널 */}
                    <AnimatePresence>
                        {isPanelVisible && (
                            <motion.aside
                                key="rightpanel"
                                initial={{ x: 400, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 400, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 260, damping: 30 }}
                                className="fixed top-0 right-0 h-full w-[360px] bg-white shadow-[-4px_0_10px_rgba(0,0,0,0.08)] overflow-hidden z-30 rounded-l-2xl"
                            >
                                <RightPanel
                                    boardId={boardId}
                                    memoId={boardId}
                                    activeTab={activeGPTTab}
                                    onTogglePanel={() => setIsPanelVisible((p) => !p)}
                                />
                            </motion.aside>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* 🔹 이탈 경고 모달 */}
            {showLeaveModal && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-[1000]">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-[320px] text-center">
                        <p className="text-gray-700 mb-4 leading-relaxed">
                            작성 중인 메모와 질문은 기록에 남지 않아요.<br />이동하시겠어요?
                        </p>
                        <div className="flex justify-center gap-3">
                            <button
                                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                                onClick={() => setShowLeaveModal(false)}
                            >
                                아니오
                            </button>
                            <button
                                className="px-4 py-2 rounded-lg bg-[#7E37F9] text-white hover:bg-[#6c2de2]"
                                onClick={() => {
                                    // localStorage.removeItem("draftTitle");
                                    // localStorage.removeItem("draftMemo");
                                    // localStorage.removeItem("draftQuestion");
                                    navigate(-1);
                                }}
                            >
                                예
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🔹 Toast */}
            <AnimatePresence>
                {toast.visible && (
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.4 }}
                        className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md border border-gray-100 shadow-lg rounded-2xl px-7 py-5 z-[9999]"
                    >
                        {toast.content}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// 🔹 기본 회의 제목
function formatDefaultTitle() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hour = now.getHours();
    const minute = String(now.getMinutes()).padStart(2, "0");
    const ampm = hour >= 12 ? "오후" : "오전";
    const displayHour = hour % 12 || 12;
    return `${month}.${day} ${ampm} ${displayHour}:${minute} 새 회의`;
}
