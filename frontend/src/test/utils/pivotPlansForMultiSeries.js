// 기간별로 plan 값을 피벗해서 [{ x, pro, enterprise }] 형태로 반환
export function pivotPlansForMultiSeries(resp, planKeys = ["pro", "enterprise"]) {
  // 1) payload 루트 탐색
  const container = resp?.items ?? resp ?? {};
  const raw =
    Array.isArray(container) ? container :
    Array.isArray(container.data) ? container.data :
    Array.isArray(resp?.data) ? resp.data :
    [];

  if (!Array.isArray(raw)) return [];

  // 2) 라벨 키 추출
  const pickX = (d) =>
    d.x ?? d.date ?? d.week_start ?? d.week ?? d.month ?? d.year ?? d.label ?? d.period ?? "";

  // 3) 와이드 포맷인가?
  const isWide =
    raw.length > 0 &&
    planKeys.some((k) => Object.prototype.hasOwnProperty.call(raw[0], k));

  const result = new Map(); // x -> { x, pro, enterprise }

  if (isWide) {
    for (const d of raw) {
      const x = String(pickX(d));
      const row = result.get(x) ?? { x, pro: 0, enterprise: 0 };
      for (const key of planKeys) {
        const v = Number(d[key] ?? 0);
        if (Number.isFinite(v)) row[key] = (row[key] ?? 0) + v;
      }
      result.set(x, row);
    }
  } else {
    // 롱 포맷 (예: { plan, date, amount } / { category, x, y } 등)
    const pickPlan = (d) =>
      (d.plan ?? d.plan_type ?? d.category ?? d.type ?? "").toString().toLowerCase();
    const pickY = (d) =>
      d.y ?? d.amount ?? d.total_amount ?? d.value ?? d.total ?? d.count ?? 0;

    for (const d of raw) {
      const x = String(pickX(d));
      const plan = pickPlan(d);
      const y = Number(pickY(d) ?? 0);
      if (!Number.isFinite(y)) continue;

      const row = result.get(x) ?? { x, pro: 0, enterprise: 0 };
      if (plan.includes("pro")) row.pro += y;
      else if (plan.includes("enterprise")) row.enterprise += y;
      // free 등 다른 플랜은 이번 그래프에선 제외
      result.set(x, row);
    }
  }

  return Array.from(result.values()).sort((a, b) => (a.x > b.x ? 1 : a.x < b.x ? -1 : 0));
}
