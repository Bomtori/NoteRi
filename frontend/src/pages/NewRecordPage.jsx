import React, { useState } from "react";
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
    // const dispatch = useDispatch();
    const { folders } = useSelector((state) => state.folder);

    // 🔹 상태
    const [boardId, setBoardId] = useState(null);
    const [title, setTitle] = useState(localStorage.getItem("draftTitle") || formatDefaultTitle());
    const [activeTab, setActiveTab] = useState("record");
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [isPanelVisible, setIsPanelVisible] = useState(false);
    const [activeGPTTab, setActiveGPTTab] = useState("memo");
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const { toast, showToast, clearToast } = useToast();
    const [showDropdown, setShowDropdown] = useState(false);

    // 🔹 STT 관련 상태
    const [liveText, setLiveText] = useState("");
    const [liveLines, setLiveLines] = useState([]);
    const [summaries, setSummaries] = useState([]);
    const [allHistory, setAllHistory] = useState([]); // ✅ 전체 누적 히스토리
    const [finalSummary, setFinalSummary] = useState(null); // ✅ 전체 요약
    const [recordingStopped, setRecordingStopped] = useState(false); // ✅ 녹음 종료 플래그

    const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/stt";
    const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

    // ✅ useRecording hook
    const { recordingState, startRecording, stopRecording } = useRecording({
        WS_URL,
        onData: (msg) => {
            // 🎙️ 실시간 STT
            if (msg.realtime) {
                setLiveText(msg.realtime);
            }

            // 📝 후처리 완료 문장 (현재 1분 구간 + 전체 히스토리에 추가)
            if (msg.append) {
                const cleanText = msg.append.replace(/^•\s*/, "");
                setLiveLines((prev) => [...prev, cleanText]); // 1분 구간
                setAllHistory((prev) => [...prev, cleanText]); // 전체 누적
            }

            // ⏱️ 1분 요약 도착 (현재 1분 구간 초기화)
            if (msg.summary) {
                setSummaries((prev) => [
                    ...prev,
                    {
                        id: Date.now(),
                        summary: msg.summary,
                    },
                ]);
                setLiveLines([]); // 현재 1분 구간만 초기화
            }
        },
        onStartError: (err) => console.error("녹음 시작 실패:", err),
    });

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
            setRecordingStopped(false);
        } catch (err) {
            console.error("녹음 시작 실패:", err);
            showToast("녹음을 시작할 수 없습니다.");
        }
    };

    // 🔹 녹음 종료 → 전체 요약 대기
    const handleStopRecording = async () => {
        const sid = await stopRecording();
        setIsRecording(false);
        setRecordingStopped(true);

        // ✅ 세션 ID 매핑 대기 (MeetingPage 방식)
        if (sid) {
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            let sessionId = null;
            let tries = 0;

            console.log("⏳ 세션 ID 매핑 대기 중... sid:", sid);

            // 1단계: sid → session_id 매핑 대기
            while (tries++ < 60) {
                try {
                    const res = await apiClient.get(`/sessions/by-sid/${sid}`);
                    console.log(`[${tries}] by-sid 응답:`, res.status, res.data);

                    if (res.status === 200 && res.data?.id) {
                        sessionId = res.data.id;
                        console.log("✅ 세션 매핑 완료 sessionId:", sessionId);
                        break;
                    }
                } catch (err) {
                    const status = err.response?.status;
                    if (status === 202) {
                        console.log(`[${tries}] pending, 재시도...`);
                    } else {
                        console.warn(`[${tries}] by-sid 오류:`, status);
                    }
                }
                await sleep(500);
            }

            if (!sessionId) {
                console.error("❌ 세션 ID 매핑 실패");
                showToast("세션 정보를 가져올 수 없습니다.");
                return;
            }

            // 2단계: 전체 요약 생성 대기 (백엔드 자동 생성)
            console.log("⏳ 전체 요약 생성 대기 중... sessionId:", sessionId);
            tries = 0;
            while (tries++ < 60) {
                try {
                    const res = await apiClient.get(`/sessions/final-summaries/by-session/${sessionId}`);
                    console.log(`[${tries}] final-summary 응답:`, res.status, res.data);

                    if (res.status === 200 && res.data) {
                        setFinalSummary(res.data);
                        console.log("✅ 전체 요약 로드 완료:", res.data);
                        setActiveTab("summary");
                        showToast("전체 요약이 생성되었습니다.");
                        return;
                    }
                } catch (err) {
                    const status = err.response?.status;
                    if (status === 404) {
                        console.log(`[${tries}] 아직 생성 중... 재시도`);
                    } else {
                        console.warn(`[${tries}] final-summary 오류:`, status);
                    }
                }
                await sleep(500);
            }

            console.warn("⚠️ 전체 요약 생성 시간 초과");
            showToast("전체 요약 생성에 시간이 걸리고 있습니다.");
        }
    };

    // 🔹 페이지 이탈 시 확인
    const handleNavigateAway = () => {
        if (!isRecording) {
            setShowLeaveModal(true);
            return;
        }

        if (window.history.length <= 2) navigate("/");
        else navigate(-1);
    };

    // 폴더선택 동작
    const handleSelectFolder = async (folder) => {
        if (!folder || !boardId) return;
        try {
            await apiClient.patch(`/boards/${boardId}/folder`, { folder_id: folder.id });
            setShowDropdown(false);
            showToast(`📂 "${folder.name}" 폴더로 이동했습니다.`);
        } catch (err) {
            console.error("폴더 이동 실패:", err);
            showToast("폴더 이동 중 오류가 발생했습니다.");
        }
    };

    // 🔹 녹음 종료 후 탭 설정
    const tabs = recordingStopped
        ? [
            { id: "record", label: "회의기록" },
            { id: "script", label: "스크립트" },
            { id: "summary", label: "전체 요약" }, // ✅ 녹음 종료 후에만 표시
        ]
        : [
            { id: "record", label: "회의기록" },
            { id: "script", label: "스크립트" },
        ];

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
                            showDropdown={showDropdown}
                            setShowDropdown={setShowDropdown}
                            onSelectFolder={handleSelectFolder}
                        />

                        <RecordTabs
                            tabs={tabs}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                        />

                        <RecordSection
                            activeTab={activeTab}
                            liveText={liveText}
                            liveLines={liveLines}
                            summaries={summaries}
                            recordingState={recordingState}
                            allHistory={allHistory}
                            finalSummary={finalSummary}
                        />

                        {/* 🔹 하단 컨트롤 */}
                        <div className="sticky bottom-4 relative">
                            <RecordBar
                                boardId={boardId}
                                recordingState={recordingStopped ? "stopped" : recordingState}
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
                                onClick={() => navigate(-1)}
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