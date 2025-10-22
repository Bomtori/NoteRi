// src/components/ratings/RatingSummaryCard.tsx
import React, { useMemo, useState, useEffect } from "react";
// @ts-expect-error TS7016: no declaration
import NivoBar from "@/test/components/NivoBar.tsx";
import {
  ensureSummary,
  toNivoBarData,
  type RatingSummary as RatingSummaryType,
} from "@/test/components/usageDashBoard/RatingSummary";

// ✅ 임시 데이터 (원하는 대로 조정 가능)
const mockSummary: RatingSummaryType = ensureSummary({
  counts: { 1: 8, 2: 14, 3: 32, 4: 57, 5: 89 }, // 점수별 개수
  // total/average 생략하면 ensureSummary가 자동 계산
});

type Props = {
  className?: string;
  height?: number;
  showUsers?: boolean;
  // endpoint?: string;   // ← 나중에 라우트 만들면 다시 사용
};

export default function RatingSummaryCard({
  className = "",
  height = 240,
  showUsers = true,
  // endpoint,
}: Props) {
  // 🔧 지금은 임시 데이터로 시작
  const [summary, setSummary] = useState<RatingSummaryType | null>(mockSummary);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 📌 나중에 API 연결 시 이 블록의 주석을 해제하세요.
  /*
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch(endpoint ?? `${API_BASE_URL}/ratings/summary`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        setSummary(ensureSummary(payload));
      } catch (e: any) {
        setErr(e?.message ?? "불러오기 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, [endpoint]);
  */

  const barData = useMemo(() => (summary ? toNivoBarData(summary) : []), [summary]);

  return (
    <div className={`p-4 bg-white rounded-2xl shadow ${className}`}>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">전체 게시글 평가 요약</h3>
          <p className="text-base text-muted-foreground/80">
  총 <span className="text-lg font-semibold tabular-nums">{summary?.total.toLocaleString() ?? 0}</span>명 ·
  평균 <span className="text-lg font-semibold tabular-nums">{summary?.average.toFixed(2) ?? "0.00"}</span> / 5
</p>
        </div>
      </div>

      {loading && <div>로딩…</div>}
      {err && <div className="text-destructive">에러: {err}</div>}

      {!loading && !err && summary && (
        <div className="min-h-[220px] min-w-0">
          <NivoBar
            data={barData}
            height={height}
            horizontal={true}                     // 가로 막대 추천
            showUserCount={showUsers}             // users 필드(n명) 라벨 표시
            valueFormatter={(v) => Number(v ?? 0).toLocaleString()}
            maxValue="auto"
          />
        </div>
      )}
    </div>
  );
}
