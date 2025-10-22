import React, {useEffect, useState} from 'react';
import TotalUsageCard from "@/test/components/usageDashBoard/TotalUsageCard.js";

const API_BASE_URL = import.meta.env.API_BASE_URL ?? "http://localhost:8000"


const TotalUsage = () => {
      const [totalUsage, setTotalUsage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
    useEffect(() => {
        const run = async() => {
      try{
        setLoading(true)
        setError(null)
        const res = await fetch(`${API_BASE_URL}/recordings/usage/total`)
        if(!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setTotalUsage(data.total ?? 0)
      } catch (e){
        setError("사용량을 불러올 수 없습니다.")
        setTotalUsage(0)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

    return (
        <>
            <TotalUsageCard title="총 사용량" value={totalUsage ?? 0} loading={loading} error={error}/>
        </>
    );
};

export default TotalUsage;