import React from 'react';
import StatCard from "@/test/components/StatCard"

const TotalPaymentCard = ({
    title, value, loading=false, error=null, hideTrend=true
                          }:Props) => {

     let displayValue: string
  if (loading) displayValue = "로딩…"
  else if (error) displayValue = "-"
  else if (typeof value === "number") displayValue = value.toLocaleString() + " 원"
  else if (typeof value === "string") displayValue = value
    else displayValue = "-"

    return (
        <StatCard
        title={title}
        value={displayValue}
        hideTrend={hideTrend}/>
    );
};

export default TotalPaymentCard;