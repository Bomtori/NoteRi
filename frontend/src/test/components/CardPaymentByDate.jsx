// src/test/components/CardPaymentByDate.jsx
import React, { useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import DateButtons from "@/test/components/DateButtons"
import StatCard from "@/test/components/StatCard.js"; // 오늘/7일/1개월/1년 프리셋 그대로 사용

function currencyKRW(n) {
  try { return Number(n ?? 0).toLocaleString("ko-KR") + " 원" } catch { return "0 원" }
}

export default function CardPaymentByDate({
  range, setRange,
  todayPayment, weekPayment, monthPayment, yearPayment,
  loading, error,
}) {
  // 현재 선택된 값
  const value = useMemo(() => {
    if (range === "today") return todayPayment
    if (range === "7d")  return weekPayment
    if (range === "month") return monthPayment
    if (range === "year")  return yearPayment
    return 0
  }, [range, todayPayment, weekPayment, monthPayment, yearPayment])

  const title = useMemo(() => {
    if (range === "today") return "오늘 결제 합계"
    if (range === "7d")  return "최근 1주 결제 합계"
    if (range === "month") return "최근 1개월 결제 합계"
    if (range === "year")  return "최근 1년 결제 합계"
    return "결제 합계"
  }, [range])

  return (
   <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-6xl mx-auto grid gap-6 grid-cols-1">
        <StatCard
          title={title}
          value={value.toLocaleString()+" 원"}
          // delta/trend 등은 필요 시 여전히 전달 가능
          actions={
            <DateButtons
              range={range}
              onRangeChange={setRange}
            />
          }
          hideTrend
        />
      </div>
    </div>
  )
}
