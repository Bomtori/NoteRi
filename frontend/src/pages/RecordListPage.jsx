import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import RecordList from "../components/recording/RecordList";
import Calendar from "../components/calendar/Calendar";
import { FaRegCalendarAlt } from "react-icons/fa";
import apiClient from "../api/apiClient";
import { setRecords } from "../features/record/recordSlice.js";
import { fetchFolders } from "../features/folder/folderSlice";
import { BsChatDots } from "react-icons/bs";
import { showMessenger } from "../lib/channelTalk";
import SearchBar from "../components/recording/SearchBar";
import RightSidePanel from "../components/recording/RightSidePanel";

// 모바일용 RecordCard 컴포넌트
const MobileRecordCard = ({ record, onClick }) => {
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('ko-KR', { 
            year: 'numeric',
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        return `${mins}분`;
    };

    return (
        <div 
            onClick={onClick}
            className="bg-white rounded-lg p-4 mb-3 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition"
        >
            <h3 className="font-semibold text-gray-900 mb-2 text-base">
                {record.title}
            </h3>
            <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>{formatDate(record.created_at)}</span>
                <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                        <path strokeWidth="2" d="M12 6v6l4 2"/>
                    </svg>
                    {formatDuration(record.duration || 120)}
                </span>
            </div>
            {record.folder && (
                <div className="mt-2 flex items-center gap-1 text-sm">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                    </svg>
                    <span className="text-gray-600">{record.folder.name}</span>
                </div>
            )}
        </div>
    );
};

export default function RecordListPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { user } = useSelector(state => state.auth);
    const { records } = useSelector((state) => state.record);
    const { folders, status: folderStatus } = useSelector((state) => state.folder);

    // 폴더/공유 선택 상태
    const [selectedView, setSelectedView] = useState("all");
    const [showFolderMenu, setShowFolderMenu] = useState(false);

    // 캘린더 관련 상태
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false);
    const [calendarClosing, setCalendarClosing] = useState(false);
    const [upcomingEvents, setUpcomingEvents] = useState([]);
    const sheetRef = useRef(null);

    // 검색 관련 상태
    const [searchKeyword, setSearchKeyword] = useState("");
    const [searchStartDate, setSearchStartDate] = useState(null);
    const [searchEndDate, setSearchEndDate] = useState(null);
    const [searchMode, setSearchMode] = useState(false);
    const [showMobileSearch, setShowMobileSearch] = useState(false);

    // UI 상태
    const [sortOption, setSortOption] = useState("latest");
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // 페이지네이션 상태
    const [totalPages, setTotalPages] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 7;
    const [totalCount, setTotalCount] = useState(0);


    // RAG 관련 상태
    const [ragQuestion, setRagQuestion] = useState("");
    const [ragAnswer, setRagAnswer] = useState("");
    const [ragSources, setRagSources] = useState([]);
    const [ragLoading, setRagLoading] = useState(false);
    const [ragError, setRagError] = useState("");
    const [gptTab, setGptTab] = useState("gpt");

    // 공유받은 회의 불러오기 (페이지네이션 지원)
    const fetchSharedBoards = useCallback(async (page = 1) => {
        setIsLoading(true);
        try {
            const res = await apiClient.get("/boards/shared-received", {
                params: { page, limit: recordsPerPage }
            });

            const { total, items } = res.data;
            setTotalCount(total);
            setTotalPages(Math.ceil(total / recordsPerPage));
            dispatch(setRecords(items));
        } catch (err) {
            console.error("공유받은 회의 조회 실패:", err);
            dispatch(setRecords([]));
            setTotalPages(1);
        } finally {
            setIsLoading(false);
        }
    }, [dispatch]);

    // 폴더별 보드 불러오기 (페이지네이션 지원)
    const fetchFolderBoards = useCallback(async (folderId, page = 1) => {
        setIsLoading(true);
        try {
            const res = await apiClient.get(`/folders/${folderId}/boards`, {
                params: { page, limit: recordsPerPage }
            });
            const { total, items } = res.data;

            setTotalCount(total);
            setTotalPages(Math.ceil(total / recordsPerPage));
            dispatch(setRecords(items));
        } catch (err) {
            console.error("폴더 보드 불러오기 실패:", err);
            dispatch(setRecords([]));
            setTotalPages(1);
        } finally {
            setIsLoading(false);
        }
    }, [dispatch]);

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

    // 검색 API 호출
    const fetchSearchBoards = useCallback(async (page = 1, keyword = "", startDate = null, endDate = null) => {
        setIsLoading(true);
        try {
            const skip = (page - 1) * recordsPerPage;
            const params = {
                skip,
                limit: recordsPerPage,
            };

            if (keyword) params.title = keyword;
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;

            const res = await apiClient.get("/boards/search", { params });
            const { total, items } = res.data;
            setTotalCount(total);
            setTotalPages(Math.ceil(total / recordsPerPage));
            dispatch(setRecords(items));
        } catch (err) {
            console.error("❌ 검색 실패:", err);
            setTotalPages(1);
            dispatch(setRecords([]));
        } finally {
            setIsLoading(false);
        }
    }, [dispatch]);

    // 일반 보드 목록 불러오기
    const fetchBoards = useCallback(async (page = 1) => {
        setIsLoading(true);
        try {
            const skip = (page - 1) * recordsPerPage;
            const res = await apiClient.get("/boards", {
                params: { skip, limit: recordsPerPage },
            });

            const { total, items } = res.data;

            setTotalCount(total);
            setTotalPages(Math.ceil(total / recordsPerPage));
            dispatch(setRecords(items));
        } catch (err) {
            console.error("보드 불러오기 실패:", err);
        } finally {
            setIsLoading(false);
        }
    }, [dispatch]);

    // 검색 핸들러
    const handleSearch = (searchParams) => {
        const { keyword, startDate, endDate } = searchParams;
        
        if (!keyword && !startDate && !endDate) {
            setSearchMode(false);
            setSearchKeyword("");
            setSearchStartDate(null);
            setSearchEndDate(null);
            setCurrentPage(1);
            
            // 현재 뷰에 맞는 데이터 다시 로드
            if (selectedView === "shared") {
                fetchSharedBoards(1);
            } else if (selectedView !== "all") {
                fetchFolderBoards(parseInt(selectedView), 1);
            } else {
                fetchBoards(1);
            }
        } else {
            setSearchKeyword(keyword);
            setSearchStartDate(startDate);
            setSearchEndDate(endDate);
            setSearchMode(true);
            setCurrentPage(1);
            fetchSearchBoards(1, keyword, startDate, endDate);
        }
    };

    // 모바일 캘린더 닫기
    const closeCalendar = useCallback(() => {
        setCalendarClosing(true);
        setTimeout(() => {
            setMobileCalendarOpen(false);
            setCalendarClosing(false);
        }, 300);
    }, []);

    // 초기 로드
    useEffect(() => {
        fetchBoards(1);
        fetchUpcoming();

        if (folderStatus === "idle") {
            dispatch(fetchFolders());
        }
    }, [fetchBoards, fetchUpcoming, folderStatus, dispatch]);

    // 모바일 캘린더 스와이프 제스처
    useEffect(() => {
        const sheet = sheetRef.current;
        if (!sheet || !mobileCalendarOpen) return;

        let startY = 0;
        let currentY = 0;

        const touchStart = (e) => {
            startY = e.touches[0].clientY;
        };

        const touchMove = (e) => {
            currentY = e.touches[0].clientY - startY;

            if (currentY > 0) {
                sheet.style.transform = `translateY(${currentY}px)`;
            }
        };

        const touchEnd = () => {
            if (currentY > 120) {
                closeCalendar();
            } else {
                sheet.style.transform = "translateY(0)";
            }

            startY = 0;
            currentY = 0;
        };

        sheet.addEventListener("touchstart", touchStart);
        sheet.addEventListener("touchmove", touchMove);
        sheet.addEventListener("touchend", touchEnd);

        return () => {
            sheet.removeEventListener("touchstart", touchStart);
            sheet.removeEventListener("touchmove", touchMove);
            sheet.removeEventListener("touchend", touchEnd);
        };
    }, [mobileCalendarOpen, closeCalendar]);

    // 폴더 변경 핸들러
    const handleFolderChange = useCallback(async (recordId, folder) => {
        try {
            await apiClient.patch(`/boards/${recordId}/move`, {
                folder_id: folder.id
            });

            const updatedRecords = records.map(rec =>
                rec.id === recordId
                    ? { ...rec, folder, folder_id: folder.id }
                    : rec
            );
            dispatch(setRecords(updatedRecords));
        } catch (err) {
            console.error("❌ 폴더 변경 실패:", err);
            
            // 현재 뷰에 맞게 데이터 새로고침
            if (searchMode) {
                fetchSearchBoards(currentPage, searchKeyword, searchStartDate, searchEndDate);
            } else if (selectedView === "shared") {
                fetchSharedBoards(currentPage);
            } else if (selectedView !== "all") {
                fetchFolderBoards(parseInt(selectedView), currentPage);
            } else {
                fetchBoards(currentPage);
            }
        }
    }, [dispatch, records, currentPage, searchMode, searchKeyword, searchStartDate, searchEndDate, 
        selectedView, fetchSearchBoards, fetchSharedBoards, fetchFolderBoards, fetchBoards]);

    // 페이지 변경
    const handlePageChange = (page) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);

        if (searchMode) {
            fetchSearchBoards(page, searchKeyword, searchStartDate, searchEndDate);
        } else if (selectedView === "shared") {
            fetchSharedBoards(page);
        } else if (selectedView !== "all") {
            const folderId = parseInt(selectedView);
            fetchFolderBoards(folderId, page);
        } else {
            fetchBoards(page);
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // 뷰 변경 핸들러 (폴더/공유 선택 시)
    const handleViewChange = useCallback((view) => {
        setSelectedView(view);
        setCurrentPage(1);
        setSearchMode(false);
        setSearchKeyword("");
        setSearchStartDate(null);
        setSearchEndDate(null);

        if (view === "shared") {
            fetchSharedBoards(1);
        } else if (view === "all") {
            fetchBoards(1);
        } else {
            const folderId = parseInt(view);
            fetchFolderBoards(folderId, 1);
        }
    }, [fetchSharedBoards, fetchBoards, fetchFolderBoards]);

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

    // 클라이언트 사이드 정렬 (백엔드에서 페이징된 데이터만 정렬)
    const sortedRecords = useMemo(() => {
        let sorted = Array.isArray(records) ? [...records] : [];

        return sorted.sort((a, b) => {
            if (sortOption === "latest")
                return new Date(b.created_at) - new Date(a.created_at);
            if (sortOption === "oldest")
                return new Date(a.created_at) - new Date(b.created_at);
            if (sortOption === "name")
                return a.title.localeCompare(b.title);
            return 0;
        });
    }, [records, sortOption]);
    
    // 현재 선택된 뷰 이름 가져오기
    const getViewName = () => {
        if (selectedView === "all") return "모든 노트";
        if (selectedView === "shared") return "공유받은 회의";
        const folder = folders.find(f => f.id === parseInt(selectedView));
        return folder ? folder.name : "모든 노트";
    };

    return (
        <>
            {/* 모바일 헤더 */}
            <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
                <div className="flex items-center justify-between px-4 py-4">
                    {/* 폴더 선택 드롭다운 */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowFolderMenu(!showFolderMenu)}
                            className="flex items-center gap-2 text-lg font-semibold"
                        >
                            {getViewName()}
                            <svg 
                                className={`w-5 h-5 transition-transform ${showFolderMenu ? 'rotate-180' : ''}`}
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {/* 드롭다운 메뉴 */}
                        {showFolderMenu && (
                            <>
                                <div 
                                    className="fixed inset-0 z-40" 
                                    onClick={() => setShowFolderMenu(false)}
                                />
                                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 max-h-96 overflow-y-auto">
                                    {/* 모든 노트 */}
                                    <button
                                    onClick={() => {
                                            if (!user) {
                                            navigate("/login");
                                            return;
                                        }

                                        setShowFolderMenu(false);
                                        setSelectedView("all");
                                        navigate("/record"); // ⭐ 핵심: 강제로 초기 mount 시키기

                                        // 바로 다시 리스트 로딩
                                        fetchBoards(1);
                                    }}
                                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 ${
                                            selectedView === "all" ? "bg-[#7E37F9]/5 text-[#7E37F9]" : ""
                                        }`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeWidth="2" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                                        </svg>
                                        <span className="font-medium">모든 노트</span>
                                    </button>

                                    {/* 폴더 목록 */}
                                    {folders.length > 0 && (
                                        <>
                                            {folders.map(folder => (
                                                <button
                                                    key={folder.id}
                                                    onClick={() => {
                                                        handleViewChange(folder.id.toString());
                                                        setShowFolderMenu(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 ${
                                                        selectedView === folder.id.toString() ? "bg-[#7E37F9]/5 text-[#7E37F9]" : ""
                                                    }`}
                                                >
                                                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                                                    </svg>
                                                    <span>{folder.name}</span>
                                                </button>
                                            ))}
                                        </>
                                    )}

                                    {/* 구분선 */}
                                    <div className="border-t border-gray-200 my-2" />

                                    {/* 공유받은 회의 */}
                                    <button
                                        onClick={() => {
                                            handleViewChange("shared");
                                            setShowFolderMenu(false);
                                        }}
                                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 ${
                                            selectedView === "shared" ? "bg-[#7E37F9]/5 text-[#7E37F9]" : ""
                                        }`}
                                    >
                                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                                        </svg>
                                        <span>공유받은 회의</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <button 
                        onClick={() => setShowMobileSearch(!showMobileSearch)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </button>
                </div>

                {/* 모바일 검색바 */}
                {showMobileSearch && (
                    <div className="px-4 pb-4 animate-slideDown">
                        <SearchBar onSearch={(params) => {
                            handleSearch(params);
                            setShowMobileSearch(false);
                        }} />
                    </div>
                )}
            </div>

            {/* 모바일 뷰 */}
            <div className="lg:hidden pt-16 pb-20 px-4 bg-gray-50 min-h-screen">
                {/* 정렬 옵션 */}
                <div className="flex justify-between items-center mb-4 mt-3">
                    <p className="text-sm text-gray-500">
                        총 {totalCount}개
                    </p>
                    <select
                        value={sortOption}
                        onChange={(e) => setSortOption(e.target.value)}
                        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                    >
                        <option value="latest">최신순</option>
                        <option value="oldest">오래된순</option>
                        <option value="name">이름순</option>
                    </select>
                </div>

                {/* 검색 필터 표시 */}
                {(searchKeyword || searchStartDate) && (
                    <div className="mb-4 flex flex-wrap gap-2">
                        {searchKeyword && (
                            <span className="px-3 py-1 bg-[#7E37F9]/10 text-[#7E37F9] rounded-full text-sm flex items-center gap-2">
                                🔍 {searchKeyword}
                                <button onClick={() => handleSearch({ keyword: "", startDate: searchStartDate, endDate: searchEndDate })}>✕</button>
                            </span>
                        )}
                        {searchStartDate && (
                            <span className="px-3 py-1 bg-[#7E37F9]/10 text-[#7E37F9] rounded-full text-sm flex items-center gap-2">
                                📅 {searchStartDate}{searchEndDate ? ` ~ ${searchEndDate}` : ""}
                                <button onClick={() => handleSearch({ keyword: searchKeyword, startDate: null, endDate: null })}>✕</button>
                            </span>
                        )}
                    </div>
                )}

                {/* 리스트 */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-9 h-9 border-2 border-[#7E37F9]/30 border-t-[#7E37F9] rounded-full animate-spin" />
                    </div>  
                ) : sortedRecords.length > 0 ? (
                    sortedRecords.map(record => (
                        <MobileRecordCard 
                            key={record.id} 
                            record={record}
                            onClick={() => window.location.href = `/record/${record.id}`}
                        />
                    ))
                ) : (
                    <div className="text-center py-20">
                        <p className="text-gray-400 mb-2">😔</p>
                        <p className="text-gray-400 text-sm">
                            {selectedView === "shared" ? '공유받은 회의가 없습니다' : 
                             searchMode ? '검색 결과가 없습니다' : '회의록이 없습니다'}
                        </p>
                    </div>
                )}

                {/* 페이지네이션 (모바일) */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-6">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className={`px-3 py-1 rounded ${currentPage === 1 ? "text-gray-400" : "text-[#7E37F9]"}`}
                        >
                            이전
                        </button>
                        <span className="text-sm text-gray-600">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className={`px-3 py-1 rounded ${currentPage === totalPages ? "text-gray-400" : "text-[#7E37F9]"}`}
                        >
                            다음
                        </button>
                    </div>
                )}

                {/* 모바일 하단 녹음 버튼 */}
                <button 
                    onClick={() => navigate("/new")}
                    className="fixed bottom-20 right-4 w-16 h-16 bg-[#7E37F9] rounded-full shadow-lg flex items-center justify-center text-white z-40"
                >
                    <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-white rounded-full mb-1"></div>
                        <span className="text-xs font-medium">녹음</span>
                    </div>
                </button>

                {/* 모바일 하단 네비게이션 */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
                    <div className="flex justify-around py-3">
                        <button
                        onClick={() => navigate("/record")} 
                        className="flex flex-col items-center gap-1">
                            <svg className="w-6 h-6 text-[#7E37F9]" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                            </svg>
                            <span className="text-xs text-[#7E37F9]">노트</span>
                        </button>

                        <button 
                            onClick={() => setMobileCalendarOpen(true)}
                            className="flex flex-col items-center gap-1"
                        >
                            <FaRegCalendarAlt className="w-6 h-6 text-gray-400" />
                            <span className="text-xs text-gray-400">일정</span>
                        </button>

                        <button 
                            onClick={() => showMessenger()}
                            className="flex flex-col items-center gap-1"
                        >
                            <BsChatDots className="w-6 h-6 text-gray-400" />
                            <span className="text-xs text-gray-400">문의</span>
                        </button>

                        <button 
                            onClick={() => navigate("/user")}
                            className="flex flex-col items-center gap-1"
                        >
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                fill="currentColor" 
                                viewBox="0 0 24 24" 
                                className="w-6 h-6 text-gray-400"
                            >
                                <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.33 0-10 1.667-10 5v2h20v-2c0-3.333-6.67-5-10-5z"/>
                            </svg>
                            <span className="text-xs text-gray-400">마이</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 모바일 달력 모달 */}
            {(mobileCalendarOpen || calendarClosing) && (
                <div 
                    className={`
                        lg:hidden fixed inset-0 bg-black/50 z-[100] flex items-end 
                        transition-opacity duration-300
                        ${calendarClosing ? "opacity-0" : "opacity-100"}
                    `}
                    onClick={closeCalendar}
                >
                    <div 
                        ref={sheetRef}
                        onClick={(e) => e.stopPropagation()}
                        className={`
                            bg-white w-full max-w-[600px] mx-auto rounded-t-3xl p-6 
                            max-h-[85vh] overflow-y-auto 
                            transition-transform duration-300
                            ${calendarClosing ? "translate-y-full" : "translate-y-0"}
                        `}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold">일정 관리</h2>
                            <button 
                                onClick={closeCalendar}
                                className="text-2xl text-gray-500"
                            >
                                ✕
                            </button>
                        </div>
                        <Calendar />
                    </div>
                </div>
            )}

            {/* 데스크톱 뷰 (기존 레이아웃) */}
            <main className="hidden lg:flex bg-gray-50 min-h-screen p-8 gap-6">
                {/* 왼쪽: 회의 리스트 */}
                <section className="flex-1">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold text-gray-800">
                            {searchMode && (searchKeyword || searchStartDate) 
                                ? `검색 결과${searchKeyword ? `: "${searchKeyword}"` : ""}${searchStartDate ? ` (${searchStartDate}${searchEndDate ? ` ~ ${searchEndDate}` : ""})` : ""}`
                                : getViewName()}
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

                    <SearchBar onSearch={handleSearch} />

                    {searchMode && (
                        <div className="mb-4 text-sm text-gray-500">
                            총 {(currentPage - 1) * recordsPerPage + records.length}개의 검색 결과
                        </div>
                    )}

                    {records.length > 0 ? (
                        <>
                            <RecordList
                                records={sortedRecords}
                                folders={Array.isArray(folders) ? folders : []}
                                onFolderChange={handleFolderChange}
                            />

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
                            {searchMode 
                                ? `검색 결과가 없습니다.`
                                : selectedView === "shared"
                                ? "공유받은 회의가 없습니다."
                                : "회의록이 없습니다."}
                        </p>
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

            <style>{`
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes slideUp {
                    from {
                        transform: translateY(100%);
                    }
                    to {
                        transform: translateY(0);
                    }
                }

                .animate-slideDown {
                    animation: slideDown 0.3s ease-out;
                }

                .animate-slideUp {
                    animation: slideUp 0.3s ease-out;
                }
            `}</style>
        </>
    );
}