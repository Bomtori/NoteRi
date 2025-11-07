import React, { useState, useEffect, useMemo, useRef } from "react";
import RatingModal from "./RatingModal";
import { useToast } from "@/hooks/useToast";
import apiClient from "../../api/apiClient";

export default function FinalSummarySection({ finalSummaries }) {
   const [showRating, setShowRating] = useState(false);
   const { showToast } = useToast();

  // ✅ 전체 요약이 처음 생성되면 별점 모달 표시
  useEffect(() => {
    if (finalSummaries && finalSummaries.length > 0) {
      const timer = setTimeout(() => setShowRating(true), 2000); // 2초 후 표시
      return () => clearTimeout(timer);
    }
  }, [finalSummaries]);

 
  const handleSubmitRating = async (rating) => {
    try {
      // 실제 API 호출 (임시: 콘솔로 확인)
      console.log("⭐ 별점 제출:", rating);
      await apiClient.post("/feedback/summary", { rating }); // 백엔드 준비 안 됐으면 주석 처리 가능
      showToast("피드백이 제출되었습니다!", 2000);
    } catch {
      showToast("⚠️ 피드백 서버가 아직 연결되지 않았어요.", 2000);
    }
  };
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
            <RatingModal
            show={showRating}
            onClose={() => setShowRating(false)}
            onSubmit={(score) => {
                showToast(`피드백 감사합니다! ${score}점으로 평가하셨습니다 💜`);
                handleSubmitRating(score);
                setTimeout(() => setShowRating(false), 1500);
            }}
            />

        </div>
    );
}
