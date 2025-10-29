/* filename: src/test/components/userDashBoard/UserAway.tsx */
import React, { useEffect, useState } from "react";
import StatCard from "../cards/StatCard";

type Props = {
  range?: string;
};

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE ??
  (import.meta as any).env?.API_BASE_URL ??
  "http://127.0.0.1:8000";

const UserAway: React.FC<Props> = ({ range }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [awayUserCount, setAwayUserCount] = useState<number>(0);
  const [awayRatio, setAwayRatio] = useState<number>(0);

  useEffect(() => {
    let aborted = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(undefined);

        const res = await fetch(`${API_BASE_URL}/users/away/count`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const count =
          data.inactive_user_count ??
          data.inactive_users ??
          data.count ??
          0;

        const ratio = data.inactive_ratio ?? data.ratio ?? 0;

        if (aborted) return;
        setAwayUserCount(Number(count));
        setAwayRatio(Number(ratio));
      } catch (e: unknown) {
        if (aborted) return;
        setError(
          e instanceof Error ? e.message : "이탈 유저 정보를 불러오지 못했습니다."
        );
        setAwayUserCount(0);
        setAwayRatio(0);
      } finally {
        if (!aborted) setLoading(false);
      }
    };

    run();
    return () => {
      aborted = true;
    };
  }, [range]);

  const caption =
    error ? undefined : `이탈률: ${(awayRatio * 100).toFixed(2)}%`;

  const value: string =
    loading ? "로딩…" : error ? "-" : `${awayUserCount.toLocaleString()} 명`;

  return (
    <div className="w-full">
      <StatCard
        title="이탈 유저 (최근 6개월 미접속자)"
        value={value}
        caption={caption}
        hideTrend
      />
    </div>
  );
};

export default UserAway;
