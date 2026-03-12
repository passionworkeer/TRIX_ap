import { Map, BookOpen, Camera, MessageSquare, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  iosFloatingMotion,
  iosIconButtonMotion,
  iosPressableMotion,
  iosQuickSpring,
} from "../utils/iosMotion";

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
    <motion.nav
      role="navigation"
      aria-label="主导航"
      onClick={(e) => e.stopPropagation()}
      {...iosFloatingMotion}
      style={{
        position: "fixed",
        left: "1.25rem",
        right: "1.25rem",
        margin: "0 auto",
        bottom: "1.75rem",
        maxWidth: "392px",
        height: "72px",
        zIndex: 50,
        isolation: "isolate",
      }}
    >
      <div
        className="ios-glass-surface"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "2rem",
          boxShadow: `
            0 22px 44px rgba(15, 23, 42, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.78),
            inset 0 -1px 0 rgba(255, 255, 255, 0.16)
          `,
          zIndex: -1,
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: "100%",
          padding: "0 14px",
          gap: "2px",
        }}
      >
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;

          return (
            <motion.button
              key={tab.id}
              type="button"
              onClick={() => navigate(tab.path)}
              aria-label={tab.isCore ? "首页" : `${tab.id}`}
              aria-current={isActive ? "page" : undefined}
              data-active={isActive}
              {...(tab.isCore ? iosIconButtonMotion : iosPressableMotion)}
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
              className={`ios-pressable group rounded-[1.55rem] ${tab.isCore ? "overflow-visible" : ""}`}
            >
              {isActive && !tab.isCore && (
                <motion.div
                  layoutId="active-glow"
                  className="ios-pill-indicator"
                  style={{
                    position: "absolute",
                    inset: "10px 8px",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.38))",
                    border: "1px solid rgba(255,255,255,0.62)",
                    boxShadow:
                      "0 10px 24px rgba(148, 163, 184, 0.18), inset 0 1px 0 rgba(255,255,255,0.72)",
                    borderRadius: "18px",
                    zIndex: 0,
                  }}
                  transition={iosQuickSpring}
                />
              )}

              <div style={{ position: "relative", zIndex: 1 }}>
                {tab.isCore ? (
                  <motion.div
                    className="ios-pill-indicator"
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.24), rgba(255,255,255,0.04)), linear-gradient(135deg, #60a5fa 0%, #4f46e5 52%, #7c3aed 100%)",
                      boxShadow: `
                        0 14px 30px rgba(79, 70, 229, 0.34),
                        0 6px 14px rgba(59, 130, 246, 0.2),
                        inset 0 1px 0 rgba(255, 255, 255, 0.36)
                      `,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "24px",
                      border: "1px solid rgba(255, 255, 255, 0.34)",
                    }}
                  >
                    <tab.icon size={24} color="white" strokeWidth={2.45} />
                  </motion.div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <tab.icon
                      size={26}
                      strokeWidth={isActive ? 2.35 : 2.05}
                      color={isActive ? "#1e293b" : "#94a3b8"}
                      style={{
                        transition: "all 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
                        transform: isActive ? "scale(1.08) translateY(-1px)" : "scale(1)",
                        filter: isActive
                          ? "drop-shadow(0 4px 10px rgba(15, 23, 42, 0.16))"
                          : "none",
                      }}
                    />
                    {isActive && (
                      <motion.div
                        layoutId="dot-indicator"
                        style={{
                          position: "absolute",
                          bottom: "10px",
                          width: "18px",
                          height: "4px",
                          borderRadius: "999px",
                          background:
                            "linear-gradient(90deg, rgba(59,130,246,0.85), rgba(99,102,241,0.72))",
                          boxShadow: "0 0 12px rgba(99, 102, 241, 0.3)",
                        }}
                        transition={iosQuickSpring}
                      />
                    )}
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
}
