import { useSelector, useDispatch } from "react-redux";
import {
    fetchFolders,
    addFolderAsync,
    renameFolderAsync,
    deleteFolderAsync,
} from "../../features/folder/folderSlice";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useToast } from "../../hooks/useToast";
import Toast from "../common/Toast";
import apiClient from "../../api/apiClient";
import { API_BASE_URL } from "../../config";
import { Folder, FileText, Mic, Star } from "lucide-react"; // 추가
import { Palette } from "lucide-react";
import { updateFolderColorAsync } from "../../features/folder/folderSlice";

// color값에 따라 아이콘 매핑
const colorToIcon = {
    "#7E36F9": <Mic className="w-4 h-4 text-[#7E36F9]" />, // 보라 → 마이크
    "#FFD700": <Star className="w-4 h-4 text-yellow-400" />, // 금색 → 즐겨찾기
    "#3B82F6": <FileText className="w-4 h-4 text-blue-500" />, // 파랑 → 문서
    "#4ADE80": <Folder className="w-4 h-4 text-green-500" />, // 초록 → 폴더
};

export default function SideNav() {
    const dispatch = useDispatch();
    const { folders, status } = useSelector((state) => state.folder);
    const { message, showToast, clearToast } = useToast();

    const [isAdding, setIsAdding] = useState(false);
    const [newFolder, setNewFolder] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [tempName, setTempName] = useState("");
    const [user, setUser] = useState(null);

    const colorOptions = ["#7E36F9", "#FFD700", "#3B82F6", "#4ADE80", "#EF4444", "#A855F7"];
    const [colorPickerId, setColorPickerId] = useState(null);

    // ✅ 폴더 목록 불러오기
    useEffect(() => {
        dispatch(fetchFolders());
    }, [dispatch]);

    // ✅ 로그인된 유저 정보
    useEffect(() => {
        async function fetchUser() {
            try {
                const res = await apiClient.get(`${API_BASE_URL}/users/me`, {
                    withCredentials: true,
                });
                setUser(res.data);
            } catch (err) {
                console.error("유저 정보 로드 실패:", err);
                setUser(null);
            }
        }
        fetchUser();
    }, []);

    // ✅ 새 폴더 추가
    const handleAddFolder = async () => {
        const trimmed = newFolder.trim();
        if (!trimmed) {
            showToast("폴더 이름을 입력해주세요.");
            return;
        }
        const isDuplicate = folders.some((f) => f.name === trimmed);
        if (isDuplicate) {
            showToast("이미 존재하는 폴더입니다.");
            return;
        }

        try {
            await dispatch(addFolderAsync(trimmed)).unwrap();
            showToast("폴더가 추가되었습니다.");
        } catch {
            showToast("서버 오류로 폴더를 추가할 수 없습니다.");
        } finally {
            setNewFolder("");
            setIsAdding(false);
        }
    };

    // ✅ 폴더 이름 변경
    const handleRename = async (id) => {
        const trimmed = tempName.trim();
        if (!trimmed) {
            showToast("폴더 이름을 입력해주세요.");
            return;
        }

        const isDuplicate = folders.some(
            (f) => f.name === trimmed && f.id !== id
        );
        if (isDuplicate) {
            showToast("이미 존재하는 폴더입니다.");
            return;
        }

        try {
            await dispatch(renameFolderAsync({ id, name: trimmed })).unwrap();
            showToast("폴더 이름이 변경되었습니다.");
        } catch {
            showToast("서버 오류로 이름을 변경할 수 없습니다.");
        } finally {
            setEditingId(null);
        }
    };

    // ✅ 폴더 삭제
    const handleDelete = async (id) => {
        const folder = folders.find((f) => f.id === id);
        if (!folder) return;

        if (window.confirm(`"${folder.name}" 폴더를 삭제하시겠습니까?`)) {
            try {
                await dispatch(deleteFolderAsync(id)).unwrap();
                showToast(`"${folder.name}" 폴더가 삭제되었습니다.`);
            } catch {
                showToast("폴더 삭제에 실패했습니다.");
            }
        }
    };

    return (
        <aside className="w-64 h-screen bg-white border-r border-gray-200 flex flex-col">
            {/* ✅ 상단 : 로고 + 버튼 (고정) */}
            <div className="flex-shrink-0">
                {/* 로고 */}
                <div className="p-5 border-b border-gray-200 flex items-center justify-start">
                    <Link to="/" className="flex items-center gap-2 group">
                        <img
                            src="/assets/NoteRi-Logo.svg"
                            alt="NoteRi Logo"
                            className="w-7 h-7 object-contain group-hover:scale-110 transition-transform duration-300"
                        />
                        <span className="text-lg font-bold text-[#7E37F9] group-hover:text-[#682be0] transition-colors">
                    NoteR<span className="text-black">i</span>
                </span>
                    </Link>
                </div>

                {/* 녹음 관련 버튼 */}
                <div className="px-5 py-4 border-b border-gray-200 flex flex-col gap-2">
                    <Link
                        to="/record"
                        className="text-sm font-medium text-gray-700 hover:text-[#7E37F9] flex items-center gap-2"
                    >
                        🎧 모든 녹음 보기
                    </Link>
                    <Link
                        to="/new"
                        className="text-sm font-medium text-gray-700 hover:text-[#7E37F9] flex items-center gap-2"
                    >
                        ➕ 새 녹음 시작
                    </Link>
                </div>
            </div>

            {/* ✅ 가운데 : 폴더 리스트 (남은 영역 채우고, 스크롤 되지만 스크롤바 숨김) */}
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
                {/* no-scrollbar 클래스 추가 ✅ */}
                <div className="p-5 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-800">폴더</h2>
                    {!isAdding ? (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="text-[#7E37F9] text-sm font-medium hover:text-[#682be0]"
                        >
                            + 새 폴더
                        </button>
                    ) : (
                        <div className="flex gap-2 items-center">
                            <input
                                type="text"
                                value={newFolder}
                                onChange={(e) => setNewFolder(e.target.value)}
                                className="border rounded px-2 py-1 text-sm w-28 focus:outline-none focus:border-[#7E37F9]"
                                placeholder="폴더 이름"
                            />
                            <button
                                onClick={handleAddFolder}
                                className="text-[#7E37F9] text-sm font-semibold"
                            >
                                저장
                            </button>
                            <button
                                onClick={() => {
                                    setIsAdding(false);
                                    setNewFolder("");
                                }}
                                className="text-gray-400 text-sm"
                            >
                                취소
                            </button>
                        </div>
                    )}
                </div>

                {/* 폴더 리스트 */}
                <div className="p-3">
                    {status === "loading" ? (
                        <p className="text-sm text-gray-400 mt-4 text-center">불러오는 중...</p>
                    ) : folders.length === 0 ? (
                        <p className="text-sm text-gray-400 mt-4 text-center">폴더가 없습니다.</p>
                    ) : (
                        folders.map((folder) => (
                            <div
                                key={folder.id}
                                className="group flex items-center justify-between py-2 px-3 rounded-md hover:bg-gray-100"
                            >
                                {editingId === folder.id ? (
                                    <input
                                        type="text"
                                        value={tempName}
                                        onChange={(e) => setTempName(e.target.value)}
                                        onBlur={() => handleRename(folder.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleRename(folder.id);
                                            if (e.key === "Escape") setEditingId(null);
                                        }}
                                        className="border-b border-[#7E37F9] bg-transparent w-full text-sm text-gray-800 focus:outline-none"
                                        autoFocus
                                    />
                                ) : (
                                    <Link
                                        to={`/folder/${folder.id}`}
                                        className="flex items-center gap-2 text-sm text-gray-800 truncate hover:text-[#7E37F9]"
                                    >
                                        <Folder
                                            className="w-4 h-4"
                                            style={{ color: folder.color || "#6B7280" }}
                                        />
                                        <span>{folder.name}</span>
                                    </Link>
                                )}

                                {/* 색상 변경/수정/삭제 버튼 */}
                                <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                                    <button
                                        onClick={() => {
                                            setEditingId(folder.id);
                                            setTempName(folder.name);
                                        }}
                                        className="text-gray-400 hover:text-[#7E37F9] text-xs"
                                    >
                                        수정
                                    </button>
                                    <button
                                        onClick={() => handleDelete(folder.id)}
                                        className="text-gray-400 hover:text-red-500 text-xs"
                                    >
                                        삭제
                                    </button>
                                    <div className="relative overflow-visible">
                                        <Palette
                                            className="w-3.5 h-3.5 text-gray-400 hover:text-[#7E37F9] cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setColorPickerId(folder.id);
                                            }}
                                        />
                                        {colorPickerId === folder.id && (
                                            <div className="absolute right-0 top-5 bg-white border border-gray-200 shadow-md rounded-md p-2 flex gap-1 z-[9999] overflow-visible">
                                                {colorOptions.map((color) => (
                                                    <button
                                                        key={color}
                                                        onClick={async () => {
                                                            await dispatch(
                                                                updateFolderColorAsync({
                                                                    id: folder.id,
                                                                    color,
                                                                })
                                                            );
                                                            setColorPickerId(null);
                                                            showToast("색상이 변경되었습니다.");
                                                        }}
                                                        className="w-5 h-5 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ✅ 하단 : 유저 정보 (고정) */}
            <div className="flex-shrink-0 p-4 border-t border-gray-200">
                <Link
                    to={user ? "/user" : "/login"}
                    className="flex items-center gap-3 group transition-colors hover:text-[#7E37F9]"
                >
                    <img
                        src={user?.picture || "https://via.placeholder.com/32"}
                        alt="user profile"
                        className="w-8 h-8 rounded-full object-cover border border-gray-200 group-hover:border-[#7E37F9] transition"
                    />
                    <div className="flex flex-col text-xs leading-tight">
                <span className="font-medium text-gray-700 group-hover:text-[#7E37F9]">
                    {user?.nickname || user?.name || "로그인 필요"}
                </span>
                        <span className="text-gray-400">
                    {user ? "마이페이지" : "로그인 페이지"}
                </span>
                    </div>
                </Link>
            </div>
        </aside>

    );
}
