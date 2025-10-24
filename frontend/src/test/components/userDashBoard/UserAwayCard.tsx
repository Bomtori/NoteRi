import React from "react";
import StatCard from "@/test/components/StatCard";

type Props = {
  title: string;
  value: number | string | null | undefined;
  caption?: string;
  loading?: boolean;
  error?: string;
  actions?: React.ReactNode;
  hideTrend?: boolean;
};

export default function UserAwayCard({
  title,
  value,
  caption,
  loading = false,
  error,
  hideTrend = true,
}: Props) {
  let displayValue: string;

  if (loading) displayValue = "로딩…";
  else if (error) displayValue = "-";
  else if (typeof value === "number") displayValue = `${value.toLocaleString()} 명`;
  else if (typeof value === "string") displayValue = value;
  else displayValue = "-";

  return (
    <StatCard
      title={title}
      value={displayValue}
      caption={caption}
      hideTrend={hideTrend}
    />
  );
}
