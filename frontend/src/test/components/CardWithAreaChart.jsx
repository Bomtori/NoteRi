// src/test/components/CardWithAreaChart.jsx
import React, { useMemo } from "react"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import DateButtons from "@/test/components/DateButtons" // ✅ 네가 가진 버튼 컴포넌트 재사용

export default function CardWithAreaChart({
  uiRange, onUiRangeChange,
  loading, error,
  last7d = [],
  last6m = [],
  last5y = [],
}) {
  // UI 범위(today/7d/month/year) → 사용할 데이터 결정
  const data = useMemo(() => {
    const pick =
      uiRange === "month" ? last6m :
      uiRange === "year"  ? last5y :
      /* today/7d */        last7d

    return (pick ?? []).map(r => ({ x: r.x, y: Number(r.y ?? 0) }))
  }, [uiRange, last7d, last6m, last5y])

  const total = useMemo(() => data.reduce((s, p) => s + (p.y || 0), 0), [data])

  return (
    <Card className="bg-card text-card-foreground">
      <CardHeader className="p-5 pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm text-muted-foreground">
            가입자 수 추이
          </CardTitle>

          {/* ✅ DateButtons 그대로 재사용 */}
          <DateButtons range={uiRange} onRangeChange={onUiRangeChange} />
        </div>
        <div className="text-2xl font-semibold mt-2">
          {loading ? "로딩…" : error ? "-" : `${total.toLocaleString()} 명`}
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-0">
        {error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : (
          <div className="w-full h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 10, left: 8 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <defs>
                  <linearGradient id="signupTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="x"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  width={40}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.15 }}
                  contentStyle={{
                    background: "transparent",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    padding: "6px 10px",
                  }}
                  formatter={(val) => [Number(val).toLocaleString() + " 명", "가입자"]}
                  labelFormatter={(v) => String(v)}
                />
                <Area
                  type="monotone"
                  dataKey="y"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#signupTrendFill)"
                  dot={false}
                  isAnimationActive
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
