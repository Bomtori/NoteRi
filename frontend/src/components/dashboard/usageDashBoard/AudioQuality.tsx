// src/test/components/usageDashBoard/AudioQuality.tsx
import React, { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from "recharts";

type Datum = { id: string; value: number; color?: string; label?: string };
type Props = { frameless?: boolean; height?: number };

// 브랜드 퍼플 팔레트 (진 → 연)
export const COLORS = ["#7E37F9", "#B68CFF", "#9E77FF"];

const RAW: Datum[] = [
  { id: "고품질 (HD)", value: 73.2, color: "#7E37F9" }, // Brand Purple (메인)
  { id: "표준 (SD)", value: 24.8, color: "#B68CFF" },   // Lighter Purple
  { id: "저품질 (LD)", value: 2.0,  color: "#9CA3AF" }, // Neutral Gray
];

const AudioQuality: React.FC<Props> = ({ frameless = false, height = 260 }) => {
  const data = useMemo(() => RAW.map(d => ({ ...d, label: d.id })), []);
  const total = data.reduce((s, d) => s + d.value, 0);

  // 조각 안에 항상 보이는 % 라벨
  const renderSliceLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    const RAD = Math.PI / 180;
    const r = (innerRadius + outerRadius) / 2;
    const x = cx + r * Math.cos(-midAngle * RAD);
    const y = cy + r * Math.sin(-midAngle * RAD);
    return (
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fill="#ffffff"
        style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,.25)", strokeWidth: 2 }}
      >
        {Math.round(percent * 100)}%
      </text>
    );
  };

  return (
    <div className={`${frameless ? "" : "p-4 bg-card rounded-xl shadow-sm"} min-w-0 h-full flex flex-col`}>
      <h3 className="text-sm font-medium text-muted-foreground mb-2">녹음 품질별 분포</h3>

      {/* 차트 */}
      <div className="min-w-0 flex-1 min-h-0">
        <ResponsiveContainer width="100%" height={height - 80}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              label={renderSliceLabel}
              labelLine={false}
              isAnimationActive={false}
            >
              {data.map((d, i) => (
                <Cell key={d.id} fill={d.color || COLORS[i % COLORS.length]} />
              ))}
              {/* 가운데 합계/타이틀 */}
              <Label
                position="center"
                content={(props: any) => {
                  const vb = props?.viewBox as any;
                  const cx = vb?.cx;
                  const cy = vb?.cy;
                  if (typeof cx !== "number" || typeof cy !== "number") return null;

                  return (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
                      <tspan x={cx} y={cy - 6} className="fill-gray-500" fontSize="12">총</tspan>
                      <tspan x={cx} y={cy + 12} className="fill-gray-900" fontSize="14" fontWeight={600}>
                        100%
                      </tspan>
                    </text>
                  );
                }}
              />
            </Pie>
            <Tooltip
              formatter={(v: number, _: any, item: any) => [
                `${v} (${Math.round((v / total) * 100)}%)`,
                item?.payload?.label,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 항상 보이는 하단 레전드 */}
      <ul className="mt-3 grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
        {data.map((d, i) => {
          const pct = Math.round((d.value / total) * 100);
          return (
            <li key={d.id} className="flex items-center gap-2 min-w-0">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: d.color || COLORS[i % COLORS.length] }}
                aria-hidden
              />
              <span className="truncate">{d.label}</span>
              <span className="ml-auto tabular-nums shrink-0">
                {d.value} ({pct}%)
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default AudioQuality;
