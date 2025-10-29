import React from "react";
import FolderDropdown from "./FolderDropdown";

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
  return (
    <div className="flex flex-col mb-3">
      {/* 제목 + 폴더 버튼 */}
      <div className="flex items-center justify-between mb-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-xl font-semibold border-none focus:ring-0 outline-none flex-1 min-w-0"
          placeholder="회의 제목을 입력하세요"
        />
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

      {/* 날짜 */}
      <p className="text-xs text-gray-400">{dateStr}</p>
    </div>
  );
}
