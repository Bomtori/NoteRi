import { useEffect, useRef } from "react";

export default function FolderDropdown({ folders = [], currentFolder, onSelect }) {
    const ref = useRef();

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
                        {folder.name}
                    </button>
                ))
            )}
        </div>
    );
}
