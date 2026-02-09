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
        // 物理居中方案：避免 translateX 的亚像素偏移
        left: 0,
        right: 0,
        margin: "0 auto",
        // 适配 iPhone 底部安全区域 (Home Indicator)
        bottom: "calc(2rem + env(safe-area-inset-bottom, 0px))",
        width: "88%",
        maxWidth: "360px",
        height: "64px",
        zIndex: 9999,
        isolation: "isolate",
      }}
    >
      {/* ✨ 纯净磨砂玻璃层 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          // 回归高透白色，干净清爽
          backgroundColor: "rgba(255, 255, 255, 0.75)",
          // 适度模糊，保持通透感
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: "40px", // 极润的胶囊形
          // 极细微的白边，增加精致感
          border: "0.5px solid rgba(255, 255, 255, 0.5)",
          // 极柔和的阴影，让它轻轻浮起来，拒绝黑脏影
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.05)",
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
              <div style={{ position: "relative", zIndex: 1 }}>
                {tab.isCore ? (
                  // 🌞 核心按钮：扁平化、高饱和度的活力橙色
                  <motion.div
                    whileTap={{ scale: 0.92 }}
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "50%",
                      // 放弃复杂的3D渐变，使用纯净、吸睛的暖橙色
                      backgroundColor: "#FF9F1C",
                      // 同色系的柔和发光，而不是黑色阴影
                      boxShadow: "0 6px 16px rgba(255, 159, 28, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "24px", // 适度上浮
                      border: "3px solid #FFFFFF", // 纯白描边，与背景隔绝
                    }}
                  >
                    <tab.icon size={24} color="white" strokeWidth={2} />
                  </motion.div>
                ) : (
                  // 普通图标：极简风格，无文字
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <tab.icon
                      size={24}
                      strokeWidth={isActive ? 2.2 : 1.8}
                      // 选中纯黑，未选中中灰色
                      color={isActive ? "#1A1A1A" : "#A0A0A5"}
                      style={{
                        transition: "all 0.2s ease",
                        // 选中时轻微放大
                        transform: isActive ? "scale(1.08)" : "scale(1)",
                      }}
                    />
                    {/* 选中时底部出现一个小黑点指示器，替代文字 */}
                    {isActive && (
                      <motion.div
                        layoutId="dot-indicator"
                        style={{
                          position: 'absolute',
                          bottom: '-8px',
                          width: '4px',
                          height: '4px',
                          borderRadius: '50%',
                          backgroundColor: '#1A1A1A'
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