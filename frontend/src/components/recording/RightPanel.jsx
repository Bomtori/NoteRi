import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function RightPanel({
                                       tabs = ["memo", "gpt"], // 기본값: 상세페이지처럼 메모 + GPT
                                       memoText = "",
                                       setMemoText = () => {},
                                       isEditing = false,
                                       setIsEditing = () => {},
                                       saveStatus = "",
                                   }) {
    const [activeTab, setActiveTab] = useState(tabs[0]);

    return (
        <aside className="w-[30%] bg-white rounded-2xl shadow-sm p-6 flex flex-col min-h-[800px]">
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
                {/* 메모 탭 */}
                {activeTab === "memo" && (
                    <div className="relative flex flex-col h-full">
                        <div className="flex justify-between items-center mb-2">
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                className="text-xs text-gray-500 hover:text-[#7E37F9] transition"
                            >
                                {isEditing ? "👁 보기로 전환" : "✏️ 편집하기"}
                            </button>
                            <span className="text-xs text-gray-400">{saveStatus}</span>
                        </div>

                        {isEditing ? (
                            <textarea
                                value={memoText}
                                onChange={(e) => setMemoText(e.target.value)}
                                placeholder="메모를 입력하세요. 마크다운을 지원합니다. (#, -, **bold**)"
                                className="flex-1 border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#7E37F9] focus:outline-none resize-none font-[Pretendard]"
                            />
                        ) : (
                            <div className="flex-1 overflow-y-auto prose prose-sm max-w-none text-gray-800 leading-relaxed font-[Pretendard]">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {memoText || "_메모가 없습니다._"}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>
                )}

                {/* GPT 탭 */}
                {activeTab === "gpt" && (
                    <div className="text-sm text-gray-600 flex flex-col justify-center items-center h-full text-center">
                        🤖 GPT 분석 결과가 이곳에 표시됩니다.
                        <p className="mt-2 text-gray-400">(아직 백엔드 연동 전 상태입니다.)</p>
                    </div>
                )}
            </div>
        </aside>
    );
}
