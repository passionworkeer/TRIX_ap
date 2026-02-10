import React from "react";
import { IMAGES } from "../constants";

// ✅ 绝对路径
const HERO_BG = "/assets/role.jpg";

export default function HeroBackground() {
  return (
    <div 
      className="fixed inset-0 w-full h-full overflow-hidden" 
      style={{ 
        zIndex: 0, 
        backgroundColor: '#1a1a1a',
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
    </div>
  );
}