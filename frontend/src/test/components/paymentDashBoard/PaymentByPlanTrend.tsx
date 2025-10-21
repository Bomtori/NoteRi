// src/test/components/PaymentByPlanTrend.tsx
import React, { useEffect, useMemo, useRef, useState } from "react"
// @ts-expect-error TS7016: no declaration
import DateButtons from "@/test/components/DateButtons"
import ShadcnAreaChart from "@/test/components/ShadcnAreaChart"
// @ts-expect-error TS7016: no declaration
import { pivotPlansForMultiSeries } from "@/test/utils/pivotPlansForMultiSeries"

const API_BASE_URL = import.meta.env.VITE_API_BASE ?? "http://localhost:8000"

type Row = { x: string; pro?: number; enterprise?: number }

const fmtTick = (v: string) => {
  const d = new Date(v)
  return isNaN(d.getTime())
    ? String(v)
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default function PaymentByPlanTrend({ className = "" }: { className?: string }) {
  const [uiRange, setUiRange] = useState<"7d"|"5w"|"6m"|"5y">("7d")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [series, setSeries] = useState<Row[]>([])
  const prevSig = useRef("")

  const trendOptions = useMemo(
    () => [
      { value: "7d", label: "최근 7일" },
      { value: "5w", label: "최근 5주" },
      { value: "6m", label: "최근 6개월" },
      { value: "5y", label: "최근 5년" },
    ],
    []
  )

  const endpoint = useMemo(() => {
    switch (uiRange) {
      case "5w": return "/payments/last-5-weeks"
      case "6m": return "/payments/last-6-months"
      case "5y": return "/payments/last-5-years"
      case "7d":
      default:   return "/payments/last-7-days"
    }
  }, [uiRange])

  useEffect(() => {
    const ac = new AbortController()
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`${API_BASE_URL}${endpoint}`, { signal: ac.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const resp = await res.json()
        const next = pivotPlansForMultiSeries(resp, ["pro", "enterprise"])
          .map((r: { x: any; pro: any; enterprise: any }) => ({ x: r.x, pro: Number(r.pro ?? 0), enterprise: Number(r.enterprise ?? 0) }))
        const sig = `${next.length}:${next.reduce((s: any, r: { pro: any; enterprise: any }) => s + (r.pro || 0) + (r.enterprise || 0), 0)}`
        if (prevSig.current !== sig) {
          setSeries(next)
          prevSig.current = sig
        }
      } catch (e: any) {
        if (e.name !== "AbortError") setError("불러오기 실패")
      } finally {
        setLoading(false)
      }
    })()
    return () => ac.abort()
  }, [endpoint])

  const title =
    uiRange === "6m" ? "최근 6개월 매출 (Pro vs Enterprise)"
    : uiRange === "5y" ? "최근 5년 매출 (Pro vs Enterprise)"
    : uiRange === "5w" ? "최근 5주 매출 (Pro vs Enterprise)"
    : "최근 7일 매출 (Pro vs Enterprise)"

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex justify-end">
        <DateButtons range={uiRange} onRangeChange={setUiRange} options={trendOptions} />
      </div>

      <ShadcnAreaChart
        title={title}
        data={series}
        xKey="x"
        series={[
          { key: "enterprise", name: "Enterprise", color: "#7E36F9", fillOpacity: 0.55, strokeWidth: 2 },
          { key: "pro",        name: "Pro",        color: "#7E36F9", fillOpacity: 0.25, strokeWidth: 2 },
        ]}
        overlap
        gradientId="plan-trend"
        tickFormatter={fmtTick}
        showGrid
        height={220}
        color="#7E36F9"
      />

      {loading && <div className="text-sm text-muted-foreground">로딩…</div>}
      {error && <div className="text-sm text-destructive">{error}</div>}
    </div>
  )
}
