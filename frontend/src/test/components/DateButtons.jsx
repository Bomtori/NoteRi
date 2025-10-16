// src/components/DateButtons.jsx
import React from "react"
import PropTypes from "prop-types"
import { Button } from "@/components/ui/button"

function DateButtons({ range, onRangeChange }) {
  return (
    <div className="inline-flex items-center gap-2">
      <Button variant={range === "today" ? "default" : "secondary"} size="sm" onClick={() => onRangeChange("today")}>
        오늘
      </Button>
      <Button variant={range === "7d" ? "default" : "secondary"} size="sm" onClick={() => onRangeChange("7d")}>
        최근 7일
      </Button>
      <Button variant={range === "month" ? "default" : "secondary"} size="sm" onClick={() => onRangeChange("month")}>
        최근 1개월
      </Button>
      <Button variant={range === "year" ? "default" : "secondary"} size="sm" onClick={() => onRangeChange("year")}>
        최근 1년
      </Button>
    </div>
  )
}

DateButtons.propTypes = {
  range: PropTypes.oneOf(["today", "7d", "month", "year"]).isRequired,
  onRangeChange: PropTypes.func.isRequired,
}

export default DateButtons
