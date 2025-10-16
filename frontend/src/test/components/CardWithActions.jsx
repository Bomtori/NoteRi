import React, {useMemo, useState} from 'react';
import { Button } from "@/components/ui/button"
// StatCard 경로 맞게 수정
import StatCard from "@/test/components/StatCard"
import DateButtons from "@/test/components/DateButtons.jsx";

const CardWithActions = ({
  range, setRange, todaySignupUsers, last7dSignupUsers, lastMonthSignupUsers, lastYearSignupUsers
}) => {

    const value = useMemo(() => {
    switch (range) {
      case "today":
        return todaySignupUsers ?? 0
      case "7d":
        return last7dSignupUsers ?? 0
      case "month":
        return lastMonthSignupUsers ?? 0
      case "year":
      default:
        return lastYearSignupUsers ?? 0
    }
  }, [range, todaySignupUsers, last7dSignupUsers, lastMonthSignupUsers, lastYearSignupUsers])
    return (
      <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-6xl mx-auto grid gap-6 grid-cols-1">
        <StatCard
          title="가입자 수"
          value={value.toLocaleString()+" 명"}
          // delta/trend 등은 필요 시 여전히 전달 가능
          actions={
            <DateButtons
              range={range}
              onRangeChange={setRange}
            />
          }
          hideTrend
        />
      </div>
    </div>
    );

};

export default CardWithActions;