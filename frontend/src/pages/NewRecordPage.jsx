import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "../api/apiClient";
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
    const { folders } = useSelector((state) => state.folder);

    // 상태
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

    // STT 관련 상태
    const [liveText, setLiveText] = useState("");
    const [liveLines, setLiveLines] = useState([]);
    const [summaries, setSummaries] = useState([]);
    const [allHistory, setAllHistory] = useState([]);
    const [finalSummary, setFinalSummary] = useState(null);
    const [recordingStopped, setRecordingStopped] = useState(false);

    function toWsUrl(httpBase) {
        try {
            const u = new URL(httpBase);
            u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
            u.pathname = "/ws/stt";
            u.search = "";
            u.hash = "";
            return u.toString();
        } catch {
            return "ws://localhost:8000/ws/stt";
        }
    }

    const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
    const WS_URL = import.meta.env.VITE_WS_URL || toWsUrl(API_BASE);

   async function fetchFinalSummary(sessionId, retryCount = 10) {
  for (let i = 0; i < retryCount; i++) {
    try {
      const res = await apiClient.get(`/sessions/final-summaries/by-session/${sessionId}`);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        console.log(`⏳ 아직 생성 중... 재시도 (${i + 1}/${retryCount})`);
        await new Promise(r => setTimeout(r, 1500)); // 1.5초 후 재시도
      } else {
        console.error("❌ final-summary 요청 실패:", err);
        throw err;
      }
    }
  }
  throw new Error("최대 재시도 후에도 final-summary를 찾을 수 없습니다.");
}

    // useRecording hook
    const { recordingState, startRecording, stopRecording } = useRecording({
        WS_URL,
        boardId,
        onData: (msg) => {
            console.log("📩 WebSocket 메시지:", msg);

            if (msg.realtime) {
                setLiveText(msg.realtime);
            }

            if (msg.append) {
                const cleanText = msg.append.replace(/^•\s*/, "");
                setLiveLines((prev) => [...prev, cleanText]);
                setAllHistory((prev) => [...prev, cleanText]);
            }

            if (msg.summary) {
                console.log("📝 1분 요약 원본:", msg.summary);

                const bullets = msg.summary
                    .split(/\n+/)
                    .map(line => line.trim())
                    .filter(line => line && line !== "")
                    .map(line => line.replace(/^[•·\-*\d.]\s*/, ""));

                console.log("📝 파싱된 bullets:", bullets);

                setSummaries((prev) => [
                    ...prev,
                    {
                        id: Date.now(),
                        summary: bullets.join("\n"),
                    },
                ]);
                setLiveLines([]);
            }
        },
        onStartError: (err) => {
            console.error("녹음 시작 실패:", err);
            showToast("녹음을 시작할 수 없습니다: " + err.message);
        },
    });

    const dateStr = new Date().toLocaleString("ko-KR", {
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
    });

    // 녹음 시작
    const handleStartRecording = async () => {
        try {
            let id = boardId;

            if (!id) {
                const res = await apiClient.post("/boards", { title, description: "" });
                console.log("✅ /boards 응답:", res.status, res.data);

                id =
                    res?.data?.id ??
                    res?.data?.board?.id ??
                    res?.data?.data?.id ??
                    null;

                if (!id) {
                    throw new Error(
                        `Board created but no id in response: ${JSON.stringify(res?.data)}`
                    );
                }

                setBoardId(id);
                await new Promise((r) => setTimeout(r, 0));
            }

            await startRecording(id);

            setIsRecording(true);
            setRecordingStopped(false);
        } catch (err) {
            console.error("❌ 녹음 시작 실패:", err);
            showToast(err?.message || "녹음을 시작할 수 없습니다.");
        }
    };

    // 녹음종료
    const handleStopRecording = async () => {
        console.log("🛑 녹음 종료 시작...");

        try {
            // stopRecording 호출
            const result = await stopRecording();
            console.log("🛑 stopRecording 결과:", result, "타입:", typeof result);

            setIsRecording(false);
            setRecordingStopped(true);

            // result가 null/undefined인지 체크
            if (!result) {
                console.error("❌ stopRecording이 null/undefined를 반환했습니다");
                showToast("녹음 종료 결과를 받지 못했습니다.");
                return;
            }

            // 🍒 result가 숫자(sid)인지, 객체인지 판별
            let sid;
            let targetBoardId;

            if (typeof result === 'number' || typeof result === 'string') {
                // result가 직접 sid인 경우
                sid = String(result);  // 문자열로 변환
                targetBoardId = boardId; // 컴포넌트 state의 boardId 사용
                console.log("✅ sid 직접 반환:", sid);
            } else if (typeof result === 'object') {
                // result가 객체인 경우
                sid = String(result.sid || result.session_id || result.sessionId);
                targetBoardId = result.boardId || result.board_id || boardId;
                console.log("✅ 객체에서 sid 추출:", sid);
            }

            if (!sid || sid === 'null' || sid === 'undefined') {
                console.error("❌ sid를 찾을 수 없습니다. result:", result);
                showToast("녹음 세션 정보를 가져올 수 없습니다.");
                return;
            }

            if (!targetBoardId) {
                console.error("❌ boardId를 찾을 수 없습니다");
                showToast("보드 정보를 찾을 수 없습니다.");
                return;
            }

            console.log("✅ sid:", sid, "boardId:", targetBoardId);

            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            let sessionId = null;
            let tries = 0;

            console.log("⏳ 세션 ID 매핑 대기 중... sid:", sid, "boardId:", targetBoardId);

            // 1단계: 세션 ID 매핑 대기 (최대 15초, 5회 × 3초)
            while (tries++ < 5) {
                try {
                    const res = await apiClient.get(`/sessions/by-sid/${sid}`);
                    console.log(`[${tries}] by-sid 응답:`, res.status, res.data);

                    if (res.status === 200 && (res.data?.session_id || res.data?.id)) {
                        sessionId = res.data.session_id || res.data.id;
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
                await sleep(3000);
            }

            // 세션 매핑 실패 처리
            if (!sessionId) {
                console.warn("⚠️ 세션 매핑 실패 → 요약 생성 불가");
                showToast("녹음은 저장되었으나, 요약 생성에 실패했습니다.");
                return;
            }

            // 사용량 차감 (audio_id 기반)
            try {
                console.log("💳 사용량 차감 API 호출 - board_id:", targetBoardId);
                const usageRes = await apiClient.post(`/recordings/usage/use-by-board/${targetBoardId}`);
                console.log("✅ 사용량 차감 완료:", usageRes.data);
                showToast(`사용량 차감: ${Math.floor(usageRes.data.used_seconds / 60)}분 사용`);
                } catch (err) {
                console.error("❌ 사용량 차감 실패:", err);
                if (err.response?.status === 400) {
                    showToast("사용량이 부족합니다.");
                }
                }

            // 2단계: 전체 요약 생성 대기 (최대 30초, 30회 × 1초)
            console.log("⏳ 전체 요약 생성 대기 중... sessionId:", sessionId);
            tries = 0;
            while (tries++ < 30) {
                try {
                    const summary = await fetchFinalSummary(sessionId);
                    setFinalSummary(summary);
                    setActiveTab("summary");
                    showToast("전체 요약이 생성되었습니다 ✅");
                    console.log("✅ 전체 요약 로드 완료:", summary);
                    } catch (err) {
                    console.warn("⚠️ 전체 요약 생성 시간 초과:", err.message);
                    showToast("전체 요약 생성에 시간이 걸리고 있습니다.");
                    }
                await sleep(1000);
            }

            console.warn("⚠️ 전체 요약 생성 시간 초과");
            showToast("전체 요약 생성에 시간이 걸리고 있습니다.");

        } catch (err) {
            console.error("❌ 녹음 종료 처리 실패:", err);
            console.error("에러 상세:", {
                message: err.message,
                stack: err.stack,
                response: err.response?.data
            });
            showToast("녹음 종료 중 오류가 발생했습니다.");
            setIsRecording(false);
        }
    };

    // 페이지 이탈 시 확인
    const handleNavigateAway = () => {
        if (isRecording) {
            setShowLeaveModal(true);
            return;
        }
        if (window.history.length <= 2) navigate("/");
        else navigate(-1);
    };

    // 폴더 선택
    const handleSelectFolder = async (folder) => {
        if (!folder || !boardId) return;
        try {
            await apiClient.patch(`/boards/${boardId}/folder`, { folder_id: folder.id });
            setShowDropdown(false);
            showToast(`"${folder.name}" 폴더로 이동했습니다.`);
        } catch (err) {
            console.error("폴더 이동 실패:", err);
            showToast("폴더 이동 중 오류가 발생했습니다.");
        }
    };

    // 녹음 종료 후 탭 설정
    const tabs = recordingStopped
        ? [
            { id: "record", label: "회의기록" },
            { id: "script", label: "스크립트" },
            { id: "summary", label: "전체 요약" },
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
                    {/* 메인 영역 */}
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

                        {/* 하단 컨트롤 */}
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

                    {/* 오른쪽 패널 */}
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

            {/* 이탈 경고 모달 */}
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

            {/* Toast */}
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

// 기본 회의 제목
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