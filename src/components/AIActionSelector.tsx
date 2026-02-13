import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Table, Presentation, Image as ImageIcon, Video, Sparkles } from 'lucide-react';

interface AIActionSelectorProps {
  onSelect: (action: string) => void;
}

const AIActions = [
  {
    id: 'chat',
    label: 'AI聊天',
    icon: Sparkles,
    bgColor: '#E6F0FF',
    iconBg: 'from-blue-500 to-indigo-600',
    textColor: '#0066CC'
  },
  {
    id: 'doc',
    label: 'AI文档',
    icon: FileText,
    bgColor: '#E6F0FF',
    iconBg: 'from-blue-500 to-indigo-600',
    textColor: '#0066CC'
  },
  {
    id: 'slide',
    label: 'AI幻灯片',
    icon: Presentation,
    bgColor: '#F3E6FF',
    iconBg: 'from-purple-500 to-purple-600',
    textColor: '#9333EA'
  },
  {
    id: 'table',
    label: 'AI表格',
    icon: Table,
    bgColor: '#E6F7EE',
    iconBg: 'from-green-500 to-green-600',
    textColor: '#00A854'
  },
  {
    id: 'image',
    label: 'AI图片',
    icon: ImageIcon,
    bgColor: '#F3E6FF',
    iconBg: 'from-purple-500 to-pink-600',
    textColor: '#9333EA'
  },
  {
    id: 'video',
    label: 'AI视频',
    icon: Video,
    bgColor: '#FFF5E6',
    iconBg: 'from-orange-500 to-orange-600',
    textColor: '#FF8C00'
  },
];

const AIActionSelector: React.FC<AIActionSelectorProps> = ({ onSelect }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="flex gap-2 overflow-x-auto pb-1"
    >
      {AIActions.map((action) => {
        const Icon = action.icon;

        return (
          <motion.button
            key={action.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(action.id)}
            className="flex-shrink-0 flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-gray-200 transition-all hover:border-gray-300"
            style={{ backgroundColor: action.bgColor }}
          >
            {/* 图标 */}
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${action.iconBg} flex items-center justify-center`}>
              <Icon size={16} className="text-white" />
            </div>

            {/* 标签 */}
            <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: action.textColor }}>
              {action.label}
            </span>
          </motion.button>
        );
      })}
    </motion.div>
  );
};

export default AIActionSelector;
