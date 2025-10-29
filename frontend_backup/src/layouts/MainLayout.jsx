// src/layouts/MainLayout.jsx
import { Outlet } from "react-router-dom";
import SideNav from "../components/common/SideNav";

export default function MainLayout() {
    return (
        <div className="flex">
            {/* ✅ 공통 사이드바 (한 번만 렌더링) */}
            <SideNav />

            {/* ✅ 오른쪽 페이지 내용 */}
            <div className="flex-1 bg-gray-50 min-h-screen">
                <Outlet /> {/* 각 페이지의 콘텐츠가 여기에 렌더링됨 */}
            </div>
        </div>
    );
}
