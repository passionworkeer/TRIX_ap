/**
 * 成就面板组件 — Achievements Panel
 *
 * 显示用户所有成就（已解锁 + 未解锁），稀有度分级着色
 * 数据来源: achievementService.getUserAchievements(userId)
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Lock, Star } from 'lucide-react';
import { achievementService } from '../services/achievementService';
import type { Achievement } from '../types/achievement';
import { getAchievementColor, getAchievementBgColor } from '../types/achievement';

interface AchievementsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

interface GroupedAchievements {
  unlocked: Achievement[];
  locked: Achievement[];
}

function groupByUnlock(achievements: Achievement[]): GroupedAchievements {
  return achievements.reduce(
    (acc, a) => {
      if (a.unlockedAt) {
        acc.unlocked.push(a);
      } else {
        acc.locked.push(a);
      }
      return acc;
    },
    { unlocked: [] as Achievement[], locked: [] as Achievement[] }
  );
}

const RARITY_LABELS: Record<string, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

const RARITY_GRADIENTS: Record<string, string> = {
  common: 'from-gray-400 to-gray-500',
  rare: 'from-blue-400 to-blue-600',
  epic: 'from-purple-400 to-purple-600',
  legendary: 'from-amber-400 to-orange-500',
};

export const AchievementsPanel: React.FC<AchievementsPanelProps> = ({
  isOpen,
  onClose,
  userId,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 自动聚焦关闭按钮
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  // ESC 键关闭
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // 加载成就数据
  useEffect(() => {
    if (!isOpen || !userId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    achievementService.getUserAchievements(userId)
      .then((data: Achievement[]) => {
        if (!cancelled) setAchievements(data);
      })
      .catch((_err: unknown) => {
        if (!cancelled) setError('加载成就失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, userId]);

  const { unlocked, locked } = groupByUnlock(achievements);

  const renderAchievement = (a: Achievement, isLocked: boolean) => {
    const color = getAchievementColor(a.rarity);
    const bg = getAchievementBgColor(a.rarity);
    const gradient = RARITY_GRADIENTS[a.rarity] ?? 'from-gray-400 to-gray-500';

    return (
      <motion.div
        key={a.id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className={`
          relative flex flex-col items-center gap-1.5 p-3 rounded-2xl
          border transition-all duration-200 cursor-default
          ${isLocked
            ? 'border-white/5 bg-white/5 opacity-60 grayscale'
            : 'border-white/15 bg-white/10 shadow-lg'
          }
        `}
        style={isLocked ? {} : { borderColor: `${color}30`, background: bg }}
      >
        {/* 稀有度角标 */}
        <div
          className={`absolute top-2 right-2 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider text-white bg-gradient-to-r ${gradient}`}
        >
          {RARITY_LABELS[a.rarity]}
        </div>

        {/* 成就图标 */}
        <div
          className={`
            w-12 h-12 rounded-xl flex items-center justify-center text-2xl mt-1
            ${isLocked ? 'bg-white/10' : 'bg-gradient-to-br ' + gradient}
          `}
        >
          {isLocked ? <Lock size={20} className="text-white/60" /> : a.icon}
        </div>

        {/* 成就名称 */}
        <span className={`text-xs font-bold text-center leading-tight ${isLocked ? 'text-white/50' : 'text-white'}`}>
          {a.name}
        </span>

        {/* 描述 */}
        <span className={`text-[10px] text-center leading-tight ${isLocked ? 'text-white/30' : 'text-white/70'}`}>
          {a.description}
        </span>

        {/* 解锁时间 */}
        {a.unlockedAt && !isLocked && (
          <span className="text-[9px] text-white/40 mt-0.5">
            {new Date(a.unlockedAt).toLocaleDateString('zh', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </motion.div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* 面板 */}
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-slate-900 w-full sm:max-w-lg max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-white/10 flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 顶部标题栏 */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                    <Trophy size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">成就</h2>
                    <p className="text-xs text-white/50">
                      {unlocked.length} / {achievements.length} 已解锁
                    </p>
                  </div>
                </div>
                <button
                  ref={closeButtonRef}
                  onClick={onClose}
                  className="ios-pressable w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 transition-colors"
                  aria-label="关闭"
                >
                  <X size={18} />
                </button>
              </div>

              {/* 进度条 */}
              {achievements.length > 0 && (
                <div className="px-6 pt-4 flex-shrink-0">
                  <div className="flex justify-between text-xs text-white/40 mb-1.5">
                    <span>完成进度</span>
                    <span>{Math.round((unlocked.length / achievements.length) * 100)}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(unlocked.length / achievements.length) * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                    />
                  </div>
                </div>
              )}

              {/* 内容区 */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {loading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                    <span className="text-sm text-white/50">加载中...</span>
                  </div>
                )}

                {error && !loading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Star size={32} className="text-white/20" />
                    <span className="text-sm text-red-400/80">{error}</span>
                  </div>
                )}

                {!loading && !error && achievements.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Star size={32} className="text-white/20" />
                    <span className="text-sm text-white/50">暂无成就数据</span>
                  </div>
                )}

                {/* 已解锁成就 */}
                {!loading && !error && unlocked.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                      已解锁 ({unlocked.length})
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {unlocked.map((a) => renderAchievement(a, false))}
                    </div>
                  </div>
                )}

                {/* 未解锁成就 */}
                {!loading && !error && locked.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Lock size={10} />
                      待解锁 ({locked.length})
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {locked.map((a) => renderAchievement(a, true))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AchievementsPanel;
