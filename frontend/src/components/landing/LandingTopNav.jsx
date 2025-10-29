import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/apiClient";
import useLogout from "../../hooks/useLogout.js";

export default function LandingTopNav() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [isScrolled, setIsScrolled] = useState(false);
    const fetchedRef = useRef(false); // ✅ 중복 호출 방지
    const handleLogout = useLogout();

    useEffect(() => {
        // ✅ 비로그인 상태면 요청하지 않음
        const accessToken = localStorage.getItem("access_token");
        if (!accessToken) {
            console.log("🔓 Public mode — skip /users/me");
            return;
        }

        // ✅ 이미 요청한 적 있으면 또 안 함
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        const fetchUser = async () => {
            try {
                const res = await apiClient.get("/users/me");
                setUser(res.data);
            } catch (err) {
                // ✅ refresh 실패(401)는 무시하고 계속 공개 페이지 유지
                if (err.response?.status === 401) {
                    console.log("⚠️ Unauthorized — probably expired token, stay logged out.");
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("refresh_token");
                    setUser(null);
                    return;
                }
                console.error("❌ Failed to load user:", err);
            }
        };

        fetchUser();
    }, []);

    // ✅ 스크롤 색상 반전
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > window.innerHeight * 0.8);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollToSection = (id) => {
        const section = document.getElementById(id);
        if (section) section.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <nav
            className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
                isScrolled
                    ? "bg-white/70 backdrop-blur-lg border-b border-gray-200 text-gray-900"
                    : "bg-transparent text-white"
            }`}
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
                            onClick={() => handleLogout(user.oauth_provider)}
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
