import { useState, useRef, useEffect } from "react";

export default function FAQSection() {
    const faqs = [
        { q: "NoteRi는 무료로 사용할 수 있나요?", a: "네. 기본 기능(STT 변환, 회의록 저장 5건, 간단 요약)은 Free 요금제에서 무료로 이용할 수 있습니다." },
        { q: "녹음한 회의 데이터는 안전하게 보관되나요?", a: "모든 회의 데이터는 사용자 계정별로 안전하게 분리되어 저장되며, 사용자 동의 없이 외부에 공유되지 않습니다. 현재는 인증된 사용자만 접근할 수 있도록 보호되어 있으며, 추후 데이터 암호화 기능이 추가될 예정입니다." },
        { q: "AI 요약 결과를 편집할 수 있나요?", a: "예. 회의가 끝난 후 자동 생성된 요약 내용을 직접 수정하고 저장할 수 있습니다." },
        { q: "Pro 요금제는 어떤 기능이 추가되나요?", a: "화자 분리, AI 템플릿 추천, GPT 분석 등 고급 기능을 무제한으로 이용하실 수 있습니다." },
    ];

    const [openIndex, setOpenIndex] = useState(null);
    const [visibleItems, setVisibleItems] = useState([]);
    const sectionRef = useRef(null);
    const contentRefs = useRef([]);

    // ✅ 각 FAQ 항목별로 IntersectionObserver 적용
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const index = Number(entry.target.dataset.index);
                        setVisibleItems((prev) =>
                            prev.includes(index) ? prev : [...prev, index]
                        );
                    }
                });
            },
            { threshold: 0.3 }
        );

        contentRefs.current.forEach((el) => el && observer.observe(el));
        return () => observer.disconnect();
    }, []);

    const toggleFAQ = (i) => setOpenIndex((prev) => (prev === i ? null : i));

    return (
        <section
            ref={sectionRef}
            className="relative py-32 bg-gradient-to-b from-white/80 to-[#F5F0FF]/70 backdrop-blur-xl text-center"
        >
            <div className="w-full max-w-3xl mx-auto px-6 flex flex-col items-center justify-center">
                <h2 className="text-4xl font-bold text-[#272527] mb-14">FAQ</h2>

                <div className="space-y-6 w-full text-left">
                    {faqs.map((item, i) => (
                        <div
                            key={i}
                            ref={(el) => (contentRefs.current[i] = el)}
                            data-index={i}
                            className={`bg-white/60 backdrop-blur-md border border-white/30 rounded-2xl p-6 shadow-sm 
                                transition-all duration-700 ease-out transform
                                ${
                                visibleItems.includes(i)
                                    ? "opacity-100 translate-y-0"
                                    : "opacity-0 translate-y-10"
                            }`}
                            style={{ transitionDelay: `${i * 150}ms` }}
                        >
                            <button
                                onClick={() => toggleFAQ(i)}
                                className="w-full flex justify-between items-center text-left font-semibold text-[#272527] text-lg"
                            >
                                {item.q}
                                <span className="text-[#7E37F9] text-2xl font-light">
                                    {openIndex === i ? "–" : "+"}
                                </span>
                            </button>

                            <div
                                style={{
                                    maxHeight:
                                        openIndex === i
                                            ? "200px"
                                            : "0px",
                                    transition: "max-height 0.45s ease, opacity 0.4s ease",
                                    opacity: openIndex === i ? 1 : 0,
                                }}
                                className="overflow-hidden mt-2"
                            >
                                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                                    {item.a}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
