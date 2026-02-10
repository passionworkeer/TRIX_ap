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
        left: "1.5rem",  // 24px
        right: "1.5rem", // 24px
        margin: "0 auto",
        // 🔥 不再贴底，改为悬浮
        bottom: "2rem", // 32px 距离底部
        // 自适应宽度，最大宽度限制
        maxWidth: "380px",
        height: "68px",
        zIndex: 50, // 确保足够高
        isolation: "isolate",
      }}
    >
      {/* ✨ 高级磨砂玻璃层 - 更强通透感 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          // 🎨 深色半透明玻璃背景
          backgroundColor: "rgba(0, 0, 0, 0.35)",
          // 🌫️ 超强模糊效果
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          // 🔮 完全圆角 - 胶囊岛形状
          borderRadius: "2rem", // 32px
          // 💎 极细白边增加精致感
          border: "1px solid rgba(255, 255, 255, 0.18)",
          // ☁️ 柔和悬浮阴影 - 拒绝黑脏影
          boxShadow: `
            0 8px 32px rgba(0, 0, 0, 0.12),
            0 2px 8px rgba(0, 0, 0, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.1)
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
                    backgroundColor: "rgba(255, 255, 255, 0.15)",
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
                  // 普通图标：高级交互反馈
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <tab.icon
                      size={26}
                      strokeWidth={isActive ? 2.4 : 2}
                      // 🎨 选中白色高亮，未选中半透明
                      color={isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.5)"}
                      style={{
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        // 选中时轻微放大并添加发光
                        transform: isActive ? "scale(1.1)" : "scale(1)",
                        filter: isActive ? "drop-shadow(0 2px 8px rgba(255, 255, 255, 0.4))" : "none",
                      }}
                    />
                    {/* 选中时底部出现发光指示器 */}
                    {isActive && (
                      <motion.div
                        layoutId="dot-indicator"
                        style={{
                          position: 'absolute',
                          bottom: '10px',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: '#FFFFFF',
                          boxShadow: '0 0 8px rgba(255, 255, 255, 0.8)',
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