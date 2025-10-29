import React from "react";

export default function AdminHeader(): JSX.Element {
    const handleLogout = () => {
        localStorage.removeItem("access_token");
        window.location.href = "/login";
    };

    return (
        <header className="h-14 border-b bg-white flex items-center justify-between px-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800">관리자 페이지</h2>

            <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">관리자</span>
                <button onClick={handleLogout} className="text-sm text-[#7E37F9] hover:underline">
                    로그아웃
                </button>
            </div>
        </header>
    );
}
