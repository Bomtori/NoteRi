/* filename: src/test/components/usageDashBoard/TotalUsage.tsx */
import React, { useEffect, useState } from "react";
import StatCard from "../cards/StatCard";

/** 기본 API 베이스는 8000 포트 */
/** 기본 API 베이스는 8000 포트 */
const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE ??
  (import.meta as any).env?.API_BASE_URL ??
  "http://127.0.0.1:8000";

/** 응답에서 total_seconds 추출 (items/data 래핑도 대응) */
function pickTotalSeconds(payload: any): number {
  if (!payload || typeof payload !== "object") return 0;
  if ("total_seconds" in payload) return Number(payload.total_seconds ?? 0) || 0;
  if (payload.items && typeof payload.items === "object") return pickTotalSeconds(payload.items);
  if (payload.data && typeof payload.data === "object") return pickTotalSeconds(payload.data);
  return 0;
}

const TotalUsage: React.FC = () => {
  const [seconds, setSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/recordings/usage/total`, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setSeconds(pickTotalSeconds(json));
      } catch (e: any) {
        if (e?.name !== "AbortError") setError("총 사용량을 불러오지 못했습니다.");
        setSeconds(0);
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  const value = loading
    ? "로딩…"
    : error
    ? "-"
    : `${Math.round(seconds / 60).toLocaleString()} 분`;

  return <StatCard title="총 사용량" value={value} hideTrend />;
};

export default TotalUsage;
