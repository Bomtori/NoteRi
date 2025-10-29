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
    const {showToast} = useToast();

    const baseUrl = `${window.location.origin}/record/${boardId || ""}`;
    const shareUrl = hasPassword ? `${baseUrl}?protected=true` : baseUrl; // ✅ 보호 여부에 따라 링크 변경

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
            await apiClient.patch(`/boards/${boardId}/password`, {password: pin});
            setHasPassword(true);
            showToast(
                <div className="flex flex-col items-center gap-1 text-center">
                    <p className="text-sm font-medium text-gray-800">🔒 비밀번호가 설정되었습니다!</p>
                    <p className="text-xs text-gray-500">{`${shareUrl}`}</p>
                </div>
            );
        } catch (err) {
            showToast("비밀번호 설정 중 오류가 발생했습니다.");
        }
    };

    // ✅ 비밀번호 해제
    const handleClearPassword = async () => {
        try {
            await apiClient.delete(`/boards/${boardId}/password`);
            setHasPassword(false);
            setPin("");
            showToast(
                <div className="flex flex-col items-center gap-1 text-center">
                    <p className="text-sm font-medium text-gray-800">🔓 비밀번호가 제거되었습니다.</p>
                    <p className="text-xs text-gray-500">{`${baseUrl}`}</p>
                </div>
            );
        } catch (err) {
            showToast("비밀번호 제거 중 오류가 발생했습니다.");
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    layout               // ✅ 부모에도 layout 추가
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 40 }}
                    transition={{ type: "spring", stiffness: 250, damping: 25 }} // ✅ layout용도 함께 적용
                    className="fixed bottom-[90px] left-1/2 -translate-x-1/2 z-[100]"
                >
                    {/* ✅ layout 추가 (모달 박스 높이도 함께 스르륵) */}
                    <motion.div
                        ref={ref}
                        layout
                        transition={{ type: "spring", stiffness: 280, damping: 26 }} // ✅ nested layout에도 spring 적용
                        className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] w-[340px] p-5 border border-gray-100 overflow-hidden"
                    >
                        {/* 🔹 탭 */}
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

                        {/* 🔹 탭 콘텐츠 (내부 높이도 layout 동기화) */}
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

                                        {/* 비밀번호 설정 / 해제 */}
                                        <div className="mt-4 border-t pt-4">
                                            <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                                {hasPassword ? <FaLock /> : <FaUnlock />} 비밀번호 보호
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
                                        <p className="text-sm text-gray-600">
                                            초대할 팀원의 이메일을 입력하세요.
                                        </p>

                                        <div className="flex items-center gap-2">
                                            <input
                                                value={inviteEmail}
                                                onChange={(e) => setInviteEmail(e.target.value)}
                                                placeholder="예: teammate@noteri.com"
                                                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-[#7E37F9]"
                                            />
                                            <button
                                                onClick={() => {
                                                    if (inviteEmail.trim() === "")
                                                        return showToast("이메일을 입력해주세요!");
                                                    if (invited.includes(inviteEmail))
                                                        return showToast("이미 초대한 이메일입니다!");
                                                    setInvited((prev) => [...prev, inviteEmail]);
                                                    setInviteEmail("");
                                                    showToast("✅ 팀원 초대가 추가되었습니다!");
                                                }}
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
                                                                <FaTimes size={10} /> 취소
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