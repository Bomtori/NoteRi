import { useState, useMemo, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useParams } from "react-router-dom";
import { FaRegCalendarAlt } from "react-icons/fa"; // ✅ 누락된 import 추가
import apiClient from "../api/apiClient";
import { setSelectedFolder } from "@/features/folder/folderSlice.js";
import RecordList from "../components/recording/RecordList";
import Calendar from "../components/calendar/Calendar";
import RightSidePanel from "../components/recording/RightSidePanel";
import { showMessenger } from "../lib/channelTalk";

export default function FolderListPage() {
  const { id } = useParams();
  const folderId = Number(id);
  const dispatch = useDispatch();

  const { records = [] } = useSelector((state) => state.record || {});
  const { folders, selectedFolder } = useSelector((state) => state.folder);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("latest");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  // GPT 관련 상태
  const [gptTab, setGptTab] = useState("gpt");
  const [ragQuestion, setRagQuestion] = useState("");
  const [ragAnswer, setRagAnswer] = useState("");
  const [ragSources, setRagSources] = useState([]);
  const [ragLoading, setRagLoading] = useState(false);
  const [ragError, setRagError] = useState("");

  // ✅ 일정 불러오기
  const fetchUpcoming = useCallback(async () => {
    try {
      const now = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(now.getMonth() + 1);

      const token = localStorage.getItem("access_token");
      if (!token) {
        console.warn("🚫 access_token 없음");
        return;
      }

      const params = new URLSearchParams({
        start: now.toISOString(),
        end: nextMonth.toISOString(),
      });

      const res = await apiClient.get(`/calendar?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const allEvents = res.data || [];
      const future = allEvents
        .filter((ev) => new Date(ev.start) >= now)
        .sort((a, b) => new Date(a.start) - new Date(b.start))
        .slice(0, 4);

      setUpcomingEvents(future);
    } catch (err) {
      console.error("📅 일정 불러오기 실패:", err);
    }
  }, []);

  // ✅ GPT 질문 제출
  const handleRagSubmit = async () => {
    if (!ragQuestion.trim()) {
      setRagError("질문을 입력해주세요.");
      return;
    }
    setRagLoading(true);
    setRagError("");
    setRagAnswer("");
    setRagSources([]);
    try {
      const response = await apiClient.post("/rag/ask", {
        question: ragQuestion,
        top_k: 5,
      });
      setRagAnswer(response.data.answer);
      setRagSources(response.data.sources || []);
    } catch (err) {
      console.error("❌ RAG 에러:", err);
      setRagError(err.response?.data?.detail || "답변 생성 중 오류가 발생했습니다.");
    } finally {
      setRagLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleRagSubmit();
    }
  };

  // ✅ 폴더 선택 자동 반영
  useEffect(() => {
    if (folderId && folders.length > 0) {
      const found = folders.find((f) => f.id === folderId);
      if (found) dispatch(setSelectedFolder(found));
    }
  }, [folderId, folders, dispatch]);

  // ✅ 일정 최초 로드
  useEffect(() => {
    fetchUpcoming();
  }, [fetchUpcoming]);

  // ✅ 폴더 내 회의 필터링
  const filteredRecords = useMemo(() => {
    const safeRecords = Array.isArray(records) ? records : [];
    let filtered = safeRecords;

    if (selectedFolder?.id) {
      filtered = filtered.filter((rec) => rec?.folder_id === selectedFolder.id);
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter((rec) =>
        rec?.title?.toLowerCase?.().includes(lower)
      );
    }

    return [...filtered].sort((a, b) => {
      if (!a?.created_at || !b?.created_at) return 0;
      if (sortOption === "latest")
        return new Date(b.created_at) - new Date(a.created_at);
      if (sortOption === "oldest")
        return new Date(a.created_at) - new Date(b.created_at);
      if (sortOption === "name")
        return a?.title?.localeCompare?.(b?.title ?? "") ?? 0;
      return 0;
    });
  }, [records, searchTerm, sortOption, selectedFolder]);

  return (
    <main className="flex bg-gray-50 min-h-screen p-8 gap-6 overflow-visible">
      {/* 왼쪽: 회의 리스트 */}
      <section className="flex-1">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            {selectedFolder?.name || "폴더 없음"}
          </h2>

          <select
            className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-[#7E37F9] focus:outline-none"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
          >
            <option value="latest">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="name">이름순</option>
          </select>
        </div>

        {/* 검색창 */}
        <div className="flex items-center w-full max-w-2xl mb-8 bg-white border border-gray-200 rounded-full px-4 py-2 shadow-sm">
          <span className="text-gray-400 mr-2">🔍</span>
          <input
            type="text"
            placeholder="노트 검색 (@참석자, from:to:날짜)"
            className="w-full focus:outline-none text-sm text-gray-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* 회의 리스트 */}
        {filteredRecords.length === 0 ? (
          <p className="text-gray-400 text-sm text-center mt-20">
            해당 폴더에 회의록이 없습니다.
          </p>
        ) : (
          <RecordList records={filteredRecords} />
        )}
      </section>

      {/* 오른쪽 일정 + GPT */}
      <RightSidePanel
        upcomingEvents={upcomingEvents}
        setCalendarOpen={setCalendarOpen}
        calendarOpen={calendarOpen}
        gptTab={gptTab}
        setGptTab={setGptTab}
        ragQuestion={ragQuestion}
        setRagQuestion={setRagQuestion}
        ragAnswer={ragAnswer}
        ragSources={ragSources}
        ragLoading={ragLoading}
        ragError={ragError}
        handleKeyPress={handleKeyPress}
        handleRagSubmit={handleRagSubmit}
      />

      {/* 캘린더 패널 */}
      <div
        className={`fixed top-0 right-0 h-full w-[450px] bg-white shadow-lg border-l p-5 z-[150] transition-transform duration-500 ${
          calendarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <button
          onClick={() => {
            setCalendarOpen(false);
            fetchUpcoming();
          }}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-xl font-bold"
        >
          ✕
        </button>
        <h3 className="font-semibold mb-4 text-lg">일정 관리</h3>
        <Calendar />
      </div>

      {/* 플로팅 캘린더 버튼 */}
      {!calendarOpen && (
        <button
          onClick={() => setCalendarOpen(true)}
          className="fixed bottom-6 right-6 z-[9999] w-[64px] h-[64px] flex items-center justify-center bg-white rounded-2xl shadow-[0_4px_18px_rgba(0,0,0,0.15)] border border-gray-200 hover:bg-gray-50 transition"
        >
          <FaRegCalendarAlt size={30} className="text-[#7E37F9]" />
        </button>
      )}

      {/* 문의하기 버튼 */}
      <button
        onClick={() => showMessenger()}
        className="fixed bottom-24 right-6 z-[200] w-[64px] h-[64px] flex items-center justify-center bg-white rounded-2xl shadow-[0_4px_18px_rgba(0,0,0,0.15)] border border-gray-200 hover:bg-gray-50 transition"
        title="문의하기"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-7 h-7 text-[#7E37F9]"
        >
          <path d="M2 3h20v14H6l-4 4V3z" />
        </svg>
      </button>
    </main>
  );
}
