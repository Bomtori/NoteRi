// src/lib/ratings/RatingSummary.ts
export type RatingCounts = Record<1 | 2 | 3 | 4 | 5, number>;

export type RatingSummary = {
  total: number;
  average: number;         // 0~5
  counts: RatingCounts;    // 각 점수별 개수
};

export const RATING_COLORS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#f59e0b",
  4: "#22c55e",
  5: "#2563eb",
};

export function ensureSummary(input: {
  counts: any;          // {1:10,...} | [{score,count}] | [5,4,5,...]
  total?: number;
  average?: number;
}): RatingSummary {
  const counts: RatingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  const raw = input.counts;
  if (Array.isArray(raw)) {
    if (raw.length && typeof raw[0] === "number") {
      raw.forEach((s: number) => { if (s >= 1 && s <= 5) counts[s as 1|2|3|4|5] += 1; });
    } else if (raw.length && typeof raw[0] === "object") {
      raw.forEach((r: any) => {
        const s = Number(r?.score);
        const c = Number(r?.count ?? 0);
        if (s >= 1 && s <= 5) counts[s as 1|2|3|4|5] += c;
      });
    }
  } else if (raw && typeof raw === "object") {
    Object.entries(raw).forEach(([k, v]) => {
      const s = Number(k);
      const c = Number(v ?? 0);
      if (s >= 1 && s <= 5) counts[s as 1|2|3|4|5] += c;
    });
  }

  const total = input.total ?? (counts[1]+counts[2]+counts[3]+counts[4]+counts[5]);
  const sum   = 1*counts[1] + 2*counts[2] + 3*counts[3] + 4*counts[4] + 5*counts[5];
  const avg   = input.average ?? (total ? +(sum / total).toFixed(2) : 0);

  return { counts, total, average: avg };
}

export function toNivoBarData(summary: RatingSummary) {
  return ([1,2,3,4,5] as const).map((score) => ({
    id: `${score}점`,
    value: Number(summary.counts[score] ?? 0),
    color: RATING_COLORS[score],
    users: Number(summary.counts[score] ?? 0),
    score,
  }));
}
