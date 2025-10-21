// 여러 형태의 응답을 흡수해서 기간별 합계(y)를 만든 단일 시리즈 [{x, y}]로 변환
export function mergePlansToSingleSeries(resp) {
  // 1) payload 루트 찾기: items.data | items | data | resp
  const container = resp?.items ?? resp ?? {};
  const raw =
    Array.isArray(container) ? container :
    Array.isArray(container.data) ? container.data :
    Array.isArray(resp?.data) ? resp.data :
    [];

  if (!Array.isArray(raw)) return [];

  // 2) 이미 [{x,y}]면 그대로 정규화
  if (raw.length && "x" in raw[0] && "y" in raw[0]) {
    return raw
      .map(d => ({ x: String(d.x ?? ""), y: Number(d.y ?? 0) }))
      .sort((a, b) => (a.x > b.x ? 1 : a.x < b.x ? -1 : 0));
  }

  // 3) 라벨 키/값 추출
  const pickX = (d) =>
    d.x ?? d.date ?? d.week_start ?? d.week ?? d.month ?? d.year ?? d.label ?? d.period ?? "";

  // 4) 와이드 포맷(예: {date, free, pro, enterprise}) → 라벨 키를 제외한 숫자 합산
  const LABEL_KEYS = new Set(["x","date","day","week","week_start","month","year","label","period"]);
  const toNumber = (v) => (v == null || v === "" ? 0 : Number(v));
  const sumRowValues = (row) => {
    let s = 0;
    for (const [k, v] of Object.entries(row)) {
      if (LABEL_KEYS.has(k)) continue;
      const n = toNumber(v);
      if (!Number.isNaN(n) && Number.isFinite(n)) s += n;
    }
    return s;
  };

  // 5) 기간별 합산
  const map = new Map(); // x -> y
  for (const d of raw) {
    const x = String(pickX(d));
    // 값 후보: y/amount/total_amount/value/total/count … 없으면 와이드 합산
    const yCandidate =
      d.y ?? d.amount ?? d.total_amount ?? d.value ?? d.total ?? d.count;
    const y = yCandidate != null ? Number(yCandidate) : sumRowValues(d);
    map.set(x, (map.get(x) ?? 0) + (Number.isFinite(y) ? y : 0));
  }

  // 6) 정렬 & 반환
  return Array.from(map.entries())
    .sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0))
    .map(([x, y]) => ({ x, y }));
}
