// src/test/components/TotalPaymentByDate.jsx
import React, { useEffect, useState } from "react"
import CardPaymentByDate from "@/test/components/paymentDashBoard/CardPaymentByDate.jsx"

const API_BASE_URL = import.meta.env.VITE_API_BASE ?? "http://localhost:8000"

function pickGrowthRate(payload) {
  // 1) 단일 구조: { current, previous, growth_rate }
  if (payload && typeof payload.growth_rate === "number") return payload.growth_rate

  // 2) { ok, items: { current, previous, growth_rate } }
  if (payload?.items?.growth_rate != null) return Number(payload.items.growth_rate)

  // 3) 플랜별 dict: { pro:{current,previous,growth_rate}, enterprise:{...}, ... }
  if (payload && typeof payload === "object") {
    let cur = 0, prev = 0
    for (const v of Object.values(payload)) {
      if (v && typeof v === "object" && "current" in v && "previous" in v) {
        cur += Number(v.current || 0)
        prev += Number(v.previous || 0)
      }
    }
    if (cur === 0 && prev === 0) return 0
    return prev === 0 ? (cur > 0 ? 1 : 0) : (cur - prev) / prev
  }

  return 0
}

const TotalPaymentByDate = () => {
  const [range, setRange] = useState("today")     // today | 7d | month | year
  const [todayPayment, setTodayPayment] = useState(0)
  const [weekPayment, setWeekPayment] = useState(0)
  const [monthPayment, setMonthPayment] = useState(0)
  const [yearPayment, setYearPayment] = useState(0)
  const [growthRate, setGrowthRate] = useState(0)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const ac = new AbortController()

    const totalEndpoint = {
      today: "/payments/today",
      "7d":  "/payments/total/week",
      month: "/payments/total/month",
      year:  "/payments/total/year",
    }[range]

    // 성장률 엔드포인트 매핑 (백엔드에 맞게 경로만 조정하면 됨)
    const growthEndpoint = {
      today: "/analytics/revenue/dod",  // Day-over-Day
      "7d":  "/analytics/revenue/wow",  // Week-over-Week (동요일까지 누적)
      month: "/analytics/revenue/mom",  // Month-over-Month
      year:  "/analytics/revenue/yoy",  // Year-over-Year
    }[range]

    const run = async () => {
      try {
        setLoading(true)
        setError(null)

        // 총액
        const res = await fetch(`${API_BASE_URL}${totalEndpoint}`, { signal: ac.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const totalJson = await res.json()

        if (range === "today") setTodayPayment(totalJson.total ?? 0)
        if (range === "7d")    setWeekPayment(totalJson.total ?? 0)
        if (range === "month") setMonthPayment(totalJson.total ?? 0)
        if (range === "year")  setYearPayment(totalJson.total ?? 0)

        // 성장률
        const gr = await fetch(`${API_BASE_URL}${growthEndpoint}`, { signal: ac.signal })
        if (!gr.ok) throw new Error(`HTTP ${gr.status}`)
        const growthJson = await gr.json()
        setGrowthRate(pickGrowthRate(growthJson))
      } catch (e) {
        if (e.name !== "AbortError") setError("불러오기 실패")
      } finally {
        setLoading(false)
      }
    }

    run()
    return () => ac.abort()
  }, [range])

  return (
    <CardPaymentByDate
      range={range}
      setRange={setRange}
      todayPayment={todayPayment}
      weekPayment={weekPayment}
      monthPayment={monthPayment}
      yearPayment={yearPayment}
      growthRate={growthRate}   // 👈 뱃지에 표시
      loading={loading}
      error={error}
    />
  )
}

export default TotalPaymentByDate
