import React, { useEffect, useState } from "react";
import {
    getPlans,
    updatePlan,
    createPlan,
    deletePlan,
} from "../api/planApi";
import { useToast } from "../hooks/useToast";

interface Plan {
    id: number;
    name: string;
    price: number;
    duration_days: number;
    allocated_seconds: number;
    description?: string;
}

export default function AdminSettingsPage(): JSX.Element {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [newPlan, setNewPlan] = useState({
        name: "",
        price: "",
        duration_days: "",
        allocated_seconds: "",
        description: "",
    });
    const { showToast } = useToast();

    // ✅ 플랜 목록 로드
    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const res = await getPlans();
            setPlans(res.data);
        } catch {
            showToast({ content: "플랜 정보를 불러오지 못했습니다.", duration: "error" });
        }
    };

    // ✅ 플랜 수정
    const handleUpdate = async (id: number, updated: Partial<Plan>) => {
        try {
            await updatePlan(id, updated);
            showToast({ content: "플랜이 수정되었습니다.", duration: "success" });
            fetchPlans();
        } catch {
            showToast({ content: "수정 실패", duration: "error" });
        }
    };

    // ✅ 플랜 삭제
    const handleDelete = async (id: number) => {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        try {
            await deletePlan(id);
            showToast({ content: "플랜이 삭제되었습니다.", duration: "success" });
            setPlans((prev) => prev.filter((p) => p.id !== id));
        } catch {
            showToast({ content: "삭제 실패", duration: "error" });
        }
    };

    // ✅ 새 플랜 생성
    const handleCreate = async () => {
        const { name, price, duration_days, allocated_seconds } = newPlan;
        if (!name || !price) {
            showToast({ content: "이름과 가격은 필수입니다.", duration: "error" });
            return;
        }

        try {
            await createPlan({
                name,
                price: parseFloat(price),
                duration_days: parseInt(duration_days) || 0,
                allocated_seconds: parseInt(allocated_seconds) || 0,
                description: newPlan.description,
            });
            showToast({ content: "새 플랜이 추가되었습니다.", duration: "success" });
            setNewPlan({ name: "", price: "", duration_days: "", allocated_seconds: "", description: "" });
            fetchPlans();
        } catch {
            showToast({ content: "생성 실패", duration: "error" });
        }
    };

    return (
        <div className="p-6 space-y-6">
            <h2 className="text-xl font-semibold">플랜 관리</h2>

            {/* 새 플랜 생성 */}
            <div className="border rounded-xl p-4 bg-gray-50">
                <h3 className="font-semibold mb-2 text-[#7E37F9]">새 플랜 추가</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <input
                        placeholder="이름 (영문 소문자/숫자/하이픈만)"
                        value={newPlan.name}
                        onChange={(e) => {
                            const value = e.target.value
                                .replace(/[^a-z0-9-]/g, "") // 한글, 공백, 특수문자 차단
                                .toLowerCase();             // 소문자로 자동 변환
                            setNewPlan({ ...newPlan, name: value });
                        }}
                        className="border rounded-lg px-2 py-1 text-sm"
                    />

                    <input
                        placeholder="가격"
                        type="number"
                        value={newPlan.price}
                        onChange={(e) => setNewPlan({ ...newPlan, price: e.target.value })}
                        className="border rounded-lg px-2 py-1 text-sm"
                    />
                    <input
                        placeholder="기간(일)"
                        type="number"
                        value={newPlan.duration_days}
                        onChange={(e) => setNewPlan({ ...newPlan, duration_days: e.target.value })}
                        className="border rounded-lg px-2 py-1 text-sm"
                    />
                    <input
                        placeholder="제공시간(초)"
                        type="number"
                        value={newPlan.allocated_seconds}
                        onChange={(e) => setNewPlan({ ...newPlan, allocated_seconds: e.target.value })}
                        className="border rounded-lg px-2 py-1 text-sm"
                    />
                    <input
                        placeholder="설명"
                        value={newPlan.description}
                        onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                        className="border rounded-lg px-2 py-1 text-sm col-span-2 md:col-span-5"
                    />
                </div>
                <button
                    onClick={handleCreate}
                    className="mt-3 text-sm bg-[#7E37F9] text-white rounded-lg px-4 py-1 hover:bg-[#6a2de0]"
                >
                    추가
                </button>
            </div>

            {/* 플랜 목록 */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {plans.map((plan) => (
                    <div
                        key={plan.id}
                        className="border rounded-xl p-4 bg-white shadow-sm flex flex-col gap-2"
                    >
                        <div className="flex justify-between items-center">
                            <label className="text-sm text-gray-700">이름</label>
                            <input
                                value={plan.name}
                                onChange={(e) =>
                                    setPlans((prev) =>
                                        prev.map((p) =>
                                            p.id === plan.id ? { ...p, name: e.target.value } : p
                                        )
                                    )
                                }
                                className="border rounded-lg px-2 py-1 text-sm"
                            />
                            <button
                                onClick={() => handleDelete(plan.id)}
                                className="text-xs text-red-500 hover:underline"
                            >
                                삭제
                            </button>
                        </div>

                        <label className="text-sm text-gray-700">가격</label>
                        <input
                            type="number"
                            value={plan.price}
                            onChange={(e) =>
                                setPlans((prev) =>
                                    prev.map((p) =>
                                        p.id === plan.id ? { ...p, price: Number(e.target.value) } : p
                                    )
                                )
                            }
                            className="border rounded-lg px-2 py-1 text-sm"
                        />

                        <label className="text-sm text-gray-700">기간(일)</label>
                        <input
                            type="number"
                            value={plan.duration_days}
                            onChange={(e) =>
                                setPlans((prev) =>
                                    prev.map((p) =>
                                        p.id === plan.id
                                            ? { ...p, duration_days: Number(e.target.value) }
                                            : p
                                    )
                                )
                            }
                            className="border rounded-lg px-2 py-1 text-sm"
                        />

                        <label className="text-sm text-gray-700">제공 시간(초)</label>
                        <input
                            type="number"
                            value={plan.allocated_seconds}
                            onChange={(e) =>
                                setPlans((prev) =>
                                    prev.map((p) =>
                                        p.id === plan.id
                                            ? { ...p, allocated_seconds: Number(e.target.value) }
                                            : p
                                    )
                                )
                            }
                            className="border rounded-lg px-2 py-1 text-sm"
                        />

                        <label className="text-sm text-gray-700">설명</label>
                        <input
                            value={plan.description || ""}
                            onChange={(e) =>
                                setPlans((prev) =>
                                    prev.map((p) =>
                                        p.id === plan.id
                                            ? { ...p, description: e.target.value }
                                            : p
                                    )
                                )
                            }
                            className="border rounded-lg px-2 py-1 text-sm"
                        />

                        <button
                            onClick={() => handleUpdate(plan.id, plan)}
                            className="text-sm bg-[#7E37F9] text-white rounded-lg py-1 mt-1 hover:bg-[#6a2de0]"
                        >
                            저장
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
