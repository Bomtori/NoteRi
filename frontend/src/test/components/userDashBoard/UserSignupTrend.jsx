import React, { useEffect, useMemo, useState } from "react"
import DateButtons from "@/test/components/DateButtons.jsx"               // 하나만 import (중복 X)
import ShadcnAreaChart from "@/test/components/ShadcnAreaChart.js"
import { normalizeToXY} from "@/test/utils/normalizeToXY.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE ?? "http://localhost:8000"

export default function UserSignupTrend() {
  // 버튼 값: "7d" | "5w" | "6m" | "5y"
  const [uiRange, setUiRange] = useState("7d")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [series, setSeries] = useState([]) // 항상 [{x, y}]만 저장

  // 버튼 옵션을 메모이즈 (렌더마다 새 배열 생성 방지)
  const trendOptions = useMemo(
    () => [
      { value: "7d", label: "최근 7일" },
      { value: "5w", label: "최근 5주" },
      { value: "6m", label: "최근 6개월" },
      { value: "5y", label: "최근 5년" },
    ],
    []
  )

  // endpoint는 uiRange에서 바로 계산 (문자열 리터럴만 사용)
  const endpoint = useMemo(() => {
    switch (uiRange) {
      case "5w": return "/users/count/signup/last-5-weeks"
      case "6m": return "/users/count/signup/last-6-months"
      case "5y": return "/users/count/signup/last-5-years"
      case "7d":
      default:   return "/users/count/signup/last-7-days"
    }
  }, [uiRange])

  useEffect(() => {
    if (!endpoint) return
    const ac = new AbortController()

    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`${API_BASE_URL}${endpoint}`, { signal: ac.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const resp = await res.json()

        const list = normalizeToXY(resp)

        // 이전 데이터와 길이/합이 같으면 생략 (불필요 리렌더 방지)
        const prevSum = series.reduce((s, p) => s + (p.y || 0), 0)
        const nextSum = list.reduce((s, p) => s + (p.y || 0), 0)
        if (series.length !== list.length || prevSum !== nextSum) {
          setSeries(list)
        }
      } catch (e) {
        if (e.name !== "AbortError") setError("불러오기 실패")
      } finally {
        setLoading(false)
      }
    })()

    return () => ac.abort()
  // ❗ 의존성은 endpoint 하나만 (혹은 uiRange). series는 비교용이지만 의존성에 넣지 않음.
  }, [endpoint])

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <DateButtons
          range={uiRange}
          onRangeChange={setUiRange}
          options={trendOptions}     // ← 반드시 옵션을 넣어 7d/5w/6m/5y 사용
        />
      </div>

      <ShadcnAreaChart
        title={
          uiRange === "6m" ? "최근 6개월 가입자"
          : uiRange === "5y" ? "최근 5년 가입자"
          : uiRange === "5w" ? "최근 5주 가입자"
          : "최근 7일 가입자"
        }
        data={series}
        height={260}
        color="#7E36F9"
        showGrid
      />

      {loading && <div className="text-sm text-muted-foreground">로딩…</div>}
      {error && <div className="text-sm text-destructive">{error}</div>}
    </div>
  )
}
