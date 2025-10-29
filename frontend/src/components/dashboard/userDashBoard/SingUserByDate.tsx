import React, { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import DateButtons from "../../dashboard/cards/DateButtons";

type Range = "today" | "7d" | "month" | "year";

function pct(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "0%";
  return new Intl.NumberFormat("ko-KR", { style: "percent", maximumFractionDigits: 1 }).format(
    Math.abs(Number(n) > 1 ? Number(n) / 100 : Number(n))
  );
}

function GrowthBadge({ rate, label }: { rate?: number | null; label: string }) {
  const v = Number(rate ?? 0);
  const up = v > 0,
    down = v < 0;
  const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border";
  const cls = up
    ? `${base} bg-emerald-50 text-emerald-700 border-emerald-200`
    : down
    ? `${base} bg-rose-50 text-rose-700 border-rose-200`
    : `${base} bg-muted text-muted-foreground border-border`;
  const arrow = up ? "▲" : down ? "▼" : "■";
  return (
    <span className={cls} title={`${label} 대비`}>
      {arrow} {pct(v)} <span className="opacity-70">/ {label}</span>
    </span>
  );
}

export default function SingUserByDate({
  range,
  setRange,
  todaySignupUsers,
  last7dSignupUsers,
  lastMonthSignupUsers,
  lastYearSignupUsers,
  growthRate,
  loading,
  error,
  className = "",
}: {
  range: Range;
  setRange: (value: Range) => void; // Dispatch<SetStateAction<Range>>도 호환됨
  todaySignupUsers?: number;
  last7dSignupUsers?: number;
  lastMonthSignupUsers?: number;
  lastYearSignupUsers?: number;
  growthRate?: number | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
}) {
  const value = useMemo(() => {
    switch (range) {
      case "today":
        return todaySignupUsers ?? 0;
      case "7d":
        return last7dSignupUsers ?? 0;
      case "month":
        return lastMonthSignupUsers ?? 0;
      case "year":
      default:
        return lastYearSignupUsers ?? 0;
    }
  }, [range, todaySignupUsers, last7dSignupUsers, lastMonthSignupUsers, lastYearSignupUsers]);

  const title = useMemo(() => {
    if (range === "today") return "오늘 가입자 수";
    if (range === "7d") return "최근 1주 가입자 수";
    if (range === "month") return "최근 1개월 가입자 수";
    if (range === "year") return "최근 1년 가입자 수";
    return "가입자 수";
  }, [range]);

  const badgeLabel = range === "today" ? "전일" : range === "7d" ? "전주" : range === "month" ? "전월" : "전년";

  return (
    <Card className={`bg-card text-card-foreground flex flex-col ${className}`}>
      <CardHeader className="px-4 py-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xs text-muted-foreground">{title}</CardTitle>
          <GrowthBadge rate={growthRate ?? 0} label={badgeLabel} />
        </div>

        <div className="mt-1 mb-1 flex justify-end">
          <div className="max-w-full overflow-x-auto no-scrollbar">
            <DateButtons<Range>
              range={range}
              onRangeChange={setRange}
              className="[*]:h-6 [*]:px-2 [*]:text-[11px] [*]:rounded-md"
              options={[
                { value: "today", label: "오늘" },
                { value: "7d", label: "최근 7일" },
                { value: "month", label: "최근 1개월" },
                { value: "year", label: "최근 1년" },
              ]}
            />
          </div>
        </div>

        <div className="text-lg font-semibold leading-none">
          {loading ? "로딩…" : error ? "-" : `${Number(value).toLocaleString()} 명`}
        </div>
      </CardHeader>

      <CardContent className="px-4 pt-0 pb-3">{error && <div className="text-sm text-destructive">{error}</div>}</CardContent>
    </Card>
  );
}
