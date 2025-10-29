import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaLink, FaUserPlus, FaTimes } from "react-icons/fa";

export default function RecordShareModal({ isOpen, onClose }) {
  const ref = useRef(null);
  const [activeTab, setActiveTab] = useState("link");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invited, setInvited] = useState([]); // ✅ 초대한 사람 목록

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring", stiffness: 250, damping: 25 }}
          className="fixed bottom-[90px] left-1/2 -translate-x-1/2 z-[100]"
        >
          <div
            ref={ref}
            className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] w-[340px] p-5 border border-gray-100"
          >
            {/* 🔹 토글 */}
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
                    {tab === "link" ? (
                      <>
                        <FaLink /> 링크 공유
                      </>
                    ) : (
                      <>
                        <FaUserPlus /> 팀원 초대
                      </>
                    )}
                  </span>
                </button>
              ))}
            </div>

            {/* 🔹 탭별 콘텐츠 */}
            <AnimatePresence mode="wait">
              {activeTab === "link" ? (
                <motion.div
                  key="link"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <p className="text-sm text-gray-600">
                    아래 링크를 복사하여 회의 내용을 공유하세요.
                  </p>
                  <div className="flex items-center bg-gray-50 border rounded-lg px-3 py-2 justify-between">
                    <span className="text-xs text-gray-500 truncate">
                      https://noteri.app/record/12345
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText("https://noteri.app/record/12345");
                        alert("✅ 링크가 복사되었습니다!");
                      }}
                      className="text-xs px-3 py-1 bg-[#7E37F9] text-white rounded-lg hover:bg-[#692ed9] transition"
                    >
                      복사
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="invite"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-3"
                >
                  <p className="text-sm text-gray-600">
                    초대할 팀원의 이메일을 입력하세요.
                  </p>

                  {/* 입력 영역 */}
                  <div className="flex items-center gap-2">
                    <input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="예: teammate@noteri.com"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-[#7E37F9]"
                    />
                    <button
                      onClick={() => {
                        if (inviteEmail.trim() === "") return alert("이메일을 입력해주세요!");
                        if (invited.includes(inviteEmail))
                          return alert("이미 초대한 이메일입니다!");
                        setInvited((prev) => [...prev, inviteEmail]);
                        setInviteEmail("");
                      }}
                      className="px-3 py-2 bg-[#7E37F9] text-white rounded-lg hover:bg-[#692ed9] text-sm transition"
                    >
                      추가
                    </button>
                  </div>

                  {/* 초대한 목록 */}
                  <div className="mt-3 max-h-[120px] overflow-y-auto">
                    <AnimatePresence>
                      {invited.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-3">
                          아직 초대한 팀원이 없습니다.
                        </p>
                      ) : (
                        invited.map((email, i) => (
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
                                setInvited((prev) => prev.filter((e) => e !== email))
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
