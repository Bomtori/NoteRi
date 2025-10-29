import React, {useEffect, useState} from 'react';
import Buttons from "./Buttons.tsx"
import Menubars from "@/test/components/Menubar.jsx";
import UserCards from "../../components/dashboard/userDashBoard/UserCards.jsx";
import PaymentCards from "../components/paymentDashBoard/PaymentCards.jsx";
import UsageCards from "../components/usageDashBoard/UsageCards.jsx";

export default function AdminDashboardPage() {
  // 주소 변경 없이 내부 탭만 관리
  const [tab, setTab] = useState("users") // "users" | "payments" | "usage"

  // 선택 유지하고 싶으면(새로고침 대비) 주석 해제
  useEffect(() => { const t = sessionStorage.getItem("dash_tab"); if (t) setTab(t) }, [])
  useEffect(() => { sessionStorage.setItem("dash_tab", tab) }, [tab])

  return (
    <div className="bg-background text-foreground">
      <div className="p-4 border-b">
        <Buttons active={tab} onChange={setTab} />
      </div>

      <div className="p-6">
        <div className="max-w-6xl mx-auto grid gap-6">
          {tab === "users" && <UserCards />}
          {tab === "payments" && <PaymentCards />}
          {tab === "usage" && <UsageCards />}
        </div>
      </div>
    </div>
  )
}