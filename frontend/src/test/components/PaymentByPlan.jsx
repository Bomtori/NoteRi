import React, {useEffect, useState} from 'react';
import PaymentPlanDonutGraph from "@/test/components/PaymentPlanDonutGraph.js";

const API_BASE_URL = import.meta.env.API_BASE_URL ?? "http://localhost:8000"

const PaymentByPlan = () => {
      const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

    const [totalPlan, setTotalPlan] = useState()

useEffect(() => {
  const ac = new AbortController();
  const run = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/analytics/revenue/paid`, { signal: ac.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // 예: data.get_user_count_by_provider === { google:116, naver:26, kakao:52 }
      console.log("data", data)
      setTotalPlan(data || {})
    } catch (e) {
      if (e.name !== "AbortError") {
        setError("매출을 불러오지 못했습니다.");
        setTotalPlan({});
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
        <PaymentPlanDonutGraph
        className="sm:col-span-2 xl:col-span-2 h-[340px]"
        totalPlan={totalPlan}
        />
        </>
    );
};

export default PaymentByPlan;