import React, { useState, useEffect } from "react";
import apiClient from "../api/apiClient";
import { motion, AnimatePresence } from "framer-motion";
import { FiSearch, FiCheck, FiX, FiCheckSquare, FiSquare } from "react-icons/fi";
import { useToast } from "../hooks/useToast";

/** ===== Types ===== */
interface PaymentItem {
    date: string;
    plan_name?: string;
    amount: number;
    status: string;
}

interface AdminUser {
    ban_logs?: {
        id: number;
        is_banned: boolean;
        reason?: string | null;
        until?: string | null;
        created_at: string;
    }[];
    user_id: number;
    name: string;
    email: string;
    is_banned: boolean;
    banned_reason?: string | null;
    banned_until?: string | null;
    is_active: boolean;
    plan_name?: string | null;
    subscription_is_active?: boolean | null;
    latest_payment_status?: string | null;
    total_paid_amount: number;
    next_billing_date?: string | null;
    joined_at: string;
    payments?: PaymentItem[];
    visibleCount?: number;
}

interface AdminUserOverviewList {
    total: number;
    items: AdminUser[];
}

interface ToastApi {
    toast: { visible: boolean; content: React.ReactNode };
    showToast: (content: React.ReactNode, duration?: number) => void;
    clearToast: () => void;
}

interface BanLog {
    id: number;
    is_banned: boolean;
    reason?: string | null;
    until?: string | null;
    actor_id?: number;
    created_at: string;
}

/** ===== Main Component ===== */
export default function AdminUserPage(): JSX.Element {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [page, setPage] = useState<number>(1);
    const [size] = useState<number>(10);
    const [search, setSearch] = useState<string>("");
    const [selected, setSelected] = useState<number[]>([]);
    const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUser | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [newPlan, setNewPlan] = useState("Free");
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [blockForm, setBlockForm] = useState({ days: 1, reason: "", permanent: false });
    const { toast, showToast, clearToast } = useToast() as unknown as ToastApi;

    /** ✅ 유저 목록 불러오기 */
    const fetchUsers = async () => {
        try {
            const res = await apiClient.get<AdminUserOverviewList>("/admin/users/overview-list", {
                params: { page, size, q: search || undefined },
            });
            setUsers(res.data.items);
            setTotal(res.data.total);
        } catch (err) {
            console.error("유저 목록 불러오기 실패:", err);
            showToast(<div className="text-red-600">유저 목록 불러오기 실패</div>, 3000);
        }
    };

    /** ✅ 상세보기용 데이터 가져오기 */
    const fetchUserDetail = async (userId: number) => {
        try {
            const [overviewRes, banLogsRes] = await Promise.all([
                apiClient.get(`/admin/users/${userId}/overview`),
                apiClient.get(`/users/${userId}/ban/logs`), // ✅ 차단 로그도 함께 불러오기
            ]);

            setSelectedUserDetail({
                ...overviewRes.data,
                ban_logs: banLogsRes.data, // ✅ 차단 로그 추가
            });
        } catch (err) {
            console.error("유저 상세조회 실패:", err);
            showToast(<div className="text-red-600">유저 상세조회 실패</div>, 2500);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [page, search]);

    /** ✅ ESC 및 바깥 클릭 시 패널 닫기 */
    useEffect(() => {
        if (!selectedUserDetail) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSelectedUserDetail(null);
        };

        const handleClickOutside = (e: MouseEvent) => {
            const panel = document.querySelector(".user-detail-panel");
            if (panel && !panel.contains(e.target as Node)) {
                setSelectedUserDetail(null);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("mousedown", handleClickOutside);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("mousedown", handleClickOutside);
        };
    }, [selectedUserDetail]);

    const totalPages = Math.ceil(total / size);

    const toggleSelect = (id: number): void => {
        setSelected((prev) =>
            prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = (): void => {
        const ids = users.map((u) => u.user_id);
        const all = ids.every((id) => selected.includes(id));
        setSelected(all ? [] : ids);
    };

    const selectedUsers = users.filter((u) => selected.includes(u.user_id));
    const allBlocked = selectedUsers.length > 0 && selectedUsers.every((u) => u.is_banned);

    /** ✅ 차단 확정 */
    const handleBlockConfirm = async (): Promise<void> => {
        try {
            const now = new Date();
            const until = blockForm.permanent
                ? null
                : new Date(now.setDate(now.getDate() + blockForm.days)).toISOString();

            await Promise.all(
                selected.map((id) =>
                    apiClient.patch(`/users/${id}/ban`, {
                        is_banned: true,
                        reason: blockForm.reason || "사유 없음",
                        until,
                    })
                )
            );

            showToast(
                <div className="text-red-600 font-medium">
                    ⛔ {selected.length}명의 유저가 차단되었습니다.
                    <div className="text-xs text-gray-500">
                        {blockForm.permanent
                            ? "영구 차단"
                            : `기간: ${blockForm.days}일 / 사유: ${blockForm.reason || "없음"}`}
                    </div>
                </div>,
                3500
            );

            setShowBlockModal(false);
            setBlockForm({ days: 1, reason: "", permanent: false });
            setSelected([]);
            fetchUsers();
        } catch (err) {
            console.error(err);
            showToast(<div className="text-red-600">차단 요청 실패</div>, 2500);
        }
    };

    /** ✅ 차단 해제 */
    const handleUnblockUsers = async (): Promise<void> => {
        try {
            await Promise.all(
                selected.map((id) =>
                    apiClient.patch(`/users/${id}/ban`, {
                        is_banned: false,
                        reason: null,
                        until: null,
                    })
                )
            );
            showToast(
                <div className="text-green-600 font-medium">
                    ✅ {selected.length}명의 유저 차단이 해제되었습니다.
                </div>,
                3000
            );
            setSelected([]);
            fetchUsers();
        } catch (err) {
            console.error(err);
            showToast(<div className="text-red-600">차단 해제 실패</div>, 2500);
        }
    };

    const handlePlanChange = () => {
        showToast(
            <div className="text-[#7E37F9] font-medium">
                ⚙️ {selected.length}명의 유저 플랜이 {newPlan} 으로 변경되었습니다.
            </div>,
            3000
        );
        setShowModal(false);
    };

    return (
        <div className="p-6 relative">
            <h2 className="text-2xl font-semibold mb-4">유저 관리</h2>

            {/* 검색 + 필터 */}
            <div className="flex flex-wrap gap-3 items-center mb-4">
                <div className="flex items-center bg-gray-50 rounded-lg px-3 py-2 border">
                    <FiSearch className="text-gray-500 mr-2" />
                    <input
                        type="text"
                        placeholder="이름 또는 이메일 검색"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="bg-transparent outline-none text-sm"
                    />
                </div>

                <div className="flex gap-2 ml-auto items-center">
                    {selected.length > 0 && (
                        <p className="text-sm text-gray-500 mr-1">{selected.length}명 선택됨</p>
                    )}
                    {allBlocked ? (
                        <button
                            onClick={handleUnblockUsers}
                            className="px-3 py-1.5 text-sm bg-green-100 text-green-600 rounded-lg hover:bg-green-200"
                        >
                            차단 해제
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                if (selected.length > 0) {
                                    setShowBlockModal(true);
                                } else {
                                    showToast(
                                        <div className="text-red-500 font-medium">⚠️ 유저를 먼저 선택해주세요.</div>,
                                        2000
                                    );
                                }
                            }}
                            className="px-3 py-1.5 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                        >
                            유저 차단
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (selected.length > 0) {
                                setShowModal(true);
                            } else {
                                showToast(
                                    <div className="text-red-500 font-medium">⚠️ 유저를 먼저 선택해주세요.</div>,
                                    2000
                                );
                            }
                        }}
                        className="px-3 py-1.5 text-sm bg-[#f5f2fb] text-[#7E37F9] rounded-lg hover:bg-[#ede3ff]"
                    >
                        구독 변경
                    </button>
                </div>
            </div>
            {/* 🔹 유저 차단 모달 */}
            <AnimatePresence>
                {showBlockModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white rounded-xl shadow-xl p-6 w-[360px]"
                        >
                            <h3 className="text-lg font-semibold mb-4 text-gray-800">유저 차단</h3>
                            <div className="space-y-3 text-sm">
                                <label className="block">
                                    <span className="text-gray-600 font-medium">사유</span>
                                    <input
                                        type="text"
                                        value={blockForm.reason}
                                        onChange={(e) =>
                                            setBlockForm({ ...blockForm, reason: e.target.value })
                                        }
                                        className="mt-1 w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#7E37F9] focus:outline-none"
                                        placeholder="예: 이용약관 위반"
                                    />
                                </label>

                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 text-gray-600">
                                        <input
                                            type="checkbox"
                                            checked={blockForm.permanent}
                                            onChange={(e) =>
                                                setBlockForm({ ...blockForm, permanent: e.target.checked })
                                            }
                                        />
                                        영구 차단
                                    </label>

                                    {!blockForm.permanent && (
                                        <label className="flex items-center gap-2 text-gray-600">
                                            기간:
                                            <input
                                                type="number"
                                                min={1}
                                                value={blockForm.days}
                                                onChange={(e) =>
                                                    setBlockForm({
                                                        ...blockForm,
                                                        days: parseInt(e.target.value, 10),
                                                    })
                                                }
                                                className="border rounded w-16 px-2 py-1 text-center"
                                            />
                                            일
                                        </label>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-5">
                                <button
                                    onClick={() => setShowBlockModal(false)}
                                    className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleBlockConfirm}
                                    className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
                                >
                                    차단하기
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 🔹 구독 변경 모달 */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white rounded-xl shadow-xl p-6 w-[340px]"
                        >
                            <h3 className="text-lg font-semibold mb-4 text-gray-800">구독 변경</h3>

                            <div className="space-y-3 text-sm">
                                <label className="text-gray-600 font-medium">새 플랜 선택</label>
                                <select
                                    value={newPlan}
                                    onChange={(e) => setNewPlan(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#7E37F9] focus:outline-none"
                                >
                                    <option value="Free">Free</option>
                                    <option value="Basic">Basic</option>
                                    <option value="Pro">Pro</option>
                                    <option value="Enterprise">Enterprise</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 mt-5">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handlePlanChange}
                                    className="px-4 py-2 rounded-lg bg-[#7E37F9] text-white hover:bg-[#6d2ee3]"
                                >
                                    변경하기
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 테이블 */}
            <div className="bg-white shadow rounded-xl p-4 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead className="text-left border-b bg-gray-50">
                    <tr>
                        <th className="p-2 w-10 text-center">
                            <input
                                type="checkbox"
                                checked={users.length > 0 && users.every((u) => selected.includes(u.user_id))}
                                onChange={toggleSelectAll}
                            />
                        </th>
                        <th className="p-2">이름</th>
                        <th className="p-2">이메일</th>
                        <th className="p-2">상태</th>
                        <th className="p-2">플랜</th>
                        <th className="p-2">결제 상태</th>
                        <th className="p-2">총 결제액</th>
                        <th className="p-2">다음 결제일</th>
                        <th className="p-2">가입일</th>
                    </tr>
                    </thead>
                    <tbody>
                    {users.map((u) => (
                        <motion.tr
                            key={u.user_id}
                            layout
                            onClick={(e) => {
                                const tag = (e.target as HTMLElement).tagName.toLowerCase();
                                if (["input", "button", "svg", "path"].includes(tag)) return;
                                fetchUserDetail(u.user_id);
                            }}
                            className={`border-b hover:bg-gray-50 ${
                                selected.includes(u.user_id) ? "bg-[#F8F5FF]" : ""
                            }`}
                        >
                            <td className="p-2 text-center">
                                <input
                                    type="checkbox"
                                    checked={selected.includes(u.user_id)}
                                    onChange={() => toggleSelect(u.user_id)}
                                />
                            </td>
                            <td className="p-2">{u.name}</td>
                            <td className="p-2">{u.email}</td>
                            <td
                                className={`p-2 font-medium ${
                                    u.is_banned ? "text-red-500" : "text-green-600"
                                }`}
                            >
                                {u.is_banned ? "차단됨" : u.is_active ? "활성" : "비활성"}
                            </td>
                            <td className="p-2">{u.plan_name ?? "-"}</td>
                            <td className="p-2">
                                {u.latest_payment_status === "SUCCESS" ? (
                                    <FiCheck className="text-green-600" />
                                ) : (
                                    <FiX className="text-red-600" />
                                )}
                            </td>
                            <td className="p-2">₩{u.total_paid_amount.toLocaleString()}</td>
                            <td className="p-2">{u.next_billing_date ?? "-"}</td>
                            <td className="p-2">{u.joined_at.slice(0, 10)}</td>
                        </motion.tr>
                    ))}
                    </tbody>
                </table>

                {/* 🔹 유저 상세보기 패널 + 블러 배경 */}
                <AnimatePresence>
                    {selectedUserDetail && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0.4 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="fixed inset-0 bg-black backdrop-blur-sm z-40"
                            />
                            <motion.div
                                initial={{ x: "100%", opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: "100%", opacity: 0 }}
                                transition={{ type: "spring", stiffness: 220, damping: 25 }}
                                className="user-detail-panel fixed top-0 right-0 h-full w-[420px] bg-white shadow-2xl border-l overflow-y-auto z-50"
                            >
                                <div className="flex justify-between items-center px-6 py-4 border-b bg-white sticky top-0 z-10">
                                    <h3 className="text-lg font-semibold">
                                        {selectedUserDetail.name} 님 상세정보
                                    </h3>
                                    <button
                                        onClick={() => setSelectedUserDetail(null)}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="p-6 space-y-5 text-[15px] leading-relaxed">
                                    {/* 기본 정보 */}
                                    <div className="space-y-3">
                                        {[
                                            ["이메일", selectedUserDetail.email],
                                            [
                                                "상태",
                                                selectedUserDetail.is_banned
                                                    ? "차단됨"
                                                    : selectedUserDetail.is_active
                                                        ? "활성"
                                                        : "비활성",
                                                selectedUserDetail.is_banned
                                                    ? "text-red-500 font-medium"
                                                    : selectedUserDetail.is_active
                                                        ? "text-green-600 font-medium"
                                                        : "text-gray-600",
                                            ],
                                            ["플랜", selectedUserDetail.plan_name ?? "-", "text-[#7E37F9] font-semibold"],
                                            ["총 결제액", `₩${selectedUserDetail.total_paid_amount.toLocaleString()}`],
                                            ["다음 결제일", selectedUserDetail.next_billing_date ?? "-"],
                                            ["가입일", selectedUserDetail.joined_at.slice(0, 10)],
                                        ].map(([label, value, extra], idx) => (
                                            <div key={idx} className="flex justify-between border-b pb-1 text-gray-800">
                                                <span className="text-gray-500 font-medium">{label}</span>
                                                <span className={extra as string}>{value}</span>
                                            </div>
                                        ))}
                                        {selectedUserDetail.banned_reason && (
                                            <div className="flex items-start gap-2 text-red-500 mt-2">
                                                <span className="mt-[2px]">🚫</span>
                                                <p className="text-sm leading-snug">
                                                    <span className="font-semibold">차단 사유:</span>{" "}
                                                    {selectedUserDetail.banned_reason}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* 💳 결제 내역 */}
                                    <div className="mt-6">
                                        <h4 className="font-semibold mb-3 text-gray-800">결제 내역</h4>
                                        {selectedUserDetail.payments && selectedUserDetail.payments.length > 0 ? (
                                            <>
                                                <div className="overflow-x-auto border rounded-xl">
                                                    <table className="w-full text-sm table-fixed">
                                                        <thead className="bg-[#F8F5FF] text-gray-600 border-b">
                                                        <tr>
                                                            <th className="p-2 text-left w-[28%]">날짜</th>
                                                            <th className="p-2 text-left w-[20%]">플랜</th>
                                                            <th className="p-2 text-left w-[30%]">금액</th>
                                                            <th className="p-2 text-center w-[22%]">상태</th>
                                                        </tr>
                                                        </thead>
                                                        <tbody>
                                                        {selectedUserDetail.payments
                                                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                            .slice(0, selectedUserDetail.visibleCount || 5)
                                                            .map((p, i) => (
                                                                <tr key={i} className="border-b last:border-none">
                                                                    <td className="p-2 truncate">{p.date?.slice(0, 10)}</td>
                                                                    <td className="p-2 text-[#7E37F9] font-medium truncate">
                                                                        {p.plan_name || "-"}
                                                                    </td>
                                                                    <td className="p-2">₩{p.amount?.toLocaleString()}</td>
                                                                    <td className="p-2 text-center">
                                                                        {p.status === "SUCCESS" ? (
                                                                            <span className="px-2 py-[2px] bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                                              성공
                                                                            </span>
                                                                        ) : (
                                                                            <span className="px-2 py-[2px] bg-red-100 text-red-600 rounded-full text-xs font-medium">
                                                                              실패
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                {selectedUserDetail.payments.length >
                                                    (selectedUserDetail.visibleCount || 5) && (
                                                        <div className="flex justify-center mt-3">
                                                            <button
                                                                onClick={() =>
                                                                    setSelectedUserDetail((prev) =>
                                                                        prev
                                                                            ? {
                                                                                ...prev,
                                                                                visibleCount: (prev.visibleCount || 5) + 5,
                                                                            }
                                                                            : prev
                                                                    )
                                                                }
                                                                className="text-sm text-[#7E37F9] hover:underline"
                                                            >
                                                                더보기 +
                                                            </button>
                                                        </div>
                                                    )}
                                            </>
                                        ) : (
                                            <p className="text-gray-400 text-sm">
                                                결제 내역이 없습니다.
                                            </p>
                                        )}
                                        {/* 🔸 차단 로그 내역 */}
                                        <div className="mt-8">
                                            <h4 className="font-semibold mb-3 text-gray-800">차단 로그</h4>

                                            {selectedUserDetail.ban_logs && selectedUserDetail.ban_logs.length > 0 ? (
                                                <div className="bg-white border rounded-xl overflow-hidden">
                                                    <table className="w-full text-sm text-gray-700">
                                                        <thead className="bg-gray-50 text-gray-600 border-b">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left w-[25%]">날짜</th>
                                                            <th className="px-3 py-2 text-left w-[20%]">상태</th>
                                                            <th className="px-3 py-2 text-left w-[55%]">사유</th>
                                                        </tr>
                                                        </thead>
                                                        <tbody>
                                                        {selectedUserDetail.ban_logs
                                                            .slice(0, selectedUserDetail.showBanCount || 5) // ✅ 처음엔 5개만
                                                            .map((log) => (
                                                                <tr key={log.id} className="border-b last:border-none hover:bg-gray-50">
                                                                    <td className="px-3 py-2">
                                                                        {new Date(log.created_at).toLocaleString("ko-KR", {
                                                                            year: "numeric",
                                                                            month: "2-digit",
                                                                            day: "2-digit",
                                                                            hour: "2-digit",
                                                                            minute: "2-digit",
                                                                        })}
                                                                    </td>
                                                                    <td
                                                                        className={`px-3 py-2 font-medium ${
                                                                            log.is_banned ? "text-red-500" : "text-green-600"
                                                                        }`}
                                                                    >
                                                                        {log.is_banned ? "차단" : "해제"}
                                                                    </td>
                                                                    <td className="px-3 py-2">{log.reason || "-"}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>

                                                    {/* 🔹 더보기 버튼 */}
                                                    {selectedUserDetail.ban_logs.length >
                                                        (selectedUserDetail.showBanCount || 5) && (
                                                            <div className="text-center py-2 bg-gray-50">
                                                                <button
                                                                    onClick={() =>
                                                                        setSelectedUserDetail((prev: any) => ({
                                                                            ...prev,
                                                                            showBanCount:
                                                                                (prev.showBanCount || 5) + 5, // ✅ 5개씩 추가
                                                                        }))
                                                                    }
                                                                    className="text-[#7E37F9] text-sm font-medium hover:underline"
                                                                >
                                                                    더보기 +
                                                                </button>
                                                            </div>
                                                        )}
                                                </div>
                                            ) : (
                                                <p className="text-gray-400 text-sm">차단 로그가 없습니다.</p>
                                            )}
                                        </div>


                                    </div>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                {/* 페이지네이션 */}
                <div className="flex justify-center gap-2 mt-4">
                    {Array.from({ length: totalPages }, (_, i) => (
                        <button
                            key={i}
                            onClick={() => setPage(i + 1)}
                            className={`px-3 py-1 rounded-md text-sm ${
                                page === i + 1
                                    ? "bg-[#7E37F9] text-white"
                                    : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                            }`}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div>
            </div>

            {/* 🔹 토스트 */}
            <AnimatePresence>
                {toast.visible && (
                    <motion.div
                        key="admin-toast"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.3 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md border shadow-lg rounded-2xl px-6 py-3 z-[9999]"
                        onClick={clearToast}
                    >
                        {toast.content}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
