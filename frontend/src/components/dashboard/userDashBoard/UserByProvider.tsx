/* filename: src/components/UserByProvider.tsx */
import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import RechartsDonut from "../cards/RechartsDonut";

type ProviderCounts = Record<string, number> | undefined;
type ProviderDatum = { id: string; value: number; color?: string };

const COLORS: Record<string, string> = {
  kakao: "#FEE500",
  naver: "#03C75A",
  google: "#4285F4",
};

// 범례에 쓸 표시명 매핑
const LABELS: Record<string, string> = {
  kakao: "카카오",
  google: "구글",
  naver: "네이버",
};

export default function UserByProvider({
  providerUsers,
  className = "",
  height = 220,
}: {
  providerUsers: ProviderCounts | ProviderDatum[];
  className?: string;
  height?: number;
}) {
  const data = useMemo<ProviderDatum[]>(() => {
    if (Array.isArray(providerUsers)) {
      return providerUsers.map((d) => ({
        id: d.id,
        value: Number(d.value ?? 0),
        color: d.color ?? COLORS[d.id] ?? "#94a3b8",
      }));
    }
    const counts = providerUsers ?? {};
    const base: ProviderDatum[] = ["kakao", "google", "naver"].map((id) => ({
      id,
      value: Number((counts as any)[id] ?? 0),
      color: COLORS[id] ?? "#94a3b8",
    }));
    Object.keys(counts).forEach((id) => {
      if (!base.find((b) => b.id === id)) {
        base.push({
          id,
          value: Number((counts as any)[id] ?? 0),
          color: COLORS[id] ?? "#94a3b8",
        });
      }
    });
    return base;
  }, [providerUsers]);

  const total = useMemo(
    () => data.reduce((s, d) => s + (Number(d.value) || 0), 0),
    [data]
  );
  // 공통 카드 스타일 (원하는 강도로 조절 가능)
  const CARD = "bg-white rounded-2xl shadow-sm transition-all duration-200 hover:-translate-y-0.1 hover:shadow-lg";

  return (
    <Card className={`${CARD} ${className}`}>
      <CardHeader className="p-5 pb-2">
        <CardTitle className="text-muted-foreground">플랫폼 별 가입자 비율</CardTitle>
      </CardHeader>

      <CardContent className="p-5 pt-0">
        <div className="text-2xl font-semibold mb-3">
          {total.toLocaleString()} 명
        </div>

        <div className="w-full overflow-hidden min-w-0" style={{ height }}>
          <RechartsDonut
            data={data}
            height={height}
            showLegend                   // 범례 표시
            legendPlacement="right"      // 오른쪽에 범례
            labelsMap={LABELS}           // id → 한글 표시명
          />
        </div>
      </CardContent>
    </Card>
  );
}
