"use client";

import * as React from "react";
import { Button } from "../../ui/button";
import { ButtonGroup } from "../../ui/button-group";

type Tab = "users" | "payments" | "usage";

interface Props {
  active?: Tab;
  onChange?: (next: Tab) => void;
}

const Buttons: React.FC<Props> = ({ active = "users", onChange }) => {
  return (
    <ButtonGroup className="flex items-center gap-2">
      <ButtonGroup className="gap-2">
        <Button
          variant={active === "users" ? "default" : "outline"}
          onClick={() => onChange?.("users")}
        >
          사용자 관련
        </Button>
        <Button
          variant={active === "payments" ? "default" : "outline"}
          onClick={() => onChange?.("payments")}
        >
          결제/매출 관련
        </Button>
        <Button
          variant={active === "usage" ? "default" : "outline"}
          onClick={() => onChange?.("usage")}
        >
          서비스 사용 현황
        </Button>
      </ButtonGroup>
    </ButtonGroup>
  );
};

export default Buttons;
