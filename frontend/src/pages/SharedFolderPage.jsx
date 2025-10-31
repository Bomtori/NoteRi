import { useEffect, useState } from "react";
import apiClient from "../api/apiClient";
import { API_BASE_URL } from "../config";

export default function SharedFolderPage() {
    const [boards, setBoards] = useState([]);

    useEffect(() => {
        async function fetchShared() {
            const res = await apiClient.get(`${API_BASE_URL}/folders/shared/boards`, {
                withCredentials: true,
            });
            setBoards(res.data);
        }
        fetchShared();
    }, []);

    return (
        <div className="p-6">
            <h1 className="text-lg font-bold text-[#7E37F9] mb-4">공유받은 회의</h1>
            {boards.length === 0 ? (
                <p className="text-gray-400 text-sm">아직 공유받은 회의가 없습니다.</p>
            ) : (
                <ul className="space-y-2">
                    {boards.map((b) => (
                        <li key={b.id} className="border rounded-lg p-3 hover:bg-gray-50">
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
