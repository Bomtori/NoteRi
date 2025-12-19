import { useState, useRef, useEffect } from "react";

export default function SearchBar({ onSearch }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectingMode, setSelectingMode] = useState("start"); // 'start' or 'end'

    const datePickerRef = useRef(null);

    // 외부 클릭 감지
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (datePickerRef.current && !datePickerRef.current.contains(e.target)) {
                setShowDatePicker(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearch = () => {
        onSearch({
            keyword: searchTerm.trim(),
            startDate: startDate ? formatDateForAPI(startDate) : null,
            endDate: endDate ? formatDateForAPI(endDate) : null,
        });
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") handleSearch();
    };

    const handleDateClick = (date) => {
        if (selectingMode === "start") {
            setStartDate(date);
            setSelectingMode("end");
        } else {
            if (date < startDate) {
                setEndDate(startDate);
                setStartDate(date);
            } else {
                setEndDate(date);
            }
            setSelectingMode("start");
        }
    };

    const handleClearDates = () => {
        setStartDate(null);
        setEndDate(null);
        setSelectingMode("start");
    };

    const handleToday = () => {
        const today = new Date();
        setStartDate(today);
        setEndDate(today);
    };

    const handleThisWeek = () => {
        const today = new Date();
        const first = today.getDate() - today.getDay();
        const start = new Date(today.setDate(first));
        const end = new Date(today.setDate(first + 6));
        setStartDate(start);
        setEndDate(end);
    };

    const handleThisMonth = () => {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        setStartDate(start);
        setEndDate(end);
    };

    return (
        <div className="mb-8 w-full">

            {/* 🌟 반응형 한 줄/두 줄 전환 */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3 w-full">

                {/* 검색창 (lg에서는 flex-grow) */}
                <div className="flex items-center bg-white border border-gray-200 rounded-full px-4 py-2 shadow-sm flex-grow min-w-[200px]">
                    <span className="text-gray-400 mr-2">🔍</span>

                    <input
                        type="text"
                        className="flex-1 outline-none text-sm min-w-0"
                        placeholder="제목 검색 후 Enter"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />

                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm("")}
                            className="text-gray-400 hover:text-gray-600 ml-2"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* 날짜 버튼 / 검색 버튼 */}
                <div className="flex items-center gap-2 relative">

                    {/* 날짜 버튼 */}
                    <button
                        onClick={() => setShowDatePicker(!showDatePicker)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 whitespace-nowrap flex items-center gap-2"
                    >
                        📅
                        {startDate && endDate ? (
                            <span>{formatDateDisplay(startDate)} - {formatDateDisplay(endDate)}</span>
                        ) : startDate ? (
                            <span>{formatDateDisplay(startDate)}</span>
                        ) : (
                            <span className="text-gray-500">날짜 선택</span>
                        )}
                    </button>

                    {(startDate || endDate) && (
                        <button
                            onClick={handleClearDates}
                            className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                        >
                            초기화
                        </button>
                    )}

                    {/* 검색 버튼 */}
                    <button
                        onClick={handleSearch}
                        className="px-6 py-2 bg-[#7E37F9] text-white rounded-lg text-sm hover:bg-[#6c2de2] whitespace-nowrap"
                    >
                        검색
                    </button>

                    {/* 날짜 선택 드롭다운 */}
                    {showDatePicker && (
                        <div
                            ref={datePickerRef}
                            className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-50 w-[340px]"
                        >

                            {/* 빠른 선택 */}
                            <div className="flex gap-2 mb-4">
                                <button onClick={handleToday} className="px-3 py-1 text-xs border rounded hover:bg-gray-50">오늘</button>
                                <button onClick={handleThisWeek} className="px-3 py-1 text-xs border rounded hover:bg-gray-50">이번 주</button>
                                <button onClick={handleThisMonth} className="px-3 py-1 text-xs border rounded hover:bg-gray-50">이번 달</button>
                            </div>

                            {/* 선택 안내 */}
                            <div className="text-xs text-gray-500 mb-3">
                                {selectingMode === "start" ? "📍 시작 날짜 선택" : "📍 종료 날짜 선택"}
                            </div>

                            {/* 달력 헤더 */}
                            <div className="flex justify-between items-center mb-3">
                                <button
                                    onClick={() => {
                                        const prev = new Date(currentMonth);
                                        prev.setMonth(prev.getMonth() - 1);
                                        setCurrentMonth(prev);
                                    }}
                                    className="p-1 hover:bg-gray-100 rounded"
                                >
                                    ◀
                                </button>
                                <span className="font-semibold text-sm">
                                    {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
                                </span>
                                <button
                                    onClick={() => {
                                        const next = new Date(currentMonth);
                                        next.setMonth(next.getMonth() + 1);
                                        setCurrentMonth(next);
                                    }}
                                    className="p-1 hover:bg-gray-100 rounded"
                                >
                                    ▶
                                </button>
                            </div>

                            {/* 요일 */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                                    <div key={d} className="text-center text-xs text-gray-500 py-1">{d}</div>
                                ))}
                            </div>

                            {/* 날짜 그리드 */}
                            <div className="grid grid-cols-7 gap-1">
                                {renderCalendarDays(currentMonth, startDate, endDate, handleDateClick)}
                            </div>

                            {/* 선택 요약 */}
                            {startDate && (
                                <div className="mt-4 pt-3 border-t text-xs text-gray-600">
                                    선택: {formatDateDisplay(startDate)}
                                    {endDate && ` ~ ${formatDateDisplay(endDate)}`}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// 달력 날짜 렌더링
function renderCalendarDays(currentMonth, startDate, endDate, onClick) {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    
    // 빈 칸 추가
    for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`empty-${i}`} />);
    }
    
    // 날짜 추가
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const isSelected = isDateSelected(date, startDate, endDate);
        const isInRange = isDateInRange(date, startDate, endDate);
        const isToday = isSameDay(date, new Date());
        
        days.push(
            <button
                key={day}
                onClick={() => onClick(date)}
                className={`
                    p-2 text-xs rounded-lg hover:bg-gray-100 transition
                    ${isSelected ? "bg-[#7E37F9] text-white hover:bg-[#6c2de2]" : ""}
                    ${isInRange && !isSelected ? "bg-[#7E37F9]/10" : ""}
                    ${isToday && !isSelected ? "border border-[#7E37F9]" : ""}
                `}
            >
                {day}
            </button>
        );
    }
    
    return days;
}

// 날짜 비교 헬퍼 함수들
function isSameDay(date1, date2) {
    if (!date1 || !date2) return false;
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
}

function isDateSelected(date, startDate, endDate) {
    return isSameDay(date, startDate) || isSameDay(date, endDate);
}

function isDateInRange(date, startDate, endDate) {
    if (!startDate || !endDate) return false;
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    date.setHours(12, 0, 0, 0);
    return date >= start && date <= end;
}

function formatDateDisplay(date) {
    if (!date) return "";
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${month}월 ${day}일`;
}

function formatDateForAPI(date) {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}