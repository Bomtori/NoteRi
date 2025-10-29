import React, { useEffect, useMemo, useState } from "react";
import NivoBar from "../cards/NivoBar";

type PlanStat = {
  plan: string;
  avg_used_minutes?: number;
  sample_size?: number;
};

type ChartDatum = {
  id: string;
  value: number;
  color?: string;
  users?: number;
};

const PLAN_COLORS: Record<string, string> = {
  free: "#A1A1AA",       // gray
  pro: "#7E36F9",        // purple
  enterprise: "#FACC15", // yellow
};

/** 기본 API 베이스는 8000 포트 */
const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE ??
  (import.meta as any).env?.VITE_API_BASE_URL ??
  "http://127.0.0.1:8000";

export default function UsageAvgByPlan({
  className = "p-4 bg-card rounded-xl shadow-sm",
  height = 280,
}: {
  className?: string;
  height?: number;
}) {
  const [plans, setPlans] = useState<PlanStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 데이터 로드
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/recordings/usage/avg`, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rows: PlanStat[] = Array.isArray(json?.plans) ? json.plans : [];
        setPlans(rows);
      } catch (e: any) {
        if (e?.name !== "AbortError") setError("불러오기 실패");
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  // 차트 데이터 변환
  const chartData: ChartDatum[] = useMemo(() => {
    const rows = Array.isArray(plans) ? plans : [];
    return rows
      .slice()
      .sort(
        (a, b) =>
          (Number(b?.avg_used_minutes ?? 0) || 0) -
          (Number(a?.avg_used_minutes ?? 0) || 0)
      )
      .map((p) => {
        const id = String(p.plan ?? "").toUpperCase();
        const key = String(p.plan ?? "").toLowerCase();
        return {
          id,
          value: Number(p.avg_used_minutes ?? 0) || 0,
          color: PLAN_COLORS[key] || "hsl(var(--primary))",
          users: Number(p.sample_size ?? 0) || 0,
        };
      });
  }, [plans]);

  const totalSamples = useMemo(
    () =>
      Array.isArray(plans)
        ? plans.reduce((s, p) => s + (Number(p?.sample_size ?? 0) || 0), 0)
        : 0,
    [plans]
  );

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-2 flex items-end justify-between">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">
            플랜별 평균 사용시간 (분)
          </h3>
          <p className="text-xs text-muted-foreground/80">
            표본 {totalSamples.toLocaleString()}명 기준
          </p>
        </div>
      </div>

      {loading && <div>로딩…</div>}
      {error && <div className="text-destructive">에러: {error}</div>}

      {!loading && !error && chartData.length > 0 && (
        <NivoBar data={chartData} height={height} showUserCount />
      )}

      {!loading && !error && chartData.length === 0 && (
        <div className="text-sm text-muted-foreground">데이터 없음</div>
      )}
    </div>
  );
}
