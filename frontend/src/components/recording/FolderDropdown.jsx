import { useEffect, useRef } from "react";
import { Folder, FileText, Mic, Star } from "lucide-react"; // lucide-react 아이콘셋

const colorToIcon = {
    "#7E36F9": <Mic className="w-4 h-4 text-[#7E36F9]" />, // 보라 → 마이크
    "#FFD700": <Star className="w-4 h-4 text-yellow-400" />, // 금색 → 즐겨찾기
    "#3B82F6": <FileText className="w-4 h-4 text-blue-500" />, // 파랑 → 문서
    "#4ADE80": <Folder className="w-4 h-4 text-green-500" />, // 초록 → 일반 폴더
};

export default function FolderDropdown({ folders = [], currentFolder, onSelect }) {
    const ref = useRef();
    // color값에 따라 아이콘 매핑 (기존 color 필드를 재활용)


    // 🔒 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onSelect(null);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onSelect]);

    return (
        <div
            ref={ref}
            className="absolute right-8 top-8 w-44 bg-white border border-gray-200 rounded-lg shadow-md .animate-dropdown z-50"
        >
            {folders.length === 0 ? (
                <p className="text-xs text-gray-400 p-3">폴더 없음</p>
            ) : (
                folders.map((folder) => (
                    <button
                        key={folder.id}
                        onClick={() => onSelect(folder)}
                        className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                            currentFolder?.id === folder.id ? "text-[#7E37F9] font-medium" : ""
                        }`}
                    >
                        {/* ✅ color 기반 아이콘 표시 */}
                        {colorToIcon[folder.color] || (
                            <Folder className="w-4 h-4 text-gray-400" />
                        )}
                        <span>{folder.name}</span>
                    </button>
                ))
            )}
        </div>
    );
}
