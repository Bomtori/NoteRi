// // src/layouts/MainLayout.jsx
// import { Outlet } from "react-router-dom";
// import SideNav from "../components/common/SideNav";

// export default function MainLayout({ children }) {
//     return (
//         <div className="flex">
//             {/* ✅ 공통 사이드바 */}
//             <SideNav />

//             {/* ✅ 오른쪽 페이지 내용 */}
//             <div className="flex-1 bg-gray-50 min-h-screen">
//                 {children || <Outlet />}  {/* ✅ children이 있으면 그걸 렌더링 */}
//             </div>
//         </div>
//     );
// }
import { Outlet } from "react-router-dom";
import { useState } from "react";
import SideNav from "../components/common/SideNav";

export default function MainLayout({ children }) {
  const [isSideNavOpen, setIsSideNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* SideNav */}
      <SideNav 
        isOpen={isSideNavOpen} 
        onClose={() => setIsSideNavOpen(false)} 
      />

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-y-auto relative">

        {children || <Outlet />}
      </main>
    </div>
  );
}