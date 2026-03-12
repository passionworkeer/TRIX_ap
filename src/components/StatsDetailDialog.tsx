/**
 * 统计详情对话框组件 - Stats Detail Dialog
 * 显示用户的详细统计信息：陪伴天数、积分、互动次数等
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, Calendar, MessageCircle, Star, Target } from 'lucide-react';

interface UserStats {
  daysActive: number;
  totalPoints: number;
  interactions: number;
  level: number;
  nextLevelPoints: number;
  pointsToNextLevel: number;
}

interface StatsDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  stats: UserStats | null;
  loading?: boolean;
}

export const StatsDetailDialog: React.FC<StatsDetailDialogProps> = ({
  isOpen,
  onClose,
  stats,
  loading = false
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // 自动聚焦关闭按钮
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  // ESC 键关闭
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (loading) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={onClose}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-12 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* 对话框 */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 顶部标题栏 */}
              <div className="bg-gradient-to-br from-amber-400 to-yellow-500 p-6 text-white">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <TrendingUp size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">数据统计</h2>
                      <p className="text-white/90 text-sm">你的学习旅程</p>
                    </div>
                  </div>
                  <button
                    ref={closeButtonRef}
                    onClick={onClose}
                    className="ios-pressable ios-secondary-button flex h-9 w-9 items-center justify-center rounded-full text-white"
                    aria-label="关闭"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* 内容区域 */}
              <div className="p-6">
                {stats && (
                  <div className="space-y-4">
                    {/* 陪伴天数卡片 */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                            <Calendar size={16} className="text-white" />
                          </div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">陪伴天数</span>
                        </div>
                        <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                          {stats.daysActive}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        🎉 你已经和 TRIX 相伴 {stats.daysActive} 天啦！
                      </p>
                    </div>

                    {/* 积分卡片 */}
                    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-2xl p-4 border border-amber-100 dark:border-amber-800">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                            <Star size={16} className="text-white" />
                          </div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">总积分</span>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                            {stats.totalPoints}
                          </span>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Lv.{stats.level}
                          </div>
                        </div>
                      </div>
                      {/* 进度条 */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                          <span>进度</span>
                          <span>{stats.pointsToNextLevel} 积分升级</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-amber-400 to-yellow-500 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(100, (stats.totalPoints / stats.nextLevelPoints) * 100)}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 互动次数卡片 */}
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl p-4 border border-purple-100 dark:border-purple-800">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                            <MessageCircle size={16} className="text-white" />
                          </div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">总互动次数</span>
                        </div>
                        <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
                          {stats.interactions}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        💬 继续保持，和 TRIX 多多交流吧！
                      </p>
                    </div>

                    {/* 目标提示 */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center flex-shrink-0">
                          <Target size={16} className="text-white" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-1">
                            下个目标
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            再获得 {stats.pointsToNextLevel} 积分即可升级到 Lv.{stats.level + 1}
                          </p>
                        </div>
                      </div>
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

export default StatsDetailDialog;
