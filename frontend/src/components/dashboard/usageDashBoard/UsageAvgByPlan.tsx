import React, { useEffect, useMemo, useState } from "react";
import NivoBar from "../cards/NivoBar";

type PlanMeta = {
  name: string;
  display_name?: string;
  color?: string;
};

type PlanStat = {
  plan: string;
  avg_used_minutes?: number;
  sample_size?: number;
};

type ChartDatum = {
  id: string;
  value: number;
  color: string;
  users: number;
};

/** 퍼플 톤 기본 팔레트 (fallback) */
const FALLBACK_COLORS: Record<string, string> = {
  free: "#9E77FF",
  pro: "#B68CFF",
  enterprise: "#7E37F9",
};

/** 베이스 URL */
const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL ??
  (import.meta as any).env?.VITE_API_BASE ??
  (import.meta as any).env?.VITE_API_BASE_URL ??
  "http://127.0.0.1:8000";

export default function UsageAvgByPlan({
  className = "",
  height = 280,
  frameless = false,
}: {
  className?: string;
  height?: number;
  frameless?: boolean;
}) {
  const [plans, setPlans] = useState<PlanStat[]>([]);
  const [planMeta, setPlanMeta] = useState<PlanMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildInit = (): RequestInit => {
    const headers: Record<string, string> = { Accept: "application/json" };
    const token = localStorage.getItem("access_token");
    if (token) headers.Authorization = `Bearer ${token}`;
    return { credentials: "include", headers };
  };

  /** 플랜 메타 가져오기 */
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/plans`, {
          signal: ac.signal,
          ...buildInit(),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rows: any[] = Array.isArray(json?.plans)
          ? json.plans
          : Array.isArray(json)
          ? json
          : [];
        setPlanMeta(
          rows
            .filter((p) => p && p.name)
            .map((p) => ({
              name: String(p.name).toLowerCase(),
              display_name: p.display_name ?? undefined,
              color: p.color ?? undefined,
            }))
        );
      } catch {
        setPlanMeta([]);
      }
    })();
    return () => ac.abort();
  }, []);

  /** 평균 사용량 가져오기 */
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/recordings/usage/avg`, {
          signal: ac.signal,
          ...buildInit(),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rows: PlanStat[] = Array.isArray(json?.plans)
          ? json.plans
          : Array.isArray(json)
          ? json
          : [];
        setPlans(rows);
      } catch (e: any) {
        if (e?.name !== "AbortError") setError("불러오기 실패");
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  /** 색상 맵 (DB color > fallback) */
  const colorMap: Record<string, string> = useMemo(() => {
    const m: Record<string, string> = { ...FALLBACK_COLORS };
    for (const pm of planMeta) {
      const key = pm.name.toLowerCase();
      if (pm.color) m[key] = pm.color;
    }
    return m;
  }, [planMeta]);

  /** 차트 데이터 생성 (빈 값/누락 대비 완전 방어) */
  const chartData: ChartDatum[] = useMemo(() => {
    const usageByPlan = new Map<string, PlanStat>();
    for (const r of plans || []) {
      const key = String(r?.plan || "").toLowerCase();
      if (key) usageByPlan.set(key, r);
    }

    const planOrder: string[] =
      planMeta?.length > 0
        ? planMeta.map((p) => p.name)
        : usageByPlan.size > 0
        ? Array.from(usageByPlan.keys())
        : Object.keys(FALLBACK_COLORS);

    const filled: ChartDatum[] = (planOrder || [])
      .map((key) => {
        const stat = usageByPlan.get(key);
        const meta = planMeta.find((p) => p.name === key);
        const label = (meta?.display_name || key).toUpperCase();
        return {
          id: label,
          value: Number(stat?.avg_used_minutes ?? 0) || 0,
          color: colorMap[key] || "#7E37F9", // CSS 변수 대신 HEX
          users: Number(stat?.sample_size ?? 0) || 0,
        };
      })
      .filter((d): d is ChartDatum => !!d); // null 방어

    return filled.length > 0
      ? filled.slice().sort((a, b) => (b.value || 0) - (a.value || 0))
      : [{ id: "—", value: 0, color: "#7E37F9", users: 0 }];
  }, [plans, planMeta, colorMap]);

  /** 총 표본 수 */
  const totalSamples = useMemo(
    () =>
      Array.isArray(plans)
        ? plans.reduce(
            (s, p) => s + (Number(p?.sample_size ?? 0) || 0),
            0
          )
        : 0,
    [plans]
  );

  /** 외곽 Card 여부 */
  const wrapperClass = frameless ? "" : "p-4 bg-card rounded-xl shadow-sm";

  return (
    <div className={`w-full min-w-0 h-full flex flex-col ${wrapperClass} ${className}`}>
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

      {!loading && !error && (
        <>
          <div className="flex-1 min-h-0">
            {/* data가 무조건 배열이 되도록 보장 */}
            <NivoBar
              data={Array.isArray(chartData) ? chartData : []}
              height={height}
              showUserCount
            />
          </div>

          {chartData.every((d) => d.value === 0) && (
            <div className="mt-2 text-sm text-muted-foreground">
              데이터 없음 (플랜은 DB 기준으로 0 표시)
            </div>
          )}
        </>
      )}
    </div>
  );
}
