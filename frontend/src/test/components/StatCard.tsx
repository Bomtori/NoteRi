import { TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Trend = "up" | "down"

export default function StatCard({
  title,
  value,
  delta = "+0%",
  trend = "up",
  highlight,
  caption,
  className,
  actions,              // ← 제목 옆 버튼 슬롯
  hideTrend = false,    // ← 필요 시 뱃지 숨김
}: {
  title: string
  value: string | number
  delta?: string
  trend?: Trend
  highlight?: string
  caption?: string
  className?: string
  actions?: React.ReactNode
  hideTrend?: boolean
}) {
  const isUp = trend === "up"
  const Icon = isUp ? TrendingUp : TrendingDown

  return (
    <Card className={cn("hover:shadow-md transition", className)}>
      <CardHeader className="flex items-start justify-between space-y-0">
        {/* 왼쪽: 제목 + 버튼들을 한 줄로 */}
        <div className="flex items-center gap-2.5 min-w-0">
          <CardTitle className="text-muted-foreground whitespace-nowrap">
            {title}
          </CardTitle>
        </div>
        <div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>

        {/* 오른쪽: 트렌드 뱃지 */}
        {!hideTrend && (
          <Badge
            // 타입 충돌 피하려고 기존 variant만 사용 + 초록 스타일 덮어쓰기
            variant={isUp ? "secondary" : "destructive"}
            className={cn("gap-1", isUp && "bg-green-50 text-green-700 border border-green-200")}
          >
            <Icon className="h-3.5 w-3.5" />
            {delta}
          </Badge>
        )}
      </CardHeader>

      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        <div className="mt-3 space-y-0.5">
          {highlight && (
            <div className="text-sm font-medium flex items-center gap-1">
              {highlight} <span className="text-muted-foreground">↗</span>
            </div>
          )}
          {caption && <CardDescription>{caption}</CardDescription>}
        </div>
      </CardContent>
    </Card>
  )
}