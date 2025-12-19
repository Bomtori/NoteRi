import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useFadeInOnScroll from "../../hooks/useFadeInOnScroll";

export default function PricingSection({user}) {
    const navigate = useNavigate();
    const [showModal, setShowModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    // 페이드 인 훅
    const { ref, isVisible } = useFadeInOnScroll(0.3);
    // 플랜
    const plans = [
        { name: "Free", price: "₩0", desc: "개인 사용자용 기본 기능", features: ["월 300분 녹음 가능", "실시간 STT 변환", "기록 저장 5건", "기본 요약 제공"] },
        { name: "Basic", price: "₩9,900", desc: " 가벼운 업무용", features: ["월 500분 녹음 가능", "보드 공유(읽기)", "Notion"] },
        { name: "Pro", price: "₩19,900", desc: "팀 및 전문가용 확장 기능", features: ["월 1000분 사용 가능", "다양한 템플릿 제공", "베타 기능 제공"] },

    ];

    const handleStart = (plan) => {
        if (!user) return navigate("/login");
        setSelectedPlan(plan);
        setShowModal(true);
    };


    const handlePayment = async () => {
        if (!selectedPlan) return;
        try {
            const { data } = await apiClient.post(`${API_BASE_URL}/payments/request`, {
                plan_name: selectedPlan.name.toLowerCase(),
            });
            const toss = window.TossPayments?.(import.meta.env.VITE_TOSS_CLIENT_KEY);
            if (!toss) throw new Error("TossPayments SDK 로드 실패");
            await toss.requestPayment("카드", {
                amount: data.amount,
                orderId: data.orderId,
                orderName: data.orderName,
                customerEmail: data.customerEmail,
                successUrl: data.successUrl,
                failUrl: data.failUrl,
            });
        } catch (err) {
            console.error("결제 시작 실패:", err);
            alert("결제를 시작할 수 없습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setShowModal(false);
        }
    };

    return (
        <section
  ref={ref}
  className={`relative 
      min-h-screen        /* 화면보다 크면 더 늘어나도록 */
      py-16               /* 위아래 여백 추가 */
      flex items-start md:items-center justify-center
      bg-gradient-to-b from-[#F5F0FF]/60 to-white/80 
      text-center 
      overflow-visible md:overflow-hidden   /* 모바일은 잘리지 않게 */
      transition-all duration-[1000ms] ease-out
      ${isVisible ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-10 blur-md"}`}
>
            <div className="flex flex-col items-center justify-center w-full max-w-6xl mx-auto px-6">
                <h2 className="text-4xl font-bold text-[#272527] mb-16">요금제</h2>
                <div className="flex flex-wrap justify-center gap-10">
                    {plans.map((p, i) => (
                        <div
                            key={i}
                            className={`w-80 p-10 rounded-2xl border border-transparent bg-white/60 backdrop-blur-md
              shadow-[0_8px_20px_rgba(0,0,0,0.05)] transition-all duration-700 ease-out
              hover:border-[#C19EF8] hover:shadow-[0_8px_25px_rgba(126,55,249,0.15)] hover:scale-[1.02]
              ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
                            style={{ transitionDelay: `${i * 150}ms` }}
                        >
                            <h3 className="text-2xl font-semibold text-[#7E37F9] mb-2">{p.name}</h3>
                            <p className="text-gray-600 mb-6">{p.desc}</p>
                            <div className="text-3xl font-bold mb-4">{p.price}</div>
                            <ul className="text-sm text-gray-700 mb-8 space-y-2">
                                {p.features.map((f, j) => (
                                    <li key={j}>• {f}</li>
                                ))}
                            </ul>
                            <button
                                onClick={() => handleStart(p)}
                                className="px-8 py-2 rounded-full text-white bg-[#7E37F9] hover:bg-[#6c2fe3] transition"
                            >
                                시작하기
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* 모달 그대로 유지 */}
            {showModal && selectedPlan && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-[420px] shadow-xl">
                        <h2 className="text-lg font-semibold mb-4">{selectedPlan.name} 플랜 결제</h2>
                        <p className="text-sm text-gray-600 mb-6">
                            {selectedPlan.desc} <br />
                            <span className="font-semibold text-[#7E37F9]">{selectedPlan.price}</span> 결제하시겠습니까?
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                            >
                                취소
                            </button>
                            <button
                                onClick={handlePayment}
                                className="px-5 py-2 rounded-md bg-[#7E37F9] text-white hover:bg-[#6b29e3] text-sm"
                            >
                                결제 진행
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
