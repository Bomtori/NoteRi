// src/test/components/RechartsDonut.tsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";

type Datum = { id: string; label?: string; value: number; color?: string };

type LegendPlacement = "bottom" | "right";

export default function RechartsDonut({
  data,
  height = 220,
  aspect,
  showLegend = true,         
  legendPlacement = "bottom",   
  labelsMap,              
  className = "",
}: {
  data: Datum[];
  height?: number;
  aspect?: number;
  showLegend?: boolean;
  legendPlacement?: LegendPlacement;
  labelsMap?: Record<string, string>;
  className?: string;
}) {
  const { ref, size } = useMeasuredSize(aspect, height);

  const total = useMemo(
    () => data.reduce((s, d) => s + (Number(d.value) || 0), 0),
    [data]
  );

  // 범례에서 사용할 표시 데이터
  const legendData = useMemo(
    () =>
      data.map((d, idx) => {
        const name = labelsMap?.[String(d.id)] ?? d.label ?? d.id;
        const value = Number(d.value) || 0;
        const pct = total ? Math.round((value / total) * 100) : 0;
        const color = d.color ?? `hsl(${(idx * 47) % 360} 70% 55%)`;
        return { id: String(d.id), name: String(name), value, pct, color };
      }),
    [data, labelsMap, total]
  );

  // 레이아웃: 범례가 right면 flex로 좌-우 배치
  const isRight = legendPlacement === "right";

  return (
    <div
      className={`w-full ${className} ${isRight ? "flex items-center gap-4" : ""}`}
      style={{ minHeight: height }}
    >
      {/* 차트 컨테이너 (자가 측정) */}
      <div
        ref={ref}
        className={`min-w-0 ${isRight ? "flex-1" : "w-full"}`}
        style={{ height, minHeight: height }}
      >
        {size.w > 0 && size.h > 0 ? (
          <PieChart width={size.w} height={size.h}>
            <Pie
              data={data.map((d) => ({
                name: String(labelsMap?.[String(d.id)] ?? d.label ?? d.id),
                id: String(d.id),
                value: Number(d.value) || 0,
                color: d.color,
              }))}
              dataKey="value"
              nameKey="name"
              innerRadius="30%"
              outerRadius="70%"
              paddingAngle={1.5}
              cornerRadius={4}
              stroke="hsl(var(--background))"
              strokeWidth={2}
              labelLine
              isAnimationActive
            >
              {data.map((entry, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={entry.color ?? `hsl(${(idx * 47) % 360} 70% 55%)`}
                />
              ))}
            </Pie>

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0] as any;
                const name: string = p?.payload?.name ?? p?.name ?? "";
                const val: number = Number(p?.value) || 0;
                const pct = total ? Math.round((val / total) * 100) : 0;

                return (
                  <div className="rounded-md border border-border bg-popover text-popover-foreground px-3 py-2 text-sm shadow-sm">
                    <div className="font-medium">{name}</div>
                    <div className="text-muted-foreground">
                      {val.toLocaleString()} ({pct}%)
                    </div>
                  </div>
                );
              }}
            />
          </PieChart>
        ) : null}
      </div>

      {/* 커스텀 범례 */}
      {showLegend && (
        <LegendBlock
          items={legendData}
          placement={legendPlacement}
          className={isRight ? "shrink-0 w-[180px]" : "mt-3"}
        />
      )}
    </div>
  );
}

/* ---------- 내부 컴포넌트 & 훅 ---------- */

function LegendBlock({
  items,
  placement,
  className = "",
}: {
  items: { id: string; name: string; value: number; pct: number; color: string }[];
  placement: LegendPlacement;
  className?: string;
}) {
  // 아래 배치면 2열 그리드, 오른쪽 배치면 단일 컬럼
  const layoutCls =
    placement === "right"
      ? "flex flex-col gap-2"
      : "grid grid-cols-2 gap-x-4 gap-y-2";

  return (
    <div className={`text-sm ${layoutCls} ${className}`}>
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block rounded-sm"
            style={{ width: 10, height: 10, background: it.color }}
            aria-hidden
          />
          <span className="truncate" title={it.name}>
            {it.name}
          </span>
          <span className="ml-auto tabular-nums text-muted-foreground">
            {it.value.toLocaleString()} ({it.pct}%)
          </span>
        </div>
      ))}
    </div>
  );
}

function useMeasuredSize(aspect?: number, fallbackHeight = 220) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(aspect ? w / aspect : fallbackHeight));
      setSize({ w, h });
    };

    measure();
    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    ro.observe(el);
    const mo = new MutationObserver(() => requestAnimationFrame(measure));
    mo.observe(el, { attributes: true, attributeFilter: ["style", "class"] });

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [aspect, fallbackHeight]);

  return { ref, size };
}
