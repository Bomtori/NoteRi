import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/apiClient";
import { API_BASE_URL } from "../../config";

export default function LandingTopNav() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [isScrolled, setIsScrolled] = useState(false);

    // ✅ 사용자 로그인 상태 확인
    useEffect(() => {
        async function fetchUser() {
            try {
                const res = await apiClient.get(`${API_BASE_URL}/users/me`, {
                    withCredentials: true,
                });
                setUser(res.data);
            } catch {
                setUser(null);
            }
        }
        fetchUser();
    }, []);

    // ✅ HeroSection 지나가면 색 반전
    useEffect(() => {
        const handleScroll = () => {
            const scrollY = window.scrollY;
            setIsScrolled(scrollY > window.innerHeight * 0.8);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollToSection = (id) => {
        const section = document.getElementById(id);
        if (section) section.scrollIntoView({ behavior: "smooth" });
    };

    const handleLogout = () => {
        window.location.href = `${API_BASE_URL}/auth/logout?provider=${user.oauth_provider}`;
    };


    return (
        <nav
            className={`fixed top-0 left-0 w-full z-50 
        transition-all duration-500
        ${isScrolled
                ? "bg-white/70 backdrop-blur-lg border-b border-gray-200 text-gray-900"
                : "bg-transparent text-white"}`
            }
        >
            <div className="max-w-7xl mx-auto flex items-center justify-between px-8 py-4">
                {/* ✅ 로고 */}
                <div
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="cursor-pointer flex items-center gap-2 select-none"
                >
                    <img
                        src="/assets/NoteRi-Logo.svg"
                        alt="NoteRi Logo"
                        className={`h-6 md:h-8 transition-all duration-500 ${
                            isScrolled ? "" : "brightness-0 invert"
                        }`}
                    />
                </div>

                {/* ✅ 메뉴 */}
                <div
                    className={`hidden md:flex items-center gap-10 text-sm font-medium transition-colors duration-500 ${
                        isScrolled ? "text-gray-900" : "text-white"
                    }`}
                >
                    <button onClick={() => scrollToSection("features")} className="hover:text-[#7E37F9] transition">
                        기능
                    </button>
                    <button onClick={() => scrollToSection("pricing")} className="hover:text-[#7E37F9] transition">
                        요금제
                    </button>
                    <button onClick={() => scrollToSection("faq")} className="hover:text-[#7E37F9] font-semibold transition">
                        FAQ
                    </button>

                    {user ? (
                        <button
                            onClick={handleLogout}
                            className={`ml-6 px-5 py-2 rounded-full font-semibold transition-all duration-500 ${
                                isScrolled
                                    ? "bg-[#7E37F9] text-white hover:bg-[#6927d8]"
                                    : "bg-white/70 text-[#7E37F9] hover:bg-white"
                            }`}
                        >
                            로그아웃
                        </button>
                    ) : (
                        <button
                            onClick={() => navigate("/login")}
                            className={`ml-6 px-5 py-2 rounded-full font-semibold transition-all duration-500 ${
                                isScrolled
                                    ? "bg-[#7E37F9] text-white hover:bg-[#6927d8]"
                                    : "bg-white/70 text-[#7E37F9] hover:bg-white"
                            }`}
                        >
                            로그인
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );
}
