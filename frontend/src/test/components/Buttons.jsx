"use client"

import * as React from "react"
import { ArrowLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"

/** props:
 *  active: "users" | "payments" | "usage"
 *  onChange: (next: string) => void
 */
function Buttons({ active = "users", onChange }) {
  return (
    <ButtonGroup className="flex items-center gap-2">
      {/*<ButtonGroup className="hidden sm:flex">*/}
      {/*  <Button variant="outline" size="icon" aria-label="Go Back" onClick={() => window.history.back()}>*/}
      {/*    <ArrowLeftIcon />*/}
      {/*  </Button>*/}
      {/*</ButtonGroup>*/}

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
  )
}

export default Buttons
