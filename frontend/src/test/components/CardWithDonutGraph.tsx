import React, { useMemo } from "react"
import { ResponsivePie } from "@nivo/pie"
import { Card, CardContent, CardHeader, CardTitle } from "@/test/ui/Card"

type ProviderCounts = Record<string, number> | undefined
type ProviderDatum = { id: string; value: number; color?: string }

const COLORS: Record<string, string> = {
  kakao: "#FEE500",   // 노랑
  naver: "#03C75A",   // 초록
  google: "#4285F4",  // 파랑
}

export default function CardWithDonutGraph({
  providerUsers,
  className = "",          // ✅ 추가
  height = 220,           // ✅ 추가: 차트 높이
}: {
  providerUsers: ProviderCounts | ProviderDatum[]
  className?: string
  height?: number
}) {
  // 객체/배열 어떤 형태로 와도 Nivo용 배열로 통일
  const data = useMemo<ProviderDatum[]>(() => {
    if (Array.isArray(providerUsers)) {
      return providerUsers.map((d) => ({
        id: d.id,
        value: Number(d.value ?? 0),
        color: d.color ?? COLORS[d.id] ?? "#94a3b8",
      }))
    }
    const counts = providerUsers ?? {}
    const base: ProviderDatum[] = ["kakao", "google", "naver"].map((id) => ({
      id,
      value: Number((counts as any)[id] ?? 0),
      color: COLORS[id] ?? "#94a3b8",
    }))
    Object.keys(counts).forEach((id) => {
      if (!base.find((b) => b.id === id)) {
        base.push({
          id,
          value: Number((counts as any)[id] ?? 0),
          color: COLORS[id] ?? "#94a3b8",
        })
      }
    })
    return base
  }, [providerUsers])

  const total = useMemo(
    () => data.reduce((s, d) => s + (Number(d.value) || 0), 0),
    [data]
  )

   return (
    <Card className={`bg-card text-card-foreground ${className}`}>
      <CardHeader className="p-5 pb-2">
        <CardTitle className="text-muted-foreground">플랫폼 별 가입자 비율</CardTitle>
      </CardHeader>

      <CardContent className="p-5 pt-0">
        <div className="text-2xl font-semibold mb-3">
          {total.toLocaleString()} 명
        </div>

        <div className="w-full overflow-hidden" style={{ height }}>
          <ResponsivePie
            data={data}
            margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
            innerRadius={0.3}
            padAngle={1.5}
            cornerRadius={4}
            activeOuterRadiusOffset={8}
            colors={{ datum: "data.color" }}
            borderWidth={2}
            borderColor="hsl(var(--background))"
            enableArcLinkLabels={false}
            arcLabelsSkipAngle={10}
            arcLabelsTextColor="hsl(var(--card-foreground))"
            theme={{
              background: "transparent",
              legends: { text: { fill: "hsl(var(--foreground))" } },
              tooltip: { container: { background: "transparent" } },
            }}
            tooltip={({ datum }) => (
              <div className="rounded-md border border-border bg-popover text-popover-foreground px-3 py-2 text-sm shadow-sm">
                <div className="font-medium">{String(datum.id)}</div>
                <div className="text-muted-foreground">
                  {Number(datum.value).toLocaleString()} (
                  {total ? Math.round((Number(datum.value) / total) * 100) : 0}
                  %)
                </div>
              </div>
            )}
          />
        </div>
      </CardContent>
    </Card>
  )
}
