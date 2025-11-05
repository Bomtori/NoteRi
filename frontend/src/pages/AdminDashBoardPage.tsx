/* filename: src/test/components/DashBoard.tsx */
import React from "react";
import Buttons from "../components/dashboard/cards/Buttons";
import UserCards from "./UserCards";
import PaymentCards from "./PaymentCards";
import UsageCards from "./UsageCards";
import AdminToggleTabs from "../components/admin/AdminToggleTabs";

type Tab = "users" | "payments" | "usage";
const ADMIN_TABS: { id: Tab; label: string }[] = [
  { id: "users",    label: "사용자" },
  { id: "payments", label: "결제" },
  { id: "usage",    label: "이용량" },
];
const AdminDashBoardPage: React.FC = () => {
  const [tab, setTab] = React.useState<Tab>("users");

  return (
    <div className="bg-background text-foreground min-w-0">
      <div className="p-4 border-b min-w-0">
        <AdminToggleTabs
          tabs={ADMIN_TABS}
          active={tab}
          onChange={(id) => setTab(id as Tab)}
          layoutId="active-pill-admin-tabs" // 이 페이지 고유 layoutId
        />
      </div>

      <div className="p-6 min-w-0">
        <div className="mx-auto px-6 max-w-screen-2xl grid gap-6 min-w-0">
          {tab === "users" && <section className="min-w-0"><UserCards /></section>}
          {tab === "payments" && <section className="min-w-0"><PaymentCards /></section>}
          {tab === "usage" && <section className="min-w-0"><UsageCards /></section>}
        </div>
      </div>
    </div>
  );
};

export default AdminDashBoardPage;
