import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { AppRoutes } from "../types";
import { IMAGES } from "../constants";

// ✅ 1. 绝对路径 (经过验证好用)
const HERO_BG = "/assets/role.jpg";

export default function HeroBackground() {
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState("");

  const greetings = [
    "你来啦，我一直在等你。",
    "今天过得怎么样？",
    "收到一条新情报,要去看看吗？",
    "随时待命，准备出发。",
    "好久不见，有点想你了。",
    "TRIX 系统运转正常，随时可以开始。",
  ];

  useEffect(() => {
    const randomMsg = greetings[Math.floor(Math.random() * greetings.length)];
    setGreeting(randomMsg);
  }, []);

  return (
    <div 
      className="fixed inset-0 w-full h-full overflow-hidden" 
      style={{ 
        zIndex: 0, 
        backgroundColor: '#1a1a1a', // 只有图片加载失败才会看到这个颜色
      }} 
    >
      
      {/* ✅ 2. 图片层：完全复刻“暴力版”的写法，不使用 Tailwind 类名控制尺寸 */}
      <img
        src={HERO_BG}
        alt="Hero Character"
        // 移除 className，防止 Tailwind 样式冲突
        // className="absolute inset-0 w-full h-full object-cover" 
        style={{ 
          // 👇 这些是刚才“暴力版”验证过好用的样式
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',   // 保持比例铺满
          objectPosition: 'center 20%', // 调整人物位置
          display: 'block',     // 强制显示
          opacity: 1,           // 强制不透明
          zIndex: 1,
        }}
        onError={(e) => console.error("❌ 图片加载失败:", HERO_BG)}
      />

      {/* 3. 渐变遮罩 (美化) */}
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), transparent, rgba(0,0,0,0.6))',
          zIndex: 2 
        }}
      />

      {/* 4. 气泡组件 (功能层) - 最高层级确保可点击 */}
      <AnimatePresence>
        {greeting && (
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              navigate(AppRoutes.CHAT_DETAIL, {
                state: {
                  name: 'TRIX Bot',
                  avatar: IMAGES.WIZARD_BOY,
                  isBot: true,
                  friendId: 'clawbot'
                }
              });
            }}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: 0.5, duration: 0.8, type: "spring" } }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              position: "absolute",
              top: "10%",
              right: "5%",
              maxWidth: 260,
              zIndex: 9999,
              cursor: "pointer",
            }}
            className="group flex items-start gap-3 p-4 text-left"
          >
            <motion.div
              className="relative bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl p-4 shadow-xl"
              animate={{ y: [0, -4, 0] }}
              transition={{ delay: 1.2, duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <p className="text-white/95 text-sm font-medium leading-relaxed drop-shadow-md">
                {greeting}
              </p>
              <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-white/20 border-b border-l border-white/30 rotate-45 transform translate-x-full" />
              <div className="absolute -bottom-6 right-0 text-[10px] text-white/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <span>点击回复</span>
                <MessageCircle size={10} />
              </div>
            </motion.div>
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-2 h-2 bg-[#00FFFF] rounded-full shadow-[0_0_10px_#00FFFF] mt-2"
            />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}