import React from "react"
import PropTypes from "prop-types"
import { Button } from "@/components/ui/button"

function DateButtons({ range, onRangeChange, options, size = "sm" }) {
  const items = options ?? [
    { value: "today", label: "오늘" },
    { value: "7d",    label: "최근 7일" },
    { value: "month", label: "최근 1개월" },
    { value: "year",  label: "최근 1년" },
  ]
  return (
    <div className="inline-flex items-center gap-2">
      {items.map(({ value, label }) => (
        <Button
          key={value}
          variant={range === value ? "default" : "secondary"}
          size={size}
          onClick={() => onRangeChange(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}

DateButtons.propTypes = {
  range: PropTypes.string.isRequired,
  onRangeChange: PropTypes.func.isRequired,
  options: PropTypes.array,
  size: PropTypes.oneOf(["sm","default","lg"]),
}

export default DateButtons
