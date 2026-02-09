import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { AppRoutes } from "../types";
import { IMAGES } from "../constants";
import roleImg from "../assets/role.jpg";

export default function HeroBackground() {
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState("");

  // 语录库：模拟角色的语气
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
      data-hero-background="true"
      className="fixed inset-0 w-full h-full overflow-hidden" 
      style={{ 
        zIndex: 1,  // 低于滚动层(10)
        backgroundColor: '#1a1a1a',
        isolation: 'isolate',
        transform: 'translateZ(0)',
        willChange: 'transform'  // 优化渲染性能
      }}
    >
      
      {/* 背景底图 */}
      <img
        src={roleImg}
        alt="Hero Character"
        onError={(e) => console.error("Hero image failed to load", e)}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ 
          objectPosition: 'center 20%', 
          zIndex: 1,
          pointerEvents: 'none',
          display: 'block'
        }}
      />

      {/* 黑色渐变遮罩 */}
      <div 
        className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" 
        style={{ zIndex: 2, pointerEvents: 'none' }} 
      />

      {/* 悬浮对话气泡 (Companion Bubble) */}
      <AnimatePresence>
        {greeting && (
          <motion.button
            onClick={() => navigate(AppRoutes.CHAT_DETAIL, { 
              state: { 
                name: 'TRIX Bot', 
                avatar: IMAGES.WIZARD_BOY, 
                isBot: true, 
                friendId: 'clawbot' 
              } 
            })}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: 0.5, duration: 0.8, type: "spring" } }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              position: "absolute",
              top: "15%",
              right: "10%",
              maxWidth: 240,
              zIndex: 30,
            }}
            className="group flex items-start gap-3 p-4 text-left"
          >
            {/* 气泡本体：毛玻璃效果，带轻微呼吸动画 */}
            <motion.div
              className="relative bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl p-4 shadow-xl"
              animate={{ y: [0, -4, 0] }}
              transition={{ delay: 1.2, duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <p className="text-white/95 text-sm font-medium leading-relaxed drop-shadow-md">
                {greeting}
              </p>

              {/* 装饰小三角 (指向人物) */}
              <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-white/20 border-b border-l border-white/30 rotate-45 transform translate-x-full" />

              {/* 点击提示 (Hover 时显示) */}
              <div className="absolute -bottom-6 right-0 text-[10px] text-white/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <span>点击回复</span>
                <MessageCircle size={10} />
              </div>
            </motion.div>

            {/* 装饰光点 */}
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
