import React, { useEffect, useMemo, useState } from "react";
// import DateButtons from "../../dashboard/cards/DateButtons";
import { normalizeToXY } from "../../dashboard/utils/normalizeToXY";
import ShadcnAreaChart from "../../dashboard/cards/ShadcnAreaChart";
import AdminToggleTabs from "../../../components/admin/AdminToggleTabs"; // 경로 맞게

type UiRange = "7d" | "5w" | "6m" | "5y";
type XY = { x: string; y: number };

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE ??
  (import.meta as any).env?.API_BASE_URL ??
  "http://127.0.0.1:8000";

export default function UserSignupTrend() {
  const [uiRange, setUiRange] = useState<UiRange>("7d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [series, setSeries] = useState<XY[]>([]);

  const trendOptions = useMemo(
    () =>
      [
        { value: "7d", label: "최근 7일" },
        { value: "5w", label: "최근 5주" },
        { value: "6m", label: "최근 6개월" },
        { value: "5y", label: "최근 5년" },
      ] as const,
    []
  );

  const endpoint = useMemo(() => {
    switch (uiRange) {
      case "5w": return "/users/count/signup/last-5-weeks";
      case "6m": return "/users/count/signup/last-6-months";
      case "5y": return "/users/count/signup/last-5-years";
      case "7d":
      default:   return "/users/count/signup/last-7-days";
    }
  }, [uiRange]);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}${endpoint}`, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const resp = await res.json();

        const list: XY[] = normalizeToXY(resp);
        const prevSum = series.reduce((s, p) => s + (p.y || 0), 0);
        const nextSum = list.reduce((s, p) => s + (p.y || 0), 0);
        if (series.length !== list.length || prevSum !== nextSum) {
          setSeries(list);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") setError("불러오기 실패");
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [endpoint]); // series는 비교용이지만 의존성에서 제외

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <AdminToggleTabs
          size="sm"
          layoutId="signup-trend-tabs"
          className="bg-muted/60" // 필요 없으면 제거
          tabs={trendOptions.map(o => ({ id: o.value, label: o.label }))}
          active={uiRange}
          onChange={(id) => setUiRange(id as UiRange)}
        />
      </div>

      <ShadcnAreaChart
        title={
          uiRange === "6m" ? "최근 6개월 가입자"
          : uiRange === "5y" ? "최근 5년 가입자"
          : uiRange === "5w" ? "최근 5주 가입자"
          : "최근 7일 가입자"
        }
        data={series}
        xKey="x"
        series={[{ key: "y", name: "가입자", color: "#7E36F9" }]}
        height={260}
        showGrid
      />

      {loading && <div className="text-sm text-muted-foreground">로딩…</div>}
      {error && <div className="text-sm text-destructive">{error}</div>}
    </div>
  );
}
