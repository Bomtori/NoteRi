import React, {useEffect, useState} from 'react';
import MetricStatCard from "@/test/components/MetricsStatCard.js";
import StatCard from "@/test/components/StatCard.js";
import CardWithActions from "@/test/components/CardWithActions.jsx";
import CardWithDonutGraph from "@/test/components/CardWithDonutGraph.js";
import UserSignupTrend from "@/test/components/UserSignupTrend.jsx";
import TotalPaymentCard from "@/test/components/TotalPaymentCard.tsx";

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
                setTotalPayments(null)
            } finally {
                setLoading(false)
            }
        }
        run()
    }, []);
    return (
        <div className="min-h-screen bg-background text-foreground p-6">
            <div className="max-w-6xl mx-auto grid gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
                <TotalPaymentCard
                    title="총 매출"
                    value={totalPayments ?? 0}
                    loading={loading}
                    error={error}
                />
            </div>

        </div>
    );
};

export default TotalPayment;