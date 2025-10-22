import { ResponsivePie } from "@nivo/pie"

type Datum = { id: string; label?: string; value: number; color?: string }

export default function NivoDonut({
  data,
  height = 300,
}: {
  data: Datum[]
  height?: number
}) {
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0)

  return (
    <div style={{ height }} className="relative">
      <ResponsivePie
        data={data}
        margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
        innerRadius={0.3}
        padAngle={1.5}
        cornerRadius={4}
        activeOuterRadiusOffset={8}
        colors={{ datum: "data.color" }}  // ✅ 각 데이터의 color 사용
        borderWidth={2}
        borderColor="hsl(var(--background))"
        enableArcLinkLabels={false}
        arcLabelsSkipAngle={10}
        arcLabelsTextColor="hsl(var(--card-foreground))"
        tooltip={({ datum }) => (
          <div className="rounded-md border border-border bg-popover text-popover-foreground px-3 py-2 text-sm shadow-sm">
            <div className="font-medium">{String(datum.id)}</div>
            <div className="text-muted-foreground">
              {Number(datum.value).toLocaleString()} (
              {total ? Math.round((Number(datum.value) / total) * 100) : 0}%)
            </div>
          </div>
        )}
        theme={{
          background: "transparent",
          legends: { text: { fill: "hsl(var(--foreground))" } },
          tooltip: { container: { background: "transparent" } },
        }}
      />
    </div>
  )
}
