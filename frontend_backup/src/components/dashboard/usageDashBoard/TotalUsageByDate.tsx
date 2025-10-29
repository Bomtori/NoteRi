/* filename: src/test/components/usageDashBoard/TotalUsageByDate.tsx */
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../ui/card";
import DateButtons from "../cards/DateButtons";

type Range = "today" | "7d" | "month" | "year";

/** 기본 API 베이스는 8000 포트 */
const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE ??
  (import.meta as any).env?.API_BASE_URL ??
  "http://127.0.0.1:8000";

/** 숫자 안전 변환 */
const toNum = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** 응답에서 '분' 값을 안전하게 추출 (seconds/minutes/total 등 다양한 키 지원) */
function pickMinutes(payload: any): number {
  if (!payload || typeof payload !== "object") return 0;

  // 바로 분으로 오는 경우
  for (const k of ["total_minutes", "minutes", "used_minutes", "value", "sum", "total"]) {
    if (k in payload) {
      const n = toNum(payload[k]);
      // total 같은게 '초'일 수도 있으니 휴리스틱: 값이 크면 초로 간주해 분 변환
      if (k === "total") {
        if (n > 60 * 60 * 24) return Math.round(n / 60); // 초로 보임 → 분
        return n; // 이미 분일 가능성
      }
      return n;
    }
  }
  // 초로 오는 경우
  for (const k of ["total_seconds", "seconds", "used_seconds"]) {
    if (k in payload) return Math.round(toNum(payload[k]) / 60);
  }

  // 래핑 (items / data)
  if (payload.items && typeof payload.items === "object") return pickMinutes(payload.items);
  if (payload.data && typeof payload.data === "object") return pickMinutes(payload.data);

  return 0;
}

/** % 표기 */
function pct(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "0%";
  const v = Number(n);
  const fraction = Math.abs(v) > 1 ? v / 100 : v;
  return new Intl.NumberFormat("ko-KR", { style: "percent", maximumFractionDigits: 1 }).format(fraction);
}

/** 증감률 뱃지 */
function GrowthBadge({ rate, label }: { rate: number | null | undefined; label: string }) {
  const v = Number(rate ?? 0);
  const up = v > 0, down = v < 0;
  const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border";
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

const TotalUsageByDate: React.FC = () => {
  const [range, setRange] = useState<Range>("today");

  const [todayUsageTotal, setTodayUsageTotal] = useState(0);
  const [weekUsageTotal, setWeekUsageTotal] = useState(0);
  const [monthUsageTotal, setMonthUsageTotal] = useState(0);
  const [yearUsageTotal, setYearUsageTotal] = useState(0);

  const [growthRate, setGrowthRate] = useState(0); // %
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // (A) 구간별 총 사용량
  useEffect(() => {
    const ac = new AbortController();
    const endpoint =
      {
        today: "/recordings/usage/total/today",
        "7d": "/recordings/usage/total/7d",
        month: "/recordings/usage/total/month",
        year: "/recordings/usage/total/year",
      }[range] ?? "/recordings/usage/total/today";

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // 어떤 구조든 '분'으로 환산해서 세팅
        const minutes =
          pickMinutes(data) ||
          pickMinutes(data?.today) ||
          pickMinutes(data?.last_7_days) ||
          pickMinutes(data?.month) ||
          pickMinutes(data?.year);

        if (range === "today") setTodayUsageTotal(minutes);
        if (range === "7d") setWeekUsageTotal(minutes);
        if (range === "month") setMonthUsageTotal(minutes);
        if (range === "year") setYearUsageTotal(minutes);
      } catch (e: any) {
        if (e?.name !== "AbortError") setError("불러오기 실패");
      }
    })();

    return () => ac.abort();
  }, [range]);

  // (B) 비교 요약 (증감률)
  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE_URL}/recordings/usage/compare`, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const pctMap: Record<Range, number | undefined> = {
          today: data?.day?.pct,
          "7d": data?.week?.pct,
          month: data?.month?.pct,
          year: data?.year?.pct,
        };
        setGrowthRate(toNum(pctMap[range]));
      } catch (e: any) {
        if (e?.name !== "AbortError") setError("불러오기 실패");
        setGrowthRate(0);
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [range]);

  const value = useMemo(() => {
    switch (range) {
      case "today":
        return todayUsageTotal ?? 0;
      case "7d":
        return weekUsageTotal ?? 0;
      case "month":
        return monthUsageTotal ?? 0;
      case "year":
      default:
        return yearUsageTotal ?? 0;
    }
  }, [range, todayUsageTotal, weekUsageTotal, monthUsageTotal, yearUsageTotal]);

  const title = useMemo(() => {
    if (range === "today") return "오늘 총 사용량 (분)";
    if (range === "7d") return "최근 1주 총 사용량 (분)";
    if (range === "month") return "최근 1개월 총 사용량 (분)";
    if (range === "year") return "최근 1년 총 사용량 (분)";
    return "총 사용량 (분)";
  }, [range]);

  const badgeLabel: string =
    range === "today" ? "전일" : range === "7d" ? "전주" : range === "month" ? "전월" : "전년";

  return (
    <Card className="bg-card text-card-foreground flex flex-col">
      <CardHeader className="px-4 py-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xs text-muted-foreground">{title}</CardTitle>

          <div className="flex items-center gap-2">
            <GrowthBadge rate={growthRate} label={badgeLabel} />
          </div>
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
          {loading ? "로딩…" : error ? "-" : `${Number(value).toLocaleString()} 분`}
        </div>
      </CardHeader>

      <CardContent className="px-4 pt-0 pb-3">
        {error && <div className="text-sm text-destructive">{error}</div>}
      </CardContent>
    </Card>
  );
};

export default TotalUsageByDate;
