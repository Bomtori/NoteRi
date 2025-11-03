import { useCallback, useEffect, useRef, useState } from "react";
import UserHeader from "../components/user/UserHeader";
import apiClient from "../api/apiClient";
import { API_BASE_URL } from "../config";
import { useToast } from "../hooks/useToast";

// =======================
// ✅ 타입 정의
// =======================
interface Plan {
    name: "free" | "pro" | "enterprise";
    price: number;
    allocated_minutes: number;
    description: string;
    end_date?: string;
}

interface PlanOption {
    id: number;
    name: string;
    price: number;
    duration_days: number;
    allocated_seconds: number;
    description?: string;
}

interface Billing {
    id: number;
    date: string;
    planName: string;
    amount: number;
    method: string;
}

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

interface NotificationItem {
    id: number;
    type: string;
    content: string;
    is_read: boolean;
    created_at: string;
}

// =======================
// 📊 진행률 바 컴포넌트
// =======================
interface ProgressBarProps {
    used: number;
    total: number;
    mode?: "used" | "remaining";
}

function ProgressBar({ used, total, mode = "remaining" }: ProgressBarProps) {
    const percentUsed = Math.min((used / total) * 100, 100);
    const percentRemaining = 100 - percentUsed;
    const percent = mode === "remaining" ? percentRemaining : percentUsed;
    const [animatedWidth, setAnimatedWidth] = useState(0);

    useEffect(() => {
        const timeout = setTimeout(() => setAnimatedWidth(percent), 1000);
        return () => clearTimeout(timeout);
    }, [percent]);

    return (
        <div className="w-full bg-gray-200 rounded-full h-3 mt-2 overflow-hidden">
            <div
                className="bg-[#7E37F9] h-3 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${animatedWidth}%` }}
            />
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
                    {billings.map((b) => (
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
type NotionProps = {
    connected: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
};

function NotionIntegration({ connected, onConnect, onDisconnect }: NotionProps) {
    const [loading, setLoading] = useState(false);

    return (
        <section className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <h2 className="text-lg font-semibold mb-3">노션 연동</h2>
            {connected ? (
                <>
                    <p className="text-sm text-gray-600 mb-4">노션과 연동이 완료되었습니다.</p>
                    <button
                        onClick={async () => { setLoading(true); await onDisconnect(); setLoading(false); }}
                        disabled={loading}
                        className="px-4 py-2 rounded-md border border-red-400 text-red-500 hover:bg-red-50 text-sm disabled:opacity-60"
                    >
                        {loading ? "해제 중..." : "연동 해제"}
                    </button>
                </>
            ) : (
                <>
                    <p className="text-sm text-gray-600 mb-4">노션 계정을 연결하여 회의록을 자동으로 동기화하세요.</p>
                    <button
                        onClick={async () => { setLoading(true); await onConnect(); setLoading(false); }}
                        disabled={loading}
                        className="px-4 py-2 rounded-md bg-[#7E37F9] text-white hover:bg-[#6b29e3] text-sm disabled:opacity-60"
                    >
                        {loading ? "연결 준비..." : "노션 연동하기"}
                    </button>
                </>
            )}
        </section>
    );
}

// =======================
// 💳 플랜 변경 모달
// =======================
interface PlanModalProps {
    currentPlan: string;
    plans: PlanOption[];
    onClose: () => void;
    onSelectPlan: (plan: PlanOption) => void;
}
function PlanChangeModal({ currentPlan, plans, onClose, onSelectPlan }: PlanModalProps) {
    const formatKrw = (v: number) =>
        v === 0 ? "₩0" : `₩${Math.round(v).toLocaleString()}`;
    const toMinutes = (sec: number) =>
        Math.floor((sec ?? 0) / 60).toLocaleString();

    // 💜 enterprise 분리, 나머지는 오름차순 정렬
    const enterprisePlans = plans.filter(
        (p) => p.name.toLowerCase() === "enterprise"
    );
    const nonEnterprise = plans
        .filter((p) => p.name.toLowerCase() !== "enterprise")
        .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));

    const sortedPlans = [...nonEnterprise, ...enterprisePlans];

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl p-8 w-[95%] max-w-6xl shadow-2xl max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-800">플랜 변경</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-xl"
                    >
                        ✕
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {sortedPlans.map((plan) => {
                        const isCurrent =
                            plan.name.toLowerCase() === currentPlan.toLowerCase();
                        const isEnterprise =
                            plan.name.toLowerCase() === "enterprise";

                        return (
                            <div
                                key={plan.id}
                                className={[
                                    "relative flex flex-col justify-between text-center p-8 rounded-3xl bg-white border transition-all duration-300",
                                    isCurrent
                                        ? "border-[#7E37F9] shadow-[0_8px_25px_rgba(126,55,249,0.15)]"
                                        : "border-gray-200 hover:border-[#C19EF8] hover:shadow-[0_10px_25px_rgba(126,55,249,0.12)]",
                                ].join(" ")}
                            >
                                <div>
                                    <h3 className="text-xl font-extrabold text-[#7E37F9] mb-2">
                                        {plan.name.toUpperCase()}
                                    </h3>
                                    <p className="text-sm text-gray-600 mb-6 min-h-[36px]">
                                        {plan.description ||
                                            `${plan.name} 플랜 설명`}
                                    </p>
                                    <div className="text-3xl font-extrabold mb-2">
                                        {formatKrw(plan.price)}
                                    </div>
                                    <p className="text-sm text-gray-500 mb-8">
                                        {toMinutes(plan.allocated_seconds)}분 제공{" "}
                                        {plan.duration_days > 0
                                            ? `/ ${plan.duration_days}일`
                                            : ""}
                                    </p>
                                </div>

                                {isCurrent ? (
                                    <button
                                        disabled
                                        className="w-full py-2.5 rounded-full bg-gray-200 text-gray-500 font-medium cursor-not-allowed"
                                    >
                                        현재 플랜
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => onSelectPlan(plan)}
                                        className={`w-full py-2.5 rounded-full font-semibold transition
                                        ${
                                            isEnterprise
                                                ? "bg-gray-700 hover:bg-gray-800 text-white"
                                                : "bg-[#7E37F9] hover:bg-[#6b29e3] text-white"
                                        }`}
                                    >
                                        {isEnterprise ? "담당자 문의" : "변경하기"}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}


// =======================
// 🧭 메인 UserPage
// =======================
export default function UserPage() {
    const prevUnreadRef = useRef(0);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [availablePlans, setAvailablePlans] = useState<PlanOption[]>([]);
    const { showToast } = useToast();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    // 맨 위 import 밑 아무 곳
    const formatKrw = (v: number) => (v === 0 ? "₩0" : `₩${Math.round(v).toLocaleString()}`);
    const toMinutes = (sec: number) => Math.floor((sec ?? 0) / 60).toLocaleString();

    // ✅ 플랜 목록 가져오기
    const fetchAvailablePlans = useCallback(async () => {
        try {
            const res = await apiClient.get(`/plans`);
            setAvailablePlans(res.data);
        } catch (err) {
            console.error("플랜 목록 조회 실패:", err);
        }
    }, []);

    useEffect(() => {
        async function fetchUser() {
            try {
                const [userRes, paymentsRes, usageRes, subRes, notiRes] = await Promise.all([
                    apiClient.get(`/users/me`),
                    apiClient.get(`/payments/me`),
                    apiClient.get(`/recordings/usage`),
                    apiClient.get(`/subscriptions/me`),
                    apiClient.get(`/notifications`),
                ]);

                let notionConnected = false;
                try {
                    const notionRes = await apiClient.get(`/notion/status`);
                    notionConnected = !!notionRes.data?.connected;
                } catch {
                    notionConnected = !!userRes.data?.notion_connected;
                }

                const data = userRes.data;
                const usage = usageRes.data;
                const subscription = subRes.data;
                const endDate = subscription?.end_date || null;
                const usedMinutes = Math.floor((usage.used_seconds ?? 0) / 60);

                const plan: Plan =
                    data.plan_name === "pro"
                        ? { name: "pro", price: 10000, allocated_minutes: usage.allocated_minutes ?? 500, description: "PRO 플랜 (30일 500분)" }
                        : data.plan_name === "enterprise"
                            ? { name: "enterprise", price: 30000, allocated_minutes: usage.allocated_minutes ?? 999999, description: "엔터프라이즈 (무제한)" }
                            : { name: "free", price: 0, allocated_minutes: usage.allocated_minutes ?? 300, description: "무료 플랜 (평생 300분)" };

                const billings: Billing[] = paymentsRes.data
                    .filter((p: PaymentItem) => p.plan_name?.toLowerCase() !== "free")
                    .sort((a: PaymentItem, b: PaymentItem) => new Date(b.approved_at).getTime() - new Date(a.approved_at).getTime())
                    .map((p: PaymentItem) => ({
                        id: p.id,
                        date: p.approved_at,
                        planName: p.plan_name?.toUpperCase() ?? "UNKNOWN",
                        amount: Math.round(p.amount),
                        method: p.method,
                    }));

                setUser({
                    ...data,
                    plan: { ...plan, end_date: endDate },
                    used_minutes: usedMinutes,
                    billings,
                    notion_connected: notionConnected,
                });
                setNotifications(notiRes.data ?? []);
            } catch (err) {
                console.error("사용자 정보 불러오기 실패:", err);
                setUser(null);
            } finally {
                setLoading(false);
            }
        }

        fetchUser();
        fetchAvailablePlans();

        const qs = new URLSearchParams(window.location.search);
        if (qs.get("notion") === "connected") {
            setUser((u) => (u ? { ...u, notion_connected: true } : u));
            window.history.replaceState({}, "", window.location.pathname);
        }
    }, [fetchAvailablePlans]);

    const refreshNotifications = useCallback(async () => {
        try {
            const unreadRes = await apiClient.get(`/notifications/unread`, { withCredentials: true });
            const unread = unreadRes.data.length;

            if (unread > prevUnreadRef.current) {
                showToast(unread === 1 ? "🔔 새 알림이 1개 도착했습니다." : `🔔 새 알림이 ${unread}개 도착했습니다.`);
                const listRes = await apiClient.get(`/notifications`);
                setNotifications(listRes.data ?? []);
            }

            setUnreadCount(unread);
            prevUnreadRef.current = unread;
        } catch (e) {
            console.error("알림 확인 실패:", e);
        }
    }, [showToast]);

    useEffect(() => {
        refreshNotifications();
        const interval = setInterval(refreshNotifications, 15000);
        return () => clearInterval(interval);
    }, [refreshNotifications]);
    // 모달 렌더 가격필터링
    const enterprisePlans = availablePlans.filter(p => p.name.toLowerCase() === "enterprise");
    const nonEnterprise = availablePlans
        .filter(p => p.name.toLowerCase() !== "enterprise")
        .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));

    const sortedPlans = [...nonEnterprise, ...enterprisePlans];

    // 플랜 선택 시 결제 진행
    const handleSelectPlan = async (selectedPlan: PlanOption) => {
        console.log("선택된 플랜:", selectedPlan);

        if (selectedPlan.name.toLowerCase() === "free") {
            showToast("무료 플랜으로는 직접 변경할 수 없습니다.");
            setShowModal(false);
            return;
        }

        try {
            console.log("결제 요청 시작...");
            const { data } = await apiClient.post(`/payments/request`, {
                plan_name: selectedPlan.name.toLowerCase(),
            });
            console.log("결제 데이터:", data);

            const tossKey = import.meta.env.VITE_TOSS_CLIENT_KEY;
            console.log("Toss Key:", tossKey);

            const toss = (window as any).TossPayments?.(tossKey);
            if (!toss) {
                console.error("TossPayments SDK를 찾을 수 없습니다.");
                throw new Error("TossPayments SDK 로드 실패");
            }

            console.log("Toss 결제창 호출...");
            await toss.requestPayment("카드", {
                amount: data.amount,
                orderId: data.orderId,
                orderName: data.orderName,
                customerEmail: data.customerEmail,
                successUrl: data.successUrl,
                failUrl: data.failUrl,
            });
        } catch (err: any) {
            console.error("결제 시작 실패:", err);
            showToast(err.message || "결제를 시작할 수 없습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setShowModal(false);
        }
    };

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

    const remaining =
        user.plan.allocated_minutes - user.used_minutes > 0
            ? user.plan.allocated_minutes - user.used_minutes
            : 0;

    return (
        <main className="bg-gray-50 min-h-screen p-8 space-y-8">
            <h1 className="text-2xl font-semibold mb-6">마이페이지</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <div className="space-y-6">
                    <UserHeader user={user} />

                    <section className="bg-white rounded-2xl p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <div>
                                <p className="text-sm text-gray-500">현재 플랜</p>
                                <h2 className="text-xl font-semibold">
                                    {user.plan.name.toUpperCase()}
                                </h2>

                                {user.plan.name !== "free" && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        다음 결제일:{" "}
                                        <span className="font-medium text-gray-700">
                                            {user.plan.end_date
                                                ? new Date(user.plan.end_date).toLocaleDateString("ko-KR")
                                                : "결제 정보 없음"}
                                        </span>
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
                        <ProgressBar used={user.used_minutes} total={user.plan.allocated_minutes} />
                        <p className="text-xs text-gray-400 mt-1">
                            남은 시간: {remaining.toLocaleString()}분
                        </p>
                    </section>
                </div>

                <div className="space-y-6">
                    <BillingSection billings={user.billings} />

                    <section className="bg-white rounded-2xl p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-gray-800">알림</h2>
                            <button
                                onClick={async () => {
                                    try {
                                        await apiClient.post(`/notifications/read-all`);
                                        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
                                        refreshNotifications();
                                        showToast("모든 알림을 읽음 처리했습니다.");
                                    } catch {
                                        showToast("알림 처리 중 오류가 발생했습니다.");
                                    }
                                }}
                                className="text-sm text-[#7E37F9] hover:underline"
                            >
                                모두 읽음
                            </button>
                        </div>

                        {notifications.length === 0 ? (
                            <p className="text-sm text-gray-400">새 알림이 없습니다.</p>
                        ) : (
                            <ul className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
                                {[...notifications]
                                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                    .map((n) => (
                                        <li key={n.id} className={`p-3 rounded-lg border transition ${n.is_read ? "bg-gray-50 border-gray-200" : "bg-[#F3EFFF] border-[#E0CFFF]"}`}>
                                            <p className="text-sm text-gray-800">{n.content}</p>
                                            <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString("ko-KR")}</p>
                                        </li>
                                    ))}
                            </ul>
                        )}
                    </section>

                    <NotionIntegration
                        connected={user.notion_connected}
                        onConnect={async () => {
                            const token = localStorage.getItem("access_token");
                            if (!token) return alert("로그인이 필요합니다.");
                            await fetch(`/healthz`, {
                                headers: { "ngrok-skip-browser-warning": "1" },
                                cache: "no-store",
                            }).catch(() => {});

                            const res = await fetch(`/notion/login`, {
                                headers: { Authorization: `Bearer ${token}` },
                            });
                            if (!res.ok) {
                                const text = await res.text();
                                return alert(`노션 URL 요청 실패: ${res.status} ${text}`);
                            }
                            const { url } = await res.json();
                            window.location.href = url;
                        }}
                        onDisconnect={async () => {
                            const token = localStorage.getItem("access_token");
                            if (!token) return alert("로그인이 필요합니다.");
                            const res = await fetch(`/notion/disconnect`, {
                                method: "DELETE",
                                headers: { Authorization: `Bearer ${token}` },
                            });
                            if (!res.ok) {
                                const text = await res.text();
                                return alert(`연동 해제 실패: ${res.status} ${text}`);
                            }
                            alert("노션 연동이 해제되었습니다.");
                            setUser((u) => (u ? { ...u, notion_connected: false } : u));
                        }}
                    />
                </div>
            </div>

            {showModal && (
                <PlanChangeModal
                    currentPlan={user.plan.name}
                    plans={sortedPlans} // ← 여기!
                    onClose={() => setShowModal(false)}
                    onSelectPlan={handleSelectPlan}
                />
            )}
        </main>
    );
}