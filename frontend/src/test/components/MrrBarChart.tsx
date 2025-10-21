// frontend/src/test/components/paymentDashBoard/MrrBarChart.jsx
import React from "react";
import { ResponsiveBar } from "@nivo/bar";

export default function MrrBarChart({ data = [], height = 280 }) {
  return (
    <div style={{ height }}>
      <ResponsiveBar
        data={data}
        keys={["new", "expansion", "contraction", "churn"]}
        indexBy="month"
        margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
        padding={0.3}
        groupMode="stacked"
        enableGridY={true}
        axisBottom={{
          tickRotation: -30,
          legend: "월",
          legendOffset: 36,
          legendPosition: "middle",
        }}
        axisLeft={{
          legend: "MRR",
          legendOffset: -45,
          legendPosition: "middle",
        }}
        colors={({ id }) => {
          switch (id) {
            case "new": return "#16a34a";
            case "expansion": return "#2563eb";
            case "contraction": return "#ef4444";
            case "churn": return "#f59e0b";
            default: return "#9ca3af";
          }
        }}
        tooltip={({ id, value, indexValue, color }) => (
          <div style={{ background: "white", padding: "6px 8px", border: "1px solid #e5e7eb", fontSize: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, background: color, display: "inline-block" }} />
              <strong>{indexValue}</strong>
            </div>
            <div style={{ marginTop: 4 }}>
              {String(id)}: {Number(value ?? 0).toLocaleString()}
            </div>
          </div>
        )}
        animate
        motionConfig="gentle"
        role="application"
        ariaLabel="MRR breakdown chart"
        barAriaLabel={(e) => `${e.id}: ${e.formattedValue} in month: ${e.indexValue}`}
      />
    </div>
  );
}
