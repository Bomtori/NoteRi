import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import RecordHeader from "./RecordHeader";
import RecordTabs from "./RecordTabs";
import RecordSection from "./RecordSection";
import RightPanel from "./RightPanel";
import RecordBar from "./RecordBar";
import TemplateBar from "./TemplateBar";
import apiClient from "../../api/apiClient";
import TemplateResultModal from "./TemplateResultModal";

export default function RecordingLayout({
  mode = "new",
  board,
  memo,
  folders = [],
  title,
  setTitle,
  dateStr,
  tabs = [],
  activeTab,
  setActiveTab,
  recordBarProps = {},
  recordSectionProps = {},
  onSelectFolder,
  onDeleteBoard,
  audioPlayer,
  sharedUsers = [],
  showMobileMemo,
  setShowMobileMemo,
  showMobileSidebar,
  setShowMobileSidebar,
}) {
  const navigate = useNavigate();

  // 초깃값 계산 (SSR 방어)
  const initialIsMobile =
    typeof window !== "undefined" ? window.innerWidth < 1024 : false;

const layoutRef = useRef(null);
const barRef = useRef(null);

const [barCenter, setBarCenter] = useState(null);
const [isMobile, setIsMobile] = useState(initialIsMobile);
const [showTemplateBar, setShowTemplateBar] = useState(false);
const [isPanelVisible, setIsPanelVisible] = useState(
  mode === "detail" && !initialIsMobile
);
const [showDropdown, setShowDropdown] = useState(false);
const [panelWidth, setPanelWidth] = useState(360);
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [isResizing, setIsResizing] = useState(false);
const [showTemplateModal, setShowTemplateModal] = useState(false);
const [templateContent, setTemplateContent] = useState("");
const [showShareModal, setShowShareModal] = useState(false);

  const API_BASE_URL =
    import.meta.env.VITE_API_URL ??
  import.meta.env.VITE_API_BASE
  // 동적 탭 관리
  const [dynamicTabs, setDynamicTabs] = useState([]); // [{ id, label, isDynamic: true }]
  const [dynamicTemplates, setDynamicTemplates] = useState({}); // { tabId: { content, isLoading } }

  const templateServerMap = {
    lecture: "스크립트",
    meeting: "회의기록",
    interview: "스크립트",
    blog: "전체요약",
  };

  const templateLabels = {
    lecture: "강의록",
    meeting: "회의록",
    interview: "인터뷰",
    blog: "블로그",
  };
  useEffect(() => {
  console.log("🔍 barCenter UPDATED:", barCenter);
}, [barCenter]);

useEffect(() => {
  const updateBarCenter = () => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    setBarCenter(rect.left + rect.width / 2);
  };

  // requestAnimationFrame(updateBarCenter);            // 처음 1번
  // window.addEventListener("resize", updateBarCenter);

  // return () => {
  //   window.removeEventListener("resize", updateBarCenter);
  // };
  updateBarCenter();
  window.addEventListener('resize', updateBarCenter);
  return () => window.removeEventListener('resize', updateBarCenter);
}, []);

// ⭐ 세션 ID 가져오기 (임시)
const getValidSessionId = () => {
  return localStorage.getItem("session_id") || null;
};

  // 템플릿 선택 핸들러
// ✅ 수정된 템플릿 선택 핸들러
const handleSelectTemplate = async (templateKey) => {
  console.log("🔥 handleSelectTemplate CALLED", templateKey);
  
  const newTabId = `template-${Date.now()}`;
  const newTabLabel = templateLabels[templateKey];

  // 1) 탭 추가
  setDynamicTabs((prev) => [
    ...prev,
    { id: newTabId, label: newTabLabel, isDynamic: true },
  ]);

  // 2) 로딩 상태
  setDynamicTemplates((prev) => ({
    ...prev,
    [newTabId]: { content: "⏳ 템플릿 생성 중...", isLoading: true },
  }));

  // 3) 탭 활성화
  setActiveTab(newTabId);

  try {
    // ✅ 올바른 엔드포인트: /ollama/template
    const { data } = await apiClient.post("/ollama/template", {
      type: templateKey,  // lecture, meeting, interview, blog
      summaries: recordSectionProps?.summaries || [],
      refinedScript: recordSectionProps?.refinedScript || [],
      memo: memo || {},
    });

    const content = data.template;  // ✅ 백엔드가 {"template": "..."} 반환

    // ✅ 모달 표시
    setTemplateContent(content);
    setShowTemplateModal(true);

    // 탭에도 저장
    setDynamicTemplates((prev) => ({
      ...prev,
      [newTabId]: { content, isLoading: false },
    }));

  } catch (err) {
    const msg = err.response?.data?.detail || err.message;
    console.error("템플릿 생성 실패:", err);
    
    setDynamicTemplates((prev) => ({
      ...prev,
      [newTabId]: {
        content: `# ⚠️ 템플릿 생성 실패\n\n${msg}`,
        isLoading: false,
      },
    }));
  }
};

  // 탭 삭제 핸들러
  const handleRemoveTab = (tabId) => {
    setDynamicTabs((prev) => prev.filter((t) => t.id !== tabId));
    setDynamicTemplates((prev) => {
      const copy = { ...prev };
      delete copy[tabId];
      return copy;
    });

    // 삭제된 탭이 현재 활성 탭이면 기본 탭으로 이동
    if (activeTab === tabId) {
      setActiveTab("record");
    }
  };

  // 패널 리사이징
  const startResizing = (e) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMouseMove = (e2) => {
      let newWidth = startWidth - (e2.clientX - startX);
      newWidth = Math.max(320, Math.min(720, newWidth));
      setPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // 회의 삭제 핸들러
  const handleDeleteBoard = async () => {
    if (onDeleteBoard) {
      await onDeleteBoard();
      setShowDeleteModal(false);
    }
  };

  // 전체 탭 목록 (고정 + 동적)
  const allTabs = [...tabs, ...dynamicTabs];

  // 리사이즈 시 모바일 여부 업데이트
  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      // 모바일로 바뀌면 오른쪽 패널 자동 숨김
      if (mobile) {
        setIsPanelVisible(false);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleResize);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", handleResize);
      }
    };
  }, []);

return (
  <>
    {/* 🔥 템플릿 결과 모달 */}
    <TemplateResultModal
      isOpen={showTemplateModal}
      onClose={() => setShowTemplateModal(false)}
      content={templateContent}
    />
    {/* 🔥 템플릿 선택 바 (공유 모달과 같은 위치에서 띄우기) */}
    <TemplateBar
      isOpen={showTemplateBar}
      onClose={() => setShowTemplateBar(false)}
      onSelect={handleSelectTemplate}
      barCenter={barCenter}
    />
    <motion.div
      className="relative overflow-visible bg-gray-50 min-h-[100vh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div>
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between mt-4 mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="text-sm text-gray-400 hover:text-gray-600 lg:mb-0"
            >
              ← 돌아가기
            </button>
          </div>
        </div>

        {/* 메인 레이아웃 */}
        <div className="flex justify-center">
          <div
            ref={layoutRef}
            className="
              w-full max-w-[1300px] flex flex-col h-[calc(100vh-120px)]
              px-6 md:px-10 pt-8
              relative  
              /* ⭐ 수정1: PC absolute 중앙 배치를 위해 relative 추가 */
            "
          >
            <div className="flex gap-6 w-full flex-1 min-h-0">
              {/* 메인 콘텐츠 */}
              <main
                className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col flex-1 min-h-0"
                style={{
                  maxWidth: isPanelVisible
                    ? `calc(100% - ${panelWidth}px - 24px)`
                    : "100%",
                  transition: isResizing ? "none" : "all 0.2s ease",
                }}
              >
                <RecordHeader
                  title={title}
                  setTitle={setTitle}
                  dateStr={dateStr}
                  boardId={board?.id}
                  folders={folders}
                  showDropdown={showDropdown}
                  setShowDropdown={setShowDropdown}
                  onSelectFolder={onSelectFolder}
                  currentFolder={board?.folder}
                  onDeleteBoard={() => setShowDeleteModal(true)}
                />

                {/* 공유 유저 */}
                {mode === "detail" &&
                  sharedUsers.filter((u) => u.role !== "owner").length > 0 && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs text-gray-500">공유 중:</span>
                      <div className="flex -space-x-2">
                        {sharedUsers
                          .filter((u) => u.role !== "owner")
                          .slice(0, 3)
                          .map((u) => {
                            let avatarSrc;
                            if (u.user_picture) {
                              if (u.user_picture.startsWith("http")) {
                                avatarSrc = u.user_picture;
                              } else {
                                const path = u.user_picture.startsWith("/")
                                  ? u.user_picture
                                  : `/${u.user_picture}`;
                                avatarSrc = `${API_BASE_URL}${path}`;
                              }
                            } else {
                              avatarSrc = `${API_BASE_URL}/static/uploads/Group_49.png`;
                            }
                            return (
                              <img
                                key={u.user_id}
                                src={avatarSrc}
                                alt={u.user_name}
                                className="w-8 h-8 rounded-full border-2 border-white"
                                onError={(e) => {
                                  const fallback = `${API_BASE_URL}/static/uploads/Group_49.png`;
                                  if (e.currentTarget.src !== fallback) {
                                    e.currentTarget.src = fallback;
                                  }
                                }}
                              />
                            );
                          })}
                      </div>
                    </div>
                  )}

                <RecordTabs
                  tabs={[...tabs, ...dynamicTabs]}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  onAddTemplate={() => setShowTemplateBar(true)}
                  onRemoveTab={handleRemoveTab}
                />

                {/* 스크롤 영역 */}
                <div className="flex-1 overflow-y-auto no-scrollbar mt-4 min-h-0">
                  <RecordSection
                    activeTab={activeTab}
                    {...recordSectionProps}
                    dynamicTemplates={dynamicTemplates}
                  />
                </div>

                {mode === "detail" && audioPlayer && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {audioPlayer}
                  </div>
                )}
              </main>

              {/* 우측 패널 */}
              <AnimatePresence>
                {isPanelVisible && (
                  <motion.aside
                    key="rightpanel"
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 260,
                      damping: 30,
                    }}
                    className="hidden lg:flex h-full bg-white shadow-xl rounded-l-2xl overflow-hidden flex-col relative"
                    style={{ width: `${panelWidth}px`, flexShrink: 0 }}
                  >
                    <div
                      className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-gray-200 z-10"
                      onMouseDown={startResizing}
                    />
                    <RightPanel
                      boardId={board?.id}
                      memoId={memo?.id}
                      onClose={() => setIsPanelVisible(false)}
                    />
                  </motion.aside>
                )}
              </AnimatePresence>
            </div>

            {/* ⭐ 수정2: RecordBar PC/모바일 분기 */}
            {isMobile ? (
              /* ⭐ 모바일: 기존처럼 fixed bottom 유지 */
              <div
                ref={barRef}
                className="
                  fixed bottom-0 left-0 w-full 
                  px-4 pb-safe pt-3 
                  bg-white 
                  shadow-[0_-2px_6px_rgba(0,0,0,0.06)]
                  z-[200]
                  flex justify-center
                "
              >
                <RecordBar
                  {...recordBarProps}
                  setShowTemplateBar={setShowTemplateBar}
                  showTemplateModal={showTemplateModal}
                  setShowTemplateModal={setShowTemplateModal}
                  templateContent={templateContent}
                  setTemplateContent={setTemplateContent}
                  onTogglePanel={() =>
                    setIsPanelVisible((v) => !v && !isMobile)
                  }
                  onToggleMobileMemo={() => setShowMobileMemo(true)}
                  barCenter={barCenter}
                  showShareModal={showShareModal}
                  setShowShareModal={setShowShareModal}
                />
              </div>
            ) : (
              /* ⭐ PC: 화면 중앙 기준 absolute로 정확한 가운데 정렬 */
              <div
                ref={barRef}
                className="
                  absolute left-1/2 -translate-x-1/2
                  bottom-[-60px]
                  z-[300] flex justify-center
                "
              >
                <RecordBar
                  {...recordBarProps}
                  setShowTemplateBar={setShowTemplateBar}
                  showTemplateModal={showTemplateModal}
                  setShowTemplateModal={setShowTemplateModal}
                  templateContent={templateContent}
                  setTemplateContent={setTemplateContent}
                  onTogglePanel={() =>
                    setIsPanelVisible((v) => !v && !isMobile)
                  }
                  onToggleMobileMemo={() => setShowMobileMemo(true)}
                  barCenter={barCenter}
                  showShareModal={showShareModal}
                  setShowShareModal={setShowShareModal}
                />
              </div>
            )}

          </div>
        </div>

        {/* 삭제 모달 */}
        {showDeleteModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-[1000] px-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-[360px]">
              <h3 className="text-lg font-semibold mb-2">
                회의를 삭제하시겠어요?
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                삭제된 회의는 복구할 수 없습니다.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleDeleteBoard}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>

    {/* 모바일 메모 */}
    {showMobileMemo && (
      <div className="fixed inset-0 z-[100] bg-white lg:hidden">
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-hidden">
            <RightPanel
              boardId={board?.id}
              memoId={memo?.id}
              onClose={() => setShowMobileMemo(false)}
            />
          </div>
        </div>
      </div>
    )}
  </>
);

}
