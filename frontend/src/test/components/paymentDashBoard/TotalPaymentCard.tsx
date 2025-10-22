import React from "react";
import StatCard from "@/test/components/StatCard";

// ✅ 여기 직접 정의
interface Props {
  title: string;
  value: number | string;
  loading?: boolean;
  error?: string | null;
  hideTrend?: boolean;
  className?: string; // (선택) 외부에서 높이 통일용으로 넘길 수 있게
}

const TotalPaymentCard = ({
  title,
  value,
  loading = false,
  error = null,
  hideTrend = true,
  className = "",
}: Props) => {
  let displayValue: string;

  if (loading) displayValue = "로딩…";
  else if (error) displayValue = "-";
  else if (typeof value === "number") displayValue = value.toLocaleString() + " 원";
  else {
      displayValue = value;
  }

  return (
    <StatCard
      title={title}
      value={displayValue}
      hideTrend={hideTrend}
      className={className} // ✅ 높이 통일 시 필요
    />
  );
};

export default TotalPaymentCard;
