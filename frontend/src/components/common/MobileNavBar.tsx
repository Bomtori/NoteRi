// src/components/common/MobileNavBar.tsx
import { FaRegCalendarAlt } from "react-icons/fa";
import { BsChatDots } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import { showMessenger } from "../../lib/channelTalk";

export default function MobileNavBar({
    active,
    onCalendarClick
}: {
    active: "note" | "calendar" | "chat" | "my";
    onCalendarClick?: () => void;
}) {
    const navigate = useNavigate();

    const itemClass = (name: string) =>
        `flex flex-col items-center gap-1 ${
            active === name ? "text-[#7E37F9]" : "text-gray-400"
        }`;

    const iconClass = (name: string) =>
        `w-6 h-6 ${
            active === name ? "text-[#7E37F9]" : "text-gray-400"
        }`;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 lg:hidden">
            <div className="flex justify-around py-3">

                {/* 노트 */}
                <button className={itemClass("note")} onClick={() => navigate("/")}>
                    <svg className={iconClass("note")} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                    </svg>
                    <span className="text-xs">노트</span>
                </button>

                {/* 일정 */}
                <button
                    className={itemClass("calendar")}
                    onClick={onCalendarClick}
                >
                    <FaRegCalendarAlt className={iconClass("calendar")} />
                    <span className="text-xs">일정</span>
                </button>

                {/* 문의 */}
                <button
                    className={itemClass("chat")}
                    onClick={() => showMessenger()}
                >
                    <BsChatDots className={iconClass("chat")} />
                    <span className="text-xs">문의</span>
                </button>

                {/* 마이페이지 */}
                <button
                    className={itemClass("my")}
                    onClick={() => navigate("/user")}
                >
                    <svg className={iconClass("my")} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.33 0-10 1.667-10 5v2h20v-2c0-3.333-6.67-5-10-5z"/>
                    </svg>
                    <span className="text-xs">마이</span>
                </button>
            </div>
        </div>
    );
}
