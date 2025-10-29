import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "../api/apiClient";
import { updateFolder } from "../features/record/recordSlice";
import { useToast } from "../hooks/useToast";
import useRecording from "../hooks/useRecording";

// 🔹 Components
import RecordHeader from "../components/recording/RecordHeader";
import RecordTabs from "../components/recording/RecordTabs";
import RecordSection from "../components/recording/RecordSection";
import RecordBar from "../components/recording/RecordBar";
import RightPanel from "../components/recording/RightPanel";
import TemplateModal from "../components/recording/TemplateModal";

export default function NewRecordPage() {
  const { id } = useParams();
  const isReplayMode = Boolean(id);
  const navigate = useNavigate();

  const dispatch = useDispatch();
  const { folders } = useSelector((state) => state.record);

  // 🔹 UI 상태
  const [showDropdown, setShowDropdown] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [activeTab, setActiveTab] = useState("record");
  const [boardId, setBoardId] = useState(null);
  const [title, setTitle] = useState(() => formatDefaultTitle());
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [activeGPTTab, setActiveGPTTab] = useState("memo");
  const [rating, setRating] = useState(0);

  // 🔹 STT 관련 상태
  const [liveText, setLiveText] = useState("");
  const [summaries, setSummaries] = useState([]);
  const [refinedScript, setRefinedScript] = useState([]);
  const [speakers, setSpeakers] = useState([]);

  // 🔹 날짜 포맷
  const dateStr = new Date().toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  // 🔹 탭 목록
  const [tabs, setTabs] = useState([
    { id: "record", label: "회의기록" },
    { id: "script", label: "스크립트" },
  ]);

  const { toast, showToast, clearToast } = useToast();

  const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/stt";

  // 🔹 useRecording Hook
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

  // 🔹 폴더 이동
  const handleFolderSelect = async (folder) => {
    if (!folder) return setShowDropdown(false);
    if (!boardId) return alert("회의가 생성된 후에 폴더에 넣을 수 있습니다.");
    try {
      await apiClient.patch(`/boards/${boardId}/move`, { folder_id: folder.id });
      dispatch(updateFolder({ id: boardId, folderId: folder.id }));
      setShowDropdown(false);
    } catch (err) {
      console.error("폴더 이동 실패:", err);
    }
  };

  // 🔹 템플릿 선택
  const handleSelectTemplate = (type) => {
    setShowTemplateModal(false);
    if (type === "화자분리") {
      setTabs((prev) =>
        prev.some((t) => t.id === "speaker") ? prev : [...prev, { id: "speaker", label: "화자분리" }]
      );
      setActiveTab("speaker");
    }
  };

  return (
    <motion.div
      className="relative overflow-hidden min-h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* 🔹 부드러운 배경 */}
      <motion.div
        className="absolute inset-0 -z-10"
        animate={{
          background: [
            "radial-gradient(circle at 20% 30%, #f3e8ff, #ffffff 80%)",
            "radial-gradient(circle at 80% 70%, #ede9fe, #ffffff 90%)",
            "radial-gradient(circle at 50% 50%, #f5f3ff, #ffffff 100%)",
          ],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          repeatType: "mirror",
        }}
      />

      <div className="p-6">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-400 hover:text-gray-600 mb-4"
        >
          ← 뒤로가기
        </button>

        <div className="grid grid-cols-[1fr_360px] gap-6">
          {/* 🔹 메인 컨텐츠 */}
          <main className="bg-white rounded-2xl p-6 shadow-sm flex flex-col h-[calc(100vh-140px)]">
            <RecordHeader
              title={title}
              setTitle={setTitle}
              dateStr={dateStr}
              boardId={boardId}
              folders={folders}
              showDropdown={showDropdown}
              setShowDropdown={setShowDropdown}
              onSelectFolder={handleFolderSelect}
            />

            <RecordTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />

            <RecordSection
              activeTab={activeTab}
              liveText={liveText}
              summaries={summaries}
              refinedScript={refinedScript}
              speakers={speakers}
              recordingState={recordingState}
            />

            {/* 🔹 하단 컨트롤 영역 */}
            <div className="sticky bottom-4 relative">
              <RecordBar
                onStart={startRecording}
                onCreateTemplate={() => setShowTemplateModal(true)}
                onTogglePanel={() => setIsPanelVisible((p) => !p)}
                onStop={() => {
                  stopRecording();
                  showToast(
                    <div className="flex flex-col items-center gap-2 text-center">
                      <p className="text-sm font-medium text-gray-800">
                        이번 회의 녹음은 어땠나요?
                      </p>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            onClick={() => {
                              setRating(num);
                              clearToast();
                            }}
                            className={`text-2xl transition-transform ${
                              num <= rating
                                ? "text-yellow-400 scale-110"
                                : "text-gray-300 hover:scale-110"
                            }`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }}
              />

              {/* 🔹 작은 팝오버 템플릿 모달 */}
              <TemplateModal
                isOpen={showTemplateModal}
                onClose={() => setShowTemplateModal(false)}
                onSelect={handleSelectTemplate}
              />
            </div>
          </main>

          {/* 🔹 오른쪽 패널 (메모 | GPT) */}
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

      {/* 🔹 별점 Toast */}
      <AnimatePresence>
        {toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
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

// 🔹 기본 회의 제목 생성
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
