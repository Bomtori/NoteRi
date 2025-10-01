import React from "react";

function PaymentButton() {
    const tossPayments = window.TossPayments(import.meta.env.VITE_TOSS_CLIENT_KEY);

  const handlePayment = async () => {
    const orderId = "order_" + Date.now();
    const amount = 10000; // 테스트 금액
    const plan = "pro";
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJka2VsNDUxMkBnbWFpbC5jb20iLCJleHAiOjE3NTkzMTMzODd9.zO4lMlhTtc24KMAwq8psNpT7uTzYpTh1tOVGB5FMxl4"
    // 1. 백엔드에 결제 요청 → tossPayments.checkout 페이지 URL 받음
   const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/payments/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        orderId,
        amount,
        plan,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      alert("결제 요청 실패: " + JSON.stringify(error));
      return;
    }

    const data = await res.json();
    console.log("결제 요청 결과:", data);

    // 2. TossPayments SDK 호출
    const tossPayments = window.TossPayments(import.meta.env.VITE_TOSS_CLIENT_KEY);
    tossPayments.requestPayment("카드", {
      amount,
      orderId,
      orderName: "pro plan subscription",
      customerEmail: "dkel4512@gmail.com",
      successUrl: `${window.location.origin}/payments/success?orderId=${orderId}&plan=${plan}`,
      failUrl: `${window.location.origin}/payments/fail`,
    });
  };

  return (
    <button onClick={handlePayment}>
      💳 Pro 구독 결제하기
    </button>
  );
}

export default PaymentButton;
