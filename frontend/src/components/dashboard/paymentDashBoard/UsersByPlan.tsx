import React, { useEffect, useState } from "react";
import PricingBreakdownCard from "../cards/PricingBreakdownCard";

type UsersByPlanMap = Record<string, number>;

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE ??
  (import.meta as any).env?.API_BASE_URL ??
  "http://127.0.0.1:8000";

const UsersByPlan: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usersByPlan, setUsersByPlan] = useState<UsersByPlanMap>({});

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/subscriptions/count/plan`, {
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as UsersByPlanMap | null;
        setUsersByPlan(data ?? {});
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setError("플랜별 사용자 수를 불러오지 못했습니다.");
          setUsersByPlan({});
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  return (
    <PricingBreakdownCard
      className="h-[290px] min-w-0"
      usersByPlan={usersByPlan}
      loading={loading}
      error={error}
    />
  );
};

export default UsersByPlan;
