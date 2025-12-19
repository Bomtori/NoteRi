import React, { useEffect, useState } from "react";
import PricingBreakdownCard from "../cards/PricingBreakdownCard";
import apiClient from "../../../api/apiClient";

type UsersByPlanMap = Record<string, number>;

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

      // ✅ Axios 버전
      const { data } = await apiClient.get<UsersByPlanMap | null>(
        "/subscriptions/count/plan",
        { signal: ac.signal }
      );

      setUsersByPlan(data ?? {});
    } catch (e: any) {
      if (e?.name !== "CanceledError" && e?.code !== "ERR_CANCELED") {
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
