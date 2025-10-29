// src/components/recording/RecordCard.jsx
import { useNavigate } from "react-router-dom";
import RecordMenu from "./RecordMenu";

export default function RecordCard({ record }) {
    const navigate = useNavigate();

    return (
        <div
            onClick={() => navigate(`/record/${record.id}`)} // ✅ 상세페이지로 이동
            className="flex justify-between items-start bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-pointer"
        >
            <div>
                <h3 className="text-base font-semibold text-gray-800">
                    {record.title}
                </h3>
                <p className="text-sm text-gray-500 line-clamp-2">
                    {record.description || "설명이 없습니다."}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                    {new Date(record.created_at).toLocaleString("ko-KR")}
                </p>
            </div>

            <RecordMenu
                onEdit={() => console.log("rename", record.id)}
                onDelete={() => console.log("delete", record.id)}
                onFolderChange={(name) => console.log("move to", name)}
            />
        </div>
    );
}
