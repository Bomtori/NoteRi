/* filename: src/test/components/usageDashBoard/TotalUsage.tsx */
import React, { useEffect, useState } from "react";
import StatCard from "../cards/StatCard";
import apiClient from "../../../api/apiClient";

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

      // ✅ Axios 요청으로 변경
      const { data: json } = await apiClient.get("/recordings/usage/total", {
        signal: ac.signal,
      });

      setSeconds(pickTotalSeconds(json));
    } catch (e: any) {
      if (e?.name !== "CanceledError" && e?.code !== "ERR_CANCELED") {
        setError("총 사용량을 불러오지 못했습니다.");
        setSeconds(0);
      }
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
