import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");
    const plan = "pro"; // 백엔드와 동일하게 넘겨줘야 함

    // 1. 백엔드에 결제 승인 요청
    fetch(`${import.meta.env.VITE_API_BASE_URL}/payments/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount), plan }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("결제 승인 완료:", data);
        alert("결제가 완료되었습니다!");
      })
      .catch((err) => console.error("결제 승인 실패:", err));
  }, [searchParams]);

  return <h1>✅ 결제 성공! 서버에서 승인 처리 중입니다...</h1>;
}
