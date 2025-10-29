import React from "react";
import TotalPayment from "../components/dashboard/paymentDashBoard/TotalPayment";
import TotalPaymentByDate from "../components/dashboard/paymentDashBoard/TotalPaymentByDate";
import PaymentByPlan from "../components/dashboard/paymentDashBoard/PaymentByPlan";
import UsersByPlan from "../components/dashboard/paymentDashBoard/UsersByPlan";
import PaymentByPlanTrend from "../components/dashboard/paymentDashBoard/PaymentByPlanTrend";
import PaymentMrr from "../components/dashboard/paymentDashBoard/PaymentMrr";

const PaymentCards: React.FC = () => {
  return (
    <div className="bg-background text-foreground p-6 min-w-0">
      <div className="grid gap-6 min-w-0">
        <TotalPayment />
        <TotalPaymentByDate />
        <UsersByPlan />
        <PaymentByPlan />
        <PaymentMrr />
        <PaymentByPlanTrend className="col-span-3" />
      </div>
    </div>
  );
};

export default PaymentCards;
