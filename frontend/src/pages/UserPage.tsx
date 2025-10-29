import { useEffect, useState } from "react";
import UserHeader from "../components/user/UserHeader";
import apiClient from "../api/apiClient";
import { API_BASE_URL } from "../config";

// =======================
// ✅ 타입 정의 (팀원 참고용)
// =======================

// 🎫 플랜 정보
// └─ 백엔드 Subscription → Plan 테이블의 매핑 정보
interface Plan {
    name: "free" | "pro" | "enterprise"; // 플랜 이름
    price: number;                        // 결제 금액
    allocated_minutes: number;            // 사용 가능한 총 녹음 시간(분)
    description: string;                  // 설명 문구
    end_date?: string;                    // ✅ 다음 결제일 (옵션)
}

// 💳 결제 내역 항목
// └─ 백엔드 PaymentItem을 단순화한 형태로 사용
interface Billing {
    id: number;        // 결제 PK
    date: string;      // 결제 승인일
    planName: string;  // 결제된 플랜명
    amount: number;    // 결제 금액
    method: string;    // 결제 수단
}

// ⚙️ 백엔드의 /payments/me/payments 응답과 동일한 구조
// └─ PaymentItem 스키마 참고
interface PaymentItem {
    id: number;
    order_id: string;
    amount: number;
    method: string;
    status: string;
    transaction_key: string;
    approved_at: string;
    canceled_at?: string;
    subscription_id: number;
    plan_name: string;
}

// 👤 사용자 정보
// └─ /users/me 응답 기반으로 프론트에서 사용하는 형태
interface User {
    id: number;
    email: string;
    name: string;
    nickname: string;
    picture: string;
    oauth_provider: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    plan: Plan;
    used_minutes: number;
    billings: Billing[];
    notion_connected: boolean;
}

// =======================
// 🎨 기본 플랜 정보 (프론트에서 표시용)
// =======================
const defaultPlans: Plan[] = [
    {
        name: "free",
        price: 0,
        allocated_minutes: 300,
        description: "무료 플랜 (평생 300분)",
    },
    {
        name: "pro",
        price: 10000,
        allocated_minutes: 500,
        description: "PRO 플랜 (30일 500분)",
    },
    {
        name: "enterprise",
        price: 30000,
        allocated_minutes: 999999,
        description: "엔터프라이즈 (무제한)",
    },
];

// =======================
// 📊 진행률 바 컴포넌트
// =======================

// ✅ props 타입 정의
interface ProgressBarProps {
    used: number; // 사용한 분
    total: number; // 전체 분
    mode?: "used" | "remaining"; // 표시 모드 ("used" = 사용량 기준, "remaining" = 남은시간 기준)
}

function ProgressBar({ used, total, mode = "remaining" }: ProgressBarProps) {
    const percentUsed = Math.min((used / total) * 100, 100);
    const percentRemaining = 100 - percentUsed;
    const percent = mode === "remaining" ? percentRemaining : percentUsed;

    return (
        <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
            <div
                className="bg-[#7E37F9] h-3 rounded-full transition-all"
                style={{ width: `${percent}%` }}
            />
        </div>
    );
}


// =======================
// 💡 플랜 변경 모달 (UI 전용)
// =======================
function PlanModal({
                       visible,
                       onClose,
                       onSelect,
                       currentPlanName,
                   }: {
    visible: boolean;
    onClose: () => void;
    onSelect: (plan: Plan) => void;
    currentPlanName: string;
}) {
    useEffect(() => {
        if (!visible) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prev; };
    }, [visible]);

    if (!visible) return null;

    const planFeatures: Record<string, string[]> = {
        free: [
            "월 300분의 사용량",
            "기본 노트 저장 기능",
            "한 페이지 요약",
        ],
        pro: [
            "월 500분의 사용량",
            "노트당 60분 제한 해제",
            "고품질 한페이지 문서",
            "노트 기록 기반의 무제한 AI 채팅",
            "나만의 템플릿 요약",
        ],
        enterprise: [
            "무제한 사용량",
            "Pro 플랜의 모든 기능 포함",
            "팀 공유 기능 및 우선 지원",
        ],
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center z-50
                 animate-fadeInOverlay"
        >
            <div
                className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-6xl relative
                   animate-dropdown"
            >
                <h2 className="text-2xl font-semibold text-center mb-10">요금제 선택</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {defaultPlans.map((p) => {
                        const isCurrent = p.name === currentPlanName;
                        const features = planFeatures[p.name] || [];
                        return (
                            <div
                                key={p.name}
                                className={`relative flex flex-col justify-between p-8 rounded-2xl border-2 transition-all
                  ${isCurrent
                                    ? "border-[#7E37F9] bg-[#F7F3FF]"
                                    : "border-gray-200 hover:border-[#7E37F9]/60 hover:shadow-lg"}
                `}
                            >
                                {isCurrent && (
                                    <span className="absolute top-4 right-4 bg-[#7E37F9] text-white text-xs font-semibold px-3 py-1 rounded-full">
                    구독중
                  </span>
                                )}

                                <h3 className="text-xl font-bold text-gray-800 mb-1">
                                    {p.name.toUpperCase()}
                                </h3>
                                <p className="text-gray-500 text-sm mb-4">{p.description}</p>

                                <p className="text-2xl font-semibold mb-6">
                                    ₩{p.price.toLocaleString()}
                                    <span className="text-sm text-gray-400"> / 월</span>
                                </p>

                                <ul className="text-sm text-gray-700 space-y-2 mb-8">
                                    {features.map((f, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <span className="text-[#7E37F9] text-lg leading-[1]">●</span>
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    onClick={() => {
                                        if (!isCurrent) onSelect(p);
                                        onClose();
                                    }}
                                    disabled={isCurrent}
                                    className={`w-full py-2 rounded-lg font-medium transition-all mt-auto
                    ${isCurrent
                                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                        : "bg-[#7E37F9] hover:bg-[#6b29e3] text-white"}
                  `}
                                >
                                    {isCurrent ? "구독중" : "시작하기"}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-6 right-8 text-gray-400 hover:text-gray-600 text-sm"
                >
                    닫기 ✕
                </button>
            </div>
        </div>
    );
}



// =======================
// 💰 결제내역 섹션
// =======================
function BillingSection({ billings }: { billings: Billing[] }) {
    return (
        <section className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-3">결제 내역</h2>
            {billings.length === 0 ? (
                <p className="text-gray-400 text-sm">결제 내역이 없습니다.</p>
            ) : (
                <table className="w-full text-sm text-left border-t border-gray-100">
                    <thead>
                    <tr className="text-gray-500 border-b border-gray-100">
                        <th className="py-2">결제일</th>
                        <th>플랜</th>
                        <th>금액</th>
                        <th>결제수단</th>
                    </tr>
                    </thead>
                    <tbody>
                    {billings.map((b: Billing) => (
                        <tr key={b.id} className="border-b border-gray-100">
                            <td className="py-2 text-gray-600">
                                {new Date(b.date).toLocaleDateString("ko-KR")}
                            </td>
                            <td>{b.planName}</td>
                            <td>₩{b.amount.toLocaleString()}</td>
                            <td className="text-gray-500">{b.method}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}

// =======================
// 🧩 노션 연동 섹션
// =======================
function NotionIntegration({
                               connected,
                               onConnect,
                               onDisconnect,
                           }: {
    connected: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
}) {
    return (
        <section className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <h2 className="text-lg font-semibold mb-3">노션 연동</h2>
            {connected ? (
                <>
                    <p className="text-sm text-gray-600 mb-4">
                        노션과 연동이 완료되었습니다.
                    </p>
                    <button
                        onClick={onDisconnect}
                        className="px-4 py-2 rounded-md border border-red-400 text-red-500 hover:bg-red-50 text-sm"
                    >
                        연동 해제
                    </button>
                </>
            ) : (
                <>
                    <p className="text-sm text-gray-600 mb-4">
                        노션 계정을 연결하여 회의록을 자동으로 동기화하세요.
                    </p>
                    <button
                        onClick={onConnect}
                        className="px-4 py-2 rounded-md bg-[#7E37F9] text-white hover:bg-[#6b29e3] text-sm"
                    >
                        노션 연동하기
                    </button>
                </>
            )}
        </section>
    );
}
// 수정

// =======================
// 🧭 메인 UserPage (전체 구조)
// =======================
export default function UserPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    //  마이페이지 초기 로딩
    // └─ 사용자 정보(/users/me) + 결제 내역(/payments/me/payments) 동시 요청
    useEffect(() => {
        async function fetchUser() {
            try {
                const [userRes, paymentsRes, usageRes, subRes] = await Promise.all([
                    apiClient.get(`${API_BASE_URL}/users/me`),
                    apiClient.get(`${API_BASE_URL}/payments/me`),
                    apiClient.get(`${API_BASE_URL}/recordings/usage`),
                    apiClient.get(`${API_BASE_URL}/subscriptions/me`),
                ]);

                const data = userRes.data;
                const usage = usageRes.data;
                const subscription = subRes.data;
                const endDate = subscription?.end_date || null;
                const usedMinutes = Math.floor((usage.used_seconds ?? 0) / 60);
                const totalMinutes = Math.floor((usage.allocated_seconds ?? 0) / 60);


                //  플랜명(plan_name)에 따라 프론트 표시용 plan 객체 생성
                const plan: Plan =
                    data.plan_name === "pro"
                        ? {
                            name: "pro",
                            price: 10000,
                            // 🔽 allocated_minutes를 백엔드 응답으로 덮어쓰기
                            allocated_minutes:
                                usage.allocated_minutes ?? 500, // 없으면 기본값
                            description: "PRO 플랜 (30일 500분)",
                        }
                        : data.plan_name === "enterprise"
                            ? {
                                name: "enterprise",
                                price: 30000,
                                // 🔽 무제한 처리
                                allocated_minutes:
                                    usage.allocated_minutes ?? 999999,
                                description: "엔터프라이즈 (무제한)",
                            }
                            : {
                                name: "free",
                                price: 0,
                                allocated_minutes:
                                    usage.allocated_minutes ?? 300,
                                description: "무료 플랜 (평생 300분)",
                            };

                // 결제 내역을 Billing[] 형태로 변환 (free 제외 + 최신순 정렬)
                const billings: Billing[] = paymentsRes.data
                    // 1️⃣ free 플랜 결제 내역 제외
                    .filter(
                        (p: PaymentItem) =>
                            p.plan_name && p.plan_name.toLowerCase() !== "free"
                    )
                    // 2️⃣ 날짜 내림차순 정렬 (최신 결제가 위로)
                    .sort(
                        (a: PaymentItem, b: PaymentItem) =>
                            new Date(b.approved_at).getTime() - new Date(a.approved_at).getTime()
                    )
                    // 3️⃣ Billing 형식으로 변환
                    .map(
                        (p: PaymentItem): Billing => ({
                            id: p.id,
                            date: p.approved_at,
                            planName: p.plan_name?.toUpperCase() ?? "UNKNOWN",
                            amount: Math.round(p.amount), // 소수점 제거
                            method: p.method,
                        })
                    );

                //  최종 User 객체 구성
                setUser({
                    ...data,
                    plan: {
                        ...plan,
                        end_date: endDate,
                    },
                    used_minutes: usedMinutes, // ✅ 변환 적용
                    billings,
                    notion_connected: false,
                });
            } catch (err) {
                console.error("사용자 정보 불러오기 실패:", err);
                // ❌ 로그인 페이지로 보내지 말고, 단순히 상태만 null로
                setUser(null);
            } finally {
                setLoading(false);
            }
        }

        fetchUser();
    }, [showModal]);

    // 로딩/오류 처리
    if (loading)
        return (
            <main className="flex justify-center items-center min-h-screen text-gray-400">
                로딩 중...
            </main>
        );

    if (!user)
        return (
            <main className="flex justify-center items-center min-h-screen text-gray-400">
                사용자 정보를 찾을 수 없습니다.
            </main>
        );

    //  남은 시간 계산
    const remaining =
        user.plan.allocated_minutes - user.used_minutes > 0
            ? user.plan.allocated_minutes - user.used_minutes
            : 0;

    // UserPage.tsx 안, PlanModal onSelect에서 결제 흐름 연결
    const handleSelectPlan = async (plan: Plan) => {
        try {
            // 1) 결제 요청 정보 받기
            const { data } = await apiClient.post(`${API_BASE_URL}/payments/request`, {
                plan_name: plan.name,
            });

            // 2) 토스 위젯 열기
            //    window.TossPayments는 SDK가 로드되면 생겨요.
            //    환경변수: VITE_TOSS_CLIENT_KEY=pk_live_xxx 또는 pk_test_xxx
            // @ts-ignore
            const toss = window.TossPayments?.(import.meta.env.VITE_TOSS_CLIENT_KEY);
            if (!toss) throw new Error("TossPayments SDK 로드 실패");

            await toss.requestPayment("카드", {
                amount: data.amount,
                orderId: data.orderId,
                orderName: data.orderName,
                customerEmail: data.customerEmail,
                successUrl: data.successUrl, // 백엔드에서 내려준 URL
                failUrl: data.failUrl,
            });

            // 3) 성공/실패는 각각의 URL에서 처리 (successUrl로 리다이렉트된 페이지에서 paymentKey, orderId, amount로 /payments/confirm 호출)
        } catch (e) {
            console.error("결제 시작 실패:", e);
            alert("결제를 시작할 수 없어요. 잠시 후 다시 시도해주세요.");
        }
    };
// =======================
// 🧭 progressBar 애니메이션
// =======================
    function ProgressBar({ used, total, mode = "remaining" }: ProgressBarProps) {
        const percentUsed = Math.min((used / total) * 100, 100);
        const percentRemaining = 100 - percentUsed;
        const percent = mode === "remaining" ? percentRemaining : percentUsed;

        // 애니메이션용 상태값 생성 (초기값 0%)
        const [animatedWidth, setAnimatedWidth] = useState(0);

        // width 증가시키기
        useEffect(() => {
            const timeout = setTimeout(() => {
                setAnimatedWidth(percent); // 목표 퍼센트로 이동
            }, 1000); // 살짝 지연 후 시작하면 자연스러움
            return () => clearTimeout(timeout);
        }, [percent]);

        return (
            <div className="w-full bg-gray-200 rounded-full h-3 mt-2 overflow-hidden">
                <div
                    className="bg-[#7E37F9] h-3 rounded-full transition-all duration-700 ease-out"
                    // ✅ ③ transition으로 부드럽게 채워지게
                    style={{ width: `${animatedWidth}%` }}
                />
            </div>
        );
    }


    // =======================
    // 🎯 렌더링 (UI)
    // =======================
    return (
        <main className="bg-gray-50 min-h-screen p-8 space-y-8">
            <h1 className="text-2xl font-semibold">마이페이지</h1>

            {/* 🔹 프로필 헤더 */}
            <UserHeader user={user} />

            {/* 🔹 현재 플랜 정보 */}
            <section className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                    <div>
                        <p className="text-sm text-gray-500">현재 플랜</p>
                        <h2 className="text-xl font-semibold">
                            {user.plan.name.toUpperCase()}
                        </h2>

                        {/* 🔹 다음 결제일 표시 */}
                        {user.plan.name !== "free" && (
                            <p className="text-xs text-gray-500 mt-2">
                                다음 결제일:{" "}
                                <span className="font-medium text-gray-700">
                                  {user.plan.end_date
                                      ? new Date(user.plan.end_date).toLocaleDateString("ko-KR")
                                      : "결제 정보 없음"}
                                </span>
                                {user.plan.end_date && (
                                    <>
                                        {"  "}
                                        <span className="text-xs text-gray-400">
                                            (
                                            {Math.max(
                                                0,
                                                Math.ceil(
                                                    (new Date(user.plan.end_date).getTime() - Date.now()) /
                                                    (1000 * 60 * 60 * 24)
                                                )
                                            )}
                                            일 남음)
                                        </span>
                                    </>
                                )}
                            </p>
                        )}
                    </div>

                    <button
                        onClick={() => setShowModal(true)}
                        className="px-4 py-1.5 text-sm rounded-md border border-[#7E37F9] text-[#7E37F9] hover:bg-[#7E37F9] hover:text-white transition"
                    >
                        플랜 변경
                    </button>
                </div>

                <p className="text-sm text-gray-600">
                    사용 중: {user.used_minutes}분 / {user.plan.allocated_minutes}분
                </p>
                <ProgressBar
                    used={user.used_minutes}
                    total={user.plan.allocated_minutes}
                />
                <p className="text-xs text-gray-400 mt-1">
                    남은 시간: {remaining.toLocaleString()}분
                </p>
            </section>


            {/* 🔹 결제 내역 */}
            <BillingSection billings={user.billings} />

            {/* 🔹 노션 연동 */}
            <NotionIntegration
                connected={user.notion_connected}
                onConnect={() => {
                    // Axios 사용 X, 그냥 리디렉트만 수행
                    window.location.href = `${API_BASE_URL}/notion/login`;
                }}
                onDisconnect={async () => {
                    try {
                        await apiClient.post(`${API_BASE_URL}/notion/disconnect`);
                        setUser((prev) =>
                            prev ? { ...prev, notion_connected: false } : prev
                        );
                        alert("노션 연동이 해제되었습니다.");
                    } catch (err) {
                        console.error("노션 연동 해제 실패:", err);
                        alert("연동 해제 중 오류가 발생했습니다.");
                    }
                }}
            />

            {/* 🔹 플랜 변경 모달 */}
            <PlanModal
                visible={showModal}
                onClose={() => setShowModal(false)}
                onSelect={(plan) => handleSelectPlan(plan)}
                currentPlanName={user.plan.name} // ✅ 현재 플랜 전달
            />
        </main>
    );
}
