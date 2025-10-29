// src/layouts/MainLayout.jsx
import { Outlet } from "react-router-dom";
import SideNav from "../components/common/SideNav";

export default function MainLayout({ children }) {
    return (
        <div className="flex">
            {/* ✅ 공통 사이드바 */}
            <SideNav />

            {/* ✅ 오른쪽 페이지 내용 */}
            <div className="flex-1 bg-gray-50 min-h-screen">
                {children || <Outlet />}  {/* ✅ children이 있으면 그걸 렌더링 */}
            </div>
        </div>
    );
}
