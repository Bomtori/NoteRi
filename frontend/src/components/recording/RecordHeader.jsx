import React, { useState, useEffect, useRef } from "react";
import FolderDropdown from "./FolderDropdown";
import apiClient from "../../api/apiClient";
import { useDispatch } from "react-redux";
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
  currentFolder,
  onDeleteBoard,
}) {
  const dispatch = useDispatch();
  const [saveStatus, setSaveStatus] = useState("idle");
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  // 🔥 외부 클릭 감지용 ref
  const folderRef = useRef(null);
  const optionsRef = useRef(null);

  // -----------------------------
  // 🔥 외부 클릭 → 드롭다운/옵션메뉴 닫기
  // -----------------------------
  useEffect(() => {
    function handleClickOutside(e) {
      if (folderRef.current && !folderRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (optionsRef.current && !optionsRef.current.contains(e.target)) {
        setShowOptionsMenu(false);
      }
    }

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // -----------------------------
  // 🔥 제목 자동 저장
  // -----------------------------
  useEffect(() => {
    if (!boardId) return;

    const timeout = setTimeout(async () => {
      try {
        const res = await apiClient.patch(`/boards/${boardId}`, { title });
        dispatch(updateRecord(res.data));
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.error("제목 저장 실패:", err);
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [title, boardId, dispatch]);

  const handleFolderSelect = (folder) => {
    onSelectFolder(folder);
    setShowDropdown(false);
  };

  return (
    <div className="relative flex items-center justify-between mb-4">
      {/* ----------------------------- */}
      {/* 왼쪽 : 제목 input */}
      {/* ----------------------------- */}
      <div className="flex-1 mr-4 relative">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="회의 제목"
          spellCheck={false}
          className="w-full text-lg font-semibold bg-transparent outline-none border-b border-gray-200 focus:border-[#7E37F9] transition"
        />

        {saveStatus === "saved" && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 text-green-500 text-xs">
            ✓ 저장됨
          </span>
        )}

        <p className="text-xs text-gray-400 mt-1">{dateStr}</p>
      </div>

      {/* ----------------------------- */}
      {/* 오른쪽 : 폴더 + 옵션 메뉴 */}
      {/* ----------------------------- */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {/* 📁 폴더 메뉴 */}
        <div className="relative inline-block" ref={folderRef}>
          <button
            disabled={!boardId}
            onClick={() => setShowDropdown((v) => !v)}
            className={`text-xs px-3 py-1 rounded-md whitespace-nowrap ${
              boardId
                ? "text-[#7E37F9] bg-[#f5f2fb] hover:bg-[#ece3ff]"
                : "text-gray-300 bg-gray-100 cursor-not-allowed"
            }`}
          >
            {currentFolder ? `📂 ${currentFolder.name}` : "폴더"}
          </button>

          {showDropdown && (
            <div className="absolute top-full right-0 mt-2 z-[9999]">
              <FolderDropdown
                folders={folders}
                currentFolder={currentFolder}
                onSelect={handleFolderSelect}
              />
            </div>
          )}
        </div>

        {/* ⋯ 옵션 메뉴 */}
        <div className="relative" ref={optionsRef}>
          <button
            onClick={() => setShowOptionsMenu((v) => !v)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {showOptionsMenu && (
            <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-40 z-[9999]">
              <button
                onClick={() => {
                  setShowOptionsMenu(false);
                  onDeleteBoard && onDeleteBoard();
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                회의 삭제
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
