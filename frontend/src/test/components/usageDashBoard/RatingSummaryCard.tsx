// src/components/ratings/RatingSummaryCard.tsx
import React, { useMemo, useState, useEffect } from "react"
// @ts-expect-error TS7016: no declaration
import NivoBar from "@/test/components/NivoBar.tsx"
import {
  ensureSummary,
  toNivoBarData,
  type RatingSummary as RatingSummaryType,
} from "@/test/components/usageDashBoard/RatingSummary"   // ✅ 경로 정리

type Props = {
  className?: string
  height?: number
  showUsers?: boolean
  endpoint?: string              // ✅ 백엔드 라우트 (ex: /summary/final/ratings/summary)
  params?: Record<string, any>   // ✅ boardId, sessionId 등 쿼리 파라미터
  useMock?: boolean              // ✅ 개발 중 임시 데이터 사용 여부
}

// ✅ 임시 데이터 (원할 때만 사용)
const mockSummary: RatingSummaryType = ensureSummary({
  counts: { 1: 8, 2: 14, 3: 32, 4: 57, 5: 89 },
})

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"

export default function RatingSummaryCard({
  className = "",
  height = 240,
  showUsers = true,
  endpoint = "/summary/final/ratings",
  params,
  useMock = false,
}: Props) {
  const [summary, setSummary] = useState<RatingSummaryType | null>(useMock ? mockSummary : null)
  const [loading, setLoading] = useState(!useMock)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (useMock) return

    const url = new URL(`${API_BASE_URL}${endpoint}`)
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v))
      })
    }

    ;(async () => {
      try {
        setLoading(true)
        setErr(null)
       const res = await fetch(url.toString(), { credentials: "include" });
const text = await res.text();
if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
const payload = text ? JSON.parse(text) : { counts: {} };
setSummary(ensureSummary(payload));
      } catch (e: any) {
        setErr(e?.message ?? "불러오기 실패")
      } finally {
        setLoading(false)
      }
    })()
  }, [endpoint, JSON.stringify(params), useMock])

  const barData = useMemo(() => (summary ? toNivoBarData(summary) : []), [summary])

  const fmtInt = (n?: number) =>
    typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "0"

  const fmtAvg = (n?: number) =>
    typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "0.00"

  return (
    <div className={`p-4 bg-white rounded-2xl shadow ${className}`}>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">전체 게시글 평가 요약</h3>
          <p className="text-base text-muted-foreground/80">
  총 <span className="text-lg font-semibold tabular-nums">
    {fmtInt(summary?.total)}
  </span>명 ·
  평균 <span className="text-lg font-semibold tabular-nums">
    {fmtAvg(summary?.average)}
  </span> / 5
</p>
        </div>
      </div>

      {loading && <div className="min-h-[220px] grid place-items-center">로딩…</div>}
      {err && (
        <div className="min-h-[220px] grid place-items-center text-destructive">
          에러: {err}
        </div>
      )}

      {!loading && !err && summary && (
        <div className="min-h-[220px] min-w-0">
          <NivoBar
            data={barData}
            height={height}
            horizontal={true}                       // ✅ 가로 막대
            showUserCount={showUsers}               // ✅ users(n명) 라벨 표시
            valueFormatter={(v: unknown) => fmtInt(Number(v ?? 0))}
            maxValue="auto"
            // 필요 시 margin, padding, axis 옵션 추가
          />
        </div>
      )}
    </div>
  )
}
