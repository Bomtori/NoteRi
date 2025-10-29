import React from "react";

export default function RecordSection({
  activeTab,
  liveText,
  summaries,
  refinedScript,
  speakers,
  recordingState,
}) {
  return (
    <div className="flex-1 overflow-y-auto space-y-6 pb-24">
      {/* 회의기록 탭 */}
      {activeTab === "record" && (
        <section className="space-y-4">
          <div className="p-4 border bg-white rounded shadow-sm">
            <h2 className="font-semibold mb-2">🎤 실시간</h2>
            <p className="whitespace-pre-wrap text-gray-900">
              {recordingState === "paused"
                ? "⏸️ 일시중지 중…"
                : liveText || "녹음을 시작해보세요!"}
            </p>
          </div>

          <div className="p-4 border bg-white rounded shadow-sm max-h-64 overflow-y-auto">
            <h2 className="font-semibold mb-2">⏱️ 1분 요약</h2>
            {summaries.length ? (
              <div className="space-y-3">
                {summaries.map((s, i) => (
                  <div key={i} className="bg-gray-50 p-3 rounded">
                    {s.paragraph && (
                      <p className="text-xs text-gray-500 mb-1">
                        원문: {s.paragraph}
                      </p>
                    )}
                    <p className="text-gray-900">✅ {s.summary}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">요약 대기 중…</p>
            )}
          </div>
        </section>
      )}

      {/* 스크립트 탭 */}
      {activeTab === "script" && (
        <section className="space-y-4">
          <div className="p-4 border bg-white rounded shadow-sm max-h-64 overflow-y-auto">
            <h2 className="font-semibold mb-2">📜 확정 히스토리</h2>
            {refinedScript.length ? (
              <ul className="list-disc pl-5 space-y-1">
                {refinedScript.map((line, idx) => (
                  <li key={idx} className="text-gray-800">
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">아직 확정된 문장이 없습니다.</p>
            )}
          </div>
        </section>
      )}

      {/* 화자분리 탭 */}
      {activeTab === "speaker" && (
        <section className="space-y-4">
          <div className="p-4 border bg-white rounded shadow-sm max-h-64 overflow-y-auto">
            <h2 className="font-semibold mb-2">🗣️ 화자 분리 결과</h2>
            {speakers.length ? (
              speakers.map((s, i) => (
                <p key={i} className="text-gray-800">
                  <b>{s.speaker}</b>: {s.text}
                </p>
              ))
            ) : (
              <p className="text-gray-500">결과 없음 (녹음 종료 후 실행)</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
