// src/test/utils/normalizeToXY.js
function getISOWeekInfo(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return { year: d.getUTCFullYear(), week: weekNo }
}

function toISOWeekLabel(input) {
  if (input && typeof input === "object" && "year" in input && "week" in input) {
    const y = Number(input.year)
    const w = String(Number(input.week)).padStart(2, "0")
    return `${y}-W${w}`
  }
  if (typeof input === "string") {
    const dt = new Date(input)
    if (!isNaN(dt)) {
      const { year, week } = getISOWeekInfo(dt)
      return `${year}-W${String(week).padStart(2, "0")}`
    }
  }
  if (typeof input === "number") return String(input)
  return String(input ?? "")
}

export function normalizeToXY(resp) {
  const rows = resp?.data ?? resp?.items ?? resp ?? []
  const mapped = rows.map((d) => {
    let rawX =
      d.x ??
      d.week_label ?? d.label ??
      d.week ?? d.weekStart ?? d.week_start ??
      d.date ?? d.day ?? d.start_date ?? d.start ??
      d.month ?? d.year ?? ""

    if (
      (typeof d === "object" && ("week" in d || "week_start" in d || "weekStart" in d || "start_date" in d)) ||
      /week/i.test(String(rawX))
    ) {
      rawX = toISOWeekLabel(
        ("week_start" in d && d.week_start) ||
        ("weekStart" in d && d.weekStart) ||
        ("start_date" in d && d.start_date) ||
        ("date" in d && d.date) ||
        ("week" in d && { year: d.year, week: d.week }) ||
        rawX
      )
    } else {
      if (rawX instanceof Date) rawX = rawX.toISOString().slice(0, 10)
      else if (typeof rawX === "number") rawX = String(rawX)
      else rawX = String(rawX ?? "")
    }

    const y = Number(d.y ?? d.count ?? d.value ?? d.total ?? d.signup ?? 0)
    return { x: rawX, y: isNaN(y) ? 0 : y }
  })

  const agg = new Map()
  for (const { x, y } of mapped) {
    if (!x) continue
    agg.set(x, (agg.get(x) ?? 0) + y)
  }

  const result = Array.from(agg.entries())
    .map(([x, y]) => ({ x, y }))
    .sort((a, b) => {
      const wk = /^(\d{4})-W(\d{2})$/
      const ma = a.x.match(wk)
      const mb = b.x.match(wk)
      if (ma && mb) {
        const ay = Number(ma[1]), aw = Number(ma[2])
        const by = Number(mb[1]), bw = Number(mb[2])
        return ay === by ? aw - bw : ay - by
      }
      return a.x.localeCompare(b.x)
    })

  return result
}
