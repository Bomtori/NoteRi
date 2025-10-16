"use client"

import * as React from "react"
import {
  ArrowLeftIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"


function Buttons() {
  const [label, setLabel] = React.useState("personal")

  return (
    <ButtonGroup>
      <ButtonGroup className="hidden sm:flex">
        <Button variant="outline" size="icon" aria-label="Go Back">
          <ArrowLeftIcon />
        </Button>
      </ButtonGroup>
      <ButtonGroup>
        <Button variant="outline">사용자 관련</Button>
        <Button variant="outline">결제/매출 관련</Button>
        <Button variant="outline">서비스 사용 현황</Button>
      </ButtonGroup>
    </ButtonGroup>
  )
}

export default Buttons