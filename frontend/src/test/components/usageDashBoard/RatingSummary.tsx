// src/lib/ratings/RatingSummary.ts
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
      raw.forEach((s: number) => {
        if (s >= 1 && s <= 5) counts[s as 1 | 2 | 3 | 4 | 5] += 1;
      });
    }
    // [{score:5,count:10}, ...]
    else if (raw.length && typeof raw[0] === "object") {
      raw.forEach((r: any) => {
        const s = Number(r?.score);
        const c = Number(r?.count ?? 0);
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
