// src/test/components/userDashBoard/UserByAge.tsx
import React, { useMemo } from "react";
import RechartsDonut from "../cards/RechartsDonut"; // 경로는 프로젝트에 맞게 조정
import { Card } from "../../../components/ui/card";
import { DASH_CARD } from "../cards/cardStyles";

type Props = {
  /** 랜덤 목업이 필요하면 시드 변경용(선택) */
  seed?: number;
  /** 고정/랜덤 데이터 선택 */
  mode?: "static" | "random";
};



const PALETTE: string[] = [
  "#5B8CFF", // 10대  : Indigo Blue
  "#2AC3A2", // 20대  : Teal
  "#F6C56B", // 30대  : Amber
  "#F07F7F", // 40대  : Rose
  "#7E37F9", // 50대+ : Brand Purple
];

export default function UserByAge({ seed = 42, mode = "static" }: Props) {
  const data = useMemo(() => {
    if (mode === "static") {
      // ✅ 고정 목업 데이터
      return [
        { id: "10대", value: 120, color: PALETTE[0] },
        { id: "20대", value: 420, color: PALETTE[1] },
        { id: "30대", value: 350, color: PALETTE[2] },
        { id: "40대", value: 180, color: PALETTE[3] },
        { id: "50대+", value: 90, color: PALETTE[4] },
      ];
    }

    // ✅ 랜덤 목업 데이터 (시드 기반)
    let x = seed;
    const rand = () => {
      // 간단한 LCG
      x = (x * 1664525 + 1013904223) % 4294967296;
      return x / 4294967296;
    };
    const base = [100, 400, 350, 200, 100];
    const jitter = () => Math.round((rand() - 0.5) * 80); // ±40 정도 변동
    return [
      { id: "10대", value: Math.max(20, base[0] + jitter()), color: PALETTE[0] },
      { id: "20대", value: Math.max(20, base[1] + jitter()), color: PALETTE[1] },
      { id: "30대", value: Math.max(20, base[2] + jitter()), color: PALETTE[2] },
      { id: "40대", value: Math.max(20, base[3] + jitter()), color: PALETTE[3] },
      { id: "50대+", value: Math.max(10, base[4] + jitter()), color: PALETTE[4] },
    ];
  }, [mode, seed]);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold">유저 나이 분포</h3>
        <span className="text-xs text-muted-foreground">
          데이터: {mode === "static" ? "고정 목업" : `랜덤 목업 (seed=${seed})`}
        </span>
      </div>
       <RechartsDonut data={data} height={300} />

      {/*/!* 간단한 범례 *!/*/}
      {/*<div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">*/}
      {/*  {data.map((d) => (*/}
      {/*    <div key={d.id} className="flex items-center gap-2">*/}
      {/*      <span*/}
      {/*        className="inline-block h-3 w-3 rounded-sm"*/}
      {/*        style={{ background: d.color }}*/}
      {/*      />*/}
      {/*      <span className="text-muted-foreground">{d.id}</span>*/}
      {/*    </div>*/}
      {/*  ))}*/}
      {/*</div>*/}
    </div>
  );
}
