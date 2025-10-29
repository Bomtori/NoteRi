import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiSearch } from "react-icons/fi";
import { useToast } from "../hooks/useToast";

export default function AdminUserPage() {
  const [users, setUsers] = useState(
    Array.from({ length: 18 }, (_, i) => ({
      id: i + 1,
      email: `user${i + 1}@example.com`,
      name: `사용자${i + 1}`,
      status: i % 4 === 0 ? "차단됨" : "활성",
      plan: i % 3 === 0 ? "Enterprise" : i % 2 === 0 ? "Pro" : "Free",
      paymentSuccess: i % 2 === 0,
      amount: i % 2 === 0 ? "₩10,000" : "₩0",
      nextPayment: i % 2 === 0 ? "2025-11-21" : "-",
      joinedAt: "2025-01-15",
    }))
  );

  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("전체");
  const [selected, setSelected] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newPlan, setNewPlan] = useState("Free");

  // ✅ 페이징
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { toast, showToast, clearToast } = useToast();

  // 🔹 검색 + 필터
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchesPlan = planFilter === "전체" || u.plan === planFilter;
      return matchesSearch && matchesPlan;
    });
  }, [users, search, planFilter]);

  // 🔹 페이지네이션 적용된 리스트
  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = filteredUsers.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  // 🔹 선택 상태
  const toggleSelectAll = () => {
    const currentPageIds = paginatedUsers.map((u) => u.id);
    const allSelected = currentPageIds.every((id) => selected.includes(id));
    if (allSelected)
      setSelected((prev) => prev.filter((id) => !currentPageIds.includes(id)));
    else
      setSelected((prev) => [
        ...prev,
        ...currentPageIds.filter((id) => !prev.includes(id)),
      ]);
  };
  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const selectedUsers = users.filter((u) => selected.includes(u.id));
  const allBlocked =
    selectedUsers.length > 0 && selectedUsers.every((u) => u.status === "차단됨");

  // 🔹 일괄 작업
  const handleBulkAction = (action) => {
    if (selected.length === 0)
      return showToast(
        <div className="text-red-600 font-medium">⚠️ 유저를 먼저 선택해주세요.</div>,
        2500
      );

    if (action === "플랜 변경") setShowModal(true);
    else if (action === "차단") handleBlockUsers();
    else if (action === "차단 해제") handleUnblockUsers();
  };

  const handleBlockUsers = () => {
    setUsers((prev) =>
      prev.map((u) =>
        selected.includes(u.id) ? { ...u, status: "차단됨" } : u
      )
    );
    showToast(
      <div onClick={clearToast} className="flex items-center gap-2 text-red-600 font-medium cursor-pointer">
        ⛔ {selected.length}명의 유저가 차단되었습니다.
      </div>,
      3000
    );
    setSelected([]);
  };

  const handleUnblockUsers = () => {
    setUsers((prev) =>
      prev.map((u) =>
        selected.includes(u.id) ? { ...u, status: "활성" } : u
      )
    );
    showToast(
      <div onClick={clearToast} className="flex items-center gap-2 text-green-600 font-medium cursor-pointer">
        ✅ {selected.length}명의 유저가 차단 해제되었습니다.
      </div>,
      3000
    );
    setSelected([]);
  };

  const handlePlanChange = () => {
    setUsers((prev) =>
      prev.map((u) =>
        selected.includes(u.id) ? { ...u, plan: newPlan } : u
      )
    );
    setShowModal(false);
    showToast(
      <div onClick={clearToast} className="flex items-center gap-2 text-gray-700 font-medium cursor-pointer">
        ✅ {selected.length}명의 유저 플랜이{" "}
        <span className="text-[#7E37F9] font-semibold">"{newPlan}"</span>으로 변경되었습니다.
      </div>,
      3000
    );
    setSelected([]);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">유저 관리</h2>

      {/* 🔹 검색 + 필터 */}
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

       {/* 🔹 플랜 필터 (토글 애니메이션 적용) */}
       <div className="relative flex bg-gray-100 rounded-full p-1 w-fit">
         {["전체", "Free", "Pro", "Enterprise"].map((plan) => {
           const isActive = planFilter === plan;
           return (
             <button
               key={plan}
               onClick={() => {
                 setPlanFilter(plan);
                 setPage(1);
               }}
               className={`relative z-10 px-4 py-1.5 text-sm font-medium rounded-full transition-colors duration-200 ${
                 isActive ? "text-[#7E37F9]" : "text-gray-600 hover:text-gray-800"
               }`}
             >
               {isActive && (
                 <motion.div
                   layoutId="active-pill-admin-plan"
                   transition={{
                     type: "spring",
                     stiffness: 400,
                     damping: 30,
                   }}
                   className="absolute inset-0 bg-white shadow-sm rounded-full"
                 />
               )}
               <span className="relative z-10">
                 {plan === "전체" ? "전체 플랜" : plan}
               </span>
             </button>
           );
         })}
       </div>


        <div className="flex gap-2 ml-auto items-center">
          {selected.length > 0 && (
            <p className="text-sm text-gray-500 font-medium mr-1">
              {selected.length}명 선택됨
            </p>
          )}
          {allBlocked ? (
            <button
              onClick={() => handleBulkAction("차단 해제")}
              className="px-3 py-1.5 text-sm bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition"
            >
              차단 해제
            </button>
          ) : (
            <button
              onClick={() => handleBulkAction("차단")}
              className="px-3 py-1.5 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
            >
              유저 차단
            </button>
          )}
          <button
            onClick={() => handleBulkAction("플랜 변경")}
            className="px-3 py-1.5 text-sm bg-[#f5f2fb] text-[#7E37F9] rounded-lg hover:bg-[#ede3ff] transition"
          >
            구독 변경
          </button>
        </div>
      </div>

      {/* 🔹 유저 테이블 */}
      <div className="bg-white shadow rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="text-left border-b bg-gray-50">
            <tr>
              <th className="p-2 w-10 text-center">
                <input
                  type="checkbox"
                  onChange={toggleSelectAll}
                  checked={paginatedUsers.every((u) => selected.includes(u.id))}
                />
              </th>
              <th className="p-2">이름</th>
              <th className="p-2">이메일</th>
              <th className="p-2">상태</th>
              <th className="p-2">플랜</th>
              <th className="p-2">결제</th>
              <th className="p-2">금액</th>
              <th className="p-2">다음 결제일</th>
              <th className="p-2">가입일</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map((user) => (
              <motion.tr
                key={user.id}
                layout
                className={`border-b hover:bg-gray-50 ${
                  selected.includes(user.id) ? "bg-[#F8F5FF]" : ""
                }`}
              >
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={selected.includes(user.id)}
                    onChange={() => toggleSelect(user.id)}
                  />
                </td>
                <td className="p-2">{user.name}</td>
                <td className="p-2">{user.email}</td>
                <td
                  className={`p-2 font-medium ${
                    user.status === "차단됨"
                      ? "text-red-500"
                      : "text-green-600"
                  }`}
                >
                  {user.status}
                </td>
                <td className="p-2">{user.plan}</td>
                <td className="p-2">{user.paymentSuccess ? "✅" : "❌"}</td>
                <td className="p-2">{user.amount}</td>
                <td className="p-2">{user.nextPayment}</td>
                <td className="p-2">{user.joinedAt}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>

        {/* 🔹 페이지네이션 */}
        <div className="flex justify-center items-center gap-2 mt-4">
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

      {/* 🔹 구독 변경 모달 */}
     <AnimatePresence>
       {showModal && (
         <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-50"
         >
           <motion.div
             initial={{ scale: 0.9, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             exit={{ scale: 0.9, opacity: 0 }}
             transition={{ type: "spring", stiffness: 250, damping: 25 }}
             className="bg-white rounded-2xl shadow-xl p-6 w-[380px]"
           >
             <h3 className="text-lg font-semibold mb-3">구독 플랜 변경</h3>
             <p className="text-sm text-gray-600 mb-4">
               선택된 {selected.length}명의 유저에게 적용할 새 플랜을 선택하세요.
             </p>

             {/* ✅ 플랜 선택 */}
             <select
               value={newPlan}
               onChange={(e) => setNewPlan(e.target.value)}
               className="w-full border rounded-lg px-3 py-2 mb-4 text-sm"
             >
               <option value="Free">Free</option>
               <option value="Pro">Pro</option>
               <option value="Enterprise">Enterprise</option>
             </select>

             {/* ✅ Enterprise 전용 입력 필드 */}
             <AnimatePresence>
               {newPlan === "Enterprise" && (
                 <motion.div
                   initial={{ opacity: 0, height: 0 }}
                   animate={{ opacity: 1, height: "auto" }}
                   exit={{ opacity: 0, height: 0 }}
                   transition={{ duration: 0.3 }}
                   className="overflow-hidden"
                 >
                   <div className="flex flex-col gap-3 mb-5">
                     <div>
                       <label className="block text-sm text-gray-600 mb-1">
                         기업명
                       </label>
                       <input
                         type="text"
                         placeholder="예: NoteRi Inc."
                         className="w-full border rounded-lg px-3 py-2 text-sm"
                         onChange={(e) => console.log("기업명:", e.target.value)}
                       />
                     </div>
                     <div>
                       <label className="block text-sm text-gray-600 mb-1">
                         담당자명
                       </label>
                       <input
                         type="text"
                         placeholder="예: 김지원"
                         className="w-full border rounded-lg px-3 py-2 text-sm"
                         onChange={(e) => console.log("담당자명:", e.target.value)}
                       />
                     </div>
                   </div>
                 </motion.div>
               )}
             </AnimatePresence>

             {/* 버튼 */}
             <div className="flex justify-end gap-2">
               <button
                 onClick={() => setShowModal(false)}
                 className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50"
               >
                 취소
               </button>
               <button
                 onClick={() => {
                   handlePlanChange();
                   if (newPlan === "Enterprise") {
                     console.log("🔹 엔터프라이즈 플랜 추가 정보 제출 준비됨");
                   }
                 }}
                 className="px-4 py-1.5 text-sm rounded-lg bg-[#7E37F9] text-white hover:bg-[#692ed9] transition"
               >
                 적용
               </button>
             </div>
           </motion.div>
         </motion.div>
       )}
     </AnimatePresence>

      {/* ✅ 토스트 */}
      <AnimatePresence>
        {toast.visible && (
          <motion.div
            key="admin-toast"
            initial={{ opacity: 0, y: 30, scale: 0.95, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0)" }}
            exit={{ opacity: 0, y: 20, scale: 0.9, filter: "blur(4px)" }}
            transition={{
              duration: 0.4,
              ease: [0.25, 0.8, 0.25, 1],
              type: "spring",
              stiffness: 300,
              damping: 25,
            }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md border border-gray-200 shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-2xl px-6 py-3 z-[9999] cursor-pointer"
            onClick={clearToast}
          >
            {toast.content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
