from __future__ import annotations
from datetime import date, timedelta
from typing import Any, Dict, List, Literal, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

Granularity = Literal["day", "week", "month", "year"]

def _series_sql_parts(granularity: Granularity):
    if granularity == "day":
        series_sel  = "CAST(:start AS date), CAST(:end AS date), INTERVAL '1 day'"
        bucket_sql  = "series.bucket::date"
        # ⬇️ timezone(:tz, {ts}) 로 변경
        trunc_expr  = "date_trunc('day', timezone(:tz, {ts}))::date"
        label_key   = "date"
        label_fmt   = lambda d: d.isoformat()
    elif granularity == "week":
        series_sel  = "CAST(:start AS date), CAST(:end AS date), INTERVAL '1 week'"
        bucket_sql  = "series.bucket::date"
        trunc_expr  = "date_trunc('week', timezone(:tz, {ts}))::date"
        label_key   = "week_start"
        label_fmt   = lambda d: d.isoformat()
    elif granularity == "month":
        series_sel  = (
            "date_trunc('month', CAST(:start AS timestamp)), "
            "date_trunc('month', CAST(:end   AS timestamp)), "
            "INTERVAL '1 month'"
        )
        bucket_sql  = "series.bucket::date"
        trunc_expr  = "date_trunc('month', timezone(:tz, {ts}))::date"
        label_key   = "month"
        label_fmt   = lambda d: f"{d.year:04d}-{d.month:02d}"
    elif granularity == "year":
        series_sel  = (
            "date_trunc('year', CAST(:start AS timestamp)), "
            "date_trunc('year', CAST(:end   AS timestamp)), "
            "INTERVAL '1 year'"
        )
        bucket_sql  = "series.bucket::date"
        trunc_expr  = "date_trunc('year', timezone(:tz, {ts}))::date"
        label_key   = "year"
        label_fmt   = lambda d: f"{d.year:04d}"
    else:
        raise ValueError("invalid granularity")
    return series_sel, bucket_sql, trunc_expr, label_key, label_fmt


def trend_series(
    db: Session,
    *,
    table: str,           # 예: "users" / "payments p" (alias 포함 가능)
    ts_column: str,       # 예: "created_at" / "approved_at"
    start: date,
    end: date,
    granularity: Granularity,
    tz: str = "Asia/Seoul",
    # 집계 종류
    agg: Literal["count", "sum"] = "count",
    agg_expr: Optional[str] = None,  # count면 무시, sum이면 예: "p.amount"
    # 카테고리 피벗(예: plan 이름): 컬럼/표현식 문자열. 예: "pl.name"
    category_expr: Optional[str] = None,
    # 조인/조건 커스터마이즈
    joins: Optional[str] = None,     # 예: "LEFT JOIN subscriptions s ON p.subscription_id=s.id ..."
    where: Optional[str] = None,     # 예: "p.status='SUCCESS' AND p.approved_at IS NOT NULL"
) -> Dict[str, Any]:
    """
    generate_series로 빈 버킷 0 채우기 + COUNT/SUM 집계.
    category_expr가 있으면 {bucket: {category: value}} 형식으로 응답.
    """
    series_sel, bucket_sql, trunc_expr, label_key, label_fmt = _series_sql_parts(granularity)

    # ⬇️ table에 별칭이 있으면 별칭.없음 → p.approved_at 형식으로 보정
    if "." not in ts_column:
        if " " in table:
            alias = table.split()[-1]
            ts_qualified = f"{alias}.{ts_column}"
        else:
            ts_qualified = f"{table}.{ts_column}"
    else:
        ts_qualified = ts_column

    trunc_sql = trunc_expr.format(ts=ts_qualified)

    if agg == "count":
        value_sql = "COUNT(*)"
    elif agg == "sum":
        if not agg_expr:
            raise ValueError("sum requires agg_expr, e.g. 'p.amount'")
        value_sql = f"COALESCE(SUM({agg_expr}), 0)"
    else:
        raise ValueError("agg must be 'count' or 'sum'")

    joins_sql = f"\n{joins}\n" if joins else ""
    where_sql = f"WHERE {where}\n" if where else ""

    # category 존재 여부에 따라 counts CTE가 달라짐
    if category_expr:
        counts_sql = f"""
            SELECT {trunc_sql} AS bucket, {category_expr} AS category, {value_sql} AS val
            FROM {table}
            {joins_sql}
            {where_sql}
            GROUP BY 1, 2
        """
        final_select = f"""
            SELECT {bucket_sql} AS bucket,
                   c.category,
                   COALESCE(c.val, 0) AS val
            FROM series
            LEFT JOIN counts c ON c.bucket::date = {bucket_sql}
            ORDER BY series.bucket
        """
    else:
        counts_sql = f"""
            SELECT {trunc_sql} AS bucket, {value_sql} AS val
            FROM {table}
            {joins_sql}
            {where_sql}
            GROUP BY 1
        """
        final_select = f"""
            SELECT {bucket_sql} AS bucket,
                   COALESCE(c.val, 0) AS val
            FROM series
            LEFT JOIN counts c ON c.bucket::date = {bucket_sql}
            ORDER BY series.bucket
        """

    sql = text(f"""
        WITH series AS (
            SELECT generate_series({series_sel}) AS bucket
        ),
        counts AS (
            {counts_sql}
        )
        {final_select}
    """)

    rows = db.execute(sql, {"start": start, "end": end, "tz": tz}).fetchall()

    # 결과 구성
    if category_expr:
        # 버킷 x 카테고리 → 피벗
        by_bucket: Dict[date, Dict[str, float]] = {}
        cats: set[str] = set()
        for r in rows:
            if r.category is None:
                continue
            cats.add(r.category)
            by_bucket.setdefault(r.bucket, {})[r.category] = float(r.val)

        data: List[Dict[str, Any]] = []

        # granularity별 버킷 재생성
        def _bucket_range(g, start, end):
            if g == "day":
                return [start + timedelta(days=i) for i in range((end - start).days + 1)]
            if g == "week":
                s = start - timedelta(days=start.weekday())
                e = end - timedelta(days=end.weekday())
                k = ((e - s).days // 7) + 1
                return [s + timedelta(weeks=i) for i in range(k)]
            if g == "month":
                out = []
                y, m = start.year, start.month
                while (y, m) <= (end.year, end.month):
                    out.append(date(y, m, 1))
                    m = (m % 12) + 1
                    if m == 1:
                        y += 1
                return out
            if g == "year":
                return [date(y, 1, 1) for y in range(start.year, end.year + 1)]
            raise ValueError

        buckets = _bucket_range(granularity, start, end)
        totals: Dict[str, float] = {}

        for b in buckets:
            row = {label_key: label_fmt(b)}
            for c in by_bucket.keys() | set().union(*[set(v.keys()) for v in by_bucket.values()]) if by_bucket else set():
                pass  # placeholder to preserve structure

            # 카테고리 키 집합 계산
            if buckets.index(b) == 0:
                all_cats = set()
                for v in by_bucket.values():
                    all_cats |= set(v.keys())
                totals = {c: 0.0 for c in all_cats}

            # 값 채우기
            for c in totals.keys():
                v = by_bucket.get(b, {}).get(c, 0.0)
                row[c] = v
                totals[c] += v

            data.append(row)

        return {
            "range": {"start": start.isoformat(), "end": end.isoformat()},
            "granularity": granularity,
            "totals": totals,
            "data": data,
        }
    else:
        # 단일 시리즈
        data = [{label_key: label_fmt(r.bucket), "value": float(r.val)} for r in rows]
        total = sum(x["value"] for x in data)
        return {
            "range": {"start": start.isoformat(), "end": end.isoformat()},
            "granularity": granularity,
            "total": total,
            "data": data,
        }
