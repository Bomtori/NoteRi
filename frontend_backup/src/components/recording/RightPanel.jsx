import React, { useState, useEffect, useRef } from "react";
import MDEditor from "@uiw/react-md-editor";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import apiClient from "../../api/apiClient";
import { API_BASE_URL } from "../../config";

export default function RightPanel({
                                       boardId,
                                       memoId,
                                       tabs = ["memo", "gpt"],
                                   }) {
    const [activeTab, setActiveTab] = useState(tabs[0]);

    // 메모 상태
    const [memoText, setMemoText] = useState("");
    const [saveStatus, setSaveStatus] = useState("");
    const saveTimeout = useRef(null);

    // GPT
    const [gptInput, setGptInput] = useState("");
    const [gptOutput, setGptOutput] = useState("");
    const [loading, setLoading] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(false);

    // 초기 메모 불러오기
    useEffect(() => {
        if (activeTab === "memo" && boardId && memoId) fetchMemo();
    }, [activeTab, boardId, memoId]);

    async function fetchMemo() {
        try {
            const res = await apiClient.get(`${API_BASE_URL}/boards/${boardId}/memos/${memoId}`);
            setMemoText(res.data.content || "");
        } catch (err) {
            console.warn("📄 메모 불러오기 실패:", err);
            setMemoText("");
        }
    }

    // 자동 저장 (0.8초)
    useEffect(() => {
        if (!boardId || !memoId) return;
        if (saveTimeout.current) clearTimeout(saveTimeout.current);

        saveTimeout.current = setTimeout(async () => {
            try {
                setSaveStatus("저장 중...");
                await apiClient.patch(`${API_BASE_URL}/boards/${boardId}/memos/${memoId}`, {
                    content: memoText,
                });
                setSaveStatus("저장됨 ✓");
                setTimeout(() => setSaveStatus(""), 1500);
            } catch (err) {
                console.error("⚠️ 자동 저장 실패:", err);
                setSaveStatus("⚠️ 저장 실패");
            }
        }, 800);

        return () => clearTimeout(saveTimeout.current);
    }, [memoText, boardId, memoId]);

    // GPT 기능
    useEffect(() => {
        if (activeTab === "gpt") fetchLastHistory();
    }, [activeTab]);

    async function handleSendGPT() {
        if (!gptInput.trim()) return;
        setLoading(true);
        try {
            const res = await apiClient.post(`${API_BASE_URL}/gemini/chat`, {
                prompt: gptInput,
                temperature: 0.3,
                max_output_tokens: 256,
            });
            setGptOutput(res.data.text || "(응답이 없습니다)");
        } catch (err) {
            console.error("GPT 요청 실패:", err);
            setGptOutput("⚠️ 오류가 발생했습니다. 다시 시도해주세요.");
        } finally {
            setLoading(false);
        }
    }

    async function fetchLastHistory() {
        try {
            const res = await apiClient.get(`${API_BASE_URL}/gemini?limit=1`);
            const items = res.data.items || [];
            setGptOutput(items.length > 0 ? items[0].response_text : "");
        } catch (err) {
            console.error("GPT 기록 불러오기 실패:", err);
        }
    }

    return (
        <aside className="bg-white rounded-2xl shadow-sm p-6 flex flex-col min-h-[800px] max-h-[800px]">
            {/* 탭 버튼 */}
            <div className="flex gap-2 mb-4 border-b border-gray-200 pb-2">
                {tabs.map((key) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`px-3 py-1 text-sm font-medium transition ${
                            activeTab === key
                                ? "border-b-2 border-[#7E37F9] text-[#7E37F9]"
                                : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        {key === "memo" ? "메모" : "GPT"}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* 메모 탭 (Markdown Editor) */}
                {activeTab === "memo" && (
                    <div className="flex flex-col h-full">
                        <div className="flex justify-end mb-2">
                            <span className="text-xs text-gray-400">{saveStatus}</span>
                        </div>

                        <div data-color-mode="light" className="flex-1">
                            <MDEditor
                                value={memoText}
                                onChange={(val) => setMemoText(val || "")}
                                height={750}
                                preview="live" // 입력 즉시 렌더링
                                textareaProps={{
                                    placeholder: "회의 메모를 작성하세요. (# 제목, - 목록, **굵게** 등 지원)",
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* GPT 탭 */}
                {activeTab === "gpt" && (
                    <div className="flex flex-col h-full relative">
                        <div
                            className="flex-1 overflow-y-auto mt-2 text-sm text-gray-800 leading-relaxed relative
                         group scroll-smooth scrollbar-thin scrollbar-thumb-[#7E37F9]/30
                         hover:scrollbar-thumb-[#7E37F9]/60 scrollbar-track-transparent pr-2"
                            onScroll={(e) => {
                                const target = e.target;
                                const isBottom =
                                    target.scrollHeight - target.scrollTop === target.clientHeight;
                                setIsAtBottom(isBottom);
                            }}
                        >
                            <div className="prose prose-sm max-w-none text-gray-800 font-[Pretendard]">
                                {gptOutput ? (
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {gptOutput}
                                    </ReactMarkdown>
                                ) : (
                                    <p className="text-gray-400 text-center">
                                        GPT 분석 결과가 이곳에 표시됩니다.
                                    </p>
                                )}
                            </div>

                            {!isAtBottom && (
                                <div className="pointer-events-none absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-white to-transparent" />
                            )}
                        </div>

                        <div className="border-t bg-white pt-3 mt-2 sticky bottom-0">
              <textarea
                  value={gptInput}
                  onChange={(e) => setGptInput(e.target.value)}
                  placeholder="GPT에게 물어보세요..."
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm
                           focus:ring-2 focus:ring-[#7E37F9] focus:outline-none resize-none"
                  rows={3}
              />
                            <button
                                onClick={handleSendGPT}
                                disabled={loading || !gptInput.trim()}
                                className={`mt-2 px-4 py-1.5 rounded-md text-white text-sm float-right
                ${
                                    loading
                                        ? "bg-gray-400 cursor-not-allowed"
                                        : "bg-[#7E37F9] hover:bg-[#6b29e3]"
                                }`}
                            >
                                {loading ? "분석 중..." : "전송"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
