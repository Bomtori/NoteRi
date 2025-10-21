// frontend/src/test/components/paymentDashBoard/MrrComboChart.jsx
import React from "react";
import {
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Bar,
  Line,
  ResponsiveContainer,
} from "recharts";

export default function MrrComboChart({ data = [], height = 350 }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <ComposedChart
          data={data}
          margin={{ top: 20, right: 30, bottom: 40, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11 }}
            angle={-30}
            dy={10}
            textAnchor="end"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => v.toLocaleString()}
            width={80}
          />
          <Tooltip
            formatter={(value) => value.toLocaleString()}
            contentStyle={{
              background: "white",
              border: "1px solid #e5e7eb",
              fontSize: 12,
            }}
          />
          <Legend
            wrapperStyle={{
              fontSize: 12,
              paddingTop: 8,
            }}
          />

          {/* 막대: 증감 요인 */}
          <Bar dataKey="new" name="신규" stackId="a" fill="#16a34a" />
          <Bar dataKey="expansion" name="확장" stackId="a" fill="#2563eb" />
          <Bar dataKey="contraction" name="축소" stackId="a" fill="#ef4444" />
          <Bar dataKey="churn" name="해지" stackId="a" fill="#f59e0b" />

          {/* 라인: 월말 MRR */}
          <Line
            type="monotone"
            dataKey="ending_mrr"
            name="월말 MRR"
            stroke="#111827"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
