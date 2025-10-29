// 여러 형태의 응답을 흡수해서 기간별 합계(y)를 만든 단일 시리즈 [{x, y}]로 변환
export type XY = { x: string; y: number };

// 응답의 가능한 컨테이너 형태
type Container =
  | { items?: unknown; data?: unknown }
  | unknown[];

type AnyRow = Record<string, unknown>;

function toNumberSafe(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isArrayOfRecords(v: unknown): v is AnyRow[] {
  return Array.isArray(v) && (v.length === 0 || typeof v[0] === "object");
}

export function mergePlansToSingleSeries(resp: unknown): XY[] {
  // 1) payload 루트 찾기: items | resp | resp.data
  const container = (resp as Container && (resp as any)?.items) ?? resp ?? {};
  const raw: unknown =
    Array.isArray(container)
      ? container
      : Array.isArray((container as any)?.data)
      ? (container as any).data
      : Array.isArray((resp as any)?.data)
      ? (resp as any).data
      : [];

  if (!isArrayOfRecords(raw)) return [];

  // 2) 이미 [{x,y}]면 그대로 정규화
  if (raw.length && "x" in raw[0] && "y" in raw[0]) {
    return (raw as AnyRow[])
      .map((d) => ({
        x: String(d.x ?? ""),
        y: toNumberSafe(d.y),
      }))
      .sort((a, b) => (a.x > b.x ? 1 : a.x < b.x ? -1 : 0));
  }

  // 3) 라벨 키/값 추출
  const pickX = (d: AnyRow) =>
    (d.x ??
      d.date ??
      d.week_start ??
      d.week ??
      d.month ??
      d.year ??
      d.label ??
      d.period ??
      "") as unknown as string;

  // 4) 와이드 포맷(예: {date, free, pro, enterprise}) → 라벨 키를 제외한 숫자 합산
  const LABEL_KEYS = new Set([
    "x",
    "date",
    "day",
    "week",
    "week_start",
    "month",
    "year",
    "label",
    "period",
  ]);

  const sumRowValues = (row: AnyRow) => {
    let s = 0;
    for (const [k, v] of Object.entries(row)) {
      if (LABEL_KEYS.has(k)) continue;
      s += toNumberSafe(v);
    }
    return s;
  };

  // 5) 기간별 합산
  const map = new Map<string, number>(); // x -> y
  for (const d of raw) {
    const x = String(pickX(d));
    // 값 후보: y/amount/total_amount/value/total/count … 없으면 와이드 합산
    const yCandidate =
      (d.y as unknown) ??
      d.amount ??
      d.total_amount ??
      d.value ??
      d.total ??
      d.count;
    const y =
      yCandidate !== undefined ? toNumberSafe(yCandidate) : sumRowValues(d);
    map.set(x, (map.get(x) ?? 0) + y);
  }

  // 6) 정렬 & 반환
  return Array.from(map.entries())
    .sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0))
    .map(([x, y]) => ({ x, y }));
}
