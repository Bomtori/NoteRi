/* filename: src/test/components/paymentDashBoard/TotalPaymentByDate.tsx */
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import DateButtons from "../cards/DateButtons";
import AdminToggleTabs from "../../../components/admin/AdminToggleTabs";
import { DASH_CARD } from "../cards/cardStyles";

/** 기본 API 베이스는 8000 포트 */
const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE ?? "http://127.0.0.1:8000";

/** 퍼센트 포매터 */
function pct(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "0%";
  return new Intl.NumberFormat("ko-KR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(n);
}

/** 성장률 뱃지 */
function GrowthBadge({ rate, label }: { rate: number | null | undefined; label: string }) {
  const v = Number(rate ?? 0);
  const up = v > 0;
  const down = v < 0;
  const base =
    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border";
  const cls = up
    ? `${base} bg-emerald-50 text-emerald-700 border-emerald-200`
    : down
    ? `${base} bg-rose-50 text-rose-700 border-rose-200`
    : `${base} bg-muted text-muted-foreground border-border`;
  const arrow = up ? "▲" : down ? "▼" : "■";
  return (
    <span className={cls} title={`${label} 대비`}>
      {arrow} {pct(Math.abs(v))} <span className="opacity-70">/ {label}</span>
    </span>
  );
}

/** 백엔드 응답에서 growth_rate 꺼내기 (여러 형태 대응) */
function pickGrowthRate(payload: any) {
  // 1) 단일 구조: { current, previous, growth_rate }
  if (payload && typeof payload.growth_rate === "number") return payload.growth_rate;

  // 2) { ok, items: { current, previous, growth_rate } }
  if (payload?.items?.growth_rate != null) return Number(payload.items.growth_rate);

  // 3) 플랜별 dict: { pro:{current,previous,growth_rate}, enterprise:{...}, ... }
  if (payload && typeof payload === "object") {
    let cur = 0,
      prev = 0;
    for (const v of Object.values(payload)) {
      if (v && typeof v === "object" && "current" in v && "previous" in v) {
        cur += Number((v as any).current || 0);
        prev += Number((v as any).previous || 0);
      }
    }
    if (cur === 0 && prev === 0) return 0;
    return prev === 0 ? (cur > 0 ? 1 : 0) : (cur - prev) / prev;
  }

  return 0;
}

const TotalPaymentByDate: React.FC = () => {
  // today | 7d | month | year
  const [range, setRange] = useState<"today" | "7d" | "month" | "year">("today");
  const [todayPayment, setTodayPayment] = useState(0);
  const [weekPayment, setWeekPayment] = useState(0);
  const [monthPayment, setMonthPayment] = useState(0);
  const [yearPayment, setYearPayment] = useState(0);
  const [growthRate, setGrowthRate] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ac = new AbortController();

    const totalEndpoint =
      {
        today: "/payments/today",
        "7d": "/payments/total/week",
        month: "/payments/total/month",
        year: "/payments/total/year",
      }[range] ?? "/payments/today";

    // 성장률 엔드포인트 매핑
    const growthEndpoint =
      {
        today: "/analytics/revenue/dod", // Day-over-Day
        "7d": "/analytics/revenue/wow", // Week-over-Week
        month: "/analytics/revenue/mom", // Month-over-Month
        year: "/analytics/revenue/yoy", // Year-over-Year
      }[range] ?? "/analytics/revenue/dod";

    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        // 총액
        const res = await fetch(`${API_BASE_URL}${totalEndpoint}`, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const totalJson = await res.json();

        if (range === "today") setTodayPayment(totalJson.total ?? 0);
        if (range === "7d") setWeekPayment(totalJson.total ?? 0);
        if (range === "month") setMonthPayment(totalJson.total ?? 0);
        if (range === "year") setYearPayment(totalJson.total ?? 0);

        // 성장률
        const gr = await fetch(`${API_BASE_URL}${growthEndpoint}`, { signal: ac.signal });
        if (!gr.ok) throw new Error(`HTTP ${gr.status}`);
        const growthJson = await gr.json();
        setGrowthRate(pickGrowthRate(growthJson));
      } catch (e: any) {
        if (e?.name !== "AbortError") setError("불러오기 실패");
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => ac.abort();
  }, [range]);

  const value = useMemo(() => {
    if (range === "today") return todayPayment;
    if (range === "7d") return weekPayment;
    if (range === "month") return monthPayment;
    if (range === "year") return yearPayment;
    return 0;
  }, [range, todayPayment, weekPayment, monthPayment, yearPayment]);

  const title = useMemo(() => {
    if (range === "today") return "오늘 결제 합계";
    if (range === "7d") return "최근 1주 결제 합계";
    if (range === "month") return "최근 1개월 결제 합계";
    if (range === "year") return "최근 1년 결제 합계";
    return "결제 합계";
  }, [range]);

  const badgeLabel =
    range === "today" ? "전일" : range === "7d" ? "전주" : range === "month" ? "전월" : "전년";

  return (
    <Card className={DASH_CARD}>
      <div className="flex justify-end mb-3">
        {/*<DateButtons range={range} onRangeChange={setRange} />*/}
        <AdminToggleTabs
            size="sm"
            layoutId="total-payment-range"
            tabs={[
              { id: "today", label: "오늘" },
              { id: "7d",    label: "최근 7일" },
              { id: "month", label: "최근 1개월" },
              { id: "year",  label: "최근 1년" },
            ]}
            active={range}
            onChange={(id) => setRange(id as typeof range)}
          />
      </div>

      <CardHeader className="p-5 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
          <GrowthBadge rate={growthRate} label={badgeLabel} />
        </div>

        <div className="text-2xl font-semibold mt-2">
          {loading ? "로딩…" : error ? "-" : `${Number(value).toLocaleString()} 원`}
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-0">
        {error && <div className="text-sm text-destructive">{error}</div>}
      </CardContent>
    </Card>
  );
};

export default TotalPaymentByDate;
