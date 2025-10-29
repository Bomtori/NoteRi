/* filename: src/test/components/paymentDashBoard/TotalPayment.tsx */
import React, { useEffect, useState } from "react";
import StatCard from "../cards/StatCard";

type Props = {
  title?: string;
  className?: string;
};

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE ??
  (import.meta as any).env?.API_BASE_URL ??
  "http://127.0.0.1:8000";

const TotalPayment: React.FC<Props> = ({ title = "총 매출", className = "" }) => {
  const [totalPayments, setTotalPayments] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/payments/total/amount`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (aborted) return;
        setTotalPayments(Number(data.total ?? 0));
      } catch (e) {
        if (aborted) return;
        setError("금액을 불러올 수 없습니다.");
        setTotalPayments(0);
      } finally {
        if (!aborted) setLoading(false);
      }
    };

    run();
    return () => {
      aborted = true;
    };
  }, []);

  const displayValue =
    loading ? "로딩…" : error ? "-" : `${totalPayments.toLocaleString()} 원`;

  return (
    <StatCard
      title={title}
      value={displayValue}
      hideTrend
      className={className}
    />
  );
};

export default TotalPayment;
