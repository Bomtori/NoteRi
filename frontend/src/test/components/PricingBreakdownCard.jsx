// src/test/components/PricingBreakdownCard.jsx
import React, { useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * props
 * - items?: Array<{ id: string; label: string; note?: string; count: number }>
 * - usersByPlan?: Record<string, number>  // { Basic: 9508, Pro: 5546, ... }
 * - highlight?: string                    // 강조할 플랜 이름 (대소문자 무시)
 * - notes?: Record<string, string>        // 라벨 옆 보조표기
 * - title?: string
 * - className?: string
 */
export default function PricingBreakdownCard({
  items,
  usersByPlan,
  title = "요금제별 가입 현황",
  className,
}) {
  // 입력 통합 (items 우선, 없으면 usersByPlan에서 생성)
  const rows = useMemo(() => {
    if (Array.isArray(items)) return items
    const obj = usersByPlan || {}
    return Object.entries(obj).map(([name, count]) => ({
      id: name,
      label: name,
      count: Number(count ?? 0),
    }))
  }, [items, usersByPlan])

  const total = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.count) || 0), 0),
    [rows]
  )
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">데이터가 없습니다.</div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto] gap-x-8 gap-y-4">
              {rows.map(({ id, label, count }) => (
                <React.Fragment key={id}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{label}</div>
                  </div>
                  <div className={cn("text-lg font-semibold tabular-nums")}>
                    {Number(count || 0).toLocaleString()}명
                  </div>
                </React.Fragment>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-[1fr_auto]">
              <div className="text-xs text-muted-foreground">총 합계</div>
              <div className="text-sm font-semibold tabular-nums">
                {total.toLocaleString()}명
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
