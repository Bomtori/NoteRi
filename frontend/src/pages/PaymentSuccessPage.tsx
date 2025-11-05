import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../api/apiClient";
import { API_BASE_URL } from "../config";

export default function PaymentSuccessPage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const isConfirming = useRef(false); // ✅ 중복 실행 방지 플래그

    useEffect(() => {
        const paymentKey = params.get("paymentKey");
        const orderId = params.get("orderId");
        const amount = params.get("amount");
        const plan = params.get("plan");
        const planName = plan?.includes("PlanType.") ? plan.replace("PlanType.", "") : plan;

        if (!paymentKey || !orderId || !amount || !planName) {
            alert("결제 정보가 올바르지 않습니다. 마이페이지로 이동합니다.");
            navigate("/user");
            return;
        }

        // ✅ 이미 처리 중이라면 중단
        if (isConfirming.current) {
            console.log("⚠️ 이미 결제 확인 중입니다.");
            return;
        }

        // ✅ 이미 처리된 결제라면 confirm 재호출 방지
        const cacheKey = `confirm_done_${orderId}`;
        if (sessionStorage.getItem(cacheKey)) {
            console.log("⚠️ 이미 confirm된 결제입니다. 중복 호출 방지됨.");
            navigate("/user");
            return;
        }

        async function confirmPayment() {
            isConfirming.current = true; // ✅ 실행 시작 표시

            try {
                // ✅ API 호출 전에 미리 sessionStorage에 저장
                sessionStorage.setItem(cacheKey, "pending");

                const res = await apiClient.post(`${API_BASE_URL}/payments/confirm`, {
                    paymentKey,
                    orderId,
                    amount: Number(amount),
                    plan_name: planName,
                });

                const data = res.data;
                console.log("✅ 결제 승인 성공:", data);

                // ✅ 완료 상태로 변경
                sessionStorage.setItem(cacheKey, "done");

                const sub = data.subscription;
                const pay = data.payment;
                const usage = data.usage;

                const msg = `
[결제 완료]
플랜: ${sub.plan_name.toUpperCase()}
기간: ${sub.start_date} ~ ${sub.end_date}
금액: ₩${pay.amount.toLocaleString()}
상태: ${pay.status}
제공시간: ${(usage.allocated_seconds / 60).toLocaleString()}분
                `;
                alert(msg);

                const userRes = await apiClient.get(`${API_BASE_URL}/users/me`);
                localStorage.setItem("user", JSON.stringify(userRes.data));

                await new Promise((r) => setTimeout(r, 500));
                navigate("/user");
            } catch (err: any) {
                console.error("❌ 결제 승인 실패:", err);

                // ✅ 실패 시 sessionStorage 제거 (재시도 가능하도록)
                sessionStorage.removeItem(cacheKey);

                const message =
                    err.response?.data?.detail?.message ||
                    err.response?.data?.detail ||
                    err.message ||
                    "결제 승인 중 오류가 발생했습니다.";
                alert("결제 승인 실패\n" + message);
                navigate("/user");
            } finally {
                isConfirming.current = false; // ✅ 실행 완료 표시
            }
        }

        confirmPayment();
    }, [params, navigate]);

    return (
        <main className="flex flex-col items-center justify-center h-screen text-gray-600">
            <p className="text-lg mb-2 font-medium">결제를 확인 중입니다...</p>
            <p className="text-sm text-gray-400">잠시만 기다려주세요.</p>
        </main>
    );
}