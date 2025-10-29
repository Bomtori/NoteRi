import React from "react";
import { Button } from "@/components/ui/button";

export type DateButtonsOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  range: T;
  onRangeChange: (value: T) => void;  // ← 콜백 형식으로 고정
  options?: readonly DateButtonsOption<T>[];
  size?: "sm" | "default" | "lg";
  className?: string;
};

export default function DateButtons<T extends string>({
  range,
  onRangeChange,
  options = [] as const,
  size = "sm",
  className = "",
}: Props<T>) {
  const items = options.length
    ? options
    : ([
        { value: "today", label: "오늘" },
        { value: "7d", label: "최근 7일" },
        { value: "month", label: "최근 1개월" },
        { value: "year", label: "최근 1년" },
      ] as unknown as readonly DateButtonsOption<T>[]);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {items.map(({ value, label }) => (
        <Button
          key={String(value)}
          variant={range === value ? "default" : "secondary"}
          size={size}
          onClick={() => onRangeChange(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
