import { useState } from "react";
import { FaRegCalendarAlt } from "react-icons/fa";

export default function RightSidePanel({
  upcomingEvents = [],
  setCalendarOpen,
  calendarOpen,
  gptTab,
  setGptTab,
  ragQuestion,
  setRagQuestion,
  ragAnswer,
  ragSources,
  ragLoading,
  ragError,
  handleKeyPress,
  handleRagSubmit,
}) {
  return (
    <aside className="w-[30%] bg-white rounded-2xl shadow-sm p-6 flex flex-col min-h-[700px]">
      {/* 일정 미리보기 */}
      <div className="mb-6 border-b border-gray-200 pb-3">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-gray-800">다가오는 일정</h3>
          <button
            onClick={() => setCalendarOpen(true)}
            className="text-xs text-[#7E37F9] hover:underline"
          >
            전체보기
          </button>
        </div>

        {upcomingEvents.length === 0 ? (
          <p className="text-xs text-gray-400">예정된 일정이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {upcomingEvents.map((ev) => (
              <li
                key={ev.id}
                className="flex items-center gap-2 text-sm hover:bg-gray-50 p-1 rounded cursor-pointer transition"
                onClick={() => setCalendarOpen(true)}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor:
                      ev.extended_props?.color || ev.extendedProps?.color || "#7E37F9",
                  }}
                ></span>
                <span className="text-gray-700 font-medium flex-1 truncate">
                  {ev.title}
                </span>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(ev.start).toLocaleDateString("ko-KR", {
                    month: "numeric",
                    day: "numeric",
                    weekday: "short",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 기록검색 탭 */}
      <div className="flex gap-2 mb-4 border-b border-gray-200 pb-2">
        {["gpt"].map((tab) => (
          <button
            key={tab}
            onClick={() => setGptTab(tab)}
            className={`px-3 py-1 text-sm font-medium transition ${
              gptTab === tab
                ? "border-b-2 border-[#7E37F9] text-[#7E37F9]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "gpt" ? "기록검색" : "요약 메모"}
          </button>
        ))}
      </div>

      {gptTab === "gpt" && (
        <div className="flex flex-col h-full">
          {/* 에러 메시지 */}
          {ragError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              ❌ {ragError}
            </div>
          )}

          {/* 답변 영역 */}
          <div className="flex-1 overflow-y-auto">
            {ragLoading && (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-[#7E37F9] rounded-full animate-spin mb-3" />
                <p className="text-sm">답변 생성 중...</p>
              </div>
            )}

            {!ragLoading && ragAnswer && (
              <div>
                {/* AI 답변 */}
                <div className="mb-4 p-4 bg-[#F5F3FF] border border-[#7E37F9]/20 rounded-lg">
                  <p className="font-semibold text-[#7E37F9] mb-2 text-sm">
                    노트리의 답변
                  </p>
                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {ragAnswer}
                  </div>
                </div>

                {/* 참조 소스 */}
                {ragSources.length > 0 && (
                  <div>
                    <p className="font-semibold text-gray-700 mb-2 text-sm">
                      참조 문서 ({ragSources.length}개)
                    </p>
                    <div className="space-y-2">
                      {ragSources.map((source, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-semibold text-[#7E37F9]">
                              세션 #{source.session_id}
                            </span>
                            <span className="text-xs text-gray-400">
                              유사도: {(source.similarity * 100).toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-3">
                            {source.text}
                          </p>
                          {source.metadata?.date && (
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(source.metadata.date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!ragLoading && !ragAnswer && (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <p className="text-sm text-center">
                  모든 녹음 내용에서<br />원하는 정보를 검색해보세요!
                </p>
              </div>
            )}
          </div>

          {/* 질문 입력 영역 */}
          <div className="mb-4">
            <textarea
              value={ragQuestion}
              onChange={(e) => setRagQuestion(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="모든 녹음에서 검색할 질문을 입력하세요!&#10;예: 프론트엔드 디자인 언제 완료래?"
              className="w-full h-24 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-[#7E37F9] focus:outline-none text-sm"
              disabled={ragLoading}
            />
            <div className="flex justify-between items-center mt-2">
              <button
                onClick={handleRagSubmit}
                disabled={ragLoading || !ragQuestion.trim()}
                className="px-4 py-2 bg-[#7E37F9] text-white rounded-lg text-sm font-medium hover:bg-[#6B2DD6] disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                {ragLoading ? "검색 중..." : "질문하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
