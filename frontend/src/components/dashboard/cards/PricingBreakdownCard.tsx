import * as React from "react";
import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../ui/card";
import { BarChart3 } from "lucide-react";
import { cn } from "../../../lib/utils";

type Item = { id: string; label: string; count: number };
type UsersByPlanRow = { plan: string; user_count: number };
type UsersByPlanInput = UsersByPlanRow[] | Record<string, number> | undefined;

interface Props {
  items?: Item[];
  usersByPlan?: UsersByPlanInput;
  title?: string;
  className?: string;
  loading?: boolean;           // ✅ 추가
  error?: string | null;       // ✅ 추가
}

const PricingBreakdownCard: React.FC<Props> = ({
  items,
  usersByPlan,
  title = "요금제별 가입 현황",
  className,
  loading = false,
  error = null,
}) => {
  const rows: Item[] = useMemo(() => {
    if (Array.isArray(items)) return items;
    if (Array.isArray(usersByPlan)) {
      return usersByPlan.map(({ plan, user_count }) => ({
        id: String(plan),
        label: String(plan),
        count: Number(user_count ?? 0),
      }));
    }
    const obj = (usersByPlan as Record<string, number>) ?? {};
    return Object.entries(obj).map(([name, count]) => ({
      id: String(name),
      label: String(name),
      count: Number(count ?? 0),
    }));
  }, [items, usersByPlan]);

  const total = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.count) || 0), 0),
    [rows]
  );

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="text-sm text-muted-foreground">로딩…</div>
        ) : error ? (
          <div className="text-sm text-destructive">에러: {error}</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">데이터가 없습니다.</div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto] gap-x-8 gap-y-4">
              {rows.map(({ id, label, count }) => (
                <React.Fragment key={id}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{label}</div>
                  </div>
                  <div className="text-lg font-semibold tabular-nums">
                    {Number(count || 0).toLocaleString()}명
                  </div>
                </React.Fragment>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-[1fr_auto]">
              <div className="text-xs text-muted-foreground">총 합계</div>
              <div className="text-sm font-semibold tabular-nums">
                {total.toLocaleString()}명
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PricingBreakdownCard;