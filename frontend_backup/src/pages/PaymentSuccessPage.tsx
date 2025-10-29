// src/pages/PaymentSuccessPage.tsx
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../api/apiClient";
import { API_BASE_URL } from "@/config";

export default function PaymentSuccessPage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const paymentKey = params.get("paymentKey");
        const orderId = params.get("orderId");
        const amount = params.get("amount");
        const plan = params.get("plan"); // "PlanType.pro" 형태


        if (!paymentKey || !orderId || !amount || !plan) return;

        const planName = plan.includes("PlanType.") ? plan.replace("PlanType.", "") : plan;

        async function confirmPayment() {
            try {
                const res = await apiClient.post(`${API_BASE_URL}/payments/confirm`, {
                    paymentKey,
                    orderId,
                    amount: Number(amount),
                    plan_name: planName,
                });
                console.log("✅ 결제 승인 성공:", res.data);
                alert("결제가 완료되었습니다!");
                navigate("/user"); // 마이페이지로 이동
            } catch (err) {
                console.error("❌ 결제 승인 실패:", err);
                alert("결제 승인 중 오류가 발생했습니다.");
                navigate("/user");
            }
        }

        confirmPayment();
    }, [params, navigate]);

    return (
        <main className="flex items-center justify-center h-screen text-gray-600">
            결제를 확인 중입니다. 잠시만 기다려주세요...
        </main>
    );
}
