import { useEffect, useState } from "react";
import apiClient from "../api/apiClient";
import { API_BASE_URL } from "../config";
import {useNavigate} from "react-router-dom";

export default function SharedFolderPage() {
    const [boards, setBoards] = useState([]);
    const [loading, setLoading] = useState(true);

    const navigate = useNavigate();


    useEffect(() => {
        async function fetchShared() {
            try {
                const res = await apiClient.get(`/boards/shared-received`);
                setBoards(res.data || []);
                console.log("공유받은 회의:", res.data);
            } catch (err) {
                console.error("공유받은 회의 조회 실패:", err);
                setBoards([]);
            } finally {
                setLoading(false);
            }
        }
        fetchShared();
    }, []);

    if (loading) {
        return (
            <div className="p-6">
                <p className="text-gray-400">로딩 중...</p>
            </div>
        );
    }

    return (
        <div className="p-6">
            <h1 className="text-lg font-bold text-[#7E37F9] mb-4">공유받은 회의</h1>
            {boards.length === 0 ? (
                <p className="text-gray-400 text-sm">아직 공유받은 회의가 없습니다.</p>
            ) : (
                <ul className="space-y-2">
                    {boards.map((b) => (
                        <li
                            key={b.id}
                            className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer"
                            onClick={() => navigate(`/record/${b.id}`)}
                        >
                            <h3 className="font-semibold text-gray-800">
                                {b.title || '제목 없음'}
                            </h3>
                            <p className="text-xs text-gray-400 mt-1">
                                {new Date(b.created_at).toLocaleDateString('ko-KR')}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
