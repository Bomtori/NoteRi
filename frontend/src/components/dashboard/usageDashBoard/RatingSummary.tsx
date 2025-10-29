import React, { useMemo, useState, useEffect } from "react";
import NivoBar from "../cards/NivoBar"; // ← 확장자 제거(.tsx 금지)

/* ==== (통합) RatingSummary 유틸/타입 ==== */
export type RatingCounts = Record<1 | 2 | 3 | 4 | 5, number>;

export type RatingSummary = {
  total: number;
  average: number;         // 0~5
  counts: RatingCounts;    // 각 점수별 개수
};

export const RATING_COLORS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "#ef4444", // 빨강
  2: "#f97316", // 주황
  3: "#f59e0b", // 노랑
  4: "#22c55e", // 초록
  5: "#2563eb", // 파랑
};

export function ensureSummary(input: {
  counts: unknown;       // {1:10,...} | [{score,count}] | [5,4,5,...]
  total?: number;
  average?: number;
}): RatingSummary {
  const counts: RatingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const raw = input.counts;

  if (Array.isArray(raw)) {
    // [5,4,5,...]
    if (raw.length && typeof raw[0] === "number") {
      (raw as number[]).forEach((s) => {
        if (s >= 1 && s <= 5) counts[s as 1 | 2 | 3 | 4 | 5] += 1;
      });
    }
    // [{score:5,count:10}, ...]
    else if (raw.length && typeof raw[0] === "object") {
      (raw as any[]).forEach((r) => {
        const s = Number((r as any)?.score);
        const c = Number((r as any)?.count ?? 0);
        if (s >= 1 && s <= 5) counts[s as 1 | 2 | 3 | 4 | 5] += c;
      });
    }
  } else if (raw && typeof raw === "object") {
    // { "1": 10, "2": 5, ... } 형태
    Object.entries(raw as Record<string, any>).forEach(([k, v]) => {
      const s = Number(k);
      const c = Number(v ?? 0);
      if (s >= 1 && s <= 5) counts[s as 1 | 2 | 3 | 4 | 5] += c;
    });
  }

  const total =
    input.total ??
    counts[1] + counts[2] + counts[3] + counts[4] + counts[5];

  const sum =
    1 * counts[1] +
    2 * counts[2] +
    3 * counts[3] +
    4 * counts[4] +
    5 * counts[5];

  const average = input.average ?? (total ? +(sum / total).toFixed(2) : 0);

  return { counts, total, average };
}

export function toNivoBarData(summary: RatingSummary) {
  return ([1, 2, 3, 4, 5] as const).map((score) => ({
    id: `${score}점`,
    value: summary.counts[score],
    color: RATING_COLORS[score],
    users: summary.counts[score],
    score,
  }));
}
/* ===================================== */

type Props = {
  className?: string;
  height?: number;
  showUsers?: boolean;
  /** 백엔드 라우트 (ex: /summary/final/ratings) */
  endpoint?: string;
  /** boardId, sessionId 등 쿼리 파라미터 */
  params?: Record<string, any>;
  /** 개발 중 임시 데이터 사용 */
  useMock?: boolean;
};

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE ??
  (import.meta as any).env?.VITE_API_BASE_URL ??
  "http://127.0.0.1:8000";

// ✅ 임시 데이터 (원할 때만 사용)
const MOCK: RatingSummary = ensureSummary({
  counts: { 1: 8, 2: 14, 3: 32, 4: 57, 5: 89 },
});

export default function RatingSummaryCard({
  className = "",
  height = 240,
  showUsers = true,
  endpoint = "/summary/final/ratings",
  params,
  useMock = false,
}: Props) {
  const [summary, setSummary] = useState<RatingSummary | null>(useMock ? MOCK : null);
  const [loading, setLoading] = useState(!useMock);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (useMock) return;

    const url = new URL(`${API_BASE_URL}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") {
          url.searchParams.set(k, String(v));
        }
      });
    }

    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(url.toString(), { credentials: "include", signal: ac.signal });
        const text = await res.text();
        if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
        const payload = text ? JSON.parse(text) : { counts: {} };

        // 다양한 백엔드 스키마 허용:
        // - 바로 { counts, total?, average? }
        // - { items: { counts, ... } }
        // - { data: { counts, ... } }
        const target =
          (payload?.items && typeof payload.items === "object" ? payload.items :
           payload?.data  && typeof payload.data  === "object" ? payload.data  :
           payload) ?? { counts: {} };

        setSummary(ensureSummary(target));
      } catch (e: any) {
        if (e?.name !== "AbortError") setErr(e?.message ?? "불러오기 실패");
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [endpoint, JSON.stringify(params), useMock]);

  const barData = useMemo(() => (summary ? toNivoBarData(summary) : []), [summary]);

  const fmtInt = (n?: number) =>
    typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "0";

  const fmtAvg = (n?: number) =>
    typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "0.00";

  return (
    <div className={`p-4 bg-card rounded-2xl shadow ${className}`}>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">전체 게시글 평가 요약</h3>
          <p className="text-base text-muted-foreground/80">
            총 <span className="text-lg font-semibold tabular-nums">{fmtInt(summary?.total)}</span>명 ·{" "}
            평균 <span className="text-lg font-semibold tabular-nums">{fmtAvg(summary?.average)}</span> / 5
          </p>
        </div>
      </div>

      {loading && <div className="min-h-[220px] grid place-items-center">로딩…</div>}
      {err && (
        <div className="min-h-[220px] grid place-items-center text-destructive">
          에러: {err}
        </div>
      )}

      {!loading && !err && summary && (
        <div className="min-h-[220px] min-w-0">
          <NivoBar
            data={barData}
            height={height}
            horizontal
            showUserCount={showUsers}
            valueFormatter={(v: unknown) => fmtInt(Number(v ?? 0))}
            maxValue="auto"
          />
        </div>
      )}
    </div>
  );
}
