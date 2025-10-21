// AudioQuality.jsx
import React, { useMemo } from "react";
import NivoDonut from "@/test/components/NivoDonut.tsx";

const RAW = [
  { id: "고품질 (HD)", value: 73.2, color: "#16a34a" }, // emerald-600
  { id: "표준 (SD)",   value: 24.8, color: "#2563eb" }, // blue-600
  { id: "저품질 (LD)", value:  2.0, color: "#6b7280" }, // gray-500
];

export default function AudioQuality() {
  // 필요하면 label 필드도 붙여서 전달 (NivoDonut는 id/value/color만 있어도 OK)
  const data = useMemo(() => RAW.map(d => ({ ...d, label: d.id })), []);

  return (
    <div className="p-4 bg-card rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">녹음 품질별 분포</h3>
      </div>

      {/* height는 숫자로(px). 부모 컨테이너는 자동로딩 위해 폭/높이가 0이 아니어야 해요 */}
      <NivoDonut data={data} height={240} />
    </div>
  );
}
