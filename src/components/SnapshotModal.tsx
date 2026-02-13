import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera } from "lucide-react";

interface SnapshotModalProps {
  isOpen: boolean;
  onImageSelect: (imageUri: string) => void;
  onImageCaptured?: (imageUri: string) => void; // 新增：图片选择后的回调
}

// 模拟最近相册的缩略图数据
const recentThumbnails = [
  { id: 1, color: "from-pink-400 to-rose-500" },
  { id: 2, color: "from-purple-400 to-indigo-500" },
  { id: 3, color: "from-cyan-400 to-blue-500" },
];

const SnapshotModal: React.FC<SnapshotModalProps> = ({
  isOpen,
  onImageSelect,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [hoveredThumb, setHoveredThumb] = useState<number | null>(null);

  // 处理文件选择（相册）
  const handleGalleryClick = () => {
    fileInputRef.current?.click();
  };

  // 处理相机点击
  const handleCameraClick = () => {
    // 在移动端，使用 capture 属性调用相机
    // 在桌面端，打开文件选择器
    cameraInputRef.current?.click();
  };

  // 处理文件选择完成
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUri = URL.createObjectURL(file);
      onImageSelect(imageUri);
    }
    // 重置 input 值，允许重复选择同一文件
    e.target.value = '';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 快拍卡片 - 与 GlassDock 同层级，位于其上方 */}
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 25,
              mass: 0.8,
            }}
            style={{
              // 与 GlassDock 相同的定位方式
              position: "fixed",
              left: "1.5rem",
              right: "1.5rem",
              margin: "0 auto",
              // 位于导航栏上方（导航栏 bottom: 2rem, height: 68px）
              bottom: "calc(2rem + 76px)",
              maxWidth: "380px",
              zIndex: 50,
            }}
          >
            {/* 隐藏的文件输入 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* 卡片容器 - 毛玻璃效果 */}
            <div
              className="relative overflow-hidden rounded-3xl p-5"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.65) 100%)",
                backdropFilter: "blur(25px) saturate(200%)",
                WebkitBackdropFilter: "blur(25px) saturate(200%)",
                border: "1px solid rgba(255,255,255,0.6)",
                boxShadow: `
                  0 25px 50px -12px rgba(0, 0, 0, 0.25),
                  0 0 0 1px rgba(255, 255, 255, 0.4) inset,
                  0 1px 0 rgba(255, 255, 255, 0.8) inset
                `,
              }}
            >
              {/* 顶部装饰线 */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-gray-300/50 rounded-full mt-2" />

              {/* 主内容区域 */}
              <div className="flex items-center gap-4 mt-2">
                {/* 左侧内容 */}
                <div className="flex-1 flex flex-col gap-4">
                  {/* 标题区域 */}
                  <div>
                    <h2 className="text-xl font-bold text-gray-800 tracking-tight">
                      快拍功能
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      拍照或选图发送
                    </p>
                  </div>

                  {/* 缩略图区域 - 可点击唤起相册 */}
                  <div
                    className="flex items-center cursor-pointer group"
                    onClick={handleGalleryClick}
                  >
                    <div className="flex -space-x-2.5">
                      {recentThumbnails.map((thumb, index) => (
                        <motion.div
                          key={thumb.id}
                          initial={false}
                          animate={{
                            scale: hoveredThumb === index ? 1.15 : 1,
                            zIndex: hoveredThumb === index ? 10 : 3 - index,
                          }}
                          whileHover={{ scale: 1.15, zIndex: 10 }}
                          onHoverStart={() => setHoveredThumb(index)}
                          onHoverEnd={() => setHoveredThumb(null)}
                          className={`w-9 h-9 rounded-full bg-gradient-to-br ${thumb.color} border-2 border-white shadow-md flex items-center justify-center`}
                          style={{
                            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                          }}
                        >
                          <span className="text-[8px] text-white font-medium opacity-80">
                            {index + 1}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                    <span className="ml-3 text-xs text-gray-500 group-hover:text-gray-700 transition-colors">
                      从相册选择
                    </span>
                  </div>
                </div>

                {/* 右侧 - 拟物化摄像头镜头按钮 */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCameraClick}
                  className="relative w-24 h-24 flex-shrink-0"
                >
                  {/* 镜头外圈 - 金属质感 */}
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `
                        linear-gradient(145deg, #e6e6e6 0%, #c0c0c0 50%, #a0a0a0 100%)
                      `,
                      boxShadow: `
                        0 8px 24px rgba(0,0,0,0.25),
                        0 2px 4px rgba(0,0,0,0.15),
                        inset 0 1px 1px rgba(255,255,255,0.8),
                        inset 0 -1px 1px rgba(0,0,0,0.1)
                      `,
                    }}
                  />

                  {/* 镜头内圈 - 黑色边框 */}
                  <div
                    className="absolute inset-1.5 rounded-full"
                    style={{
                      background: `
                        linear-gradient(145deg, #2a2a2a 0%, #1a1a1a 100%)
                      `,
                      boxShadow: `
                        inset 0 2px 4px rgba(0,0,0,0.5),
                        0 1px 0 rgba(255,255,255,0.1)
                      `,
                    }}
                  />

                  {/* 镜头镜片 - 蓝色反光效果 */}
                  <div
                    className="absolute inset-3 rounded-full overflow-hidden"
                    style={{
                      background: `
                        radial-gradient(circle at 30% 30%, rgba(100,150,255,0.4) 0%, rgba(50,100,200,0.2) 40%, rgba(20,50,100,0.6) 100%)
                      `,
                      boxShadow: `
                        inset 0 0 20px rgba(0,0,0,0.5),
                        0 1px 0 rgba(255,255,255,0.1)
                      `,
                    }}
                  >
                    {/* 镜片反光 */}
                    <div
                      className="absolute top-2 left-2 w-6 h-4 rounded-full opacity-60"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 100%)",
                        transform: "rotate(-45deg)",
                      }}
                    />
                    <div
                      className="absolute bottom-3 right-3 w-3 h-2 rounded-full opacity-30"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(100,200,255,0.6) 0%, rgba(100,200,255,0) 100%)",
                      }}
                    />
                  </div>

                  {/* 相机图标 */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Camera
                      size={28}
                      className="text-white/90 drop-shadow-lg"
                      strokeWidth={1.5}
                    />
                  </div>

                  {/* 点击时的闪光效果层 */}
                  <motion.div
                    className="absolute inset-0 rounded-full bg-white"
                    initial={{ opacity: 0 }}
                    whileTap={{ opacity: 0.4 }}
                    transition={{ duration: 0.1 }}
                    style={{ pointerEvents: "none" }}
                  />
                </motion.button>
              </div>

              {/* 底部装饰 */}
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="w-1 h-1 rounded-full bg-gray-400/50" />
                <div className="w-1 h-1 rounded-full bg-gray-400/30" />
                <div className="w-1 h-1 rounded-full bg-gray-400/50" />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SnapshotModal;
