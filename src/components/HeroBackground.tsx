import React from 'react';
import { motion } from 'framer-motion';

const HeroBackground: React.FC = () => {
  return (
    // 使用 fixed -z-10 确保永远在最底层，且不被父级 overflow 裁剪
    <div className="fixed inset-0 w-full h-full -z-10 bg-black">
      <motion.img 
        // 强制使用网络图作为首选，确保能看到画面
        src="https://images.unsplash.com/photo-1615818967406-30230f3f2a7a?q=80&w=1974&auto=format&fit=crop"
        className="absolute inset-0 w-full h-full object-cover opacity-100" 
        alt="Hero Background"
        initial={{ scale: 1.0 }}
        animate={{ scale: [1.0, 1.05, 1.0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        onError={(e) => {
          // 真正的双重兜底
          console.warn("Background image failed to load");
          const target = e.target as HTMLImageElement;
          target.src = "/assets/role.jpg"; 
        }}
      />
      {/* 氛围渐变，仅在底部加一点点黑，不再遮挡主体 */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
    </div>
  );
};

export default HeroBackground;
