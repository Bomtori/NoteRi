import { useEffect, useRef } from "react";
import { Folder, FileText, Mic, Star } from "lucide-react";



export default function FolderDropdown({ folders = [], currentFolder, onSelect }) {
    const ref = useRef();
    const safeFolders = Array.isArray(folders) ? folders : [];
    const safeCurrent = currentFolder ?? { id: null };


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
            className="absolute left-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-md z-50"
        >
            {folders.length === 0 ? (
                <p className="text-xs text-gray-400 p-3">폴더 없음</p>
            ) : (
                folders.map((folder) => (
                    <button
                        key={folder.id}
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect(folder);
                        }}
                        className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-50 ${
                            safeCurrent.id === folder.id
                                ? "text-[#7E37F9] font-semibold"
                                : ""
                        }`}
                    >
                        {/* 🎨 폴더 아이콘 */}
                        <Folder
                            className="w-4 h-4"
                            style={{
                                color: currentFolder?.id === folder.id
                                ? "#7E37F9"
                                : folder.color || "#6B7280"
                            }}
                            />
                        {/* 폴더 이름 */}
                        <span>{folder.name}</span>
                    </button>
                ))
            )}

        </div>
    );
}
