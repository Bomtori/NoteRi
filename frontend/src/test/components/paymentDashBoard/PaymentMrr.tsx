import React, { useEffect, useState } from "react";
// @ts-expect-error TS7016: no declaration
import PaymentMrrCard from "@/test/components/paymentDashBoard/PaymentMrrCard.jsx";

const API_BASE_URL =
  import.meta.env.API_BASE_URL ?? "http://localhost:8000";

type MrrItem = {
  month: string;
  new: number;
  expansion: number;
  contraction: number;
  churn: number;
  net_new: number;
  ending_mrr: number;
};

const PaymentMrr: React.FC = () => {
  const [mrrData, setMrrData] = useState<MrrItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const months = 6;
        const params = new URLSearchParams({ months: String(months) });
        const res = await fetch(
          `${API_BASE_URL}/billing/mrr/breakdown?${params.toString()}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setMrrData(data.series);
      } catch (e: any) {
        setError(e?.message ?? "데이터 로드 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <PaymentMrrCard data={mrrData} loading={loading} error={error} />
    </>
  );
};

export default PaymentMrr;
