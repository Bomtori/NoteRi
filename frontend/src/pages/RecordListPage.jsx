import { useState, useMemo, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import RecordList from "../components/recording/RecordList";
import Calendar from "../components/calendar/Calendar";
import { FaRegCalendarAlt } from "react-icons/fa";
import apiClient from "../api/apiClient";
import { setRecords } from "../features/record/recordSlice.js";
import { fetchFolders } from "../features/folder/folderSlice";
import { BsChatDots } from "react-icons/bs";
import { openChat, showMessenger, track } from "../lib/channelTalk";

export default function RecordListPage() {
    const dispatch = useDispatch();

    const { records } = useSelector((state) => state.record);
    const { folders, status: folderStatus } = useSelector((state) => state.folder);

    const [calendarOpen, setCalendarOpen] = useState(false);
    const [upcomingEvents, setUpcomingEvents] = useState([]);

    const [searchTerm, setSearchTerm] = useState("");
    const [sortOption, setSortOption] = useState("latest");
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [gptTab, setGptTab] = useState("gpt");
    const [totalPages, setTotalPages] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    const recordsPerPage = 7;

    const [ragQuestion, setRagQuestion] = useState("");
    const [ragAnswer, setRagAnswer] = useState("");
    const [ragSources, setRagSources] = useState([]);
    const [ragLoading, setRagLoading] = useState(false);
    const [ragError, setRagError] = useState("");

    // 다가오는 일정 불러오기
    const fetchUpcoming = useCallback(async () => {
        try {
            const now = new Date();
            const nextMonth = new Date();
            nextMonth.setMonth(now.getMonth() + 1);

            const params = new URLSearchParams({
                start: now.toISOString(),
                end: nextMonth.toISOString(),
            });

            const res = await apiClient.get(`/calendar?${params.toString()}`);
            const allEvents = res.data || [];

            const future = allEvents
                .filter(ev => new Date(ev.start) >= now)
                .sort((a, b) => new Date(a.start) - new Date(b.start))
                .slice(0, 4);

            setUpcomingEvents(future);
        } catch (err) {
            console.error("📅 일정 불러오기 실패:", err);
        }
    }, []);

    // 페이지 기반 보드 불러오기 (단일 데이터 소스)
    const fetchBoards = useCallback(async (page = 1) => {
        const skip = (page - 1) * recordsPerPage;
        const limit = recordsPerPage;

        setIsLoading(true);
        try {
            const res = await apiClient.get("/boards", { params: { skip, limit } });

            console.log("API 응답:", res.data);

            const { total = 0, items = [] } = res.data;

            setTotalPages(Math.ceil(total / recordsPerPage));
            dispatch(setRecords(Array.isArray(items) ? items : []));
        } catch (err) {
            if (err.response?.status === 401) {
                localStorage.removeItem("access_token");
                window.location.href = "/login";
            } else {
                console.error("❌ 보드 목록 불러오기 실패:", err);
            }
        } finally {
            setIsLoading(false);
        }
    }, [dispatch]);

    // 초기 로드 - 한 번만 실행
    useEffect(() => {
        console.log("🚀 초기 데이터 로드");
        fetchBoards(1);
        fetchUpcoming();

        if (folderStatus === "idle") {
            dispatch(fetchFolders());
        }
    }, []); // ❌ 의존성 배열 비움 - 마운트 시 1회만 실행

    // 폴더 목록 디버깅
    useEffect(() => {
        if (folders?.length) {
            console.log("📁 folders loaded:", folders);
        }
    }, [folders]);

    // 검색 + 정렬 + 필터링 (클라이언트 사이드)
    const filteredRecords = useMemo(() => {
        let filtered = Array.isArray(records) ? records : [];

        if (selectedFolder) {
            filtered = filtered.filter((rec) => rec.folder_id === selectedFolder.id);
        }

        if (searchTerm) {
            filtered = filtered.filter((rec) =>
                rec.title.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        return [...filtered].sort((a, b) => {
            if (sortOption === "latest")
                return new Date(b.created_at) - new Date(a.created_at);
            if (sortOption === "oldest")
                return new Date(a.created_at) - new Date(b.created_at);
            if (sortOption === "name")
                return a.title.localeCompare(b.title);
            return 0;
        });
    }, [records, searchTerm, sortOption, selectedFolder]);

    // 폴더 변경 핸들러
    const handleFolderChange = useCallback(async (recordId, folder) => {
        try {
            await apiClient.patch(`/boards/${recordId}/folder`, {
                folder_id: folder.id
            });

            // 로컬 상태 업데이트
            const updatedRecords = records.map(rec =>
                rec.id === recordId
                    ? { ...rec, folder, folder_id: folder.id }
                    : rec
            );
            dispatch(setRecords(updatedRecords));

            console.log("폴더 변경 완료");
        } catch (err) {
            console.error("❌ 폴더 변경 실패:", err);
            // 실패 시 다시 불러오기
            fetchBoards(currentPage);
        }
    }, [dispatch, records, currentPage, fetchBoards]);

    // 페이지 변경
    const handlePageChange = (page) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
        fetchBoards(page);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

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

    // 로딩 상태
    if (isLoading && records.length === 0) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="w-10 h-10 border-4 border-gray-300 border-t-[#7E37F9] rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <main className="flex bg-gray-50 min-h-screen p-8 gap-6">
            {/* 왼쪽: 회의 리스트 */}
            <section className="flex-1">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-800">
                        {selectedFolder?.name || "모든 녹음"}
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
                {filteredRecords.length > 0 ? (
                    <>
                        <RecordList
                            records={filteredRecords}
                            folders={folders}
                            onFolderChange={handleFolderChange}
                        />

                        {/* 페이지네이션 */}
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-2 mt-10">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className={`px-3 py-1 rounded transition ${
                                        currentPage === 1
                                            ? "text-gray-400 cursor-not-allowed"
                                            : "text-[#7E37F9] hover:bg-[#7E37F9]/10"
                                    }`}
                                >
                                    이전
                                </button>

                                {Array.from({ length: totalPages }, (_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handlePageChange(i + 1)}
                                        className={`px-3 py-1 rounded text-sm transition ${
                                            currentPage === i + 1
                                                ? "bg-[#7E37F9] text-white"
                                                : "text-gray-600 hover:bg-[#7E37F9]/10"
                                        }`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}

                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className={`px-3 py-1 rounded transition ${
                                        currentPage === totalPages
                                            ? "text-gray-400 cursor-not-allowed"
                                            : "text-[#7E37F9] hover:bg-[#7E37F9]/10"
                                    }`}
                                >
                                    다음
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <p className="text-gray-400 text-sm text-center mt-20">
                        회의록이 없습니다.
                    </p>
                )}
            </section>

            {/* 오른쪽: 기록검색 & 일정관리 패널 */}
            <aside className="w-[30%] bg-white rounded-2xl shadow-sm p-6 flex flex-col min-h-[700px]">
                {/* 일정 미리보기 */}
                <div className="mb-6 border-b border-gray-200 pb-3">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-gray-800">다가오는 일정</h3>
                        <button
                            onClick={() => setCalendarOpen(true)}
                            className="text-xs text-[#7E37F9] hover:underline"
                        >
                            전체보기
                        </button>
                    </div>

                    {upcomingEvents.length === 0 ? (
                        <p className="text-xs text-gray-400">예정된 일정이 없습니다.</p>
                    ) : (
                        <ul className="space-y-2">
                            {upcomingEvents.map(ev => (
                                <li
                                    key={ev.id}
                                    className="flex items-center gap-2 text-sm hover:bg-gray-50 p-1 rounded cursor-pointer transition"
                                    onClick={() => setCalendarOpen(true)}
                                >
                                    <span
                                        className="w-2 h-2 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: ev.extended_props?.color || "#7E37F9" }}
                                    ></span>
                                    <span className="text-gray-700 font-medium flex-1 truncate">{ev.title}</span>
                                    <span className="text-xs text-gray-400 whitespace-nowrap">
                                      {new Date(ev.start).toLocaleDateString("ko-KR", {
                                          month: "numeric",
                                          day: "numeric",
                                          weekday: "short",
                                      })}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="flex gap-2 mb-4 border-b border-gray-200 pb-2">
                    {["gpt"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setGptTab(tab)}
                            className={`px-3 py-1 text-sm font-medium transition ${
                                gptTab === tab
                                    ? "border-b-2 border-[#7E37F9] text-[#7E37F9]"
                                    : "text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            {tab === "gpt" ? "기록검색" : "요약 메모"}
                        </button>
                    ))}
                </div>

                {gptTab === "gpt" && (
                    <div className="flex flex-col h-full">


                        {/* 에러 메시지 */}
                        {ragError && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                                ❌❌{ragError}
                            </div>
                        )}

                        {/* 답변 영역 */}
                        <div className="flex-1 overflow-y-auto">
                            {ragLoading && (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                    <div className="w-8 h-8 border-4 border-gray-200 border-t-[#7E37F9] rounded-full animate-spin mb-3" />
                                    <p className="text-sm">답변 생성 중...</p>
                                </div>
                            )}

                            {!ragLoading && ragAnswer && (
                                <div>
                                    {/* AI 답변 */}
                                    <div className="mb-4 p-4 bg-[#F5F3FF] border border-[#7E37F9]/20 rounded-lg">
                                        <p className="font-semibold text-[#7E37F9] mb-2 text-sm">
                                            노트리의 답변
                                        </p>
                                        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                            {ragAnswer}
                                        </div>
                                    </div>

                                    {/* 참조 소스 */}
                                    {ragSources.length > 0 && (
                                        <div>
                                            <p className="font-semibold text-gray-700 mb-2 text-sm">
                                                참조 문서 ({ragSources.length}개)
                                            </p>
                                            <div className="space-y-2">
                                                {ragSources.map((source, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                                                        onClick={() => {
                                                            console.log("소스 클릭:", source);
                                                        }}
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-xs font-semibold text-[#7E37F9]">
                                                                세션 #{source.session_id}
                                                            </span>
                                                            <span className="text-xs text-gray-400">
                                                                유사도: {(source.similarity * 100).toFixed(0)}%
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-gray-600 line-clamp-3">
                                                            {source.text}
                                                        </p>
                                                        {source.metadata?.date && (
                                                            <p className="text-xs text-gray-400 mt-1">
                                                                {new Date(source.metadata.date).toLocaleDateString()}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!ragLoading && !ragAnswer && (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                    <p className="text-sm text-center">
                                        모든 녹음 내용에서<br />원하는 정보를 검색해보세요!
                                    </p>
                                </div>
                            )}
                        </div>
                        {/* 질문 입력 영역 */}
                        <div className="mb-4">
                            <textarea
                                value={ragQuestion}
                                onChange={(e) => setRagQuestion(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="모든 녹음에서 검색할 질문을 입력하세요! &#10;예: 프론트엔드 디자인 언제 완료래?"
                                className="w-full h-24 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-[#7E37F9] focus:outline-none text-sm"
                                disabled={ragLoading}
                            />
                            <div className="flex justify-between items-center mt-2">
                                <button
                                    onClick={handleRagSubmit}
                                    disabled={ragLoading || !ragQuestion.trim()}
                                    className="px-4 py-2 bg-[#7E37F9] text-white rounded-lg text-sm font-medium hover:bg-[#6B2DD6] disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                                >
                                    {ragLoading ? "검색 중..." : "질문하기"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </aside>

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
                        // 캘린더 닫을 때 일정 새로고침
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