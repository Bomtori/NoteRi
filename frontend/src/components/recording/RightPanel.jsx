import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import apiClient from "../../api/apiClient";
import { API_BASE_URL } from "../../config";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function MemoEditor({ boardId, memoId, saveStatus, setSaveStatus }) {
  const [content, setContent] = useState("");
  const saveTimeout = useRef(null);

  const editor = useEditor({
  extensions: [
    StarterKit,

    // TaskItem 먼저 등록 (nested 옵션 켜기)
    TaskItem.configure({
      nested: true,
    }),

    // 그 다음에 TaskList 등록
    TaskList,

    Image.configure({
      HTMLAttributes: { class: "rounded-lg max-w-full mx-auto my-2" },
    }),
    Placeholder.configure({
      placeholder:
        "회의 메모를 작성하세요... (체크박스, 이미지, 목록 등 지원)",
    }),
  ],
    autofocus: true,
    onUpdate: ({ editor }) => setContent(editor.getHTML()),
  });
  // 초기 메모 불러오기
  useEffect(() => {
    if (!boardId || !memoId) return;
    (async () => {
      try {
        const res = await apiClient.get(
          `/boards/${boardId}/memos/${memoId}`
        );
        if (res.data?.content) {
          editor?.commands.setContent(res.data.content);
          setContent(res.data.content);
        }
      } catch (err) {
        console.warn("📄 메모 불러오기 실패:", err);
      }
    })();
  }, [boardId, memoId, editor]);

  // 자동 저장
  useEffect(() => {
    if (!boardId || !memoId) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);

    saveTimeout.current = setTimeout(async () => {
      try {
        setSaveStatus("저장 중...");
        await apiClient.patch(`/boards/${boardId}/memos/${memoId}`, {
          content,
        });
        setSaveStatus("저장됨 ✓");
        setTimeout(() => setSaveStatus(""), 1500);
      } catch (err) {
        console.error("⚠️ 자동 저장 실패:", err);
        setSaveStatus("⚠️ 저장 실패");
      }
    }, 800);

    return () => clearTimeout(saveTimeout.current);
  }, [content, boardId, memoId]);

  const handleAddImage = () => {
    const url = prompt("이미지 URL을 입력하세요:");
    if (url) editor?.chain().focus().setImage({ src: url }).run();
  };

  if (!editor)
    return <p className="text-gray-400 text-sm p-4">에디터 로딩 중...</p>;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-2 mt-3 text-sm">
        <div className="flex gap-3 text-gray-500">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={
              editor.isActive("bold") ? "text-[#7E37F9]" : "hover:text-[#7E37F9]"
            }
          >
            <b>B</b>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={
              editor.isActive("italic") ? "text-[#7E37F9]" : "hover:text-[#7E37F9]"
            }
          >
            <i>I</i>
          </button>
          <button
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            className={
              editor.isActive("heading", { level: 2 })
                ? "text-[#7E37F9]"
                : "hover:text-[#7E37F9]"
            }
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={
              editor.isActive("bulletList")
                ? "text-[#7E37F9]"
                : "hover:text-[#7E37F9]"
            }
          >
            • List
          </button>
          <button
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={
              editor.isActive("taskList")
                ? "text-[#7E37F9]"
                : "hover:text-[#7E37F9]"
            }
          >
            ☑️ Task
          </button>
          <button onClick={handleAddImage} className="hover:text-[#7E37F9]">
            🖼️ Img
          </button>
        </div>
        <span className="text-xs text-gray-400">{saveStatus}</span>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl bg-white p-4 max-w-none tiptap-editor">
        <EditorContent
          editor={editor}
          className="tiptap focus:outline-none [&_*]:outline-none"
        />
      </div>
    </div>
  );
}

// RightPanel (메모 + GPT)
export default function RightPanel({ boardId, memoId, tabs = ["memo", "gpt"], onClose, }) {
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [saveStatus, setSaveStatus] = useState("");
  const [gptInput, setGptInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const chatContainerRef = useRef(null);

  // 추천 질문 리스트
  const quickQuestions = [
    "이 용어 뜻이 뭐야?",
    "이 기술이 어떤 역할을 해?",
    "회의 내용 중 모르는 단어 정리해줘.",
    "이 개념이 실제로 어떻게 쓰여?",
  ];

  async function handleSendGPT(promptText) {
    const message = promptText || gptInput.trim();
    if (!message) return;

    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setGptInput("");
    setLoading(true);

    try {
      const res = await apiClient.post(`/gemini/chat`, {
        prompt: message,
        temperature: 0.3,
        max_output_tokens: 256,
      });
      const gptMessage = res.data.text || "(응답이 없습니다)";
      setMessages((prev) => [...prev, { role: "gpt", text: gptMessage }]);
    } catch (err) {
      console.error("테리 응답 실패:", err);
      setMessages((prev) => [
        ...prev,
        { role: "gpt", text: "⚠️ 오류가 발생했습니다. 다시 시도해주세요." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const container = chatContainerRef.current;
    if (container)
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <aside className="bg-white rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
    {/* 상단 닫기 버튼 (작고 심플하게) */}
    <div className="absolute top-2 right-3 z-20">
      <button
        onClick={onClose}
        className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-all shadow-sm"
        title="패널 닫기"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06L11.06 12l3.71 3.71a.75.75 0 1 1-1.06 1.06L10 13.06l-3.71 3.71a.75.75 0 1 1-1.06-1.06L8.94 12 5.23 8.29a.75.75 0 0 1 .02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>

      {/* 상단 탭 */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="relative flex bg-gray-100 rounded-full p-1 w-fit">
          {tabs.map((key) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`relative z-10 px-4 py-1.5 text-sm font-medium rounded-full transition-colors duration-200 ${
                  isActive
                    ? "text-[#7E37F9]"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-pill-rightpanel"
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                    className="absolute inset-0 bg-white shadow-sm rounded-full"
                  />
                )}
                <span className="relative z-10">
                  {key === "memo" ? "메모" : "테리"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
        {activeTab === "memo" && (
          <MemoEditor
            boardId={boardId}
            memoId={memoId}
            saveStatus={saveStatus}
            setSaveStatus={setSaveStatus}
          />
        )}

        {activeTab === "gpt" && (
          <div className="flex flex-col h-full">
            {/* 추천 질문 버튼 */}
            {messages.length === 0 && (
              <div className="grid grid-cols-1 gap-2 mb-4">
                {quickQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendGPT(q)}
                    className="w-full text-left px-4 py-2 bg-gray-100 hover:bg-[#F2ECFF] text-gray-700 rounded-xl text-sm transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* 대화 영역 */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-2"
            >
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 20,
                    duration: 0.3,
                  }}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm whitespace-pre-line ${
                      msg.role === "user"
                        ? "bg-[#E9D8FD] text-gray-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                </motion.div>
              ))}
                {loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-start"
                    >
                        <div className="bg-gray-100 text-gray-500 rounded-2xl px-4 py-2 text-sm shadow-sm flex items-center gap-2">
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                            </div>
                            <span>테리가 생각 중이에요!</span>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* 입력창 */}
            <div className="pt-3 border-t border-gray-100 bg-white mt-auto">
              <div className="relative">
                <textarea
                  value={gptInput}
                  onChange={(e) => setGptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendGPT();
                    }
                  }}
                  placeholder="테리에게 물어보세요!"
                  className="w-full pr-10 p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#7E37F9] text-sm resize-none"
                  rows={2}
                />
                <button
                  onClick={() => handleSendGPT()}
                  disabled={loading}
                  className="absolute right-3 bottom-3 text-[#7E37F9] hover:text-[#6930C3] transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    className="w-5 h-5 rotate-45"
                  >
                    <path d="M2.94 2.94a1.5 1.5 0 0 1 1.56-.37l12.26 4.35a1 1 0 0 1 0 1.86l-12.26 4.35a1.5 1.5 0 0 1-2-1.4V4.7a1.5 1.5 0 0 1 .44-1.06z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
