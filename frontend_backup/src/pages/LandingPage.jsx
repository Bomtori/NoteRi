import HeroSection from "../components/landing/HeroSection";
import FeatureRecordSection from "../components/landing/FeatureRecordSection";
import FeatureSummarySection from "../components/landing/FeatureSummarySection";
import FeatureChatbotSection from "../components/landing/FeatureChatbotSection";
import PricingSection from "../components/landing/PricingSection";
import FAQSection from "../components/landing/FAQSection";
import FinalCTASection from "../components/landing/FinalCTASection";
import LandingTopNav from "../components/landing/LandingTopNav";
import { LandingFooter } from "../components/landing/LandingFooter.jsx";

export default function LandingPage() {
    return (
        <div className="w-full min-h-screen flex flex-col bg-white">
            {/* ✅ 상단 네비게이션 */}
            <LandingTopNav />

            {/* ✅ Hero Section */}
            <section id="hero">
                <HeroSection />
            </section>

            {/* ✅ 기능 소개 (3개 컴포넌트로 분리) */}
            <section id="features">
                <FeatureRecordSection />
                <FeatureSummarySection />
                <FeatureChatbotSection />
            </section>

            {/* ✅ 요금제 */}
            <section id="pricing">
                <PricingSection />
            </section>

            {/* ✅ FAQ */}
            <section id="faq">
                <FAQSection />
            </section>

            {/* ✅ CTA + Footer */}
            <section id="cta">
                <FinalCTASection />
            </section>

            <LandingFooter />
        </div>
    );
}