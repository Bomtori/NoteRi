import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { updateRecord, deleteRecord } from "../../features/record/recordSlice";
import FolderDropdown from "./FolderDropdown";
import RecordMenuDropdown from "./RecordMenuDropdown";
import apiClient from "../../api/apiClient";

export default function RecordList({ records = [], folders = [], onFolderChange }) {
    if (!Array.isArray(records)) return null;
    return (
        <div className="space-y-4">
            {records.length === 0 ? (
                <p className="text-sm text-gray-400 text-center mt-10">회의록이 없습니다.</p>
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
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(record.title);
    const navigate = useNavigate();
    const dispatch = useDispatch();

    // ✅ 이름 변경
    const handleRename = async () => {
        try {
            const res = await apiClient.patch(`/boards/${record.id}`, { title });
            dispatch(updateRecord(res.data)); // Redux 반영
            setIsEditing(false);
        } catch (err) {
            console.error("이름 변경 실패:", err);
            alert("이름 변경에 실패했습니다.");
        }
    };

    // ✅ 삭제
    const handleDelete = async () => {
        if (!window.confirm(`"${record.title}"을(를) 삭제하시겠습니까?`)) return;
        try {
            await apiClient.delete(`/boards/${record.id}`);
            dispatch(deleteRecord(record.id)); // Redux 반영
            alert("삭제되었습니다.");
        } catch (err) {
            console.error("삭제 실패:", err);
            alert("삭제 중 오류가 발생했습니다.");
        }
    };

    return (
        <div
            className="relative flex justify-between items-center bg-white border border-gray-200 rounded-lg px-6 py-4 shadow-sm hover:shadow transition group"
            onClick={() => navigate(`/record/${record.id}`)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => {
                setHovered(false);
                setShowFolderDropdown(false);
                setShowMenuDropdown(false);
            }}
        >
            {/* === 왼쪽 === */}
            <div>
                {isEditing ? (
                    <div className="flex items-center gap-2">
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="border rounded px-2 py-1 text-sm"
                            autoFocus
                        />
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRename();
                            }}
                            className="text-xs text-white bg-[#7E37F9] px-2 py-1 rounded"
                        >
                            저장
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(false);
                                setTitle(record.title);
                            }}
                            className="text-xs text-gray-500 px-2 py-1"
                        >
                            취소
                        </button>
                    </div>
                ) : (
                    <>
                        <h3 className="font-semibold text-gray-800">{record.title}</h3>
                        <p className="text-sm text-gray-500">{record.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                            {new Date(record.created_at).toLocaleString("ko-KR")}
                        </p>
                    </>
                )}
            </div>

            {/* === 오른쪽 액션 === */}
            {hovered && (
                <div className="flex items-center gap-2 relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
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
                                    await apiClient.patch(`/boards/${record.id}/move`, { folder_id: folder.id });
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
                            e.stopPropagation();
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
                            onDelete={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleDelete();
                            }}
                            onRename={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setShowMenuDropdown(false);
                                setIsEditing(true);
                            }}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
