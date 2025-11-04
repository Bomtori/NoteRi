// src/components/user/PlanChangeModal.tsx
import React from "react";

interface PlanOption {
    id: number;
    name: string;
    price: number;
    duration_days: number;
    allocated_seconds: number;
    description?: string;
}

interface PlanModalProps {
    currentPlan: string;
    plans: PlanOption[];
    onClose: () => void;
    onSelectPlan: (plan: PlanOption) => void;
}

export default function PlanChangeModal({
                                            currentPlan,
                                            plans,
                                            onClose,
                                            onSelectPlan,
                                        }: PlanModalProps) {
    const formatKrw = (v: number) =>
        v === 0 ? "₩0" : `₩${Math.round(v).toLocaleString()}`;
    const toMinutes = (sec: number) =>
        Math.floor((sec ?? 0) / 60).toLocaleString();

    // enterprise만 뒤로 배치
    const enterprisePlans = plans.filter(
        (p) => p.name.toLowerCase() === "enterprise"
    );
    const nonEnterprise = plans
        .filter((p) => p.name.toLowerCase() !== "enterprise")
        .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));

    const sortedPlans = [...nonEnterprise, ...enterprisePlans];

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl p-8 w-[95%] max-w-6xl shadow-2xl max-h-[80vh] overflow-y-auto">
                {/* 헤더 */}
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-800">플랜 변경</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-xl"
                    >
                        ✕
                    </button>
                </div>

                {/* 플랜 카드 리스트 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {sortedPlans.map((plan) => {
                        const isCurrent =
                            plan.name.toLowerCase() === currentPlan.toLowerCase();
                        const isEnterprise =
                            plan.name.toLowerCase() === "enterprise";

                        return (
                            <div
                                key={plan.id}
                                className={[
                                    "relative flex flex-col justify-between text-center p-8 rounded-3xl bg-white border transition-all duration-300",
                                    isCurrent
                                        ? "border-[#7E37F9] shadow-[0_8px_25px_rgba(126,55,249,0.15)]"
                                        : "border-gray-200 hover:border-[#C19EF8] hover:shadow-[0_10px_25px_rgba(126,55,249,0.12)]",
                                ].join(" ")}
                            >
                                <div>
                                    <h3 className="text-xl font-extrabold text-[#7E37F9] mb-2">
                                        {plan.name.toUpperCase()}
                                    </h3>
                                    <p className="text-sm text-gray-600 mb-6 min-h-[36px]">
                                        {plan.description ||
                                            `${plan.name} 플랜 설명`}
                                    </p>
                                    <div className="text-3xl font-extrabold mb-2">
                                        {formatKrw(plan.price)}
                                    </div>
                                    <p className="text-sm text-gray-500 mb-8">
                                        {toMinutes(plan.allocated_seconds)}분 제공{" "}
                                        {plan.duration_days > 0
                                            ? `/ ${plan.duration_days}일`
                                            : ""}
                                    </p>
                                </div>

                                <button
                                    onClick={() => {
                                        if (plan.name.toLowerCase() === currentPlan.toLowerCase()) return; // ✅ 현재 플랜 클릭 방지
                                        if (plan.name.toLowerCase() === "free") return; // ✅ 무료 플랜 전환 방지
                                        onSelectPlan(plan);
                                    }}
                                    disabled={
                                        plan.name.toLowerCase() === currentPlan.toLowerCase() ||
                                        plan.name.toLowerCase() === "free"
                                    }
                                    className={`px-4 py-2 rounded-md w-full text-sm font-medium transition
    ${
                                        plan.name.toLowerCase() === currentPlan.toLowerCase()
                                            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                            : plan.name.toLowerCase() === "free"
                                                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                                : "bg-[#7E37F9] text-white hover:bg-[#6a26e0]"
                                    }`}
                                >
                                    {plan.name.toLowerCase() === currentPlan.toLowerCase()
                                        ? "현재 플랜"
                                        : plan.name.toLowerCase() === "free"
                                            ? "변경 불가"
                                            : isEnterprise
                                                ? "담당자 문의"
                                                : "변경하기"}
                                </button>

                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
