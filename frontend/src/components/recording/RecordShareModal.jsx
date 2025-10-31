import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaLink, FaUserPlus, FaLock, FaUnlock, FaTimes } from "react-icons/fa";
import { useToast } from "../../hooks/useToast";
import apiClient from "../../api/apiClient";

export default function RecordShareModal({ isOpen, onClose, boardId = null }) {
    const ref = useRef(null);
    const [activeTab, setActiveTab] = useState("link");
    const [inviteEmail, setInviteEmail] = useState("");
    const [invited, setInvited] = useState([]);
    const [pin, setPin] = useState("");
    const [hasPassword, setHasPassword] = useState(false);
    const { showToast } = useToast();

    const baseUrl = `${window.location.origin}/record/${boardId || ""}`;
    const shareUrl = hasPassword ? `${baseUrl}?protected=true` : baseUrl;

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onClose();
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    // ✅ 비밀번호 존재 여부 확인
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

    // ✅ 비밀번호 설정
    const handleSetPassword = async () => {
        if (pin.length !== 4) {
            showToast("⚠️ 4자리 숫자를 입력해주세요.");
            return;
        }
        try {
            await apiClient.patch(`/boards/${boardId}/password`, { password: pin });
            setHasPassword(true);
            showToast("🔒 비밀번호가 설정되었습니다!");
        } catch (err) {
            console.error("비밀번호 설정 실패:", err);
            showToast("❌ 비밀번호 설정 중 오류가 발생했습니다.");
        }
    };

    // ✅ 비밀번호 해제
    const handleClearPassword = async () => {
        try {
            await apiClient.delete(`/boards/${boardId}/password`);
            setHasPassword(false);
            setPin("");
            showToast("🔓 비밀번호가 제거되었습니다.");
        } catch (err) {
            console.error("비밀번호 제거 실패:", err);
            showToast("❌ 비밀번호 제거 중 오류가 발생했습니다.");
        }
    };

    // ✅ 초대 버튼 (올바른 필드명 사용)
    const handleInvite = async () => {
        if (inviteEmail.trim() === "") {
            showToast("⚠️ 이메일을 입력해주세요!");
            return;
        }

        if (invited.includes(inviteEmail)) {
            showToast("⚠️ 이미 초대한 이메일입니다!");
            return;
        }

        try {
            // ✅ 백엔드 스키마에 맞춘 필드명
            await apiClient.post(`/boards/${boardId}/shares`, {
                email: inviteEmail,
                role: "editor",     // ✅ role → invite_role
            });

            setInvited((prev) => [...prev, inviteEmail]);
            setInviteEmail("");
            showToast("✅ 팀원에게 공유되었습니다!");
        } catch (err) {
            const status = err.response?.status;
            const detail = err.response?.data?.detail;

            console.error("공유 요청 실패:", err.response?.data || err);

            if (status === 404) {
                showToast("❌ 존재하지 않는 사용자입니다.");
            } else if (status === 400) {
                showToast("⚠️ 이미 공유된 사용자입니다!");
            } else if (status === 422) {
                showToast(`❌ 잘못된 요청입니다.\n${detail || "입력값을 확인해주세요."}`);
            } else {
                showToast("⚠️ 공유 요청 중 알 수 없는 오류가 발생했습니다.");
            }
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
                        className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] w-[340px] p-5 border border-gray-100 overflow-hidden"
                    >
                        {/* 탭 */}
                        <div className="relative flex bg-gray-100 rounded-full p-1 mb-5">
                            {["link", "invite"].map((tab) => (
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
                                        {tab === "link" ? "링크 공유" : "팀원 초대"}
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
                                            <span className="text-xs text-gray-500 truncate max-w-[200px]">
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
                                ) : (
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

                                        <div className="mt-3 max-h-[120px] overflow-y-auto">
                                            <AnimatePresence>
                                                {invited.length === 0 ? (
                                                    <p className="text-xs text-gray-400 text-center py-3">
                                                        아직 초대한 팀원이 없습니다.
                                                    </p>
                                                ) : (
                                                    invited.map((email) => (
                                                        <motion.div
                                                            key={email}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -10 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 mb-2"
                                                        >
                                                            <span className="text-sm text-gray-700">{email}</span>
                                                            <button
                                                                onClick={() =>
                                                                    setInvited((prev) =>
                                                                        prev.filter((e) => e !== email)
                                                                    )
                                                                }
                                                                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                                                            >
                                                                <FaTimes size={10} />
                                                                취소
                                                            </button>
                                                        </motion.div>
                                                    ))
                                                )}
                                            </AnimatePresence>
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