import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaRegCalendarAlt } from "react-icons/fa";
import apiClient from "../api/apiClient";
import Calendar from "../components/calendar/Calendar";
import RightSidePanel from "../components/recording/RightSidePanel";
import { showMessenger } from "../lib/channelTalk";

export default function SharedFolderPage() {
    const navigate = useNavigate();

    const [boards, setBoards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortOption, setSortOption] = useState("latest");

    // 캘린더 관련
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [upcomingEvents, setUpcomingEvents] = useState([]);

    // RAG 관련
    const [gptTab, setGptTab] = useState("gpt");
    const [ragQuestion, setRagQuestion] = useState("");
    const [ragAnswer, setRagAnswer] = useState("");
    const [ragSources, setRagSources] = useState([]);
    const [ragLoading, setRagLoading] = useState(false);
    const [ragError, setRagError] = useState("");

    // 공유받은 회의 불러오기
    useEffect(() => {
        async function fetchShared() {
            try {
                const res = await apiClient.get(`/boards/shared-received`);
                // setBoards(res.data || []);
                const { items } = res.data;
                setBoards(items || []);
                console.log("공유받은 회의:", res.data);
            } catch (err) {
                console.error("공유받은 회의 조회 실패:", err);
                setBoards([]);
            } finally {
                setLoading(false);
            }
        }
        fetchShared();
    }, []);

    // 다가오는 일정 불러오기
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
            console.error("일정 불러오기 실패:", err);
        }
    }, []);

    // 일정 최초 로드
    useEffect(() => {
        fetchUpcoming();
    }, [fetchUpcoming]);

    // RAG 질문 제출
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
            console.log("RAG 답변:", response.data);
        } catch (err) {
            console.error("❌ RAG 에러:", err);
            setRagError(
                err.response?.data?.detail || "답변 생성 중 오류가 발생했습니다."
            );
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

    // 검색 + 정렬 필터링
    const filteredBoards = boards
        .filter((b) =>
            searchTerm
                ? b.title?.toLowerCase().includes(searchTerm.toLowerCase())
                : true
        )
        .sort((a, b) => {
            if (sortOption === "latest")
                return new Date(b.created_at) - new Date(a.created_at);
            if (sortOption === "oldest")
                return new Date(a.created_at) - new Date(b.created_at);
            if (sortOption === "name")
                return (a.title || "").localeCompare(b.title || "");
            return 0;
        });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="w-10 h-10 border-4 border-gray-300 border-t-[#7E37F9] rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <main className="flex bg-gray-50 min-h-screen p-8 gap-6">
            {/* 왼쪽: 공유받은 회의 리스트 */}
            <section className="flex-1">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-800">
                        공유받은 회의
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
                {filteredBoards.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center mt-20">
                        공유받은 회의가 없습니다.
                    </p>
                ) : (
                    <ul className="space-y-3">
                        {filteredBoards.map((b) => (
                            <li
                                key={b.id}
                                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                                onClick={() => navigate(`/record/${b.id}`)}
                            >
                                <h3 className="font-semibold text-gray-800 mb-1">
                                    {b.title || "제목 없음"}
                                </h3>
                                <p className="text-xs text-gray-400">
                                    {new Date(b.created_at).toLocaleDateString("ko-KR", {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                    })}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* 오른쪽: 기록검색 & 일정관리 패널 */}
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

            {/* 캘린더 토글 floating 버튼 */}
            {!calendarOpen && (
                <button
                    onClick={() => setCalendarOpen(true)}
                    className="fixed bottom-6 right-6 z-[200] w-[64px] h-[64px] flex items-center justify-center bg-white rounded-2xl shadow-[0_4px_18px_rgba(0,0,0,0.15)] border border-gray-200 hover:bg-gray-50 transition"
                >
                    <FaRegCalendarAlt size={30} className="text-[#7E37F9]" />
                </button>
            )}

            {/* 캘린더 사이드 패널 */}
            <div
                className={`
                    fixed top-0 right-0 h-full w-[450px]
                    bg-white shadow-lg border-l
                    p-5 z-[150]
                    transition-transform duration-500
                    ${calendarOpen ? "translate-x-0" : "translate-x-full"}
                `}
            >
                <button
                    onClick={() => {
                        setCalendarOpen(false);
                        fetchUpcoming();
                    }}
                    className="
                    absolute top-4 right-4
                    text-gray-500 hover:text-gray-700
                    text-xl font-bold"
                >
                    ✕
                </button>

                <h3 className="font-semibold mb-4 text-lg">일정 관리</h3>

                <Calendar />
            </div>

            {/* 문의하기 버튼 */}
            <button
                onClick={() => {
                    showMessenger();
                }}
                className="fixed bottom-24 right-6 z-[200]
             w-[64px] h-[64px] flex items-center justify-center
             bg-white rounded-2xl shadow-[0_4px_18px_rgba(0,0,0,0.15)]
             border border-gray-200 hover:bg-gray-50 transition"
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