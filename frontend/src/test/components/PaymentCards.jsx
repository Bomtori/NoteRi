import React, {useState} from 'react';
import TotalPayment from "@/test/components/TotalPayment.jsx";
import TotalPaymentByDate from "@/test/components/TotalPaymentByDate.jsx";
import PaymentByPlan from "@/test/components/PaymentByPlan.jsx";
import UsersByPlan from "@/test/components/UsersByPlan.jsx";

const PaymentCards = () => {
  const [range, setRange] = useState("today")
    return (
         <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-6xl mx-auto grid gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            <TotalPayment/>
            <TotalPaymentByDate/>
            <PaymentByPlan/>
          <UsersByPlan/>
          </div>
        </div>
    );
};

export default PaymentCards;