import { useSelector, useDispatch } from "react-redux";
import {
    addFolder,
    renameFolder,
    deleteFolder,
} from "../../features/folder/folderSlice";
import { Link,useNavigate } from "react-router-dom";
import { useState } from "react";
import Toast from "../common/Toast";
import { useToast } from "../../hooks/useToast";

export default function SideNav() {
    const { folders } = useSelector((state) => state.folder);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const [newFolder, setNewFolder] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [tempName, setTempName] = useState("");

    // 실패 메시지 상태
    const { message, showToast, clearToast } = useToast();


    const handleAddFolder = () => {
        const trimmed = newFolder.trim();

        if (trimmed === "") {
            showToast("폴더 이름을 입력해주세요.");
            return;
        }

        // ✅ 중복 체크 변수 정의
        const isDuplicate = folders.some((f) => f.name === trimmed);
        if (isDuplicate) {
            showToast("이미 존재하는 폴더입니다.");
            return;
        }

        // ✅ 성공 시에는 알림 없이 추가
        dispatch(addFolder(trimmed));
        setNewFolder("");
        setIsAdding(false);
    };

    const handleRename = (id) => {
        const trimmed = tempName.trim();
        if (trimmed === "") {
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

        dispatch(renameFolder({ id, name: trimmed }));
        setEditingId(null);
    };

    const handleDelete = (id) => {
        const folder = folders.find((f) => f.id === id);
        if (!folder) return;
        if (window.confirm(`"${folder.name}" 폴더를 삭제하시겠습니까?`)) {
            dispatch(deleteFolder(id)); // recordSlice에서도 감지됨!
            showToast(`"${folder.name}" 폴더와 그 안의 회의록이 삭제되었습니다.`);
        }
    };


    return (
        <aside className="w-64 bg-white border-r h-screen flex flex-col justify-between p-6 relative">
            <div>
                <h1
                    className="text-lg font-semibold mb-8 cursor-pointer"
                    onClick={() => navigate("/")}
                >
                    로그 NOTERI
                </h1>

                {/* 기본 메뉴 */}
                <nav className="flex flex-col gap-3">
                    <button
                        onClick={() => navigate("/")}
                        className="px-4 py-2 rounded-md bg-[#7e37f9] text-white text-sm font-medium"
                    >
                        모든 녹음
                    </button>

                    <button
                        onClick={() => navigate("/new")}
                        className="px-4 py-2 rounded-md hover:bg-gray-100 text-sm"
                    >
                        새 녹음
                    </button>
                </nav>

                {/* 폴더 섹션 */}
                <div className="mt-8">
                    <p className="text-xs text-gray-500 mb-2">폴더</p>
                    <ul className="flex flex-col gap-1">
                        {folders.map((f) => (
                            <li
                                key={f.id}
                                className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                            >
                                {editingId === f.id ? (
                                    <div className="flex items-center gap-1 flex-1">
                                        <input
                                            type="text"
                                            value={tempName}
                                            onChange={(e) => setTempName(e.target.value)}
                                            className="border rounded-md px-2 py-1 text-xs flex-1"
                                            autoFocus
                                        />
                                        <button
                                            onClick={() => handleRename(f.id)}
                                            className="text-[#7E37F9] text-xs font-semibold"
                                        >
                                            저장
                                        </button>
                                    </div>
                                ) : (
                                    <>
                    <span
                        className="flex-1 cursor-pointer"
                        onClick={() => navigate(`/folder/${f.id}`)}
                    >
                      {f.name}
                    </span>
                                        <div className="relative group">
                                            <button className="text-gray-400 hover:text-gray-600">
                                                ⋮
                                            </button>

                                            {/* 드롭다운 메뉴 */}
                                            <div className="absolute right-0 mt-1 hidden group-hover:block bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-28">
                                                <button
                                                    onClick={() => {
                                                        setEditingId(f.id);
                                                        setTempName(f.name);
                                                    }}
                                                    className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-100"
                                                >
                                                    이름 수정
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(f.id)}
                                                    className="block w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-gray-100"
                                                >
                                                    폴더 삭제
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>

                    {isAdding ? (
                        <div className="mt-3 flex items-center gap-1">
                            <input
                                type="text"
                                value={newFolder}
                                onChange={(e) => setNewFolder(e.target.value)}
                                placeholder="새 폴더 이름"
                                className="border rounded-md px-2 py-1 text-xs flex-1"
                            />
                            <button
                                onClick={handleAddFolder}
                                className="text-[#7e37f9] text-xs font-semibold"
                            >
                                추가
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="mt-3 text-xs text-[#7e37f9] hover:underline"
                        >
                            + 새 폴더 추가
                        </button>
                    )}
                </div>
            </div>

            {/* 유저 정보 */}
            <Link
                to="/user"
                className="flex items-center gap-3 border-t pt-3 mt-4 group transition-colors hover:text-[#7E37F9]"
            >
                {/* 프로필 이미지 (임시 기본 이미지 or 사용자 이미지로 대체 가능) */}
                <img
                    src="https://via.placeholder.com/32"
                    alt="user profile"
                    className="w-8 h-8 rounded-full object-cover border border-gray-200 group-hover:border-[#7E37F9] transition"
                />

                <div className="flex flex-col text-xs leading-tight">
    <span className="font-medium text-gray-700 group-hover:text-[#7E37F9]">
      유저 이름
    </span>
                    <span className="text-gray-400">마이페이지</span>
                </div>
            </Link>



            {/* 실패 알림 */}
            <Toast message={message} onClose={clearToast} />
        </aside>
    );
}
