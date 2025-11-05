import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaLink, FaUserPlus, FaLock, FaUnlock, FaTimes, FaUsers } from "react-icons/fa";
import { useToast } from "../../hooks/useToast";
import apiClient from "../../api/apiClient";

export default function RecordShareModal({  isOpen,
                                             onClose,
                                             boardId = null,
                                             boardTitle = "",
                                             summaries = [],
                                             refinedScript = [],
                                             memo = null, }) {
    const ref = useRef(null);
    const [activeTab, setActiveTab] = useState("link");
    const [inviteEmail, setInviteEmail] = useState("");
    const [invited, setInvited] = useState([]);  // 로컬 추가만 (아직 저장 안됨)
    const [sharedUsers, setSharedUsers] = useState([]);  // 실제 공유된 사용자 목록
    const [pin, setPin] = useState("");
    const [hasPassword, setHasPassword] = useState(false);
    const { showToast } = useToast();
    const [selectedType, setSelectedType] = useState("");
    const baseUrl = `${window.location.origin}/record/${boardId || ""}`;
    const shareUrl = hasPassword ? `${baseUrl}?protected=true` : baseUrl;
    const [databases, setDatabases] = useState([]);
    const [selectedDB, setSelectedDB] = useState("");
    const [notionStatus, setNotionStatus] = useState({
        connected: false,
        workspace_name: null,
    });
    useEffect(() => {
        if (activeTab !== "notion") return;
        (async () => {
            try {
                const res = await apiClient.get("/notion/databases");
                setDatabases(res.data || []);
            } catch (err) {
                console.error("노션 DB 목록 불러오기 실패:", err);
                showToast("❌ 노션 DB 목록을 가져오지 못했습니다.");
            }
        })();
    }, [activeTab]);

    useEffect(() => {
        if (activeTab !== "notion") return;
        (async () => {
            try {
                const token = localStorage.getItem("access_token");
                if (!token) return;
                const res = await apiClient.get("/notion/status", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setNotionStatus(res.data);
            } catch (err) {
                console.error("노션 상태 확인 실패:", err);
                setNotionStatus({ connected: false });
            }
        })();
    }, [activeTab]);
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onClose();
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    // 비밀번호 상태 확인
    useEffect(() => {
        if (!boardId) return;
        (async () => {
            try {
                const res = await apiClient.get(`/boards/${boardId}`);
                if (res.data?.is_protected) setHasPassword(true);
            } catch (err) {
                console.warn("비밀번호 상태 확인 실패:", err);
            }
        })();
    }, [boardId]);

    // 공유된 사용자 목록 불러오기
    useEffect(() => {
        if (!boardId || activeTab !== "invite") return;

        (async () => {
            try {
                const res = await apiClient.get(`/boards/${boardId}/shares/members`);

                        const normalized = (res.data || []).map(u => ({
                        user_id: u.user_id,
                        user_name: u.nickname || u.user_name,
                        user_email: u.email || u.user_email,
                        user_picture: u.picture || u.user_picture,
                        role: u.role,
                    }));

                    setSharedUsers(normalized);
                // console.log("공유 중인 멤버 (정상화됨):", normalized);
            } catch (err) {
                console.warn("공유 목록 조회 실패:", err.data);
            }
        })();
    }, [boardId, activeTab, invited]);  // invited 변경 시에도 갱신

    // 비밀번호 설정
    const handleSetPassword = async () => {
        if (pin.length !== 4) {
            showToast("⚠️ 4자리 숫자를 입력해주세요.");
            return;
        }
        try {
            await apiClient.patch(`/boards/${boardId}`, { password: pin });
            setHasPassword(true);
            showToast("🔒 비밀번호가 설정되었습니다!");
        } catch (err) {
            console.error("비밀번호 설정 실패:", err);
            showToast("❌ 비밀번호 설정 중 오류가 발생했습니다.");
        }
    };

    // 비밀번호 해제
    const handleClearPassword = async () => {
        try {
            await apiClient.patch(`/boards/${boardId}`, { password: null });
            setHasPassword(false);
            setPin("");
            showToast("🔓 비밀번호가 제거되었습니다.");
        } catch (err) {
            console.error("비밀번호 제거 실패:", err);
            showToast("❌ 비밀번호 제거 중 오류가 발생했습니다.");
        }
    };

    // 초대 버튼
    const handleInvite = async () => {
        if (inviteEmail.trim() === "") {
            showToast("⚠️ 이메일을 입력해주세요!");
            return;
        }

        try {
            await apiClient.post(`/boards/${boardId}/shares`, {
                email: inviteEmail,
                role: "viewer",  // 기본값
            });

            setInvited((prev) => [...prev, inviteEmail]);
            setInviteEmail("");
            showToast("팀원에게 공유되었습니다!");
        } catch (err) {
            const status = err.response?.status;
            const detail = err.response?.data?.detail;

            if (status === 404) {
                showToast("❌ 존재하지 않는 사용자입니다.");
            } else if (status === 400) {
                showToast("⚠️ 이미 공유된 사용자입니다!");
            } else {
                showToast(`❌ ${detail || "공유 중 오류가 발생했습니다."}`);
            }
        }
    };

    // 권한 변경
    const handleChangeRole = async (targetUserId, newRole) => {
        try {
            await apiClient.patch(`/boards/${boardId}/shares/${targetUserId}`, {
                role: newRole
            });
            showToast(`권한이 ${newRole === 'editor' ? '편집' : '보기'}으로 변경되었습니다!`);

            // 목록 갱신
            const res = await apiClient.get(`/boards/${boardId}/shares`);
            setSharedUsers(res.data || []);
        } catch (err) {
            console.error("권한 변경 실패:", err);
            showToast("권한 변경 중 오류가 발생했습니다.");
        }
    };

    // 공유 해제
    const handleRemoveShare = async (targetUserId, userEmail) => {
        if (!confirm(`${userEmail}님과의 공유를 해제하시겠습니까?`)) return;

        try {
            await apiClient.delete(`/boards/${boardId}/shares/${targetUserId}`);
            showToast("공유가 해제되었습니다.");

            // 목록 갱신
            const res = await apiClient.get(`/boards/${boardId}/shares`);
            setSharedUsers(res.data || []);
        } catch (err) {
            console.error("공유 해제 실패:", err);
            showToast("공유 해제 중 오류가 발생했습니다.");
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    layout
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 40 }}
                    transition={{ type: "spring", stiffness: 250, damping: 25 }}
                    className="fixed bottom-[90px] left-1/2 -translate-x-1/2 z-[100]"
                >
                    <motion.div
                        ref={ref}
                        layout
                        transition={{ type: "spring", stiffness: 280, damping: 26 }}
                        className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] w-[400px] p-5 border border-gray-100 overflow-hidden"
                    >
                        {/* 탭 */}
                        <div className="relative flex bg-gray-100 rounded-full p-1 mb-5">
                            {["link", "invite", "notion"].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`relative z-10 flex items-center gap-1 px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                                        activeTab === tab
                                            ? "text-[#7E37F9]"
                                            : "text-gray-600 hover:text-gray-800"
                                    }`}
                                >
                                    {activeTab === tab && (
                                        <motion.div
                                            layoutId="active-share-pill"
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                            className="absolute inset-0 bg-white shadow-sm rounded-full"
                                        />
                                    )}
                                    <span className="relative z-10 flex items-center gap-1">
                                        {tab === "link" ? <FaLink /> : <FaUserPlus />}
                                        {tab === "link" ? "링크 공유" : tab === "invite"
                                            ? "팀원 초대"
                                            : "노션 공유"}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* 탭 콘텐츠 */}
                        <motion.div layout>
                            <AnimatePresence mode="wait">
                                {activeTab === "link" ? (
                                    <motion.div
                                        key="link"
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.25, ease: "easeInOut" }}
                                        className="space-y-4"
                                    >
                                        <p className="text-sm text-gray-600">
                                            아래 링크를 복사하거나 비밀번호를 설정하여 게스트 접근을 제어하세요.
                                        </p>

                                        {/* 링크 복사 */}
                                        <div className="flex items-center bg-gray-50 border rounded-lg px-3 py-2 justify-between">
                                            <span className="text-xs text-gray-500 truncate max-w-[250px]">
                                                {shareUrl}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(shareUrl);
                                                    showToast("🔗 링크가 복사되었습니다!");
                                                }}
                                                className="text-xs px-3 py-1 bg-[#7E37F9] text-white rounded-lg hover:bg-[#692ed9] transition"
                                            >
                                                복사
                                            </button>
                                        </div>

                                        {/* 비밀번호 설정/해제 */}
                                        <div className="mt-4 border-t pt-4">
                                            <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                                {hasPassword ? <FaLock /> : <FaUnlock />}
                                                비밀번호 보호
                                            </p>
                                            {hasPassword ? (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-gray-600">현재 보호 중</span>
                                                    <button
                                                        onClick={handleClearPassword}
                                                        className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                                    >
                                                        해제
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        value={pin}
                                                        onChange={(e) =>
                                                            setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                                                        }
                                                        maxLength={4}
                                                        placeholder="4자리 숫자"
                                                        className="flex-1 border rounded-lg px-3 py-2 text-sm text-center focus:outline-[#7E37F9]"
                                                    />
                                                    <button
                                                        onClick={handleSetPassword}
                                                        disabled={pin.length !== 4}
                                                        className="text-xs px-3 py-1 bg-[#7E37F9] text-white rounded-lg hover:bg-[#692ed9] disabled:bg-gray-300"
                                                    >
                                                        설정
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ) : activeTab === "invite" ? (
                                    <motion.div
                                        key="invite"
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.25, ease: "easeInOut" }}
                                        className="space-y-3"
                                        >
                                        <p className="text-sm text-gray-600">초대할 팀원의 이메일을 입력하세요.</p>

                                        {/* 이메일 입력 */}
                                        <div className="flex items-center gap-2">
                                            <input
                                                value={inviteEmail}
                                                onChange={(e) => setInviteEmail(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        handleInvite();
                                                    }
                                                }}
                                                placeholder="예: teammate@noteri.com"
                                                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-[#7E37F9]"
                                            />
                                            <button
                                                onClick={handleInvite}
                                                className="px-3 py-2 bg-[#7E37F9] text-white rounded-lg hover:bg-[#692ed9] text-sm transition"
                                            >
                                                추가
                                            </button>
                                        </div>

                                        {/* 공유 중인 멤버 목록 */}
                                        <div className="mt-4 border-t pt-4">
                                            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                                <FaUsers />
                                                공유 중인 팀원 ({sharedUsers.length})
                                            </h3>

                                            {sharedUsers.length === 0 ? (
                                                <p className="text-xs text-gray-400 text-center py-3">
                                                    아직 공유한 팀원이 없습니다.
                                                </p>
                                            ) : (
                                                <ul className="space-y-2 max-h-[200px] overflow-y-auto">
                                                    {sharedUsers.map((share) => (
                                                        <li key={share.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                                                            <div className="flex items-center gap-2">
                                                                <img
                                                                    src={share.user_picture || '/default-avatar.png'}
                                                                    alt={share.user_name}
                                                                    className="w-8 h-8 rounded-full"
                                                                />
                                                                <div>
                                                                    <p className="text-sm font-medium">{share.user_name}</p>
                                                                    <p className="text-xs text-gray-500">{share.user_email}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <select
                                                                    value={share.role}
                                                                    onChange={(e) => handleChangeRole(share.user_id, e.target.value)}
                                                                    className="text-xs border rounded px-2 py-1"
                                                                >
                                                                    <option value="viewer">보기</option>
                                                                    <option value="editor">편집</option>
                                                                </select>
                                                                <button
                                                                    onClick={() => handleRemoveShare(share.user_id, share.user_email)}
                                                                    className="text-red-500 hover:text-red-700"
                                                                >
                                                                    <FaTimes size={12} />
                                                                </button>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </motion.div>
                                ): (
                                    // 노션 공유 탭
                                    <motion.div
                                        key="notion"
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.25, ease: "easeInOut" }}
                                        className="space-y-4"
                                    >
                                        <p className="text-sm text-gray-600">
                                            노션 계정을 연동하고 회의록을 업로드하세요.
                                        </p>
                                        <div className="flex items-center justify-between bg-gray-50 border rounded-lg px-3 py-2">
                                            {notionStatus.connected ? (
                                                <span className="text-sm text-green-600">
      {notionStatus.workspace_name || "노션 계정"}과 연결됨
    </span>
                                            ) : (
                                                <span className="text-sm text-gray-500">
      ❌ 노션이 연결되어 있지 않습니다.
    </span>
                                            )}
                                            <button
                                                onClick={async () => {
                                                    const token = localStorage.getItem("access_token");
                                                    if (!token) return showToast("로그인이 필요합니다.");

                                                    try {
                                                        const res = await apiClient.get("/notion/status", {
                                                            headers: { Authorization: `Bearer ${token}` },
                                                        });

                                                        if (res.data.connected) {
                                                            showToast(`${res.data.workspace_name}과 연결되어 있습니다.`);
                                                        } else {
                                                            const loginRes = await apiClient.get("/notion/login", {
                                                                headers: { Authorization: `Bearer ${token}` },
                                                            });
                                                            if (loginRes.data.url) window.location.href = loginRes.data.url;
                                                        }
                                                    } catch (err) {
                                                        console.error("노션 연결 실패:", err);
                                                        showToast("❌ 노션 연동 중 오류가 발생했습니다.");
                                                    }
                                                }}
                                                className={`px-3 py-1 text-xs rounded-lg ${
                                                    notionStatus.connected
                                                        ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                                        : "bg-[#7E37F9] text-white hover:bg-[#692ed9]"
                                                }`}
                                            >
                                                {notionStatus.connected ? "연결 확인" : "계정 연결"}
                                            </button>
                                        </div>

                                        {/* 노션으로 내보내기 */}
                                        <div className="border-t mt-6 pt-4">
                                            <p className="text-sm font-medium text-gray-700 mb-3">
                                                이 회의록을 노션으로 공유하기
                                            </p>

                                            {/* 라디오 선택 */}
                                            <div className="flex gap-4 mb-3">
                                                {["회의기록", "스크립트", "전체요약"].map((opt) => (
                                                    <label key={opt} className="flex items-center gap-2 text-sm text-gray-600">
                                                        <input
                                                            type="radio"
                                                            name="notionType"
                                                            value={opt}
                                                            checked={selectedType === opt}
                                                            onChange={(e) => setSelectedType(e.target.value)}
                                                            className="accent-[#7E37F9]"
                                                        />
                                                        {opt}
                                                    </label>
                                                ))}
                                            </div>
                                            <div className="mt-4">
                                                <p className="text-sm font-medium text-gray-700 mb-2">
                                                    업로드할 노션 데이터베이스 선택
                                                </p>
                                                <select
                                                    value={selectedDB}
                                                    onChange={(e) => setSelectedDB(e.target.value)}
                                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-[#7E37F9]"
                                                >
                                                    <option value="">-- 데이터베이스 선택 --</option>
                                                    {databases.map((db) => (
                                                        <option key={db.id} value={db.id}>
                                                            {db.title}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        if (!selectedType) {
                                                            showToast("⚠️ 공유할 항목을 선택해주세요.");
                                                            return;
                                                        }
                                                        if (!selectedDB) {
                                                            showToast("⚠️ 업로드할 노션 DB를 선택해주세요.");
                                                            return;
                                                        }

                                                        // 선택한 항목에 따라 content 생성
                                                        let content = "";
                                                        if (selectedType === "회의기록") {
                                                            content = summaries
                                                                .map((s, i) => `${i + 1}. ${s.paragraph}\n요약: ${s.summary}\n`)
                                                                .join("\n");
                                                        } else if (selectedType === "스크립트") {
                                                            content = refinedScript
                                                                .map((s) => `[${s.speaker_label}] ${s.text}`)
                                                                .join("\n");
                                                        } else if (selectedType === "전체요약") {
                                                            content = memo?.content || summaries.map((s) => s.summary).join("\n");
                                                        }

                                                        const { data } = await apiClient.post(
                                                            "/notion/upload",
                                                            {
                                                                title: boardTitle,
                                                                content,
                                                                parent_id: selectedDB,
                                                                parent_type: "database",
                                                            },
                                                            {
                                                                transformRequest: [
                                                                    (data) =>
                                                                        JSON.stringify({
                                                                            title: data.title,
                                                                            content: data.content,
                                                                            parent_id: data.parent_id,
                                                                            parent_type: data.parent_type,
                                                                        }),
                                                                ],
                                                                headers: { "Content-Type": "application/json" },
                                                            }
                                                        );

                                                        showToast("노션 업로드 완료!");
                                                        window.open(data.url, "_blank");
                                                    } catch (err) {
                                                        console.error("노션 업로드 실패:", err);
                                                        showToast("❌ 노션 업로드 중 오류가 발생했습니다.");
                                                    }
                                                }}
                                                className="w-full mt-4 bg-[#7E37F9] text-white text-sm font-medium py-2 rounded-lg hover:bg-[#692ed9] transition"
                                            >
                                                노션으로 업로드
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}