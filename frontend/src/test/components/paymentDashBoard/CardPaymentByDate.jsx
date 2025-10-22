// src/test/components/CardPaymentByDate.jsx
import React, { useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.js"
import DateButtons from "@/test/components/DateButtons.jsx"

function pct(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "0%"
  return new Intl.NumberFormat("ko-KR", { style: "percent", maximumFractionDigits: 1 }).format(n)
}

function GrowthBadge({ rate, label }) {
  const v = Number(rate ?? 0)
  const up = v > 0
  const down = v < 0
  const base =
    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border"
  const cls = up
    ? `${base} bg-emerald-50 text-emerald-700 border-emerald-200`
    : down
    ? `${base} bg-rose-50 text-rose-700 border-rose-200`
    : `${base} bg-muted text-muted-foreground border-border`
  const arrow = up ? "▲" : down ? "▼" : "■"
  return (
    <span className={cls} title={`${label} 대비`}>
      {arrow} {pct(Math.abs(v))} <span className="opacity-70">/ {label}</span>
    </span>
  )
}

export default function CardPaymentByDate({
  range, setRange,
  todayPayment, weekPayment, monthPayment, yearPayment,
  growthRate,
  loading, error,
}) {
  const value = useMemo(() => {
    if (range === "today") return todayPayment
    if (range === "7d")    return weekPayment
    if (range === "month") return monthPayment
    if (range === "year")  return yearPayment
    return 0
  }, [range, todayPayment, weekPayment, monthPayment, yearPayment])

  const title = useMemo(() => {
    if (range === "today") return "오늘 결제 합계"
    if (range === "7d")    return "최근 1주 결제 합계"
    if (range === "month") return "최근 1개월 결제 합계"
    if (range === "year")  return "최근 1년 결제 합계"
    return "결제 합계"
  }, [range])

  const badgeLabel =
    range === "today" ? "전일"
    : range === "7d"  ? "전주"
    : range === "month" ? "전월"
    : "전년"

  return (
    <Card className="bg-card text-card-foreground">
      {/* 헤더: 좌측 타이틀, 우측 뱃지 */}
      <CardHeader className="p-5 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
          <GrowthBadge rate={growthRate} label={badgeLabel} />
        </div>
                <div className="flex justify-end mb-3">
          <DateButtons range={range} onRangeChange={setRange} />
        </div>
        <div className="text-2xl font-semibold mt-2">
          {loading ? "로딩…" : error ? "-" : `${Number(value).toLocaleString()} 원`}
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-0">
        {/* 본문 상단 우측: 버튼 (뱃지와 분리됨) */}


        {error && <div className="text-sm text-destructive">{error}</div>}
      </CardContent>
    </Card>
  )
}
