import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPause, FaStop, FaPlay, FaShareAlt } from "react-icons/fa";
import { BsRecordCircle } from "react-icons/bs";
import { MdOutlineStickyNote2 } from "react-icons/md";

import RecordShareModal from "./RecordShareModal";
import TemplateBar from "./TemplateBar";
import { generateTemplate } from "../../api/ollamaApi";

export default function RecordBar({
  boardId = null,
  boardOwnerId,
  recordingState = "idle",
  onStart,
  onPause,
  onResume,
  onStop,
  onTogglePanel,
  boardTitle,
  summaries = [],
  refinedScript = [],
  memo = null,
  onToggleMobileMemo,
  // ⭐ 부모에서 전달받은 props (중복 선언 제거!)
  showTemplateModal,
  setShowTemplateModal,
  templateContent,
  setTemplateContent,
  barCenter,
  showShareModal,
  setShowShareModal,
  setShowTemplateBar,
}) {
  const [state, setState] = useState(recordingState);
  const [elapsed, setElapsed] = useState(0);
  
  // ⭐ 로컬에서만 관리하는 상태
  // const [showTemplateBar, setShowTemplateBar] = useState(false);

  useEffect(() => {
    let timer;
    if (state === "recording") {
      timer = setInterval(() => setElapsed((t) => t + 1), 1000);
    } else {
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [state]);

  useEffect(() => setState(recordingState), [recordingState]);

  const formatTime = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <>
      {/* ⭐ 템플릿 선택 바 */}
      {/* <TemplateBar
        isOpen={showTemplateBar}
        onClose={() => setShowTemplateBar(false)}
        barCenter={barCenter}
        onSelect={async (type) => {
          console.log("템플릿 선택:", type);

          // 모달 첫 표시 (로딩 메시지)
          setTemplateContent("템플릿 생성 중입니다... 잠시만 기다려주세요!");
          setShowTemplateModal(true);

          try {
            const result = await generateTemplate({
              type,
              summaries,
              refinedScript,
              memo,
            });
            setTemplateContent(result);
          } catch (err) {
            setTemplateContent("템플릿 생성 중 오류 발생:\n" + err.message);
          }
        }}
      /> */}

      {/* ⭐ 공유 모달 */}
      <RecordShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        boardId={boardId}
        boardTitle={boardTitle}
        boardOwnerId={boardOwnerId}
        summaries={summaries}
        refinedScript={refinedScript}
        memo={memo}
        barCenter={barCenter}
      />

      {/* 🆕 기존 녹음 바 */}
      <motion.div
        key="record-bar"
        className="
          fixed lg:static 
          bottom-0 left-0 right-0 
          lg:bottom-auto lg:left-auto lg:right-auto
          lg:flex lg:justify-center lg:items-center
          z-50
          bg-white/95 lg:bg-transparent
          border-t lg:border-t-0 border-gray-200 lg:border-0
          py-3 lg:py-0
        "
      >
        <div className="flex items-center gap-3 justify-center lg:bg-white/80 lg:backdrop-blur-sm lg:shadow-md lg:border lg:border-gray-200 rounded-full px-5 py-2 transition-all">
          <AnimatePresence mode="wait">
            {state === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3"
              >
                <button
                  onClick={() => {
                    setState("recording");
                    onStart?.();
                  }}
                  className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all"
                  title="녹음 시작"
                >
                  <BsRecordCircle className="text-lg" />
                </button>

                <button
                  onClick={() => {
                    // recordBarProps.setShowTemplateBar(true);
                    setShowShareModal(true);
                  }}
                  className="share-button p-2 text-gray-600 hover:text-black transition-all"
                  title="공유하기"
                >
                  <FaShareAlt />
                </button>

                <button
                  onClick={() => {
                    if (window.innerWidth < 1024) onToggleMobileMemo?.();
                    else onTogglePanel?.();
                  }}
                  className="p-2 text-gray-600 hover:text-[#7E37F9] transition-all"
                  title="메모 / 테리"
                >
                  <MdOutlineStickyNote2 className="text-xl" />
                </button>
              </motion.div>
            )}

            {state === "recording" && (
              <motion.div
                key="recording"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3"
              >
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <button
                  onClick={() => {
                    setState("paused");
                    onPause?.();
                  }}
                  className="p-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-all"
                >
                  <FaPause />
                </button>

                <button
                  onClick={() => {
                    setState("stopped");
                    onStop?.();
                    setShowTemplateBar(true);
                  }}
                  className="p-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-all"
                >
                  <FaStop />
                </button>

                <span className="text-xs font-medium text-gray-600 tabular-nums">
                  {formatTime(elapsed)}
                </span>

                <button
                  onClick={() => {
                    if (window.innerWidth < 1024) onToggleMobileMemo?.();
                    else onTogglePanel?.();
                  }}
                  className="p-2 text-gray-600 hover:text-[#7E37F9] transition-all"
                  title="메모 / 테리"
                >
                  <MdOutlineStickyNote2 className="text-xl" />
                </button>
              </motion.div>
            )}

            {state === "paused" && (
              <motion.div
                key="paused"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3"
              >
                <button
                  onClick={() => {
                    setState("recording");
                    onResume?.();
                  }}
                  className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-all"
                >
                  <FaPlay />
                </button>

                <button
                  onClick={() => {
                    setState("stopped");
                    onStop?.();
                    setShowTemplateBar(true);
                  }}
                  className="p-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-all"
                >
                  <FaStop />
                </button>

                <span className="text-xs font-medium text-gray-600 tabular-nums">
                  {formatTime(elapsed)}
                </span>
              </motion.div>
            )}

            {["stopped", "replay"].includes(state) && (
              <motion.div
                key="stopped"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3"
              >
                <button
                  onClick={() => {
                    setShowTemplateBar(false);
                    setShowShareModal(true);
                  }}
                  className="share-button p-2 text-gray-700 hover:text-black transition-all"
                  title="공유하기"
                >
                  <FaShareAlt />
                </button>

                <button
                  onClick={() => {
                    setShowShareModal(false);
                    setShowTemplateBar(true);
                  }}
                  className="px-4 py-1.5 bg-black text-white rounded-full text-sm hover:bg-gray-800 transition-all whitespace-nowrap"
                >
                  템플릿 추가
                </button>

                <button
                  onClick={() => {
                    if (window.innerWidth < 1024) onToggleMobileMemo?.();
                    else onTogglePanel?.();
                  }}
                  className="p-2 text-gray-600 hover:text-[#7E37F9] transition-all"
                  title="메모 / 테리"
                >
                  <MdOutlineStickyNote2 className="text-xl" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}