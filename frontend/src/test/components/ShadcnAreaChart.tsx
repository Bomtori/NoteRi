import * as React from "react"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Point = { x: string | number; y: number }

export default function ShadcnAreaChart({
  title = "트래픽",
  data,
  height = 260,
  color = "#4285F4",
  showGrid = true,
}: {
  title?: string
  data: Point[]
  height?: number
  color?: string
  showGrid?: boolean
}) {
  return (
    <Card className="bg-card text-card-foreground">
      <CardHeader className="p-5 pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 10, left: 8 }}>
              {showGrid && (
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              )}

              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
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
                width={36}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                cursor={{ stroke: color, strokeOpacity: 0.15 }}
                contentStyle={{
                  background: "transparent",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  padding: "6px 10px",
                }}
                labelFormatter={(v) => String(v)}
                formatter={(val: number) => [val.toLocaleString(), "값"]}
              />

              {/* ⬇ 부드러운 곡선 + 그라디언트 채우기 */}
              <Area
                type="monotone"
                dataKey="y"
                stroke={color}
                strokeWidth={2}
                fill="url(#areaFill)"
                dot={false}
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
