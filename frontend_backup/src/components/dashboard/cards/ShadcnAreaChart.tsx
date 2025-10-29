import React, { useEffect, useRef, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

type SeriesConf = {
  key: string; name?: string; color?: string;
  fillOpacity?: number; strokeWidth?: number;
};

type AnimationOpts = {
  active?: boolean;        // 기본 true
  begin?: number;          // 기본 0 ms
  duration?: number;       // 기본 700 ms
  easing?: "ease" | "ease-in" | "ease-out" | "ease-in-out" | "linear";
};

function useMeasuredSize(fallbackHeight = 220) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(el.style.height ? parseInt(el.style.height) : fallbackHeight));
      setSize({ w, h });
    };
    measure();
    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    ro.observe(el);
    const mo = new MutationObserver(() => requestAnimationFrame(measure));
    mo.observe(el, { attributes: true, attributeFilter: ["style", "class"] });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [fallbackHeight]);
  return { ref, size };
}

export default function ShadcnAreaChart({
  title,
  data = [],
  xKey,
  series = [],
  height = 220,
  showGrid,
  tickFormatter,
  animation, // ✅ 추가
}: {
  title?: string;
  data?: any[];
  xKey: string;
  series?: SeriesConf[];
  height?: number;
  showGrid?: boolean;
  tickFormatter?: (v: any) => string;
  animation?: AnimationOpts;   // ✅ 추가
}) {
  const safeData = Array.isArray(data) ? data : [];
  const safeSeries = Array.isArray(series) ? series : [];
  const { ref, size } = useMeasuredSize(height);

  // ✅ 애니메이션 기본값
  const isActive  = animation?.active ?? true;
  const begin     = animation?.begin ?? 0;
  const duration  = animation?.duration ?? 700;
  const easing    = animation?.easing ?? "ease-in-out";

  return (
    <div className="w-full min-w-0">
      {title && <div className="text-sm text-muted-foreground mb-2">{title}</div>}
      <div ref={ref} className="w-full min-w-0" style={{ height, minHeight: height }}>
        {size.w > 0 && size.h > 0 && safeSeries.length > 0 ? (
          <AreaChart width={size.w} height={size.h} data={safeData}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={xKey} tickFormatter={tickFormatter} />
            <YAxis />
            <Tooltip />
            <Legend />
            {safeSeries.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name ?? s.key}
                stroke={s.color}
                fill={s.color}
                fillOpacity={s.fillOpacity ?? 0.25}
                strokeWidth={s.strokeWidth ?? 2}
                isAnimationActive={isActive}      // ✅ 켰다!
                animationBegin={begin}
                animationDuration={duration}
                animationEasing={easing}
              />
            ))}
          </AreaChart>
        ) : null}
      </div>
    </div>
  );
}
