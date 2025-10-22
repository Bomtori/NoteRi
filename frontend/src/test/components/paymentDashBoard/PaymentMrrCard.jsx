// frontend/src/test/components/paymentDashBoard/PaymentMrrCard.jsx
import React, { useMemo } from "react";
import MrrBarChart from "@/test/components/MrrBarChart.jsx";
import MrrComboChart from "@/test/components/MrrComboChart.jsx";
export default function PaymentMrrCard({ data = [], loading, error, className = "" }) {
  const chartData = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    return rows.map((r) => ({
      month: r.month,
      new: Number(r.new ?? 0),
      expansion: Number(r.expansion ?? 0),
      contraction: Number(r.contraction ?? 0),
      churn: Number(r.churn ?? 0),
      ending_mrr: Number(r.ending_mrr ?? 0),
    }));
  }, [data]);

  return (
    <div className={`w-full p-4 bg-white rounded-2xl shadow ${className}`}>
      <div className="mb-2 flex items-end justify-between">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground min-h-[360px] min-w-0">월별 MRR 분해 + 추세</h3>
          <p className="text-xs text-muted-foreground/80">
            신규/확장/축소/해지 요인 + 전체 MRR 변화
          </p>
        </div>
      </div>

      {loading && <div>로딩…</div>}
      {error && <div className="text-destructive">에러: {error}</div>}

      {!loading && !error && chartData.length > 0 && (
        <MrrComboChart data={chartData} height={350} />
      )}

      {!loading && !error && chartData.length === 0 && (
        <div className="text-sm text-muted-foreground">데이터 없음</div>
      )}
    </div>
  );
}