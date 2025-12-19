import React from "react";
import { motion } from "framer-motion";
import { FaPlus } from "react-icons/fa";

export default function RecordTabs({ 
  tabs, 
  activeTab, 
  setActiveTab,
  onAddTemplate, // 템플릿 추가 핸들러
  onRemoveTab,   // 탭 삭제 핸들러 (선택적)
}) {
  return (
    <div className="relative flex mb-4 bg-gray-100 rounded-full w-fit p-1 gap-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isDynamic = tab.isDynamic; // 동적으로 추가된 탭인지 확인
        
        return (
          <div key={tab.id} className="relative flex items-center">
            <button
              onClick={() => setActiveTab(tab.id)}
              className={`relative z-10 px-4 py-1.5 text-sm font-medium rounded-full transition-colors duration-200 ${
                isActive ? "text-[#7E37F9]" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-pill-newrecord"
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                  className="absolute inset-0 bg-white shadow-sm rounded-full"
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {tab.label}
                {/* 동적 탭에만 X 버튼 표시 */}
                {isDynamic && onRemoveTab && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTab(tab.id);
                    }}
                    className="ml-1 text-gray-400 hover:text-red-500 transition"
                  >
                    ×
                  </button>
                )}
              </span>
            </button>
          </div>
        );
      })}

      {/* + 버튼 */}
      {/* <button
        onClick={onAddTemplate}
        className="relative z-10 px-3 py-1.5 text-sm font-medium rounded-full transition-colors duration-200 text-gray-600 hover:text-[#7E37F9] hover:bg-white"
        title="템플릿 추가"
      >
        <FaPlus size={14} />
      </button> */}
    </div>
  );
}