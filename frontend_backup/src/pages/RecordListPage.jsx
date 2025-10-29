import {useState, useMemo, useEffect} from "react";
import {useDispatch, useSelector} from "react-redux";
import RecordList from "../components/recording/RecordList";
import ReactMarkdown from "react-markdown";
// import remarkGfm from "remark-gfm";
import apiClient from "../api/apiClient";
import {setRecords} from "../features/record/recordSlice.js";
import SideNav from "@/components/common/SideNav.jsx";


export default function RecordListPage() {
    const { records } = useSelector((state) => state.record);
    const { folders } = useSelector((state) => state.folder);

    const [searchTerm, setSearchTerm] = useState("");
    const [sortOption, setSortOption] = useState("latest");
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [gptTab, setGptTab] = useState("gpt"); // GPT 탭 선택 상태
    const dispatch = useDispatch();

    useEffect(() => {
        apiClient
            .get("/boards")
            .then((res) => dispatch(setRecords(res.data)))
            .catch((err) => {
                if (err.response?.status === 401) {
                    localStorage.removeItem("access_token");
                    window.location.href = "/login";
                } else {
                    console.error("보드 목록 불러오기 실패:", err);
                }
            });
    }, [dispatch]);
    // 🔍 검색 + 정렬 + 폴더 필터
    const filteredRecords = useMemo(() => {
        let filtered = records;

        if (selectedFolder) {
            filtered = filtered.filter((rec) => rec.folder_id === selectedFolder.id);
        }

        filtered = filtered.filter((rec) =>
            rec.title.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return filtered.sort((a, b) => {
            if (sortOption === "latest")
                return new Date(b.created_at) - new Date(a.created_at);
            if (sortOption === "oldest")
                return new Date(a.created_at) - new Date(b.created_at);
            if (sortOption === "name") return a.title.localeCompare(b.title);
            return 0;
        });
    }, [records, searchTerm, sortOption, selectedFolder]);

    // ✅ 폴더 변경 핸들러
    const handleFolderChange = (folder) => {
        setSelectedFolder(folder);
    };

    return (
        <main className="flex bg-gray-50 min-h-screen p-8 gap-6">
            <SideNav />
            {/* ===== 왼쪽: 회의 리스트 ===== */}
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
                    <RecordList
                        records={filteredRecords}
                        folders={folders}
                        onFolderChange={handleFolderChange}
                    />
                ) : (
                    <p className="text-gray-400 text-sm text-center mt-20">
                        회의록이 없습니다.
                    </p>
                )}
            </section>

            {/* ===== 오른쪽: GPT 분석 패널 ===== */}
            <aside className="w-[30%] bg-white rounded-2xl shadow-sm p-6 flex flex-col min-h-[700px]">
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
                            {tab === "gpt" ? "GPT 분석" : "요약 메모"}
                        </button>
                    ))}
                </div>

                {/* GPT 내용 */}
                {gptTab === "gpt" && (
                    <div className="text-sm text-gray-600 flex flex-col h-full">
                        <p className="font-semibold text-[#7E37F9] mb-2">
                            🤖 자동 분석 결과
                        </p>
                        <p className="leading-relaxed text-gray-700">
                            최근 회의에서 주요 논의된 키워드를 기반으로
                            자동 요약을 제공합니다.
                        </p>
                        <p className="mt-3 text-xs text-gray-400">
                            (백엔드 연동 전 상태입니다.)
                        </p>
                    </div>
                )}

            </aside>
        </main>
    );
}
