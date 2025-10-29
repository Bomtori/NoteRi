/* filename: src/test/components/PaymentByPlanTrend.tsx */
import React, { useEffect, useMemo, useRef, useState } from "react";
import DateButtons, { DateButtonsOption } from "../cards/DateButtons";
import ShadcnAreaChart from "../cards/ShadcnAreaChart";
import { pivotPlansForMultiSeries } from "../utils/pivotPlansForMultiSeries";

function pickArray(resp: unknown): any[] {
  const r = resp as any;                 // ✅ any 로 접근
  if (Array.isArray(r)) return r;

  const items = r?.items as any;
  if (Array.isArray(items)) return items;
  if (Array.isArray(items?.data)) return items.data;

  if (Array.isArray(r?.data)) return r.data;

  return [];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

type UiRange = "7d" | "5w" | "6m" | "5y";

/** x 축 라벨 포맷터 */
const fmtTick = (v: string) => {
  const d = new Date(v);
  return isNaN(d.getTime())
    ? String(v)
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/** 플랜 컬러 맵 + 팔레트 */
const PLAN_COLORS: Record<string, string> = {
  free: "#94a3b8",
  pro: "#F59E0B",
  enterprise: "#10B981",
};
const PALETTE = [
  "#7E36F9",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#3B82F6",
  "#E11D48",
  "#22D3EE",
  "#A78BFA",
  "#14B8A6",
  "#F97316",
  "#84CC16",
];

/** 응답에서 플랜 키 추출 (wide/long 모두) */
function inferPlanKeys(resp: any): string[] {
  const rows: any[] = pickArray(resp);   // ✅ items.data 포함 모든 경로 커버
  const keys = new Set<string>();
  if (!rows.length) return [];
  if (!Array.isArray(rows) || rows.length === 0) return [];

  // long 형식: { plan|plan_type|category|type }
  for (const r of rows) {
    const p =
      (r?.plan ?? r?.plan_type ?? r?.category ?? r?.type ?? "") + "";
    if (p) keys.add(String(p).toLowerCase());
  }

  // wide 형식: 첫 몇 행의 숫자 컬럼 이름들 추출
  const DIMENSION_KEYS = new Set([
    "x",
    "date",
    "week",
    "week_start",
    "month",
    "year",
    "label",
    "period",
    "value",
    "amount",
    "total",
    "count",
    "y",
    "plan",
    "plan_type",
    "category",
    "type",
  ]);
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const obj = rows[i];
    if (!obj || typeof obj !== "object") continue;
    for (const k of Object.keys(obj)) {
      if (DIMENSION_KEYS.has(k)) continue;
      const v = (obj as any)[k];
      if (typeof v === "number") keys.add(k.toLowerCase());
    }
  }

  // 정렬: free, pro, enterprise 우선, 나머지는 알파벳
  const order = ["free", "pro", "enterprise"];
  return Array.from(keys).sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export default function PaymentByPlanTrend({
  className = "",
}: {
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  type SeriesRow = { x: string } & Partial<Record<string, number>>;
  const [seriesRows, setSeriesRows] = useState<SeriesRow[]>([]);
  const [planKeys, setPlanKeys] = useState<string[]>([]);
  const prevSig = useRef("");
  const [uiRange, setUiRange] = useState<UiRange>("7d");

  const trendOptions = [
    { value: "7d", label: "최근 7일" },
    { value: "5w", label: "최근 5주" },
    { value: "6m", label: "최근 6개월" },
    { value: "5y", label: "최근 5년" },
  ] as const satisfies readonly DateButtonsOption<UiRange>[];

  const endpoint = useMemo(() => {
    switch (uiRange) {
      case "5w":
        return "/payments/last-5-weeks";
      case "6m":
        return "/payments/last-6-months";
      case "5y":
        return "/payments/last-5-years";
      case "7d":
      default:
        return "/payments/last-7-days";
    }
  }, [uiRange]);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE_URL}${endpoint}`, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const resp = await res.json();
        console.log("PaymentTrend", resp)

        // 1) 응답에서 플랜 키 동적 추출
        const keys = inferPlanKeys(resp);
        // 안전장치: 아무 것도 못 찾았으면 기본 키를 비워두고 종료
        if (keys.length === 0) {
          setPlanKeys([]);
          setSeriesRows([]);
          prevSig.current = "0:0";
          return;
        }

        // 2) 피벗 (동적 키 사용)
        const wide = pivotPlansForMultiSeries(resp, keys as readonly string[]);
        // 3) 숫자/형식 정리
        const next: SeriesRow[] = wide.map((row: any) => {
          const out = {} as SeriesRow;     // ✅ 먼저 캐스팅한 뒤
          out.x = String(row.x);           // ✅ 나눠서 채운다
          for (const k of keys) {
            out[k] = Number(row[k] ?? 0);  // ✅ 숫자 값 채우기
          }
          return out;
        });

        const totalSum = next.reduce(
          (s: number, r: any) => s + keys.reduce((ss, k) => ss + (r[k] || 0), 0),
          0
        );
        const sig = `${next.length}:${totalSum}`;

        if (prevSig.current !== sig) {
          setPlanKeys(keys);
          setSeriesRows(next);
          prevSig.current = sig;
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") setError("불러오기 실패");
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [endpoint]);

  // 동적 series 설정 생성 (색상 매핑 포함)
  const areaSeries = useMemo(() => {
    return planKeys.map((k, i) => {
      const color = PLAN_COLORS[k] ?? PALETTE[i % PALETTE.length];
      const opacity = 0.3 + (i % 3) * 0.15; // 약간씩 다른 투명도
      return {
        key: k,
        name: k.charAt(0).toUpperCase() + k.slice(1),
        color,
        fillOpacity: opacity,
        strokeWidth: 2,
      };
    });
  }, [planKeys]);

  const title = useMemo(() => {
    const joined = planKeys.length ? planKeys.map((k) => k[0].toUpperCase() + k.slice(1)).join(", ") : "플랜";
    return uiRange === "6m"
      ? `최근 6개월 매출 (${joined})`
      : uiRange === "5y"
      ? `최근 5년 매출 (${joined})`
      : uiRange === "5w"
      ? `최근 5주 매출 (${joined})`
      : `최근 7일 매출 (${joined})`;
  }, [uiRange, planKeys]);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex justify-end">
        <DateButtons<UiRange> range={uiRange} onRangeChange={setUiRange} options={trendOptions} />
      </div>

      <ShadcnAreaChart
        title={title}
        data={seriesRows}
        xKey="x"
        series={areaSeries}
        tickFormatter={fmtTick}
        showGrid
        height={220}
      />

      {loading && <div className="text-sm text-muted-foreground">로딩…</div>}
      {error && <div className="text-sm text-destructive">{error}</div>}
      {!loading && !error && seriesRows.length === 0 && (
        <div className="text-sm text-muted-foreground">표시할 데이터가 없습니다.</div>
      )}
    </div>
  );
}
