/* filename: src/test/components/paymentDashBoard/PaymentMrr.tsx */
import React, { useEffect, useMemo, useState } from "react";
import MrrComboChart from "../cards/MrrComboChart";
import {Card} from "../../ui/card";
import {cn} from "../../../lib/utils";
import {DASH_CARD} from "../cards/cardStyles";
import apiClient from "../../../api/apiClient";

type MrrItem = {
  month: string;
  new: number;
  expansion: number;
  contraction: number;
  churn: number;
  net_new?: number;
  ending_mrr: number;
};

type Props = {
  months?: number;      // 불러올 개월 수 (기본 6)
  className?: string;   // 외부에서 여백/배경 조정
};

/** 기본 API 베이스는 8000 포트 */
const PaymentMrr: React.FC<Props> = ({ months = 6, className = "" }) => {
  const [mrrData, setMrrData] = useState<MrrItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 데이터 로드
  useEffect(() => {
  const ac = new AbortController();

  (async () => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await apiClient.get("/billing/mrr/breakdown", {
        params: { months: String(months) },
        signal: ac.signal, // ✅ Axios v1에서 지원
      });

      // 백엔드 응답 유연 처리: { series: [...] } 또는 배열 그대로
      const rows: any[] = Array.isArray(data) ? data : data?.series ?? [];

      setMrrData(
        rows.map((r) => ({
          month: String(r.month),
          new: Number(r.new ?? 0),
          expansion: Number(r.expansion ?? 0),
          contraction: Number(r.contraction ?? 0),
          churn: Number(r.churn ?? 0),
          ending_mrr: Number(r.ending_mrr ?? 0),
          net_new: r.net_new != null ? Number(r.net_new) : undefined,
        }))
      );
    } catch (e: any) {
      // 요청 취소는 무시
      if (e?.name !== "CanceledError" && e?.code !== "ERR_CANCELED") {
        setError(e?.message ?? "데이터 로드 실패");
      }
    } finally {
      setLoading(false);
    }
  })();

  return () => ac.abort();
}, [months]);

  // 차트에 바로 쓸 수 있게 정제
  const chartData = useMemo(
    () =>
      mrrData.map((r) => ({
        month: r.month,
        new: r.new,
        expansion: r.expansion,
        contraction: r.contraction,
        churn: r.churn,
        ending_mrr: r.ending_mrr,
      })),
    [mrrData]
  );

  return (
    <Card className={cn(DASH_CARD, className)}>
      <div className="mb-2 flex items-end justify-between">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">
            월별 MRR 분해 + 추세
          </h3>
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
    </Card>
  );
};

export default PaymentMrr;
