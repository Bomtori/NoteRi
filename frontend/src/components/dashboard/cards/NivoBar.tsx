// frontend/src/components/cards/NivoBar.tsx
import React from "react";
import { ResponsiveBar } from "@nivo/bar";

export type Row = { [k: string]: any; id?: string };

type Props = {
  data: Row[];
  keys?: string[];          // 값 컬럼들 (기본: ['value'])
  indexBy?: string;         // x축 키 (기본: 'id')
  height?: number;
  className?: string;
  palette?: string[];

  horizontal?: boolean;
  showUserCount?: boolean;
  valueFormatter?: (v: unknown) => string;
  maxValue?: number | "auto";
};

export default function NivoBar({
  data,
  keys,
  indexBy,
  height = 300,
  className,
  palette,
  horizontal = false,
  showUserCount = false,
  valueFormatter,
  maxValue = "auto",
}: Props) {
  // 1) 안전한 기본값
  const _keys = Array.isArray(keys) && keys.length > 0 ? keys : ["value"];
  const _indexBy = typeof indexBy === "string" && indexBy ? indexBy : "id";
  const _rows: Row[] = Array.isArray(data) ? data : [];

  // 2) 행 보정: indexBy 없으면 채우고, 모든 key는 숫자(없으면 0)
  const normalized = _rows.map((r, i) => {
    const base = _indexBy in r ? r : { ...r, [_indexBy]: r.id ?? String(i) };
    const withNums: Row = { ...base };
    for (const k of _keys) {
      const raw = (base as any)[k];
      const n = typeof raw === "number" && Number.isFinite(raw) ? raw : Number(raw);
      withNums[k] = Number.isFinite(n) ? n : 0;
    }
    return withNums;
  });

  // 3) 완전 비어있으면 안전한 플레이스홀더 1개
  const safeData =
    normalized.length > 0
      ? normalized
      : [{ [_indexBy]: "—", ...Object.fromEntries(_keys.map(k => [k, 0])) }];

  const layout = horizontal ? "horizontal" : "vertical";

  // 색상: palette 우선, 없으면 datum.color 사용
  const colors =
    palette && palette.length > 0
      ? ({ index }: { index: number }) => palette[index % palette.length]
      : { datum: "data.color" as const };

  const valueFormat = valueFormatter ? (v: number) => valueFormatter(v) : undefined;

  // v0.85+ Nivo: max/min은 valueScale로 설정
  const valueScale = { type: "linear" as const, min: 0 as const, max: maxValue ?? "auto" };

  return (
    <div style={{ height }} className={className}>
      <ResponsiveBar
        data={safeData}
        keys={_keys}
        indexBy={_indexBy}
        layout={layout}
        valueScale={valueScale}
        valueFormat={valueFormat}
        margin={{ top: 10, right: 20, bottom: 40, left: 50 }}
        padding={0.3}
        colors={colors as any}
        borderWidth={1}
        borderColor={{ from: "color", modifiers: [["darker", 0.3]] }}
        axisBottom={{
          tickSize: 0,
          tickPadding: 8,
          legend: layout === "vertical" ? undefined : _indexBy,
          legendOffset: 36,
          truncateTickAt: 12,
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 6,
          legend: layout === "vertical" ? _keys.join(", ") : undefined,
          legendOffset: -40,
        }}
        enableGridY
        enableGridX={false}
        enableLabel={showUserCount}
        label={(d) => {
          const row: any = d.data;
          const primary = typeof row?.users === "number" ? row.users : row[_keys[0]];
          return typeof primary === "number" ? `${primary}` : "";
        }}
        labelSkipWidth={16}
        labelSkipHeight={12}
        role="img"
        ariaLabel="bar chart"
      />
    </div>
  );
}
