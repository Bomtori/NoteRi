import React, {useEffect, useState} from 'react';
import CardWithActions from "@/test/components/CardWithActions.jsx";
import CardWithDonutGraph from "@/test/components/CardWithDonutGraph.js";
import CardWithAreaChart from "@/test/components/CardWithAreaChart.js";

  const [range, setRange] = useState("today");
    const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [last7dSignupUsers, setTodaySignupUsers] = useState(0)
  const [last5wSignupUsers, setLast7dSignupUsers] = useState(0)
  const [last6mSignupUsers, setLastMonthSignupUsers] = useState(0)
  const [last5ySignupUsers, setLastYearSignupUsers] = useState(0)

  // 기간 동안 가입자 수
  useEffect(() => {
    const ac = new AbortController();
    const endpoint = {
      "7d": "/users/count/signup/last-7-days",
      "5w": "/users/count/signup/last-5-weeks",
      "6m": "/users/count/signup/last-6-months",
      "5y": "/users/count/signup/last-5-years",
    }[range];
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // 예: 각각의 state로 저장
        if (range === "7d") last7dSignupUsers(data.total ?? 0);
        if (range === "5w") last5wSignupUsers(data.total ?? 0);
        if (range === "6m") last6mSignupUsers(data.total ?? 0);
        if (range === "5y") last5ySignupUsers(data.total ?? 0);
      } catch (e) {
        if (e.name !== "AbortError") setError("불러오기 실패");
      }
    })();
    return () => ac.abort();
  }, [range]);
const UserSignupTrend = () => {
    return (
        <div>
             <CardWithAreaChart
            range={range}
            setRange={setRange}
            last7dSignupUsers={last7dSignupUsers}
      last5wSignupUsers={last5wSignupUsers}
      last6mSignupUsers={last6mSignupUsers}
      last5ySignupUsers={last5ySignupUsers}
        />
        </div>
    );
};

export default UserSignupTrend;