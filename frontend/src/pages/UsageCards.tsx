import React from "react";
import TotalUsage from "../components/dashboard/usageDashBoard/TotalUsage";
import TotalUsageByDate from "../components/dashboard/usageDashBoard/TotalUsageByDate";
import UsageAvgByPlan from "../components/dashboard/usageDashBoard/UsageAvgByPlan";
import AudioQuality from "../components/dashboard/usageDashBoard/AudioQuality";
import RatingSummary from "../components/dashboard/usageDashBoard/RatingSummary"; // 통합본 사용

const UsageCards: React.FC = () => {
  return (
    <>
      <TotalUsage />
      <TotalUsageByDate />
      <UsageAvgByPlan />
      <AudioQuality />
      <RatingSummary />
    </>
  );
};

export default UsageCards;
