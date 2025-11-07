import React, { useState } from "react";
import Calendar from "./Calendar";
import apiClient from "../../api/apiClient";

export default function CalendarPanel() {
  const [activeTab, setActiveTab] = useState("calendar");
  const [ragQuestion, setRagQuestion] = useState("");
  const [ragAnswer, setRagAnswer] = useState("");
  const [ragSources, setRagSources] = useState([]);
  const [ragLoading, setRagLoading] = useState(false);
  const [ragError, setRagError] = useState("");

  const handleRagSubmit = async () => {
    if (!ragQuestion.trim()) {
      setRagError("질문을 입력해주세요.");
      return;
    }
    setRagLoading(true);
    setRagError("");
    setRagAnswer("");
    setRagSources([]);

    try {
      const res = await apiClient.post("/rag/ask", { question: ragQuestion, top_k: 5 });
      setRagAnswer(res.data.answer);
      setRagSources(res.data.sources || []);
    } catch (err) {
      setRagError("답변 생성 중 오류가 발생했습니다.");
    } finally {
      setRagLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 탭 */}
      <div className="flex gap-3 mb-4 border-b border-gray-200">
        {["calendar", "gpt"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 text-sm font-medium transition ${
              activeTab === tab
                ? "border-b-2 border-[#7E37F9] text-[#7E37F9]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "calendar" ? "일정 관리" : "기록검색"}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === "calendar" ? (
        <Calendar />
      ) : (
        <div className="flex flex-col h-full">
          {ragError && (
            <div className="mb-3 p-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {ragError}
            </div>
          )}
          {ragLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-[#7E37F9] rounded-full animate-spin mb-3" />
              <p className="text-sm">답변 생성 중...</p>
            </div>
          ) : ragAnswer ? (
            <div className="overflow-y-auto flex-1">
              <div className="p-3 bg-[#F5F3FF] border border-[#7E37F9]/20 rounded-lg mb-3">
                <p className="font-semibold text-[#7E37F9] mb-1 text-sm">
                  노트리의 답변
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{ragAnswer}</p>
              </div>
              {ragSources.length > 0 && (
                <div>
                  <p className="font-semibold text-gray-700 mb-1 text-sm">
                    참조 문서 ({ragSources.length}개)
                  </p>
                  {ragSources.map((s, i) => (
                    <div key={i} className="p-2 bg-gray-50 border border-gray-200 rounded mb-1 text-xs text-gray-700">
                      <p className="font-medium">{s.session_id}</p>
                      <p>{s.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              모든 녹음 내용에서<br />원하는 정보를 검색해보세요!
            </div>
          )}

          <div className="mt-4">
            <textarea
              value={ragQuestion}
              onChange={(e) => setRagQuestion(e.target.value)}
              placeholder="질문을 입력하세요..."
              className="w-full h-20 p-3 border rounded-lg text-sm focus:ring-2 focus:ring-[#7E37F9] resize-none"
            />
            <button
              onClick={handleRagSubmit}
              disabled={ragLoading}
              className="mt-2 w-full py-2 bg-[#7E37F9] text-white rounded-lg text-sm hover:bg-[#6B2DD6] disabled:bg-gray-300"
            >
              {ragLoading ? "검색 중..." : "질문하기"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
