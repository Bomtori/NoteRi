/* filename: src/test/components/DashBoard.tsx */
import React from "react";
import Buttons from "../components/dashboard/cards/Buttons";
import UserCards from "./UserCards";
import PaymentCards from "./PaymentCards";
import UsageCards from "./UsageCards";

type Tab = "users" | "payments" | "usage";

const AdminDashBoardPage: React.FC = () => {
  const [tab, setTab] = React.useState<Tab>("users");

  return (
    <div className="bg-background text-foreground min-w-0">
      <div className="p-4 border-b min-w-0">
        <Buttons active={tab} onChange={(next) => setTab(next)} />
      </div>

      <div className="p-6 min-w-0">
        <div className="max-w-6xl mx-auto grid gap-6 min-w-0">
          {tab === "users" && (
            <section className="min-w-0">
              <UserCards />
            </section>
          )}

          {tab === "payments" && (
            <section className="min-w-0">
              <PaymentCards />
            </section>
          )}

          {tab === "usage" && (
            <section className="min-w-0">
              <UsageCards />
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashBoardPage;
