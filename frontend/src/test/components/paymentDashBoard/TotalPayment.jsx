// src/test/components/TotalPayment.jsx
import React, {useEffect, useState} from 'react';
import TotalPaymentCard from "@/test/components/paymentDashBoard/TotalPaymentCard.tsx";

const API_BASE_URL = import.meta.env.API_BASE_URL ?? "http://localhost:8000"

const TotalPayment = () => {
  const [totalPayments, setTotalPayments] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const run = async() => {
      try{
        setLoading(true)
        setError(null)
        const res = await fetch(`${API_BASE_URL}/payments/total/amount`)
        if(!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setTotalPayments(data.total ?? 0)
      } catch (e){
        setError("금액을 불러올 수 없습니다.")
        setTotalPayments(0)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  return (
    <TotalPaymentCard
      title="총 매출"
      value={totalPayments ?? 0}
      loading={loading}
      error={error}

      // 필요 시 높이 강제: className 전달 가능 (TotalPaymentCard->StatCard가 className 받도록 되어있다면)
      // className="!h-[96px]"
    />
  );
};

export default TotalPayment;
