/* filename: src/test/components/paymentDashBoard/PaymentByPlan.tsx */
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import RechartsDonut from "../cards/RechartsDonut";
import {DASH_CARD} from "../cards/cardStyles";
import {cn} from "../../../lib/utils";

type PlanDatum = { id: string; value: number; color?: string };

type ApiItem = {
  plan_id: number;
  plan_name: string;       // ✅ 백엔드에서 바로 내려옴
  total_amount: number;
};
type ApiResponse = { items: ApiItem[] } | null;

// (구버전도 잠깐 지원: {pro:123} 또는 [{plan:"pro", amount:...}])
type LegacyRevenue =
  | Record<string, number>
  | Array<{ plan?: string; plan_type?: string; amount?: number; total?: number; value?: number }>;

const COLORS: Record<string, string> = {
  free: "#94a3b8",
  pro: "#F59E0B",
  enterprise: "#10B981",
  starter: "#6366f1",
};

const LABEL_KO: Record<string, string> = {
  free: "무료",
  pro: "프로",
  enterprise: "엔터프라이즈",
  starter: "스타터",
};

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE ??
  (import.meta as any).env?.API_BASE_URL ??
  "http://127.0.0.1:8000";

function titleCase(s: string) {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function PaymentByPlan({
  className = "",
  height = 220,
  title = "플랜 별 매출 비율",
}: {
  className?: string;
  height?: number;
  title?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<ApiResponse>(null);
  const [legacy, setLegacy] = useState<LegacyRevenue | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/analytics/revenue/paid`, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // 신형 스키마 우선
        if (data && typeof data === "object" && Array.isArray(data.items)) {
          setResp(data as ApiResponse);
          setLegacy(null);
        } else {
          // 구형 스키마 대응
          setResp(null);
          setLegacy(data as LegacyRevenue);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") setError("플랜별 매출을 불러오지 못했습니다.");
        setResp(null);
        setLegacy(null);
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  // 신형/구형 모두 RechartsDonut 데이터로 통일
  const data = useMemo<PlanDatum[]>(() => {
    const out: PlanDatum[] = [];

    if (resp?.items) {
      for (const it of resp.items) {
        const id = String(it.plan_name || "").toLowerCase(); // ✅ plan_name 사용
        out.push({
          id,
          value: Number(it.total_amount ?? 0),
          color: COLORS[id] ?? "#94a3b8",
        });
      }
    } else if (legacy) {
      if (Array.isArray(legacy)) {
        for (const r of legacy) {
          const id = String((r.plan ?? r.plan_type ?? "") || "").toLowerCase();
          const val = Number(r.amount ?? r.total ?? r.value ?? 0);
          if (!id) continue;
          out.push({ id, value: val, color: COLORS[id] ?? "#94a3b8" });
        }
      } else if (legacy && typeof legacy === "object") {
        for (const [k, v] of Object.entries(legacy)) {
          const id = k.toLowerCase();
          out.push({ id, value: Number(v ?? 0), color: COLORS[id] ?? "#94a3b8" });
        }
      }
    }

    // 표준 순서: free, pro, enterprise, 나머지는 알파벳
    const order = ["free", "pro", "enterprise"];
    out.sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      if (ia === -1 && ib === -1) return a.id.localeCompare(b.id);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    return out.some((d) => d.value > 0) ? out : [];
  }, [resp, legacy]);

  const total = useMemo(() => data.reduce((s, d) => s + (Number(d.value) || 0), 0), [data]);
  const headline = loading ? "로딩…" : error ? "-" : `${total.toLocaleString()} 원`;

  // 범례 라벨 매핑: 백엔드 plan_name을 기반으로 한글화
  const labelsMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (resp?.items?.length) {
      for (const it of resp.items) {
        const id = String(it.plan_name || "").toLowerCase();
        map[id] = LABEL_KO[id] ?? titleCase(it.plan_name);
      }
    } else {
      for (const d of data) {
        map[d.id] = LABEL_KO[d.id] ?? titleCase(d.id);
      }
    }
    return map;
  }, [resp, data]);

  return (
    <Card className={cn(DASH_CARD, className)}>
      <CardHeader className="p-5 pb-2">
        <CardTitle className="text-muted-foreground">{title}</CardTitle>
      </CardHeader>

      <CardContent className="p-5 pt-0">
        <div className="text-2xl font-semibold mb-3">{headline}</div>

        {error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : data.length === 0 && !loading ? (
          <div className="text-sm text-muted-foreground">데이터가 없습니다.</div>
        ) : (
          <div className="w-full overflow-hidden min-w-0" style={{ height }}>
            <RechartsDonut
              data={data}
              height={height}
              showLegend
              legendPlacement="right"
              labelsMap={labelsMap}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
