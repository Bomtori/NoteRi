// src/test/components/PaymentCards.jsx
import React from 'react';
import TotalPayment from "@/test/components/paymentDashBoard/TotalPayment.jsx";
import TotalPaymentByDate from "@/test/components/paymentDashBoard/TotalPaymentByDate.jsx";
import PaymentByPlan from "@/test/components/paymentDashBoard/PaymentByPlan.jsx";
import UsersByPlan from "@/test/components/paymentDashBoard/UsersByPlan.jsx";
import PaymentByPlanTrend from "@/test/components/paymentDashBoard/PaymentByPlanTrend.tsx";
import PaymentMrrCard from "@/test/components/paymentDashBoard/PaymentMrrCard.jsx";
import PaymentMrr from "@/test/components/paymentDashBoard/PaymentMrr.tsx";

const PaymentCards = () => {
  return (
    <div className="bg-background text-foreground p-6">
      {/* ✅ 3열 고정 + stretch 방지 */}
      <div >
        {/* 1행: 3칸 */}
        <TotalPayment />
        <TotalPaymentByDate />
          <UsersByPlan />
        <PaymentByPlan />
          <PaymentMrr/>
        {/* 2행: 트렌드는 전체 폭 사용 */}
        <PaymentByPlanTrend className="col-span-3" />
        {/* UsersByPlan이 카드 하나면 1칸, 넓게 쓰고 싶으면 col-span-3 */}

      </div>
    </div>
  );
};

export default PaymentCards;
