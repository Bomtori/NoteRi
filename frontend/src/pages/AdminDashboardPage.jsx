export default function AdminDashboardPage() {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold mb-2">대시보드</h2>
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white shadow rounded-xl p-4">
                    <p className="text-sm text-gray-500">총 사용자</p>
                    <h3 className="text-xl font-bold mt-1">123명</h3>
                </div>
                <div className="bg-white shadow rounded-xl p-4">
                    <p className="text-sm text-gray-500">이번 달 매출</p>
                    <h3 className="text-xl font-bold mt-1">₩1,200,000</h3>
                </div>
                <div className="bg-white shadow rounded-xl p-4">
                    <p className="text-sm text-gray-500">활성 세션</p>
                    <h3 className="text-xl font-bold mt-1">8개</h3>
                </div>
            </div>
        </div>
    );
}
