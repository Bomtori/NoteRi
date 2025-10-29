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
                   }: {
    visible: boolean;
    onClose: () => void;
    onSelect: (plan: Plan) => void;
}) {
    // 스크롤 락 (모달 열릴 때 바디 스크롤 막기)
    useEffect(() => {
        if (!visible) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prev; };
    }, [visible]);

    if (!visible) return null;
    return (
        <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-[420px]">
                <h2 className="text-lg font-semibold mb-4">요금제 선택</h2>
                <div className="space-y-3">
                    {defaultPlans.map((p: Plan) => (
                        <div
                            key={p.name}
                            className="border rounded-xl p-4 hover:border-[#7E37F9] cursor-pointer transition"
                            onClick={() => {
                                onSelect(p);
                                onClose();
                            }}
                        >
                            <p className="font-medium">
                                {p.name.toUpperCase()}{" "}
                                <span className="text-sm text-gray-400 ml-2">
                  ₩{p.price.toLocaleString()}
                </span>
                            </p>
                            <p className="text-xs text-gray-500">{p.description}</p>
                        </div>
                    ))}
                </div>
                <button
                    onClick={onClose}
                    className="mt-4 w-full text-sm text-gray-500 hover:text-gray-700"
                >
                    닫기
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
                const [userRes, paymentsRes] = await Promise.all([
                    apiClient.get(`${API_BASE_URL}/users/me`),
                    apiClient.get(`${API_BASE_URL}/payments/me/payments`),
                ]);

                const data = userRes.data;

                //  플랜명(plan_name)에 따라 프론트 표시용 plan 객체 생성
                const plan: Plan =
                    data.plan_name === "pro"
                        ? {
                            name: "pro",
                            price: 10000,
                            allocated_minutes: 500,
                            description: "PRO 플랜 (30일 500분)",
                        }
                        : data.plan_name === "enterprise"
                            ? {
                                name: "enterprise",
                                price: 30000,
                                allocated_minutes: 999999,
                                description: "엔터프라이즈 (무제한)",
                            }
                            : {
                                name: "free",
                                price: 0,
                                allocated_minutes: 300,
                                description: "무료 플랜 (평생 300분)",
                            };

                //  결제 내역을 Billing[] 형태로 변환
                const billings: Billing[] = paymentsRes.data.items.map(
                    (p: PaymentItem): Billing => ({
                        id: p.id,
                        date: p.approved_at,
                        planName: p.plan_name || "FREE",
                        amount: p.amount,
                        method: p.method,
                    })
                );

                //  최종 User 객체 구성
                setUser({
                    ...data,
                    plan,
                    used_minutes: 0, // 추후 recording_usage 연결 시 교체 예정
                    billings,
                    notion_connected: false,
                });
            } catch (err) {
                console.error("사용자 정보 불러오기 실패:", err);
                window.location.href = "/login"; // 인증 만료 시 로그인으로 리다이렉트
            } finally {
                setLoading(false);
            }
        }

        fetchUser();
    }, []);

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
                onSelect={(plan) => {
                    handleSelectPlan(plan); // 결제로 연결
                }}
            />
        </main>
    );
}