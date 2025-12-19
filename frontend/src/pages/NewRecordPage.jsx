import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { AnimatePresence, motion } from "framer-motion";
import apiClient from "../api/apiClient";
import { useToast } from "../hooks/useToast";
import useRecording from "../hooks/useRecording";
import RecordingLayout from "../components/recording/RecordingLayout";
// import RecordingLayout from "../../components/recording/RecordingLayout";

export default function NewRecordPage() {
  const navigate = useNavigate();
  const { folders } = useSelector((state) => state.folder);
  const { showToast } = useToast();

  const [boardId, setBoardId] = useState(null);
  const [title, setTitle] = useState(
    localStorage.getItem("draftTitle") || formatDefaultTitle()
  );
  const [activeTab, setActiveTab] = useState("record");
  const [isRecording, setIsRecording] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // STT 관련 상태
  const [liveText, setLiveText] = useState("");
  const [liveLines, setLiveLines] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [allHistory, setAllHistory] = useState([]);
  const [finalSummary, setFinalSummary] = useState(null);
  const [recordingStopped, setRecordingStopped] = useState(false);
  const [currentFolder, setCurrentFolder] = useState(null);

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const WS_URL = import.meta.env.VITE_WS_URL || toWsUrl(API_BASE);

  // useRecording hook
  const { recordingState, startRecording, stopRecording } = useRecording({
    WS_URL,
    boardId,
    onData: (msg) => {
      if (msg.realtime) setLiveText(msg.realtime);
      if (msg.append) {
        const cleanText = msg.append.replace(/^•\s*/, "");
        setLiveLines((prev) => [...prev, cleanText]);
        setAllHistory((prev) => [...prev, cleanText]);
      }
      if (msg.summary) {
        const bullets = msg.summary
          .split(/\n+/)
          .map((line) => line.trim())
          .filter((line) => line && line !== "")
          .map((line) => line.replace(/^[•·\-*\d.]\s*/, ""));

        setSummaries((prev) => [
          ...prev,
          { id: Date.now(), summary: bullets.join("\n") },
        ]);
        setLiveLines([]);
      }
    },
    onStartError: (err) => {
      console.error("녹음 시작 실패:", err);
      showToast("녹음을 시작할 수 없습니다.");
    },
  });

  // 녹음 시작
  const handleStartRecording = async () => {
    try {
      let id = boardId;
      if (!id) {
        const res = await apiClient.post("/boards", { title, description: "" });
        id = res?.data?.id ?? res?.data?.board?.id ?? res?.data?.data?.id;
        if (!id) throw new Error("Board ID를 받지 못했습니다.");
        setBoardId(id);
      }
      await startRecording(id);
      setIsRecording(true);
      setRecordingStopped(false);
    } catch (err) {
      console.error("녹음 시작 실패:", err);
      showToast(err?.message || "녹음을 시작할 수 없습니다.");
    }
  };

  // 녹음 종료
  const handleStopRecording = async () => {
    try {
      const result = await stopRecording();
      setIsRecording(false);
      setRecordingStopped(true);

      if (!result) {
        showToast("녹음 종료 결과를 받지 못했습니다.");
        return;
      }

      let sid, targetBoardId;
      if (typeof result === "number" || typeof result === "string") {
        sid = String(result);
        targetBoardId = boardId;
      } else {
        sid = String(result.sid || result.session_id);
        targetBoardId = result.boardId || boardId;
      }

      if (!sid || sid === "null" || !targetBoardId) {
        showToast("세션 정보를 가져올 수 없습니다.");
        return;
      }

      // 세션 ID 매핑 대기
      let sessionId = null;
      for (let i = 0; i < 5; i++) {
        try {
          const res = await apiClient.get(`/sessions/by-sid/${sid}`);
          if (res.status === 200 && (res.data?.session_id || res.data?.id)) {
            sessionId = res.data.session_id || res.data.id;
            break;
          }
        } catch (err) {
          if (err.response?.status !== 202) break;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }

      if (!sessionId) {
        showToast("녹음은 저장되었으나, 요약 생성에 실패했습니다.");
        return;
      }

      // 사용량 차감
      try {
        const usageRes = await apiClient.post(
          `/recordings/usage/use-by-board/${targetBoardId}`
        );
        showToast(
          `사용량 차감: ${Math.floor(usageRes.data.used_seconds / 60)}분 사용`
        );
      } catch (err) {
        console.error("사용량 차감 실패:", err);
      }

      // 전체 요약 대기
      for (let i = 0; i < 30; i++) {
        try {
          const summary = await fetchFinalSummary(sessionId);
          setFinalSummary(summary);
          setActiveTab("summary");
          break;
        } catch (err) {
          console.warn("전체 요약 생성 대기 중...");
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error("녹음 종료 실패:", err);
      showToast("녹음 종료 중 오류가 발생했습니다.");
    }
  };

  // 폴더 선택
  const handleSelectFolder = async (folder) => {
  if (!folder || !boardId) return;
  try {
    await apiClient.patch(`/boards/${boardId}/move`, { 
      folder_id: folder.id 
    });
    
    // ✅ 로컬 상태 업데이트 추가
    setCurrentFolder(folder);
    
    showToast(`"${folder.name}" 폴더로 이동했습니다.`);
  } catch (err) {
    console.error("폴더 이동 실패:", err);
    showToast("폴더 이동 중 오류가 발생했습니다.");
  }
};

  // 이탈 확인
  const handleNavigateAway = () => {
    if (isRecording) {
      setShowLeaveModal(true);
    } else {
      navigate(-1);
    }
  };

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
    <>
      <RecordingLayout
        mode="new"
        board={{ id: boardId, folder: currentFolder  }}
        memo={{ id: boardId }}
        folders={folders}
        title={title}
        setTitle={setTitle}
        dateStr={new Date().toLocaleString("ko-KR")}
        tabs={tabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        recordBarProps={{
          boardId,
          boardOwnerId: null,
          recordingState: recordingStopped ? "stopped" : recordingState,
          onStart: handleStartRecording,
          onStop: handleStopRecording,
        }}
        recordSectionProps={{
          activeTab,
          liveText,
          liveLines,
          summaries,
          recordingState,
          allHistory,
          finalSummary,
        }}
        onSelectFolder={handleSelectFolder}
      />

      {/* 이탈 경고 모달 */}
      {showLeaveModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-[1000]">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-[320px] text-center">
            <p className="text-gray-700 mb-4 leading-relaxed">
              녹음 중에는 페이지를 이탈할 수 없습니다.
            </p>
            <button
              className="px-4 py-2 rounded-lg bg-[#7E37F9] text-white hover:bg-[#6c2de2]"
              onClick={() => setShowLeaveModal(false)}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// 헬퍼 함수들
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

async function fetchFinalSummary(sessionId, retryCount = 10) {
  for (let i = 0; i < retryCount; i++) {
    try {
      const res = await apiClient.get(`/sessions/final-summaries/by-session/${sessionId}`);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        await new Promise((r) => setTimeout(r, 1500));
      } else {
        throw err;
      }
    }
  }
  throw new Error("전체 요약을 찾을 수 없습니다.");
}