import React from "react";
import { Map, BookOpen, Camera, MessageSquare, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

export default function GlassDock() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: "map", icon: Map, path: "/map" },
    { id: "study", icon: BookOpen, path: "/study" },
    { id: "core", icon: Camera, path: "/", isCore: true },
    { id: "chat", icon: MessageSquare, path: "/chat" },
    { id: "profile", icon: User, path: "/profile" },
  ];

  return (
    <motion.div
      // iOS 风格的弹性进出动画
      initial={{ y: 150, opacity: 0, scale: 0.9 }}
      animate={{ 
        y: 0, 
        opacity: 1, 
        scale: 1,
        transition: {
          type: "spring",
          stiffness: 300,
          damping: 25,
          mass: 0.8
        }
      }}
      exit={{ 
        y: 150, 
        opacity: 0, 
        scale: 0.9,
        transition: {
          type: "spring",
          stiffness: 400,
          damping: 30
        }
      }}
      style={{
        position: "fixed",
        // 🏝️ 悬浮岛风格 - 左右留空
        left: "1.5rem",
        right: "1.5rem",
        margin: "0 auto",
        // 🔥 悬浮位置
        bottom: "2rem",
        maxWidth: "380px",
        height: "68px",
        zIndex: 50, // Layer 50: 悬浮交互层
        isolation: "isolate",
      }}
    >
      {/* ✨ 平衡的磨砂玻璃层 - 既清晰又不遮挡背景 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          // 🎨 适度不透明白色 - 保持通透感
          backgroundColor: "rgba(255, 255, 255, 0.75)",
          // 🌫️ 超强模糊保证可读性
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          // 🔮 完全圆角
          borderRadius: "2rem",
          // 💎 细边框
          border: "0.5px solid rgba(255, 255, 255, 0.6)",
          // ☁️ 适度阴影
          boxShadow: `
            0 12px 40px rgba(0, 0, 0, 0.15),
            0 4px 12px rgba(0, 0, 0, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.8)
          `,
          zIndex: -1,
        }}
      />

      {/* 按钮布局 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: "100%",
          padding: "0 16px",
        }}
      >
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;

          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              style={{
                position: "relative",
                flex: 1,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {/* 🌟 选中状态背景光晕 */}
              {isActive && !tab.isCore && (
                <motion.div
                  layoutId="active-glow"
                  style={{
                    position: "absolute",
                    inset: "12px",
                    backgroundColor: "rgba(55, 65, 81, 0.06)",
                    borderRadius: "16px",
                    zIndex: 0,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 30
                  }}
                />
              )}
              
              <div style={{ position: "relative", zIndex: 1 }}>
                {tab.isCore ? (
                  // 🌞 核心按钮：升级为发光宝石效果
                  <motion.div
                    whileTap={{ scale: 0.92 }}
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "50%",
                      // 🎨 高级渐变背景 - 蓝紫色宝石
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      // 💎 多层阴影 - 发光宝石效果
                      boxShadow: `
                        0 0 20px rgba(102, 126, 234, 0.6),
                        0 0 40px rgba(118, 75, 162, 0.4),
                        0 4px 16px rgba(0, 0, 0, 0.2),
                        inset 0 1px 0 rgba(255, 255, 255, 0.3)
                      `,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "24px",
                      border: "2px solid rgba(255, 255, 255, 0.4)",
                      // 添加微妙的脉冲动画
                      animation: "glow-pulse 3s ease-in-out infinite",
                    }}
                  >
                    <tab.icon size={24} color="white" strokeWidth={2.5} />
                  </motion.div>
                ) : (
                  // 普通图标：清晰可见
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <tab.icon
                      size={26}
                      strokeWidth={isActive ? 2.4 : 2}
                      // 🎨 深色确保清晰，但不过分厚重
                      color={isActive ? "#374151" : "#9CA3AF"}
                      style={{
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        transform: isActive ? "scale(1.1)" : "scale(1)",
                        filter: isActive ? "drop-shadow(0 2px 4px rgba(55, 65, 81, 0.2))" : "none",
                      }}
                    />
                    {/* 选中指示器 */}
                    {isActive && (
                      <motion.div
                        layoutId="dot-indicator"
                        style={{
                          position: 'absolute',
                          bottom: '10px',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: '#374151',
                          boxShadow: '0 0 6px rgba(55, 65, 81, 0.4)',
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 35
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}