import React from "react";
import { motion } from "framer-motion";

export default function RecordTabs({ tabs, activeTab, setActiveTab }) {
  return (
    <div className="relative flex mb-4 bg-gray-100 rounded-full w-fit p-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
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
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
