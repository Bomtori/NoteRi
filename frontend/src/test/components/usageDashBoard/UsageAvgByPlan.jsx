// frontend/src/test/components/usageDashBoard/UsageAvgByPlan.jsx
import React, { useEffect, useState } from "react";
import UsageAvgByPlanCard from "@/test/components/usageDashBoard/UsageAvgByPlanCard.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export default function UsageAvgByPlan() {
  const [plans, setPlans] = useState([]); // [{ plan, avg_used_minutes, sample_size }]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/recordings/usage/avg`, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setPlans(Array.isArray(json?.plans) ? json.plans : []);
      } catch (e) {
        if (e.name !== "AbortError") setError("불러오기 실패");
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  return (
    <UsageAvgByPlanCard
      plans={plans}
      loading={loading}
      error={error}
      className="p-4 bg-card rounded-xl shadow-sm"
    />
  );
}
