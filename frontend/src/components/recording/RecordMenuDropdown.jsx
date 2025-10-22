import { useEffect, useRef } from "react";

export default function RecordMenuDropdown({ onClose, onDelete, onRename }) {
    const ref = useRef();

    // 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onClose();
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    return (
        <div
            ref={ref}
            className="absolute right-0 top-8 w-32 bg-white border border-gray-200 rounded-lg shadow-md z-50 .animate-dropdown"
        >
            <button
                onClick={() => {
                    onRename();
                    onClose();
                }}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            >
                이름 변경
            </button>
            <button
                onClick={() => {
                    onDelete();
                    onClose();
                }}
                className="block w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-gray-50"
            >
                기록 삭제
            </button>
        </div>
    );
}
