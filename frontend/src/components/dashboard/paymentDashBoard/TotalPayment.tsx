/* filename: src/test/components/paymentDashBoard/TotalPayment.tsx */
import React, {useEffect, useMemo, useState} from "react";
import StatCard from "../cards/StatCard";

type Props = {
  title?: string;
  className?: string;
};

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE ??
  (import.meta as any).env?.API_BASE_URL ??
  "http://127.0.0.1:8000";

// ✅ 부드러운 카운트업 훅
function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (target - from) * eased);
      setVal(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

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
  const animated = useCountUp(!loading && !error ? totalPayments : 0, 900);

   const displayValue = useMemo(() => {
    if (loading) return "로딩…";
    if (error) return "-";
    return `${animated.toLocaleString()} 원`;
  }, [loading, error, animated]);
  return (
    <StatCard
      title={title}
      value={displayValue}
      hideTrend
      className={className}
      center
    />
  );
};

export default TotalPayment;
