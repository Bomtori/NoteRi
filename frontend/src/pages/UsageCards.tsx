// UsageCards.tsx
import React from "react";
import TotalUsage from "../components/dashboard/usageDashBoard/TotalUsage";
import TotalUsageByDate from "../components/dashboard/usageDashBoard/TotalUsageByDate";
import UsageAvgByPlan from "../components/dashboard/usageDashBoard/UsageAvgByPlan";
import AudioQuality from "../components/dashboard/usageDashBoard/AudioQuality";
import RatingSummary from "../components/dashboard/usageDashBoard/RatingSummary";
import { DASH_CARD } from "../components/dashboard/cards/cardStyles";
import { Card, CardContent } from "../components/ui/card";

const UsageCards: React.FC = () => {
  return (
    <div className="bg-background text-foreground p-6 min-w-0">
      {/* 부모: 1열로 고정 후 섹션별로 열수 제어 */}
      <div className="grid grid-cols-1 gap-6">
        {/* 1행: 3개 */}
        <section className="w-full grid gap-6 items-stretch grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          <div className="min-w-0 h-full"><TotalUsage /></div>
             <Card className={DASH_CARD}>
                <CardContent className="p-5">
                  <TotalUsageByDate frameless />  {/* ← 핵심 */}
                </CardContent>
             </Card>
             <Card className={DASH_CARD}>
                <CardContent className="p-5">
                  <AudioQuality frameless />
                </CardContent>
             </Card>
        </section>

        {/* 2행: 2개 */}
        <section className="w-full grid gap-6 items-stretch grid-cols-1 md:grid-cols-2">
            <Card className={DASH_CARD}>
                <CardContent className="p-5">
                  <UsageAvgByPlan frameless />
                </CardContent>
            </Card>
            <Card className={DASH_CARD}>
                <CardContent className="p-5">
                  <RatingSummary frameless />
                </CardContent>
            </Card>
        </section>
      </div>
    </div>
  );
};
export default UsageCards;
