import {useState, useMemo, useEffect} from "react";
import { useSelector, useDispatch  } from "react-redux";
import { useParams } from "react-router-dom";

import RecordList from "../components/recording/RecordList";
import {fetchRecords} from "@/features/record/recordSlice.js";
import {fetchFolders} from "@/features/folder/folderSlice.js";

export default function FolderListPage() {
    const { id } = useParams(); // ✅ URL 파라미터에서 폴더 ID 가져오기
    const folderId = Number(id);

    const dispatch = useDispatch();

    const { records } = useSelector((state) => state.record);
    const { folders } = useSelector((state) => state.folder);

    const [searchTerm, setSearchTerm] = useState("");
    const [sortOption, setSortOption] = useState("latest");

    const currentFolder = folders.find((f) => f.id === folderId);

    useEffect(() => {
        if (folderId) {
            dispatch(fetchFolders());
            dispatch(fetchRecords());
        }
    }, [dispatch, folderId]); // 폴더 ID가 바뀔 때마다 다시 fetchRecords 실행

    // ✅ 폴더 내 회의 필터링 + 검색 + 정렬
    const filteredRecords = useMemo(() => {
        return records
            .filter(
                (rec) =>
                    rec.folder_id === folderId &&
                    rec.title.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => {
                if (sortOption === "latest")
                    return new Date(b.created_at) - new Date(a.created_at);
                if (sortOption === "oldest")
                    return new Date(a.created_at) - new Date(b.created_at);
                if (sortOption === "name") return a.title.localeCompare(b.title);
                return 0;
            });
    }, [records, folderId, searchTerm, sortOption]);

    return (
        <main className="flex-1 bg-gray-50 min-h-screen p-8">
            {/* 상단 타이틀 + 정렬 */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-gray-800">
                    {currentFolder?.name || "폴더 없음"}
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

            {/* 폴더 내 회의 리스트 */}
            {filteredRecords.length === 0 ? (
                <p className="text-gray-400 text-sm text-center mt-20">
                    해당 폴더에 회의록이 없습니다.
                </p>
            ) : (
                <RecordList records={filteredRecords} />
            )}
        </main>
    );
}
