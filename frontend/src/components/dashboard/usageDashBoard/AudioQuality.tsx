import React, { useMemo } from "react";
import RechartsDonut from "../../dashboard/cards/RechartsDonut";

type Datum = { id: string; value: number; color?: string; label?: string };

const RAW: Datum[] = [
  { id: "고품질 (HD)", value: 73.2, color: "#16a34a" },
  { id: "표준 (SD)", value: 24.8, color: "#2563eb" },
  { id: "저품질 (LD)", value: 2.0,  color: "#6b7280" },
];

const AudioQuality: React.FC = () => {
  const data = useMemo(() => RAW.map(d => ({ ...d, label: d.id })), []);
  return (
    <div className="p-4 bg-card rounded-xl shadow-sm min-w-0">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">녹음 품질별 분포</h3>
      </div>
      <div className="w-full min-w-0" style={{ height: 240 }}>
        <RechartsDonut data={data} height={240} />
      </div>
    </div>
  );
};

export default AudioQuality;
