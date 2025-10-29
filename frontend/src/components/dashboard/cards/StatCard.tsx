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
  actions,              // 제목 아래 버튼 영역
  hideTrend = false,
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
    <Card className={cn("w-full hover:shadow-md transition", className)}>
      <CardHeader className="space-y-2">
        {/* 1) 제목과 뱃지 한 줄 */}
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-muted-foreground">{title}</CardTitle>

          {!hideTrend && (
            <Badge
              variant={isUp ? "secondary" : "destructive"}
              className={cn("gap-1", isUp && "bg-green-50 text-green-700 border border-green-200")}
            >
              <Icon className="h-3.5 w-3.5" />
              {delta}
            </Badge>
          )}
        </div>

        {/* 2) 버튼(actions) — 제목 아래 */}
        {actions && <div className="shrink-0">{actions}</div>}
      </CardHeader>

      <CardContent>
        {/* 3) 값 — 한 줄 고정 */}
        <div className="text-3xl font-semibold tracking-tight whitespace-nowrap">
          {value}
        </div>

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
