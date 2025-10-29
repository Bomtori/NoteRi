import * as React from "react"
import StatCard from "../../dashboard/cards/StatCard" // 경로 너의 StatCard 위치에 맞게 수정

type Props = {
  title: string
  /** 숫자나 문자열 아무거나; null/undefined면 "-" 처리 */
  value: number | string | null | undefined
  /** 캡션(하단 보조 문구). 없으면 표시 안 함 */
  caption?: string | null
  /** 로딩이면 value/캡션을 자동으로 로딩 표시로 바꿈 */
  loading?: boolean
  /** 에러 문자열이 있으면 "-" 로 표시하고 캡션도 대체 */
  error?: string | null
  /** 우측 상단에 들어갈 actions (선택) */
  actions?: React.ReactNode
  /** 트렌드 뱃지 숨김 (기본: true) */
  hideTrend?: boolean
}

export default function MetricStatCard({
  title,
  value,
  caption,
  loading = false,
  error = null,
  actions,
  hideTrend = true,
}: Props) {
  // value formatting
  let displayValue: string
  if (loading) displayValue = "로딩…"
  else if (error) displayValue = "-"
  else if (typeof value === "number") displayValue = value.toLocaleString() + " 명"
  else if (typeof value === "string") displayValue = value
  else displayValue = "-"

  // caption formatting
  let displayCaption: string | undefined
  if (loading) displayCaption = "로딩..."
  else if (error) displayCaption = "-"
  else if (caption ?? false) displayCaption = caption ?? undefined

  return (
    <StatCard
      title={title}
      value={displayValue}
      caption={displayCaption}
      hideTrend={hideTrend}
      actions={actions}
    />
  )
}
