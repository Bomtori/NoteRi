// frontend/src/test/components/usageDashBoard/UsageAvgByPlanCard.jsx
import React, { useMemo } from "react";
import NivoBar from "@/test/components/NivoBar.tsx";

const PLAN_COLORS = {
  free: "#A1A1AA",       // gray
  pro: "#7E36F9",        // purple
  enterprise: "#FACC15", // yellow
};

export default function UsageAvgByPlanCard({ plans = [], loading, error, className = "" }) {
  // 차트용 데이터로 변환 (id, value, color)
  const chartData = useMemo(() => {
  const rows = Array.isArray(plans) ? plans : [];
  return rows
    .slice()
    .sort((a, b) => (Number(b?.avg_used_minutes ?? 0) - Number(a?.avg_used_minutes ?? 0)))
    .map((p) => ({
      id: String(p.plan || "").toUpperCase(),
      value: Number(p.avg_used_minutes ?? 0),
      color: PLAN_COLORS[p.plan] || "hsl(var(--primary))",
      users: Number(p.sample_size ?? 0),   // ✅ 사용자 수 전달
    }));
}, [plans]);


  const totalSamples = useMemo(
    () => (Array.isArray(plans) ? plans.reduce((s, p) => s + Number(p?.sample_size ?? 0), 0) : 0),
    [plans]
  );

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-2 flex items-end justify-between">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">플랜별 평균 사용시간 (분)</h3>
          <p className="text-xs text-muted-foreground/80">
            표본 {totalSamples.toLocaleString()}명 기준
          </p>
        </div>
        {/* 필요한 보조 UI가 있으면 여기에 */}
      </div>

      {loading && <div>로딩…</div>}
      {error && <div className="text-destructive">에러: {error}</div>}

      {!loading && !error && chartData.length > 0 && (
        <NivoBar data={chartData} height={280} showUserCount/>
      )}

      {!loading && !error && chartData.length === 0 && (
        <div className="text-sm text-muted-foreground">데이터 없음</div>
      )}
    </div>
  );
}
