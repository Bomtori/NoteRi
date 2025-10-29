import React, { useEffect, useMemo, useState } from "react";
import StatCard from "../components/dashboard/cards/StatCard";
import SingUserByDate from "../components/dashboard/userDashBoard/SingUserByDate";
import UserByProvider from "../components/dashboard/userDashBoard/UserByProvider";
import MetricStatCard from "../components/dashboard/userDashBoard/MetricsStatCard";
import UserSignupTrend from "../components/dashboard/userDashBoard/UserSignupTrend";
import UserAway from "../components/dashboard/userDashBoard/UserAway";
import UserByAge from "../components/dashboard/userDashBoard/UserByAge";

type Range = "today" | "7d" | "month" | "year";
type ProviderCounts = Record<string, number>;

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE ??
  (import.meta as any).env?.API_BASE_URL ??
  "http://127.0.0.1:8000";

function pickGrowthRate(payload: any): number {
  if (payload && typeof payload.growth_rate === "number") return payload.growth_rate;
  if (payload?.items?.growth_rate != null) return Number(payload.items.growth_rate);
  if (payload && typeof payload === "object") {
    let cur = 0,
      prev = 0;
    for (const v of Object.values(payload)) {
      if (v && typeof v === "object" && "current" in (v as any) && "previous" in (v as any)) {
        cur += Number((v as any).current || 0);
        prev += Number((v as any).previous || 0);
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
  const [providerCounts, setProviderCounts] = useState<ProviderCounts>({});
  const [range, setRange] = useState<Range>("today");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [growthRate, setGrowthRate] = useState(0);

  // 기간별 가입자 수
  useEffect(() => {
    const ac = new AbortController();
    const endpoint =
      {
        today: "/users/count/signup/today",
        "7d": "/users/last-7d",
        month: "/users/last-m",
        year: "/users/last-12m",
      }[range] ?? "/users/count/signup/today";

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (range === "today") setTodaySignupUsers(Number(data.total ?? 0));
        if (range === "7d") setLast7dSignupUsers(Number(data.total ?? 0));
        if (range === "month") setLastMonthSignupUsers(Number(data.total ?? 0));
        if (range === "year") setLastYearSignupUsers(Number(data.total ?? 0));
      } catch (e: any) {
        if (e?.name !== "AbortError") setError("불러오기 실패");
      }
    })();

    return () => ac.abort();
  }, [range]);

  // 성장률
  useEffect(() => {
    const ac = new AbortController();
    const growthEndpoint =
      {
        today: "/users/dod",
        "7d": "/users/wow",
        month: "/users/mom",
        year: "/users/yoy",
      }[range] ?? "/users/dod";

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const gr = await fetch(`${API_BASE_URL}${growthEndpoint}`, { signal: ac.signal });
        if (!gr.ok) throw new Error(`HTTP ${gr.status}`);
        const growthJson = await gr.json();
        setGrowthRate(pickGrowthRate(growthJson));
      } catch (e: any) {
        if (e?.name !== "AbortError") setError("불러오기 실패");
        setGrowthRate(0);
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [range]);

  // 플랫폼별 유저
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/users/count/provider`, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ProviderCounts;
        setProviderCounts(data || {});
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setError("사용자 수를 불러오지 못했습니다.");
          setProviderCounts({});
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [range]);

  // 전체 유저 수
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/users/count`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setTotalUsers(Number(data.total_users ?? 0));
      } catch (e: any) {
        if (e?.name !== "AbortError") setError("사용자 수를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [range]);

  // 비활성 유저 수
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/users/count/noactive`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setNoActiveUsers(Number(data.no_active_users ?? 0));
      } catch (e: any) {
        if (e?.name !== "AbortError") setError("사용자 수를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [range]);

  // 도넛 데이터
  const provider = useMemo(
    () => [
      { id: "kakao", value: Number(providerCounts.kakao ?? 0), color: "#FEE500" },
      { id: "google", value: Number(providerCounts.google ?? 0), color: "#4285F4" },
      { id: "naver", value: Number(providerCounts.naver ?? 0), color: "#03C75A" },
    ],
    [providerCounts]
  );

  return (
    <div className="min-w-0">
      <div className="min-w-0 grid gap-6">
        <MetricStatCard
          title="전체 사용자"
          value={totalUsers ?? 0}
          caption={`비활성 유저 : ${(noActiveUsers ?? 0).toLocaleString()} 명`}
          loading={loading}
          error={error ?? undefined}
        />

        <StatCard title="MAU" value="1,532" delta="+7.4%" trend="up" highlight="전일 대비 7.4% 상승" />

        <SingUserByDate
          range={range}
          setRange={setRange}
          todaySignupUsers={todaySignupUsers}
          last7dSignupUsers={last7dSignupUsers}
          lastMonthSignupUsers={lastMonthSignupUsers}
          lastYearSignupUsers={lastYearSignupUsers}
          growthRate={growthRate}
          loading={loading}
          error={error ?? undefined}
        />

        <UserByProvider providerUsers={provider} />

        <UserAway range={range} />

        <div className="min-w-0">
          <UserByAge />
        </div>

        <div className="min-w-0">
          <UserSignupTrend />
        </div>
      </div>
    </div>
  );
}
