import React from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Table,
  Presentation,
  Image as ImageIcon,
  Video,
  Sparkles,
} from 'lucide-react';
import type { AIActionId } from '../features/chat/utils/aiPrompt';

interface AIActionSelectorProps {
  value: AIActionId;
  onSelect: (action: AIActionId) => void;
}

const actions: Array<{
  id: AIActionId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconBg: string;
  selectedClass: string;
}> = [
  {
    id: 'chat',
    label: 'AI聊天',
    icon: Sparkles,
    iconBg: 'from-blue-500 to-indigo-600',
    selectedClass:
      'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
  },
  {
    id: 'doc',
    label: 'AI文档',
    icon: FileText,
    iconBg: 'from-cyan-500 to-blue-600',
    selectedClass:
      'border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-200',
  },
  {
    id: 'slide',
    label: 'AI幻灯片',
    icon: Presentation,
    iconBg: 'from-violet-500 to-purple-600',
    selectedClass:
      'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-200',
  },
  {
    id: 'table',
    label: 'AI表格',
    icon: Table,
    iconBg: 'from-emerald-500 to-green-600',
    selectedClass:
      'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
  },
  {
    id: 'image',
    label: 'AI图片',
    icon: ImageIcon,
    iconBg: 'from-fuchsia-500 to-pink-600',
    selectedClass:
      'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-200',
  },
  {
    id: 'video',
    label: 'AI视频',
    icon: Video,
    iconBg: 'from-orange-500 to-amber-600',
    selectedClass:
      'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-200',
  },
];

const AIActionSelector: React.FC<AIActionSelectorProps> = ({ value, onSelect }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
      className="flex gap-2 overflow-x-auto pb-1"
    >
      {actions.map((action) => {
        const Icon = action.icon;
        const isSelected = value === action.id;

        return (
          <motion.button
            key={action.id}
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => onSelect(action.id)}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
              isSelected
                ? action.selectedClass
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800'
            }`}
            aria-pressed={isSelected}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${action.iconBg}`}
            >
              <Icon size={14} className="text-white" />
            </span>
            <span className="whitespace-nowrap">{action.label}</span>
          </motion.button>
        );
      })}
    </motion.div>
  );
};

export default AIActionSelector;
