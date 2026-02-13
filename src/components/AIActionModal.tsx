import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Table, Presentation, Image as ImageIcon, Video, Sparkles, Check } from 'lucide-react';

interface AIActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (action: string) => void;
}

const AIActions = [
  {
    id: 'chat',
    label: 'AI 聊天',
    icon: Sparkles,
    color: 'from-blue-500 to-indigo-600',
    bgColor: '#E6F0FF',
    textColor: '#0066CC'
  },
  {
    id: 'doc',
    label: 'AI 文档',
    icon: FileText,
    color: 'from-blue-500 to-indigo-600',
    bgColor: '#E6F0FF',
    textColor: '#0066CC'
  },
  {
    id: 'slide',
    label: 'AI 幻灯片',
    icon: Presentation,
    color: 'from-purple-500 to-purple-600',
    bgColor: '#F3E6FF',
    textColor: '#9333EA'
  },
  {
    id: 'table',
    label: 'AI 表格',
    icon: Table,
    color: 'from-green-500 to-green-600',
    bgColor: '#E6F7EE',
    textColor: '#00A854'
  },
  {
    id: 'image',
    label: 'AI 图片',
    icon: ImageIcon,
    color: 'from-purple-500 to-pink-600',
    bgColor: '#F3E6FF',
    textColor: '#9333EA'
  },
  {
    id: 'video',
    label: 'AI 视频',
    icon: Video,
    color: 'from-orange-500 to-orange-600',
    bgColor: '#FFF5E6',
    textColor: '#FF8C00'
  },
];

const AIActionModal: React.FC<AIActionModalProps> = ({
  isOpen,
  onClose,
  onSelect
}) => {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const handleSelect = (action: string) => {
    setSelectedAction(action);
    setTimeout(() => {
      onSelect(action);
      setSelectedAction(null);
    }, 200); // 延迟关闭，让用户看到点击效果
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 - 点击可关闭 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          />

          {/* 功能选择卡片 - 底部弹出 */}
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{
              type: "spring",
              stiffness: 350,
              damping: 30,
              mass: 0.8,
            }}
            style={{
              position: 'fixed',
              left: '50%',
              bottom: '120px', // 在输入框上方，增加一些间距
              transform: 'translateX(-50%)',
              zIndex: 41,
              width: '90%',
              maxWidth: '420px'
            }}
          >
            {/* 卡片容器 - 毛玻璃效果 */}
            <div
              className="relative overflow-hidden rounded-3xl p-5 shadow-2xl"
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                border: "1px solid rgba(255, 255, 255, 0.5)",
              }}
            >
              {/* 标题 */}
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold text-gray-800">
                  选择 AI 功能
                </h2>
              </div>

              {/* 功能网格 - 2列 */}
              <div className="grid grid-cols-3 gap-3">
                {AIActions.map((action) => {
                  const Icon = action.icon;
                  const isSelected = selectedAction === action.id;

                  return (
                    <motion.button
                      key={action.id}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSelect(action.id)}
                      className={`
                        relative p-3 rounded-2xl border-2 transition-all duration-200
                        flex flex-col items-center gap-2
                        ${isSelected ? 'border-gray-300 shadow-md' : 'border-transparent hover:border-gray-200'}
                      `}
                      style={{
                        backgroundColor: isSelected ? action.bgColor : '#FFFFFF',
                        boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.1)' : undefined
                      }}
                    >
                      {/* 图标 */}
                      <div className={`
                        w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center
                        ${action.color}
                      `}>
                        {isSelected ? (
                          <Check size={20} className="text-white" />
                        ) : (
                          <Icon size={20} className="text-white" />
                        )}
                      </div>

                      {/* 标签 */}
                      <span className={`
                        text-xs font-medium
                      `} style={{ color: isSelected ? action.textColor : '#666666' }}>
                        {action.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* 底部取消按钮 */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                <button
                  onClick={onClose}
                  className="w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-all"
                >
                  取消
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AIActionModal;
