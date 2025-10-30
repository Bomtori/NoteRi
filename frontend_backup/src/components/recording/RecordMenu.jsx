import { useState, useRef, useEffect } from "react";
import { useSelector } from "react-redux";

export default function RecordMenu({ onEdit, onDelete, onFolderChange }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [folderOpen, setFolderOpen] = useState(false);

    const menuRef = useRef(null);
    const folderRef = useRef(null);

    // ✅ Redux에서 폴더 목록 가져오기
    const { folders } = useSelector((state) => state.folder);

    // 🔒 메뉴 바깥 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target) &&
                folderRef.current &&
                !folderRef.current.contains(e.target)
            ) {
                setMenuOpen(false);
                setFolderOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="flex items-center gap-2 relative">
            {/* 📁 폴더 변경 드롭다운 */}
            <div className="relative" ref={folderRef}>
                <button
                    onClick={() => {
                        setFolderOpen((p) => !p);
                        setMenuOpen(false);
                    }}
                    className="px-3 py-1.5 text-sm bg-gray-100 rounded-md hover:bg-gray-200 transition flex items-center gap-1"
                >
                    📁  ▾
                </button>

                {folderOpen && (
                    <div className="absolute mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-50 animate-fadeInSmooth">
                        {folders.length > 0 ? (
                            folders.map((f) => (
                                <button
                                    key={f.id}
                                    onClick={() => {
                                        onFolderChange(f.name);
                                        setFolderOpen(false);
                                    }}
                                    className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100"
                                >
                                    <span className="text-[#7E37F9]">📁</span> {f.name}
                                </button>
                            ))
                        ) : (
                            <p className="text-xs text-gray-400 px-4 py-2 italic">
                                폴더가 없습니다
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* ⋮ 점세개 메뉴 */}
            <div className="relative" ref={menuRef}>
                <button
                    onClick={() => {
                        setMenuOpen((p) => !p);
                        setFolderOpen(false);
                    }}
                    className="px-2 py-1 text-gray-500 hover:text-gray-700"
                >
                    ⋮
                </button>

                {menuOpen && (
                    <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50 animate-fadeInSmooth">
                        <button
                            onClick={() => {
                                onEdit();
                                setMenuOpen(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                        >
                            회의 이름 수정
                        </button>
                        <button
                            onClick={() => {
                                onDelete();
                                setMenuOpen(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100"
                        >
                            회의 삭제
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
