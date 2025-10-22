// src/test/components/UserCards.jsx
import StatCard from "@/test/components/StatCard.js";
import { useEffect, useMemo, useState } from "react";
import CardWithActions from "@/test/components/userDashBoard/CardWithActions.jsx";
import CardWithDonutGraph from "@/test/components/CardWithDonutGraph.tsx";
import MetricStatCard from "@/test/components/userDashBoard/MetricsStatCard.tsx";
import UserSignupTrend from "@/test/components/userDashBoard/UserSignupTrend.jsx";

const API_BASE_URL = import.meta.env.API_BASE_URL ?? "http://localhost:8000";

function pickGrowthRate(payload) {
  // 1) { current, previous, growth_rate }
  if (payload && typeof payload.growth_rate === "number") return payload.growth_rate;
  // 2) { ok, items:{ current, previous, growth_rate } }
  if (payload?.items?.growth_rate != null) return Number(payload.items.growth_rate);
  // 3) 플랜별 dict 등은 합산하여 성장률 계산
  if (payload && typeof payload === "object") {
    let cur = 0, prev = 0;
    for (const v of Object.values(payload)) {
      if (v && typeof v === "object" && "current" in v && "previous" in v) {
        cur += Number(v.current || 0);
        prev += Number(v.previous || 0);
      }
    }
    if (cur === 0 && prev === 0) return 0;
    return prev === 0 ? (cur > 0 ? 1 : 0) : (cur - prev) / prev;
  }
  return 0;
}

export default function UserCards() {
  const [totalUsers, setTotalUsers] = useState(0);
  const [noActiveUsers, setNoActiveUsers] = useState(0);
  const [todaySignupUsers, setTodaySignupUsers] = useState(0);
  const [last7dSignupUsers, setLast7dSignupUsers] = useState(0);
  const [lastMonthSignupUsers, setLastMonthSignupUsers] = useState(0);
  const [lastYearSignupUsers, setLastYearSignupUsers] = useState(0);
  const [providerCounts, setProviderCounts] = useState({});
  const [range, setRange] = useState("today");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [growthRate, setGrowthRate] = useState(0); // 👈 추가: 기간별 성장률(DoD/WoW/MoM/YoY)

  // 기간 동안 가입자 수
  useEffect(() => {
    const ac = new AbortController();
    const endpoint = {
      today: "/users/count/signup/today",
      "7d":  "/users/last-7d",
      month: "/users/last-m",
      year:  "/users/last-12m",
    }[range];

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (range === "today") setTodaySignupUsers(data.total ?? 0);
        if (range === "7d")    setLast7dSignupUsers(data.total ?? 0);
        if (range === "month") setLastMonthSignupUsers(data.total ?? 0);
        if (range === "year")  setLastYearSignupUsers(data.total ?? 0);
      } catch (e) {
        if (e.name !== "AbortError") setError("불러오기 실패");
      }
    })();

    return () => ac.abort();
  }, [range]);

  // ✅ 성장률(DoD/WoW/MoM/YoY) 가져오기
  useEffect(() => {
    const ac = new AbortController();
    const growthEndpoint = {
      today: "/users/dod",  // 전일 대비
      "7d":  "/users/wow",  // 전주 대비(동요일까지 누적)
      month: "/users/mom",  // 전월 대비
      year:  "/users/yoy",  // 전년 대비
    }[range];

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const gr = await fetch(`${API_BASE_URL}${growthEndpoint}`, { signal: ac.signal });
        if (!gr.ok) throw new Error(`HTTP ${gr.status}`);
        const growthJson = await gr.json();
        setGrowthRate(pickGrowthRate(growthJson));
      } catch (e) {
        if (e.name !== "AbortError") setError("불러오기 실패");
        setGrowthRate(0);
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [range]);

  // 플랫폼 별 유저
  useEffect(() => {
    const ac = new AbortController();
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/users/count/provider`, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setProviderCounts(data || {});
      } catch (e) {
        if (e.name !== "AbortError") {
          setError("사용자 수를 불러오지 못했습니다.");
          setProviderCounts({});
        }
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => ac.abort();
  }, [range]); // 필요 없으면 [] 로 변경

  // 3) 렌더링용 배열로 변환
  const provider = useMemo(() => {
    const counts = providerCounts || {};
    return [
      { id: "kakao",  value: Number(counts.kakao  ?? 0), color: "#FEE500" },
      { id: "google", value: Number(counts.google ?? 0), color: "#4285F4" },
      { id: "naver",  value: Number(counts.naver  ?? 0), color: "#03C75A" },
    ];
  }, [providerCounts]);

  // 전체 유저 수
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/users/count`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setTotalUsers(data.total_users ?? 0);
      } catch (e) {
        setError("전체 사용자 수를 불러오지 못했습니다.");
        setTotalUsers(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [range]);

  // 비활성 유저 수
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/users/count/noactive`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setNoActiveUsers(data.no_active_users ?? 0);
      } catch (e) {
        setError("비활성 사용자 수를 불러오지 못했습니다.");
        setNoActiveUsers(0);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [range]);

  return (
    <div className="bg-background text-foreground p-6">
      <div className="mx-auto w-full max-w-7xl grid grid-cols-[repeat(3,minmax(0,1fr))] items-start gap-4">
        <MetricStatCard className="min-h-[190px] sm:col-span-2 xl:col-span-2"
          title="전체 사용자"
          value={totalUsers ?? 0}
          caption={`비활성 유저 : ${(noActiveUsers ?? 0).toLocaleString()} 명`}
          loading={loading}
          error={error}
        />
        <StatCard className="min-h-[190px]"
          title="MAU"
          value="1,532"
          delta="+7.4%"
          trend="up"
          highlight="전일 대비 7.4% 상승"
        />
        {/* 가입자 카드: 뱃지(헤더) + 버튼(본문 우측) */}
        <CardWithActions className="min-h-[190px] "
          range={range}
          setRange={setRange}
          todaySignupUsers={todaySignupUsers}
          last7dSignupUsers={last7dSignupUsers}
          lastMonthSignupUsers={lastMonthSignupUsers}
          lastYearSignupUsers={lastYearSignupUsers}
          growthRate={growthRate}     // 👈 여기!
          loading={loading}
          error={error}
        />
        <CardWithDonutGraph className="sm:col-span-2 xl:col-span-2 h-[340px]"
          providerUsers={provider}
        />
        <div className="col-span-1 sm:col-span-2 xl:grid-cols-4 xl:col-span-4">
          <UserSignupTrend />
        </div>
      </div>
    </div>
  );
}
