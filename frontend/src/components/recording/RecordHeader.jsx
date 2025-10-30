import React, { useEffect, useState } from "react";
import FolderDropdown from "./FolderDropdown";
import { useDispatch } from "react-redux";
import apiClient from "../../api/apiClient";
import { updateRecord } from "../../features/record/recordSlice";

export default function RecordHeader({
                                         title,
                                         setTitle,
                                         dateStr,
                                         boardId,
                                         folders,
                                         showDropdown,
                                         setShowDropdown,
                                         onSelectFolder,
                                     }) {
    const dispatch = useDispatch();
    const [saveStatus, setSaveStatus] = useState("idle");

    // 🔹 제목 자동 저장 로직
    useEffect(() => {
        // console.log("🔹 [자동저장 트리거]", { title, boardId });
        if (!boardId) return; // 새 회의 전엔 무시

        const timeout = setTimeout(async () => {
            try {
                const res = await apiClient.patch(`/boards/${boardId}`, { title });
                dispatch(updateRecord(res.data));
                setSaveStatus("saved");
                setTimeout(() => setSaveStatus("idle"), 2000);
                console.log("🔹 제목 자동 저장 완료:", title);
            } catch (err) {
                console.error("🔹 제목 저장 실패:", err);
            }
        }, 800);

        return () => clearTimeout(timeout);
    }, [title, boardId, dispatch]);

    return (
        <div className="flex flex-col mb-3">
            {/* 🔹 제목 + 폴더 버튼 */}
            <div className="flex items-center justify-between mb-2">
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-xl font-semibold border-none focus:ring-0 outline-none flex-1 min-w-0"
                    placeholder="회의 제목을 입력하세요"
                />
                {saveStatus === "saved" && (
                    <span className="text-green-500 text-xs ml-2">✓ 저장 완료</span>
                )}

                <div className="relative ml-3">
                    <button
                        disabled={!boardId}
                        onClick={() => setShowDropdown((p) => !p)}
                        className={`text-xs px-3 py-1 rounded-md whitespace-nowrap ${
                            boardId
                                ? "text-[#7E37F9] bg-[#f5f2fb] hover:bg-[#ece3ff]"
                                : "text-gray-300 bg-gray-100 cursor-not-allowed"
                        }`}
                    >
                        폴더에 넣기
                    </button>

                    {showDropdown && (
                        <FolderDropdown
                            folders={folders}
                            currentFolder={null}
                            onSelect={onSelectFolder}
                        />
                    )}
                </div>
            </div>

            {/* 🔹 날짜 */}
            <p className="text-xs text-gray-400">{dateStr}</p>
        </div>
    );
}
