import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import apiClient from "../api/apiClient";
import { useToast } from "../hooks/useToast";
import RecordingLayout from "../components/recording/RecordingLayout";
import AudioPlayer from "../components/recording/AudioPlayer";
import RightPanel from "../components/recording/RightPanel";

export default function RecordDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { folders } = useSelector((state) => state.folder);

  const [board, setBoard] = useState(null);
  const [memo, setMemo] = useState(null);
  const [summaries, setSummaries] = useState([]);
  const [refinedScript, setRefinedScript] = useState([]);
  const [finalSummaries, setFinalSummaries] = useState([]);
  const [activeTab, setActiveTab] = useState("record");
  const [sharedUsers, setSharedUsers] = useState([]);
  const [userRole, setUserRole] = useState("owner");

  // 🟣 모바일 메모만 남김
  const [showMobileMemo, setShowMobileMemo] = useState(false);

  // 보호 회의 관련
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [isVerified, setIsVerified] = useState(false);

  const user = JSON.parse(localStorage.getItem("user"));

  // 📌 보드 데이터 로드
  const loadBoardData = (data) => {
    setBoard(data.board);
    setMemo(data.memo);

    setSummaries(
      (data.summaries || []).map((s) => ({
        id: s.id,
        summary: s.content,
        interval_start_at: s.interval_start_at,
        interval_end_at: s.interval_end_at,
        created_at: s.created_at,
      }))
    );

    const scriptData = (data.recording_results || []).map((r) => ({
      start_time: r.started_at,
      end_time: r.ended_at,
      text: r.raw_text,
      speaker_label: r.speaker_label,
    }));

    setRefinedScript(scriptData);
    setFinalSummaries(data.final_summaries || []);
  };

  // 📌 보드 불러오기
  const fetchBoard = async () => {
    try {
      const guestToken = localStorage.getItem(`guest_token_board_${id}`) || null;

      const res = await apiClient.get(`/boards/${id}/full`, {
        headers: guestToken ? { "X-Guest-Token": guestToken } : {},
      });

      const data = res.data;
      loadBoardData(data);

      setIsVerified(true);
      setIsLocked(false);

      // 공유 멤버 조회
      if (user) {
        try {
          const shareRes = await apiClient.get(`/boards/${id}/shares/members`);
          const members = shareRes.data || [];

          const normalized = members.map((u) => ({
            user_id: u.user_id,
            user_name: u.nickname || u.user_name,
            user_email: u.email,
            user_picture: u.picture,
            role: u.role,
          }));
          setSharedUsers(normalized);

          const myShare = members.find((u) => u.user_id === user.id);
          if (myShare) {
            setUserRole(myShare.role);
          } else if (data.board.owner_id === user.id) {
            setUserRole("owner");
          } else {
            setUserRole("guest");
          }
        } catch (err) {
          console.error("멤버 목록 조회 오류:", err);
        }
      }
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;

      if (status === 403 && detail === "BOARD_PROTECTED") {
        setIsLocked(true);
        setBoard(null);
        setMemo(null);
        return;
      }

      if (status === 403 && detail === "BOARD_NOT_SHARED") {
        showToast("공유받지 않은 회의입니다.");
        navigate("/", { replace: true });
        return;
      }

      if (status === 404) {
        showToast("존재하지 않는 회의입니다.");
        navigate("/", { replace: true });
        return;
      }

      console.error("회의 정보 로딩 실패:", err);
      showToast("회의 정보를 불러오지 못했습니다.");
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchBoard();
  }, [id]);

  // 🔐 PIN 인증
  const handleVerifyPin = async (e) => {
    e.preventDefault();
    if (!pin.trim()) return showToast("비밀번호를 입력해주세요.");

    try {
      const res = await apiClient.post(`/boards/${id}/verify-password`, {
        password: pin,
      });

      const guestToken = res.data?.guest_token;

      if (guestToken) {
        localStorage.setItem(`guest_token_board_${id}`, guestToken);
      }

      setIsVerified(true);
      setIsLocked(false);

      await fetchBoard();
      showToast("회의에 입장했습니다.");
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403) showToast("비밀번호가 올바르지 않습니다.");
      else showToast("비밀번호 인증 중 오류가 발생했습니다.");
    }
  };

  // 🗑 회의 삭제
  const handleDeleteBoard = async () => {
    try {
      await apiClient.delete(`/boards/${id}`);
      showToast("회의가 삭제되었습니다.");
      navigate("/");
    } catch (err) {
      showToast("회의 삭제 중 오류가 발생했습니다.");
    }
  };

  // 📁 폴더 이동
  const handleSelectFolder = async (folder) => {
    if (!folder || !board?.id) return;
    try {
      await apiClient.patch(`/boards/${board.id}/move`, {
        folder_id: folder.id,
      });

      setBoard((prev) => ({ ...prev, folder }));
      showToast(`"${folder.name}" 폴더로 이동했습니다.`);
    } catch (err) {
      showToast("폴더 이동 중 오류가 발생했습니다.");
    }
  };

  // 🔐 보호된 회의 PIN UI
  if (isLocked && !isVerified) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 w-full max-w-md">
          <h1 className="text-lg font-semibold mb-2">
            비밀번호가 필요한 회의입니다
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            이 회의는 비밀번호를 입력해야 입장할 수 있습니다.
          </p>

          <form onSubmit={handleVerifyPin} className="space-y-4">
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-[#7E37F9]"
              placeholder="예: 1234"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-3 py-2 text-sm border rounded-lg"
              >
                ← 돌아가기
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm bg-[#7E37F9] text-white rounded-lg"
              >
                입장하기
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 로딩 중
  if (!board) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400">
        로딩 중...
      </div>
    );
  }

  // 탭 구성
  const tabs = [
    { id: "record", label: "회의기록" },
    { id: "script", label: "스크립트" },
    ...(finalSummaries.length > 0
      ? [{ id: "summary", label: "전체 요약" }]
      : []),
  ];

  return (
    <>
      <RecordingLayout
        mode="detail"
        board={board}
        memo={memo}
        folders={folders}
        title={board.title}
        setTitle={(t) => {
          if (userRole !== "owner" && userRole !== "editor") return;
          setBoard({ ...board, title: t });
        }}
        dateStr={new Date(board.created_at).toLocaleString("ko-KR")}
        tabs={tabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        recordBarProps={{
          boardId: board.id,
          boardOwnerId: board.owner_id,
          recordingState: "stopped",
          summaries,
          refinedScript,
          memo,
        }}
        recordSectionProps={{
          activeTab,
          summaries,
          recordingState: "finished",
          allHistory: refinedScript,
          finalSummaries,
        }}
        onSelectFolder={handleSelectFolder}
        onDeleteBoard={handleDeleteBoard}
        audioPlayer={<AudioPlayer boardId={board.id} />}
        sharedUsers={sharedUsers}
        setMemoContent={(m) => {
          if (userRole !== "owner" && userRole !== "editor") return;
          setMemo(m);
        }}
        // ✔ 모바일 메모만 유지
        showMobileMemo={showMobileMemo}
        setShowMobileMemo={setShowMobileMemo}
      />

      {/* 🟣 모바일 메모 모달 */}
      {showMobileMemo && (
        <div className="fixed inset-0 z-[100] bg-white lg:hidden">
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-hidden">
              <RightPanel
                boardId={board.id}
                memoId={memo?.id}
                onClose={() => setShowMobileMemo(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
