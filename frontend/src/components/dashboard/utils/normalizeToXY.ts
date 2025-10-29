// 다양한 날짜/주차/월 단위 응답을 [{x, y}]로 표준화
export type XY = { x: string; y: number };

type AnyRow = Record<string, unknown>;
type Container =
  | { data?: unknown; items?: unknown }
  | unknown[];

function isArrayOfRecords(v: unknown): v is AnyRow[] {
  return Array.isArray(v) && (v.length === 0 || typeof v[0] === "object");
}

function getISOWeekInfo(date: Date) {
  // 주차 계산을 UTC 기준으로 통일
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((Number(d) - Number(yearStart)) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

function toISOWeekLabel(input: unknown): string {
  if (input && typeof input === "object" && "year" in (input as AnyRow) && "week" in (input as AnyRow)) {
    const y = Number((input as AnyRow).year);
    const w = String(Number((input as AnyRow).week)).padStart(2, "0");
    return `${y}-W${w}`;
  }
  if (typeof input === "string") {
    const dt = new Date(input);
    if (!Number.isNaN(Number(dt))) {
      const { year, week } = getISOWeekInfo(dt);
      return `${year}-W${String(week).padStart(2, "0")}`;
    }
  }
  if (typeof input === "number") return String(input);
  return String((input as any) ?? "");
}

export function normalizeToXY(resp: unknown): XY[] {
  const root: unknown =
    (resp as Container && (resp as any)?.data) ??
    (resp as Container && (resp as any)?.items) ??
    resp ??
    [];

  const rows: AnyRow[] = isArrayOfRecords(root) ? root : [];
  const mapped = rows.map((d) => {
    // x 후보
    let rawX: unknown =
      d.x ??
      d.week_label ??
      d.label ??
      d.week ??
      (d as any).weekStart ??
      d.week_start ??
      d.date ??
      d.day ??
      (d as any).start_date ??
      d.start ??
      d.month ??
      d.year ??
      "";

    // 주차 패턴 감지 시 ISO Week Label로 정규화
    if (
      (typeof d === "object" &&
        (("week" in d && "year" in d) ||
          "week_start" in d ||
          "weekStart" in d ||
          "start_date" in d)) ||
      /week/i.test(String(rawX))
    ) {
      rawX = toISOWeekLabel(
        ("week_start" in d && (d as any).week_start) ||
          ("weekStart" in d && (d as any).weekStart) ||
          ("start_date" in d && (d as any).start_date) ||
          ("date" in d && (d as any).date) ||
          ("week" in d && { year: (d as any).year, week: (d as any).week }) ||
          rawX
      );
    } else {
      if (rawX instanceof Date) rawX = rawX.toISOString().slice(0, 10);
      else if (typeof rawX === "number") rawX = String(rawX);
      else rawX = String(rawX ?? "");
    }

    const y = Number(
      d.y ?? d.count ?? d.value ?? d.total ?? (d as any).signup ?? 0
    );
    return { x: String(rawX), y: Number.isFinite(y) ? y : 0 };
  });

  // 같은 x 라벨 합산
  const agg = new Map<string, number>();
  for (const { x, y } of mapped) {
    if (!x) continue;
    agg.set(x, (agg.get(x) ?? 0) + y);
  }

  // 정렬(week label은 연-주 숫자 기준 정렬)
  const result: XY[] = Array.from(agg.entries())
    .map(([x, y]) => ({ x, y }))
    .sort((a, b) => {
      const wk = /^(\d{4})-W(\d{2})$/;
      const ma = a.x.match(wk);
      const mb = b.x.match(wk);
      if (ma && mb) {
        const ay = Number(ma[1]),
          aw = Number(ma[2]);
        const by = Number(mb[1]),
          bw = Number(mb[2]);
        return ay === by ? aw - bw : ay - by;
      }
      return a.x.localeCompare(b.x);
    });

  return result;
}
