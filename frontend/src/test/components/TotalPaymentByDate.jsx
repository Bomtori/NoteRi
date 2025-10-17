import React, { useEffect, useState } from "react"
import * as PropTypes from "prop-types"
import CardPaymentByDate from "@/test/components/CardPaymentByDate" // 분리한 컴포넌트 임포트

const API_BASE_URL = import.meta.env.VITE_API_BASE ?? "http://localhost:8000"

const TotalPaymentByDate = () => {
  const [range, setRange] = useState("today")     // today | week | month | year
  const [todayPayment, setTodayPayment] = useState(0)
  const [weekPayment, setWeekPayment] = useState(0)
  const [monthPayment, setMonthPayment] = useState(0)
  const [yearPayment, setYearPayment] = useState(0)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const ac = new AbortController()
    const endpoint = {
      today: "/payments/today",
      "7d":  "/payments/total/week",
      month: "/payments/total/month",
      year:  "/payments/total/year",
    }[range]

    const run = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`${API_BASE_URL}${endpoint}`, { signal: ac.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        console.log("paymentData", data)
        if (range === "today") setTodayPayment(data.total ?? 0) // 서버 스펙에 맞게
        if (range === "7d")  setWeekPayment(data.total ?? 0)
        if (range === "month") setMonthPayment(data.total ?? 0)
        if (range === "year")  setYearPayment(data.total ?? 0)
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
  // ❌ <div>로 한번 더 감싸지 말고
  // ✅ 카드 컴포넌트 자체만 반환
  <CardPaymentByDate
    range={range}
    setRange={setRange}
    todayPayment={todayPayment}
    weekPayment={weekPayment}
    monthPayment={monthPayment}
    yearPayment={yearPayment}
    loading={loading}
    error={error}
  />
)
}

export default TotalPaymentByDate
