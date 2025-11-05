// src/components/dashboard/cards/DashCard.tsx
import React from "react";
import { Card, CardContent } from "../../ui/card";
import { DASH_CARD } from "./cardStyles";

type Props = {
  children: React.ReactNode;
  className?: string;       // 필요 시 추가 스타일
  contentClassName?: string; // 내부 패딩 조정
};

export default function DashCard({ children, className = "", contentClassName = "p-5" }: Props) {
  return (
    <Card className={`${DASH_CARD} ${className}`}>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
