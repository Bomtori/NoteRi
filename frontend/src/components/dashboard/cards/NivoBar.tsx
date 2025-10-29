import React from "react";
import {
  ResponsiveBar,
  type BarCustomLayer,
  type BarCustomLayerProps,
  type BarSvgProps,
  type ComputedBarDatum,
  type ComputedDatum,
} from "@nivo/bar";

/** 차트 데이터 스키마 */
export type MyBarDatum = {
  id: string;      // 카테고리 (예: "고품질 (HD)")
  value: number;   // 값 (퍼센트 또는 분)
  color?: string;  // 색상
  users?: number;  // 사용자 수 (표본)
};

type Props = {
  data: MyBarDatum[];
  height?: number;
  horizontal?: boolean;
  showUserCount?: boolean;                 // 막대 우측에 "n명" 라벨
  valueFormatter?: (v: number) => string;  // 레이블/툴팁 표기
  maxValue?: number | "auto";              // 최신 Nivo에선 valueScale.max로 설정
};

export default function NivoBar({
  data,
  height = 300,
  horizontal = true,
  showUserCount = false,
  valueFormatter = (v) => String(v),
  maxValue = "auto",
}: Props) {
  /** ✅ 사용자 수 라벨 커스텀 레이어 (readonly bars) */
  const UsersLayer: BarCustomLayer<MyBarDatum> = (props: BarCustomLayerProps<MyBarDatum>) => {
    if (!showUserCount) return null;

    const { bars } = props; // readonly ComputedBarDatum<MyBarDatum>[]
    return (
      <g>
        {bars.map((bar: ComputedBarDatum<MyBarDatum>) => {
          const d = bar.data.data;                // 원본 datum
          const users = d.users ?? 0;

          // 수평 막대의 오른쪽 끝 + 여백
          const x = bar.x + bar.width + 6;
          const y = bar.y + bar.height / 2 + 4;

          // key는 안전하게 bar.key 사용
          return (
            <text
              key={`users-${bar.key}`}
              x={x}
              y={y}
              fontSize={12}
              fill="hsl(var(--muted-foreground))"
            >
              {`${Number(users).toLocaleString()}명`}
            </text>
          );
        })}
      </g>
    );
  };

  const layers: BarSvgProps<MyBarDatum>["layers"] = [
    "grid",
    "axes",
    "bars",
    UsersLayer, // ✅ 커스텀 레이어 주입
    "markers",
    "legends",
    "annotations",
  ];

  return (
    <div style={{ height }} className="relative">
      <ResponsiveBar<MyBarDatum>
        data={data}                  // [{ id, value, color?, users? }]
        keys={["value"]}             // 단일 시리즈
        indexBy="id"
        layout={horizontal ? "horizontal" : "vertical"}
        margin={{ top: 10, right: 60, bottom: 30, left: 90 }}
        padding={0.3}
        /** ✅ maxValue 대신 valueScale 사용 */
        valueScale={{ type: "linear", min: 0, max: maxValue }}
        colors={{ datum: "data.color" }}          // 문자열 경로
        borderRadius={5}
        borderWidth={2}
        borderColor="hsl(var(--background))"
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 5,
          tickPadding: 5,
          legend: horizontal ? undefined : "",
          legendPosition: "middle",
          legendOffset: 24,
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          legend: horizontal ? "" : undefined,
          legendPosition: "middle",
          legendOffset: -60,
        }}
        /** ✅ label은 ComputedDatum을 받음 */
        enableLabel
        label={(d: ComputedDatum<MyBarDatum>) => valueFormatter(Number(d.value ?? 0))}
        labelSkipWidth={40}
        labelSkipHeight={14}
        labelTextColor="hsl(var(--card-foreground))"
        /** 툴팁 타입 맞춤 */
        tooltip={({ id, value, data }) => (
          <div className="rounded-md border border-border bg-popover text-popover-foreground px-3 py-2 text-sm shadow-sm">
            <div className="font-medium">{String(id)}</div>
            <div className="text-muted-foreground">
              {valueFormatter(Number(value))}
              {data?.users != null ? ` • ${Number(data.users).toLocaleString()}명` : ""}
            </div>
          </div>
        )}
        theme={{
          background: "transparent",
          text: { fontSize: 12, fill: "hsl(var(--foreground))" },
          axis: {
            ticks: { text: { fill: "hsl(var(--muted-foreground))" } },
            legend: { text: { fill: "hsl(var(--foreground))" } },
          },
          labels: { text: { fill: "hsl(var(--card-foreground))" } },
          tooltip: {
            container: {
              background: "hsl(var(--popover))",
              color: "hsl(var(--popover-foreground))",
              border: "1px solid hsl(var(--border))",
            },
          },
        }}
        animate
        motionConfig="gentle"
        layers={layers}
      />
    </div>
  );
}
