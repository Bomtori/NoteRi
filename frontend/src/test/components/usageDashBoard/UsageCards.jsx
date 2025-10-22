import React from 'react';
import StatCard from "@/test/components/StatCard.js";
import TotalUsage from "@/test/components/usageDashBoard/TotalUsage.jsx";
import TotalPaymentByDate from "@/test/components/paymentDashBoard/TotalPaymentByDate.jsx";
import TotalUsageByDate from "@/test/components/usageDashBoard/TotalUsageByDate.jsx";
import UsageAvgByPlan from "@/test/components/usageDashBoard/UsageAvgByPlan.jsx";
import AudioQuality from "@/test/components/usageDashBoard/AudioQuality.jsx";
import RatingSummary from "@/test/components/usageDashBoard/RatingSummaryCard.js";

const UsageCards = () => {

    return (
        <>
        <TotalUsage/>
            <TotalUsageByDate/>
            <UsageAvgByPlan/>
            <AudioQuality/>
            <RatingSummary/>
        </>
    );
};

export default UsageCards;