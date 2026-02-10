import React from "react";
import heroVideo from "../assets/role_video.mp4";

// 视频路径 (通过 import 导入,Vite 会自动处理)
const HERO_VIDEO = heroVideo;

export default function HeroBackground() {
  return (
    <div 
      className="fixed inset-0 w-full h-full overflow-hidden" 
      style={{ 
        zIndex: 0, 
        backgroundColor: '#1a1a1a',
      }} 
    >
      
      {/* 视频层：循环播放背景视频 */}
      <video
        src={HERO_VIDEO}
        autoPlay
        loop
        muted
        playsInline
        // 移除 className，防止 Tailwind 样式冲突
        // className="absolute inset-0 w-full h-full object-cover" 
        style={{ 
          // 视频全屏覆盖样式
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',   // 保持比例铺满
          objectPosition: 'center', // 视频居中显示
          display: 'block',     // 强制显示
          opacity: 1,           // 强制不透明
          zIndex: 1,
        }}
        onError={(e) => console.error("❌ 视频加载失败:", HERO_VIDEO)}
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