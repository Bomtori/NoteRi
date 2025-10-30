/* filename: src/test/components/paymentDashBoard/MrrComboChart.tsx */
import React, { useEffect, useRef, useState } from "react";
import {
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Bar,
  Line,
} from "recharts";

export type MrrItem = {
  month: string;
  new: number;
  expansion: number;
  contraction: number;
  churn: number;
  ending_mrr: number;
};

type Props = {
  data?: MrrItem[];
  height?: number;   // 래퍼 div 픽셀 높이
  className?: string;
};

function useMeasuredSize(fallbackHeight = 350) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(
        1,
        Math.floor(el.style.height ? parseInt(el.style.height) : fallbackHeight)
      );
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
  }, [fallbackHeight]);

  return { ref, size };
}

export default function MrrComboChart({
  data = [],
  height = 350,
  className = "",
}: Props) {
  const { ref, size } = useMeasuredSize(height);

  return (
    <div
      ref={ref}
      className={`w-full min-w-0 ${className}`}
      style={{ height, minHeight: height }}
    >
      {size.w > 0 && size.h > 0 ? (
        <ComposedChart
          width={size.w}
          height={size.h}
          data={data}
          margin={{ top: 20, right: 30, bottom: 40, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11 }}
            angle={-30}
            dy={10}
            textAnchor="end"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => v.toLocaleString()}
            width={80}
          />
          <Tooltip
            formatter={(value: any) => Number(value ?? 0).toLocaleString()}
            contentStyle={{
              background: "white",
              border: "1px solid #e5e7eb",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />

          {/* 막대: 증감 요인 */}
          <Bar dataKey="new" name="신규" stackId="a" fill="#16a34a" />
          <Bar dataKey="expansion" name="확장" stackId="a" fill="#2563eb" />
          <Bar dataKey="contraction" name="축소" stackId="a" fill="#ef4444" />
          <Bar dataKey="churn" name="해지" stackId="a" fill="#f59e0b" />

          {/* 라인: 월말 MRR */}
          <Line
            type="monotone"
            dataKey="ending_mrr"
            name="월말 MRR"
            stroke="#111827"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      ) : null}
    </div>
  );
}
