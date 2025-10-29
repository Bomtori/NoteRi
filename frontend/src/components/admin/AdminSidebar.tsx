import React from "react";
import { NavLink } from "react-router-dom";
import { FiHome, FiUsers, FiSettings } from "react-icons/fi";

export default function AdminSidebar(): JSX.Element {
    return (
        <aside className="w-64 bg-white border-r shadow-sm flex flex-col justify-between">
            <div className="p-4">
                <h1 className="text-xl font-bold text-[#7E37F9] mb-6">NoteRi Admin</h1>
                <nav className="flex flex-col gap-2">
                    <NavLink
                        to="/admin"
                        end
                        className={({ isActive }) =>
                            `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                                isActive ? "bg-[#f5f2fb] text-[#7E37F9] font-semibold" : "text-gray-600 hover:bg-gray-50"
                            }`
                        }
                    >
                        <FiHome /> 대시보드
                    </NavLink>

                    <NavLink
                        to="/admin/users"
                        className={({ isActive }) =>
                            `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                                isActive ? "bg-[#f5f2fb] text-[#7E37F9] font-semibold" : "text-gray-600 hover:bg-gray-50"
                            }`
                        }
                    >
                        <FiUsers /> 유저 관리
                    </NavLink>

                    <NavLink
                        to="/admin/settings"
                        className={({ isActive }) =>
                            `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                                isActive ? "bg-[#f5f2fb] text-[#7E37F9] font-semibold" : "text-gray-600 hover:bg-gray-50"
                            }`
                        }
                    >
                        <FiSettings /> 시스템 설정
                    </NavLink>
                </nav>
            </div>

            <div className="border-t p-4 bg-gray-50 flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-700">관리자</p>
                </div>
                <button
                    onClick={() => {
                        localStorage.removeItem("access_token");
                        window.location.href = "/login";
                    }}
                    className="text-xs text-[#7E37F9] hover:underline"
                >
                    로그아웃
                </button>
            </div>
        </aside>
    );
}
