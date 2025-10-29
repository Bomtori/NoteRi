import { useEffect, useState } from "react";
import LandingTopNav from "../components/landing/LandingTopNav";
import HeroSection from "../components/landing/HeroSection";
import FeatureRecordSection from "../components/landing/FeatureRecordSection";
import FeatureSummarySection from "../components/landing/FeatureSummarySection";
import FeatureChatbotSection from "../components/landing/FeatureChatbotSection";
import PricingSection from "../components/landing/PricingSection";
import FAQSection from "../components/landing/FAQSection";
import FinalCTASection from "../components/landing/FinalCTASection";
import { LandingFooter } from "../components/landing/LandingFooter";
import apiClient from "../api/apiClient";

export default function LandingPage() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        const fetchUser = async () => {
            try {
                const res = await apiClient.get("/users/me");
                setUser(res.data);
            } catch {
                setUser(null);
            }
        };
        fetchUser();
    }, []);
    return (
        <div className="w-full min-h-screen flex flex-col bg-white">
            <LandingTopNav user={user} />
            <section id="hero">
                <HeroSection user={user} />
            </section>
            <section id="features">
                <FeatureRecordSection />
                <FeatureSummarySection />
                <FeatureChatbotSection />
            </section>
            <section id="pricing">
                <PricingSection user={user} />
            </section>
            <section id="faq">
                <FAQSection />
            </section>
            <section id="cta">
                <FinalCTASection />
            </section>
            <LandingFooter />
        </div>
    );
}
