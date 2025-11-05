import * as React from "react";
import { motion } from "framer-motion";

type TabItem = { id: string; label: string };

interface AdminToggleTabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
  layoutId?: string;
  /** sm: 더 촘촘한 패딩/폰트, md: 기본 */
  size?: "sm" | "md";
}

export default function AdminToggleTabs({
  tabs,
  active,
  onChange,
  className = "",
  layoutId = "active-pill-admin",
  size = "md",
}: AdminToggleTabsProps) {
  const wrapBase =
    "relative flex w-fit rounded-full p-1 bg-gray-100 dark:bg-gray-800";
  const btnBase =
    "relative z-10 rounded-full transition-colors duration-200 font-medium";

  const btnSize =
    size === "sm"
      ? "px-3 py-1 text-xs" // ← 작은 사이즈
      : "px-4 py-1.5 text-sm"; // ← 기본 사이즈

  return (
    <div role="tablist" aria-label="Admin tabs" className={`${wrapBase} ${className}`}>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`${btnBase} ${btnSize} ${
              isActive
                ? "text-[#7E37F9]"
                : "text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="absolute inset-0 rounded-full bg-white shadow-sm dark:bg-gray-900"
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
