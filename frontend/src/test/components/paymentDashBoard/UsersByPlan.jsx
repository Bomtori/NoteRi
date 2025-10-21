import React, {useEffect, useState} from 'react';
import PricingBreakdownCard from "@/test/components/PricingBreakdownCard.jsx";

const UsersByPlan = () => {
    const API_BASE_URL = import.meta.env.API_BASE_URL ?? "http://localhost:8000"

          const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

    const [usersByPlan, setUsersByPlan] = useState({})

useEffect(() => {
  const ac = new AbortController();
  const run = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/subscriptions/count/plan`, { signal: ac.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // 예: data.get_user_count_by_provider === { google:116, naver:26, kakao:52 }
      console.log("data", data)
      setUsersByPlan(data || {})
    } catch (e) {
      if (e.name !== "AbortError") {
        setError("매출을 불러오지 못했습니다.");
        setUsersByPlan({});
      }
    } finally {
      setLoading(false);
    }
  };
  run();
  return () => ac.abort();
  // provider 비율이 range(오늘/7일/월/년)에 따라 바뀌는 API라면 [range] 유지,
  // 아니면 []로 한 번만 호출하세요.
}, []); // 필요 없으면 [] 로

    return (
        <>
            <PricingBreakdownCard className="h-[290px]"
                                  usersByPlan={usersByPlan}
            />
        </>
    );
};

export default UsersByPlan;