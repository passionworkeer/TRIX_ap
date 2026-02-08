import React from "react";
import { Map, BookOpen, MessageSquare, User, Hexagon } from "lucide-react"; // 使用 Hexagon 或 Aperture 作为核心按钮
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";

export default function GlassDock() {
  const navigate = useNavigate();
  const location = useLocation();

  // 导航配置
  const tabs = [
    { id: "map", icon: Map, path: "/map", label: "地图" },
    { id: "study", icon: BookOpen, path: "/study", label: "自习" },
    { id: "core", icon: Hexagon, path: "/", label: "TRIX", isCore: true }, // 中间核心按钮
    { id: "chat", icon: MessageSquare, path: "/chat", label: "聊天" },
    { id: "profile", icon: User, path: "/profile", label: "个人" },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md z-50">
      {/* 玻璃容器背景 */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl shadow-black/50" />

      {/* 按钮布局 */}
      <div className="relative flex justify-between items-end px-2 py-3 h-20">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const isCore = tab.isCore;

          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`relative flex flex-col items-center justify-end w-1/5 transition-all duration-300 ${
                isCore ? "-top-6" : "" // 核心按钮向上浮动
              }`}
            >
              {/* 核心按钮特殊样式 (赛博发光球体) */}
              {isCore ? (
                <div className="relative group">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 border-[#1a1a1a] transition-all duration-500
                    ${isActive 
                      ? "bg-gradient-to-tr from-[#00FFFF] to-[#00CCFF] shadow-[0_0_30px_rgba(0,255,255,0.6)] scale-110" 
                      : "bg-gray-800 text-white/50 hover:bg-gray-700"
                    }`}
                  >
                    <tab.icon size={28} className={isActive ? "text-black" : "text-white"} />
                  </div>
                </div>
              ) : (
                /* 普通按钮样式 */
                <div className="flex flex-col items-center gap-1 py-2">
                  <tab.icon 
                    size={24} 
                    className={`transition-colors duration-300 ${
                      isActive ? "text-[#00FFFF]" : "text-white/40"
                    }`} 
                  />
                  {/* 选中指示点 */}
                  {isActive && (
                    <motion.div 
                      layoutId="dock-dot"
                      className="w-1 h-1 bg-[#00FFFF] rounded-full mt-1 shadow-[0_0_10px_#00FFFF]"
                    />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
