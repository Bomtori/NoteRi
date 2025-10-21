import HeroSection from "../components/landing/HeroSection";
import FeatureSection from "../components/landing/FeatureSection";
import { useNavigate } from "react-router-dom";


export default function LandingPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white flex flex-col">
            {/* Hero 영역 */}
            <HeroSection onStart={() => navigate("/login")} />

            {/* 기능 소개 영역 */}
            <FeatureSection />

            {/* 푸터 (간단히) */}
            <footer className="text-center py-6 text-gray-400 text-sm border-t mt-auto">
                © 2025 NoteRi. All rights reserved.
            </footer>
        </div>
    );
}
