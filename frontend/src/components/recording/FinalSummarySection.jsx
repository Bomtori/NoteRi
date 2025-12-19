import React, { useState, useEffect } from "react";
import RatingModal from "./RatingModal";
import { useToast } from "@/hooks/useToast";
import apiClient from "../../api/apiClient";

export default function FinalSummarySection({ finalSummaries }) {
  const { showToast } = useToast();
  const summary = finalSummaries?.[0] || null;
  const finalSummaryId = summary?.id;

  const [showRating, setShowRating] = useState(false);

  // 전체 요약 생성 + 아직 rating이 없을 때만 1회 표시
  useEffect(() => {
    if (finalSummaryId && summary?.rating == null) {
      const timer = setTimeout(() => setShowRating(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [finalSummaryId, summary?.rating]);

  const handleSubmitRating = async (rating) => {
    try {
      await apiClient.patch(
        `/summary/final/${finalSummaryId}/rating`,
        { rating }
      );

      showToast("피드백이 제출되었습니다!", 2000);

      // 다시 표시되지 않도록 처리
      summary.rating = rating;
      setShowRating(false);

    } catch (err) {
      console.error(err);
      showToast("⚠️ 피드백 서버 오류", 2000);
    }
  };

  // 요약 없을 때
  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-gray-400 text-sm">
        녹음을 종료하면 전체 요약이 생성됩니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 mt-4 overflow-y-auto flex-1">
      <div className="border-gray-200 rounded-xl p-5 bg-[#f9fafb] shadow-sm">

        {summary.title && (
          <h4 className="text-lg font-bold text-gray-900 mb-3">
            {summary.title}
          </h4>
        )}

        {summary.bullets?.length > 0 && (
          <div>
            <p className="font-semibold text-gray-700 mb-2">주요 내용</p>
            <ul className="list-disc ml-5 space-y-1 text-sm text-gray-800">
              {summary.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </div>
        )}

        {summary.actions?.length > 0 && (
          <div className="mt-3">
            <p className="font-semibold text-gray-700 mb-2">후속 조치</p>
            <ul className="list-disc ml-5 space-y-1 text-sm text-gray-700">
              {summary.actions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}
      </div>

      <RatingModal
        show={showRating}
        onClose={() => setShowRating(false)}
        onSubmit={handleSubmitRating}
      />
    </div>
  );
}
