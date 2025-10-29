import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FolderDropdown from "./FolderDropdown";
import RecordMenuDropdown from "./RecordMenuDropdown";

export default function RecordList({ records = [], folders = [], onFolderChange }) {
    // ✅ records가 undefined일 경우에도 안전하게 빈 배열로 처리
    if (!Array.isArray(records)) {
        console.warn("RecordList: records가 배열이 아닙니다.", records);
        return null;
    }
    return (
        <div className="space-y-4">
            {records.length === 0 ? (
                <p className="text-sm text-gray-400 text-center mt-10">
                    회의록이 없습니다.
                </p>
            ) : (
                records.map((record) => (
                    <RecordItem
                        key={record.id}
                        record={record}
                        folders={folders}
                        onFolderChange={onFolderChange}
                    />
                ))
            )}
        </div>
    );
}

function RecordItem({ record, folders, onFolderChange }) {
    const [hovered, setHovered] = useState(false);
    const [showFolderDropdown, setShowFolderDropdown] = useState(false);
    const [showMenuDropdown, setShowMenuDropdown] = useState(false);
    const navigate = useNavigate();

    return (
        <div
            className="relative flex justify-between items-center bg-white border border-gray-200 rounded-lg px-6 py-4 shadow-sm hover:shadow transition group"
            onClick={() => navigate(`/record/${record.id}`)} // 페이지이동
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => {
                setHovered(false);
                setShowFolderDropdown(false);
                setShowMenuDropdown(false);
            }}
        >
            {/* === 왼쪽 내용 === */}
            <div>
                <h3 className="font-semibold text-gray-800">{record.title}</h3>
                <p className="text-sm text-gray-500">{record.description}</p>
                <p className="text-xs text-gray-400 mt-1">
                    {new Date(record.created_at).toLocaleString("ko-KR")}
                </p>
            </div>

            {/* === 오른쪽 액션 (hover 시 표시) === */}
            {hovered && (
                <div className="flex items-center gap-2 relative">
                    {/* 📁 폴더명 클릭 시 드롭다운 */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation(); // ✅ 카드 클릭 이벤트 막기
                            setShowFolderDropdown((prev) => !prev);
                            setShowMenuDropdown(false);
                        }}
                        className="px-2 py-1 text-sm border border-gray-200 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-600"
                    >
                        {record.folder?.name || "폴더에 추가"}
                    </button>

                    {showFolderDropdown && (
                        <FolderDropdown
                            folders={folders}
                            currentFolder={record.folder}
                            onSelect={async (folder) => {
                                if (!folder) return setShowFolderDropdown(false);
                                try {
                                    // ✅ 서버에 폴더 변경 PATCH 요청
                                    await fetch(`http://localhost:8000/boards/${record.id}/folder`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ folder_id: folder.id }),
                                    });
                                    +
                                        // ✅ Redux 상태 즉시 반영
                                        onFolderChange(record.id, folder);
                                } catch (err) {
                                    console.error("폴더 변경 실패:", err);
                                } finally {
                                    setShowFolderDropdown(false);
                                }
                            }}
                        />
                    )}

                    {/* ⋯ 점 메뉴 */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation(); // ✅ 카드 클릭 이벤트 막기
                            setShowMenuDropdown((prev) => !prev);
                            setShowFolderDropdown(false);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100"
                    >
                        ⋯
                    </button>

                    {showMenuDropdown && (
                        <RecordMenuDropdown
                            onClose={() => setShowMenuDropdown(false)}
                            onDelete={() => alert("삭제 기능 연결 예정")}
                            onRename={() => alert("이름 변경 기능 연결 예정")}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
