import React, { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.js";
// @ts-expect-error TS7016: no declaration
import DateButtons from "@/test/components/DateButtons.jsx";

function pct(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "0%";
  const v = Number(n);
  const fraction = Math.abs(v) > 1 ? v / 100 : v; // 7.5 or 0.075 모두 처리
  return new Intl.NumberFormat("ko-KR", { style: "percent", maximumFractionDigits: 1 }).format(fraction);
}

function GrowthBadge({ rate, label }: { rate: number | null | undefined; label: string }) {
  const v = Number(rate ?? 0);
  const up = v > 0, down = v < 0;
  const base =
    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border";
  const cls = up
    ? `${base} bg-emerald-50 text-emerald-700 border-emerald-200`
    : down
    ? `${base} bg-rose-50 text-rose-700 border-rose-200`
    : `${base} bg-muted text-muted-foreground border-border`;
  const arrow = up ? "▲" : down ? "▼" : "■";
  return (
    <span className={cls} title={`${label} 대비 증감률`}>
      {arrow} {pct(Math.abs(v))} <span className="opacity-70">/ {label}</span>
    </span>
  );
}

function DeltaBadge({ delta, label }: { delta: number | null | undefined; label: string }) {
  const d = Number(delta ?? 0);
  const up = d > 0, down = d < 0;
  const base =
    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border";
  const cls = up
    ? `${base} bg-emerald-50 text-emerald-700 border-emerald-200`
    : down
    ? `${base} bg-rose-50 text-rose-700 border-rose-200`
    : `${base} bg-muted text-muted-foreground border-border`;
  const sign = up ? "+" : down ? "−" : "±";
  const arrow = up ? "▲" : down ? "▼" : "■";
  const text = `${sign}${Math.abs(d).toLocaleString()} 분`;
  return (
    <span className={cls} title={`${label} 대비 증감량`}>
      {arrow} {text} <span className="opacity-70">/ {label}</span>
    </span>
  );
}

type Props = {
  range: "today" | "7d" | "month" | "year";
  setRange: (r: "today" | "7d" | "month" | "year") => void;
  todayUsageTotal?: number;
  weekUsageTotal?: number;
  monthUsageTotal?: number;
  yearUsageTotal?: number;
  growthRate?: number | null;   // %
  growthDelta?: number | null;  // 분
  loading?: boolean;
  error?: string | null;
  className?: string;
};

const TotalUsageByDateCard: React.FC<Props> = ({
  range, setRange,
  todayUsageTotal = 0,
  weekUsageTotal = 0,
  monthUsageTotal = 0,
  yearUsageTotal = 0,
  growthRate = 0,
  growthDelta = 0,
  loading = false,
  error = null,
  className = "",
}) => {
  const value = useMemo(() => {
    switch (range) {
      case "today": return todayUsageTotal ?? 0;
      case "7d":    return weekUsageTotal ?? 0;
      case "month": return monthUsageTotal ?? 0;
      case "year":
      default:      return yearUsageTotal ?? 0;
    }
  }, [range, todayUsageTotal, weekUsageTotal, monthUsageTotal, yearUsageTotal]);

  const title = useMemo(() => {
    if (range === "today") return "오늘 총 사용량 (분)";
    if (range === "7d")    return "최근 1주 총 사용량 (분)";
    if (range === "month") return "최근 1개월 총 사용량 (분)";
    if (range === "year")  return "최근 1년 총 사용량 (분)";
    return "총 사용량 (분)";
  }, [range]);

  const badgeLabel =
    range === "today" ? "전일"
    : range === "7d"  ? "전주"
    : range === "month" ? "전월"
    : "전년";

  // @ts-ignore
  return (
    <Card className={`bg-card text-card-foreground flex flex-col ${className}`}>
      <CardHeader className="px-4 py-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xs text-muted-foreground">{title}</CardTitle>

          {/* 증감률 + 증감량 뱃지 나란히 */}
          <div className="flex items-center gap-2">
            <GrowthBadge rate={growthRate} label={badgeLabel} />
          </div>
        </div>

        <div className="mt-1 mb-1 flex justify-end">
          <div className="max-w-full overflow-x-auto no-scrollbar">
            <DateButtons
              range={range}
              onRangeChange={setRange}
              className="[*]:h-6 [*]:px-2 [*]:text-[11px] [*]:rounded-md"
            />
          </div>
        </div>

        <div className="text-lg font-semibold leading-none">
          {loading ? "로딩…" : error ? "-" : `${Number(value).toLocaleString()} 분`}
        </div>
      </CardHeader>

      <CardContent className="px-4 pt-0 pb-3">
        {error && <div className="text-sm text-destructive">{error}</div>}
      </CardContent>
    </Card>
  );
};

export default TotalUsageByDateCard;
