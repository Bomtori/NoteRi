import React from "react";

export default function FinalSummarySection({ finalSummaries }) {
    if (!finalSummaries || finalSummaries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center flex-1 text-gray-400 text-sm">
                녹음을 종료하면 전체 요약이 생성됩니다.
            </div>
        );
    }

    const summary = finalSummaries[0]; // 첫 번째 전체 요약

    return (
        <div className="flex flex-col gap-4 mt-4 overflow-y-auto flex-1">
            <div className="border-gray-200 rounded-xl p-5 bg-[#f9fafb] shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-3">전체 요약</h3>

                {summary.title && (
                    <h4 className="text-lg font-bold text-gray-900 mb-3">
                        {summary.title}
                    </h4>
                )}

                {summary.bullets?.length > 0 && (
                    <div>
                        <p className="font-semibold text-gray-700 mb-2">주요 내용</p>
                        <ul className="list-disc ml-5 space-y-1 text-sm text-gray-800">
                            {summary.bullets.map((b, i) => (
                                <li key={i}>{b}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {summary.actions?.length > 0 && (
                    <div className="mt-3">
                        <p className="font-semibold text-gray-700 mb-2">후속 조치</p>
                        <ul className="list-disc ml-5 space-y-1 text-sm text-gray-700">
                            {summary.actions.map((a, i) => (
                                <li key={i}>{a}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
