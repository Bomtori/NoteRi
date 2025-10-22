// src/test/components/ShadcnAreaChart.tsx
import * as React from "react"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Point = { x: string | number; y: number }

// 멀티 시리즈 정의
type SeriesDef = {
  key: string            // 예: "pro", "enterprise"
  name?: string          // 툴팁/범례용 이름
  color?: string         // 기본선/그라디언트 색
  strokeWidth?: number   // 선 두께
  fillOpacity?: number   // 그라디언트 상단 불투명도(0~1)
}

export default function ShadcnAreaChart({
  title = "트래픽",
  data,
  height = 260,
  color = "#7E36F9",
  showGrid = true,
  gradientId = "",
  // ⬇️ 신규(옵션): 멀티 시리즈용
  xKey = "x",
  series,                // 정의가 들어오면 멀티 시리즈 모드
  overlap = false,       // true면 겹쳐 보이게(누적 X), false면 독립(기본)
  showLegend = false,
  tickFormatter,
  valueLabel = "값",
}: {
  title?: string
  data: any[] | Point[]                  // 멀티/단일 모두 수용
  height?: number
  color?: string
  showGrid?: boolean
  gradientId?: string
  // 신규
  xKey?: string
  series?: SeriesDef[]
  overlap?: boolean
  showLegend?: boolean
  tickFormatter?: (v: any) => string
  valueLabel?: string
}) {
  const gidBase = React.useId()
  const gid = gradientId || gidBase

  // 단일/멀티 판단
  const isMulti = Array.isArray(series) && series.length > 0

  // 멀티일 때 시리즈 색/옵션 기본값
  const resolvedSeries: SeriesDef[] = isMulti
    ? series!.map((s, i) => ({
        key: s.key,
        name: s.name ?? s.key,
        color: s.color ?? color,       // 기본 동일 색
        strokeWidth: s.strokeWidth ?? (i === 0 ? 2 : 2),
        fillOpacity: s.fillOpacity ?? (i === 0 ? 0.55 : 0.25), // 첫 시리즈 좀 더 진하게
      }))
    : []

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
                {isMulti
                  ? resolvedSeries.map((s, i) => (
                      <linearGradient key={s.key} id={`${gid}-fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={s.color} stopOpacity={s.fillOpacity} />
                        <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                      </linearGradient>
                    ))
                  : (
                    <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  )
                }
              </defs>

              <XAxis
                dataKey={xKey}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                stroke="hsl(var(--muted-foreground))"
                interval="preserveStartEnd"
                tickFormatter={tickFormatter}
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
                labelFormatter={(v) => (tickFormatter ? tickFormatter(v) : String(v))}
                formatter={(val: number, name) => [val.toLocaleString(), isMulti ? String(name) : valueLabel]}
              />

              {/* 단일 시리즈 (기존 그대로) */}
              {!isMulti && (
                <Area
                  type="monotone"
                  dataKey="y"
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#${gid}-fill)`}
                  dot={false}
                  isAnimationActive
                />
              )}

              {/* 멀티 시리즈 */}
              {isMulti &&
                resolvedSeries.map((s, i) => (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    stroke={s.color!}
                    strokeWidth={s.strokeWidth}
                    fill={`url(#${gid}-fill-${i})`}
                    dot={false}
                    isAnimationActive
                    connectNulls
                    {...(overlap ? {} : { stackId: undefined })} // overlap=true면 누적 안 함
                  />
                ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
