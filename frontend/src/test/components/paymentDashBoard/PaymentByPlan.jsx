// src/test/components/PaymentByPlan.jsx
import React, {useEffect, useState} from 'react';
import PaymentPlanDonutGraph from "@/test/components/paymentDashBoard/PaymentPlanDonutGraph.tsx";

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
  }, []);

  return (
    <PaymentPlanDonutGraph
      className="col-span-1"
      height={220}
      totalPlan={totalPlan}
    />
  );
};

export default PaymentByPlan;
