/* filename: src/test/utils/pivotPlansForMultiSeries.ts */

/**
 * 기간별로 plan 값을 피벗해서
 * [{ x, pro, enterprise }, ...] 형태로 반환합니다.
 * - resp는 배열 또는 { items } / { data } 어디에 있어도 동작
 * - planKeys를 넘기면 해당 키들로 와이드 포맷을 만듭니다.
 */

export type DefaultPlanKey = "pro" | "enterprise";
export const DEFAULT_PLAN_KEYS = ["pro", "enterprise"] as const;

type AnyRecord = Record<string, unknown>;
type RowInput = AnyRecord;
type RespInput =
  | RowInput[]
  | { items?: RowInput[]; data?: RowInput[] }
  | { data?: RowInput[] }
  | unknown;

/** 반환 타입: { x: string } & Record<플랜키, number> */
export type PivotRow<T extends readonly string[]> = { x: string } & Record<
  T[number],
  number
>;

/** 내부: 안전한 숫자 변환 */
const toNum = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** 내부: x 라벨 추출 */
const pickX = (d: RowInput): string =>
  String(
    (d as AnyRecord).x ??
      (d as AnyRecord).date ??
      (d as AnyRecord).week_start ??
      (d as AnyRecord).week ??
      (d as AnyRecord).month ??
      (d as AnyRecord).year ??
      (d as AnyRecord).label ??
      (d as AnyRecord).period ??
      ""
  );

/** 내부: plan/category 추출 (소문자) */
const pickPlan = (d: RowInput): string =>
  String(
    (d as AnyRecord).plan ??
      (d as AnyRecord).plan_type ??
      (d as AnyRecord).category ??
      (d as AnyRecord).type ??
      ""
  ).toLowerCase();

/** 내부: y 값 추출 */
const pickY = (d: RowInput): number =>
  toNum(
    (d as AnyRecord).y ??
      (d as AnyRecord).amount ??
      (d as AnyRecord).total_amount ??
      (d as AnyRecord).value ??
      (d as AnyRecord).total ??
      (d as AnyRecord).count ??
      0
  );

/** 내부: resp에서 원시 배열 뽑기 */
const extractRaw = (resp: unknown): RowInput[] => {
  const r = resp as any;                  // ✅ any 로 고정해서 TS2339 차단
  if (Array.isArray(r)) return r as RowInput[];

  const items = r?.items as any;
  if (Array.isArray(items)) return items as RowInput[];
  if (Array.isArray(items?.data)) return items.data as RowInput[];

  if (Array.isArray(r?.data)) return r.data as RowInput[];

  return [];
};

/* =========================
 * 함수 오버로드 (타입 안전)
 * ========================= */
export function pivotPlansForMultiSeries(
  resp: RespInput,
  planKeys?: typeof DEFAULT_PLAN_KEYS
): PivotRow<typeof DEFAULT_PLAN_KEYS>[];

export function pivotPlansForMultiSeries<T extends readonly string[]>(
  resp: RespInput,
  planKeys: T
): PivotRow<T>[];

/* =========================
 * 구현부 (any 사용해 TS 충돌 회피)
 * ========================= */
export function pivotPlansForMultiSeries(
  resp: RespInput,
  planKeys?: readonly string[]
) {
  const raw = extractRaw(resp);
  if (!Array.isArray(raw) || raw.length === 0) return [] as any[];

  // 기본 키 처리 (TS2352 회피: 구현부는 런타임 키 배열을 string[]로 사용)
  const keys = (planKeys ?? DEFAULT_PLAN_KEYS) as readonly string[];

  // 초기 row 생성 (TS7053 회피: 구현부는 any 인덱싱)
  const makeInitRow = (x: string) => {
    const base: any = { x };
    keys.forEach((k) => (base[k] = 0));
    return base;
  };

  // 와이드 포맷 판단
  const first = raw[0] as AnyRecord;
  const isWide = keys.some((k) =>
    Object.prototype.hasOwnProperty.call(first, k)
  );

  const result = new Map<string, any>();

  if (isWide) {
    // 와이드: 각 planKey 컬럼 합산
    for (const d of raw) {
      const x = pickX(d);
      const row = result.get(x) ?? makeInitRow(x);
      for (const key of keys) {
        row[key] = (row[key] ?? 0) + toNum((d as AnyRecord)[key]);
      }
      result.set(x, row);
    }
  } else {
    // 롱: { plan, date, amount } / { category, x, y } 등
    for (const d of raw) {
      const x = pickX(d);
      const plan = pickPlan(d);
      const y = pickY(d);
      const row = result.get(x) ?? makeInitRow(x);

      for (const key of keys) {
        if (plan.includes(String(key).toLowerCase())) {
          row[key] = (row[key] ?? 0) + y;
          break;
        }
      }
      result.set(x, row);
    }
  }

  // x 오름차순 정렬
  const out = Array.from(result.values()).sort((a, b) =>
    a.x > b.x ? 1 : a.x < b.x ? -1 : 0
  );

  // 오버로드가 반환 타입을 보장 (구현부는 any로 캐스팅)
  return out as any;
}

export default pivotPlansForMultiSeries;
