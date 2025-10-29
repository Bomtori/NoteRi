import { useEffect, useRef, useState } from "react";

export default function RecordMenuDropdown({ onClose, onDelete, onRename }) {
    const ref = useRef();
    const [position, setPosition] = useState({ top: 0, left: 0 });

    // 컴포넌트 렌더 후 위치 계산
    useEffect(() => {
        const rect = ref.current?.parentElement?.getBoundingClientRect();
        if (rect) setPosition({ top: rect.bottom + 4, left: rect.right - 130 }); // 위치 조정
    }, []);

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
            style={{
                position: "fixed",
                top: position.top,
                left: position.left,
            }}
            className="w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] animate-dropdown"
        >
            <button
                onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onRename(e);  // ✅ e 전달
                        onClose();
                    }}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            >
                이름 변경
            </button>
            <button
                onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onDelete(e);  // ✅ e 전달
                        onClose();
                    }}
                className="block w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-gray-50"
            >
                기록 삭제
            </button>
        </div>
    );
}
