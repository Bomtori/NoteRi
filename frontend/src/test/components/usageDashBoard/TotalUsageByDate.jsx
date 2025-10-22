// frontend/src/test/components/usageDashBoard/TotalUsageByDate.jsx
import React, { useEffect, useState } from "react";
import TotalUsageByDateCard from "@/test/components/usageDashBoard/TotalUsageByDateCard.tsx";

const API_BASE_URL = import.meta.env.API_BASE_URL ?? "http://localhost:8000";

const TotalUsageByDate = () => {
  const [range, setRange] = useState("today");

  const [todayUsageTotal, setTodayUsageTotal] = useState(0);
  const [weekUsageTotal, setWeekUsageTotal]   = useState(0);
  const [monthUsageTotal, setMonthUsageTotal] = useState(0);
  const [yearUsageTotal, setYearUsageTotal]   = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const [growthRate, setGrowthRate]   = useState(0); // 증감률
  const [growthDelta, setGrowthDelta] = useState(0); // 증감량(분)

  // (A) 구간별 총 사용량
  useEffect(() => {
    const ac = new AbortController();
    const endpoint = {
      today: "/recordings/usage/total/today",
      "7d":  "/recordings/usage/total/7d",
      month: "/recordings/usage/total/month",
      year:  "/recordings/usage/total/year",
    }[range];

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const total =
          (data && data.total) ??
          (data && data.today && data.today.total) ??
          (data && data.last_7_days && data.last_7_days.total) ??
          (data && data.month && data.month.total) ??
          (data && data.year && data.year.total) ?? 0;
console.log('TOTAL RAW', range, data);
        if (range === "today") setTodayUsageTotal(total);
        if (range === "7d")    setWeekUsageTotal(total);
        if (range === "month") setMonthUsageTotal(total);
        if (range === "year")  setYearUsageTotal(total);
      } catch (e) {
        if (e.name !== "AbortError") setError("불러오기 실패");
      }
    })();

    return () => ac.abort();
  }, [range]);

  // (B) 비교 요약 (증감률 + 증감량)
  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // ✅ 경로 수정
        const res = await fetch(`${API_BASE_URL}/recordings/usage/compare`, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const pctMap = {
          today: data && data.day && data.day.pct,
          "7d":  data && data.week && data.week.pct,
          month: data && data.month && data.month.pct,
          year:  data && data.year && data.year.pct,
        };
        const deltaMap = {
          today: data && data.day && data.day.delta,
          "7d":  data && data.week && data.week.delta,
          month: data && data.month && data.month.delta,
          year:  data && data.year && data.year.delta,
        };

        setGrowthRate(pctMap[range] ?? 0);
        setGrowthDelta(deltaMap[range] ?? 0);
      } catch (e) {
        if (e.name !== "AbortError") setError("불러오기 실패");
        setGrowthRate(0);
        setGrowthDelta(0);
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [range]);

  return (
    <>
      <TotalUsageByDateCard
        range={range}
        setRange={setRange}
        todayUsageTotal={todayUsageTotal}
        weekUsageTotal={weekUsageTotal}
        monthUsageTotal={monthUsageTotal}
        yearUsageTotal={yearUsageTotal}
        growthRate={growthRate}
        growthDelta={growthDelta}
        loading={loading}
        error={error}
      />
    </>
  );
};

export default TotalUsageByDate;
