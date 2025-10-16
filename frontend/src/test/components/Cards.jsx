import StatCard from "@/test/components/StatCard";
import {useEffect, useMemo, useState} from "react";
import DateButtons from "@/test/components/DateButtons.jsx";
import DateButton from "@/test/components/DateButtons.jsx";
import CardWithActions from "@/test/components/CardWithActions.jsx";
import CardWithDonutGraph from "@/test/components/CardWithDonutGraph.js";
import MetricStatCard from "@/test/components/MetricsStatCard.js";

const API_BASE_URL = import.meta.env.API_BASE_URL ?? "http://localhost:8000"

function UserSignupTrend() {
  return null;
}

export default function Cards() {

  const [totalUsers, setTotalUsers] = useState(0)
  const [noActiveUsers, setNoActiveUsers] = useState(0)
  const [todaySignupUsers, setTodaySignupUsers] = useState(0)
  const [last7dSignupUsers, setLast7dSignupUsers] = useState(0)
  const [lastMonthSignupUsers, setLastMonthSignupUsers] = useState(0)
  const [lastYearSignupUsers, setLastYearSignupUsers] = useState(0)
const [providerCounts, setProviderCounts] = useState({}); // {google, naver, kakao}
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [range, setRange] = useState("today");


  // 기간 동안 가입자 수
  useEffect(() => {
    const ac = new AbortController();
    const endpoint = {
      today: "/users/count/signup/today",
      "7d": "/users/last-7d",
      month: "/users/last-m",
      year: "/users/last-12m",
    }[range];
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // 예: 각각의 state로 저장
        if (range === "today") setTodaySignupUsers(data.total ?? 0);
        if (range === "7d") setLast7dSignupUsers(data.total ?? 0);
        if (range === "month") setLastMonthSignupUsers(data.total ?? 0);
        if (range === "year") setLastYearSignupUsers(data.total ?? 0);
      } catch (e) {
        if (e.name !== "AbortError") setError("불러오기 실패");
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
      // 예: data.get_user_count_by_provider === { google:116, naver:26, kakao:52 }
      console.log("data", data)
      setProviderCounts(data || {})
    } catch (e) {
      if (e.name !== "AbortError") {
        setError("전체 사용자 수를 불러오지 못했습니다.");
        setProviderCounts({});
      }
    } finally {
      setLoading(false);
    }
  };
  run();
  return () => ac.abort();
  // provider 비율이 range(오늘/7일/월/년)에 따라 바뀌는 API라면 [range] 유지,
  // 아니면 []로 한 번만 호출하세요.
}, [range]); // 필요 없으면 [] 로

// 3) 렌더링용 배열로 변환
const provider = useMemo(() => {
  const counts = providerCounts || {};
  return [
     { id: "kakao",  value: Number(counts.kakao  ?? 0), color: "#FEE500" }, // 노랑
    { id: "google", value: Number(counts.google ?? 0), color: "#4285F4" }, // 파랑
    { id: "naver",  value: Number(counts.naver  ?? 0), color: "#03C75A" }, // 초록
  ];
}, [providerCounts]);

// 전체 유저 수
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`${API_BASE_URL}/users/count`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setTotalUsers(data.total_users ?? 0)
      } catch (e) {
        setError("전체 사용자 수를 불러오지 못했습니다.")
        setTotalUsers(null)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [range])

  //비활성 유저 수
  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)
      const res = await fetch(`${API_BASE_URL}/users/count/noactive`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      setNoActiveUsers(data.no_active_users ?? 0)
    }
  }, [range])


  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-6xl mx-auto grid gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <MetricStatCard
          title="전체 사용자"
          value={totalUsers ?? 0}
          caption={`비활성 유저 : ${(noActiveUsers ?? 0).toLocaleString()} 명`}
          loading={loading}
          error={error}
        />
        <StatCard
          title="MAU"
          value="1,532"
          delta="+7.4%"
          trend="up"
          highlight="전일 대비 7.4% 상승"
        />
        <CardWithActions
            range={range}
            setRange={setRange}
            todaySignupUsers={todaySignupUsers}
      last7dSignupUsers={last7dSignupUsers}
      lastMonthSignupUsers={lastMonthSignupUsers}
      lastYearSignupUsers={lastYearSignupUsers}
        />
        <CardWithDonutGraph
        providerUsers={provider}/>
        <UserSignupTrend/>
      </div>
    </div>
  )
}
