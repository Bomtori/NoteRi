import React from "react";
import RatingModal from "./RatingModal";

export default function FinalSummarySection({ finalSummaries }) {
   const [showRating, setShowRating] = useState(false);

  // ✅ 전체 요약이 처음 생성되면 별점 모달 표시
  useEffect(() => {
    if (finalSummaries && finalSummaries.length > 0) {
      const timer = setTimeout(() => setShowRating(true), 2000); // 2초 후 표시
      return () => clearTimeout(timer);
    }
  }, [finalSummaries]);

  const handleSubmitRating = (score) => {
    console.log("유저가 남긴 평점:", score);

    // ✅ 서버로 전송 (예시)
    fetch("/api/feedback/summary", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score }),
    })
      .then((r) => r.ok && console.log("✅ 별점 저장 완료"))
      .catch((e) => console.error("❌ 별점 저장 실패:", e));
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
            }}
            />

        </div>
    );
}
