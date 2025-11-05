import React from "react";
import TotalPayment from "../components/dashboard/paymentDashBoard/TotalPayment";
import TotalPaymentByDate from "../components/dashboard/paymentDashBoard/TotalPaymentByDate";
import PaymentByPlan from "../components/dashboard/paymentDashBoard/PaymentByPlan";
import UsersByPlan from "../components/dashboard/paymentDashBoard/UsersByPlan";
import PaymentByPlanTrend from "../components/dashboard/paymentDashBoard/PaymentByPlanTrend";
import PaymentMrr from "../components/dashboard/paymentDashBoard/PaymentMrr";
import { DASH_CARD } from "../components/dashboard/cards/cardStyles";
import {Card, CardContent} from "../components/ui/card";

const PaymentCards: React.FC = () => {
  return (
    <div className="bg-background text-foreground p-6 min-w-0">
      {/* ✅ 부모: 한 열짜리(grid-cols-1)로 명시 */}
      <div className="grid grid-cols-1 gap-6">

        {/* 1행: 3개 */}
        <section className="w-full grid gap-6 items-stretch grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          <TotalPayment />
          <TotalPaymentByDate />
          <UsersByPlan />
        </section>

        {/* 2행: 2개 */}
        <section className="w-full grid gap-6 items-stretch grid-cols-1 md:grid-cols-2">
          <PaymentByPlan />
          <PaymentMrr />
        </section>

        {/* 3행: 전체폭 1개 */}
        <Card className={DASH_CARD}>
          <CardContent className="p-5">
            <PaymentByPlanTrend />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default PaymentCards;
