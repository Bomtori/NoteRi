import React, { useEffect, useState } from "react";
import UserAwayCard from "@/test/components/userDashBoard/UserAwayCard.js";

const API_BASE_URL = import.meta.env.API_BASE_URL ?? "http://localhost:8000";

type Props = {
  range?: string;
};

const UserAway: React.FC<Props> = ({ range }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [awayUserCount, setAwayUserCount] = useState<number>(0);
  const [awayRatio, setAwayRatio] = useState<number>(0); // 비율 상태 추가

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(undefined);

        const res = await fetch(`${API_BASE_URL}/users/away/count`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // ✅ 백엔드 응답 예시:
        // { inactive_users: 21, inactive_ratio: 0.1745 }
        const count =
          data.inactive_user_count ??
          data.inactive_users ??
          data.count ??
          0;

        const ratio =
          data.inactive_ratio ??
          data.ratio ??
          0;

        setAwayUserCount(Number(count));
        setAwayRatio(Number(ratio));
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "이탈 유저 정보를 불러오지 못했습니다.");
        setAwayUserCount(0);
        setAwayRatio(0);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [range]);

  const caption = error
    ? undefined
    : `이탈률: ${(awayRatio * 100).toFixed(1)}%`;

  return (
    <div>
      <UserAwayCard
        title="이탈 유저"
        value={awayUserCount}
        caption={caption}
        loading={loading}
        error={error}
      />
    </div>
  );
};

export default UserAway;
