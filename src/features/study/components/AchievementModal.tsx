import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Trophy, Lock, Sparkles } from 'lucide-react';
import { Achievement, ACHIEVEMENTS, getAchievementColor, getAchievementBgColor } from '../types/achievement';
import { achievementService } from '../services/achievementService';
import { logger } from '../../../utils/logger';
import {
  iosBackdropMotion,
  iosIconButtonMotion,
  iosPressableMotion,
  iosQuickSpring,
  iosSheetMotion
} from '../../../utils/iosMotion';

interface AchievementModalProps {
  show: boolean;
  onClose: () => void;
  userId: string;
}

/**
 * AchievementModal - 成就展示弹窗
 */
export const AchievementModal: React.FC<AchievementModalProps> = ({ show, onClose, userId }) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (show && userId) {
      loadAchievements();
    }
  }, [show, userId]);

  const loadAchievements = async () => {
    setIsLoading(true);
    try {
      const userAchievements = await achievementService.getUserAchievements(userId);
      setAchievements(userAchievements);
    } catch (error) {
      logger.error('Achievement', 'Failed to load achievements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!show) return null;

  const categories = [
    { id: 'all', label: '全部' },
    { id: 'duration', label: '时长' },
    { id: 'streak', label: '连续' },
    { id: 'social', label: '社交' },
    { id: 'special', label: '特殊' }
  ];

  const filteredAchievements = selectedCategory === 'all'
    ? achievements
    : achievements.filter(a => a.category === selectedCategory);

  const unlockedCount = achievements.filter(a => a.unlockedAt).length;
  const totalCount = achievements.length;

  return (
    <>
      {/* 背景遮罩 */}
      <motion.div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        initial={iosBackdropMotion.initial}
        animate={iosBackdropMotion.animate}
        exit={iosBackdropMotion.exit}
        onClick={onClose}
      />

      {/* Modal内容 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          className="pointer-events-auto w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-[2rem] border border-white/14 bg-gradient-to-br from-slate-950/96 via-slate-900/94 to-slate-900/92 shadow-[0_30px_90px_rgba(2,6,23,0.62)] backdrop-blur-2xl"
          initial={iosSheetMotion.initial}
          animate={iosSheetMotion.animate}
          exit={iosSheetMotion.exit}
        >
          {/* 顶部标题栏 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Trophy size={20} className="text-yellow-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">成就</h2>
                <p className="text-xs text-gray-400">{unlockedCount} / {totalCount} 已解锁</p>
              </div>
            </div>
            <motion.button
              onClick={onClose}
              transition={iosQuickSpring}
              {...iosIconButtonMotion}
              className="ios-pressable ios-surface-button ios-icon-button-compact flex items-center justify-center text-slate-400"
            >
              <X size={16} className="text-gray-400" />
            </motion.button>
          </div>

          {/* 进度条 */}
          <div className="px-6 py-3">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all"
                style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>

          {/* 分类筛选 */}
          <div className="flex gap-2 px-6 py-3 overflow-x-auto">
            {categories.map(cat => (
              <motion.button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                transition={iosQuickSpring}
                {...iosPressableMotion}
                className={`ios-pressable whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${
                  selectedCategory === cat.id
                    ? 'ios-pill-indicator border border-purple-300/20 bg-purple-500 text-white'
                    : 'ios-secondary-button text-gray-300'
                }`}
              >
                {cat.label}
              </motion.button>
            ))}
          </div>

          {/* 成就列表 */}
          <div className="overflow-y-auto max-h-96 px-6 pb-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredAchievements.map(achievement => (
                  <AchievementCard key={achievement.id} achievement={achievement} />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
};

/**
 * AchievementCard - 单个成就卡片
 */
const AchievementCard: React.FC<{ achievement: Achievement }> = ({ achievement }) => {
  const isUnlocked = !!achievement.unlockedAt;
  const bgColor = getAchievementBgColor(achievement.rarity);
  const borderColor = getAchievementColor(achievement.rarity);

  return (
    <div
      className={`ios-list-row rounded-[1.3rem] border-2 p-4 transition-all ${
        isUnlocked
          ? 'border-opacity-50 shadow-lg'
          : 'border-white/10 opacity-50'
      }`}
      style={{
        backgroundColor: bgColor,
        borderColor: isUnlocked ? borderColor : undefined
      }}
    >
      {/* 图标 */}
      <div className="flex items-center justify-between mb-3">
        <div className={`text-3xl ${isUnlocked ? '' : 'grayscale'}`}>
          {isUnlocked ? achievement.icon : '🔒'}
        </div>
        {isUnlocked && (
          <Sparkles size={16} style={{ color: borderColor }} className="animate-pulse" />
        )}
      </div>

      {/* 名称 */}
      <h3 className="font-bold text-white text-sm mb-1">
        {achievement.name}
      </h3>

      {/* 描述 */}
      <p className="text-xs text-gray-400 line-clamp-2">
        {achievement.description}
      </p>

      {/* 稀有度标签 */}
      <div className="mt-3">
        <span
          className="ios-pill-indicator rounded-full px-2 py-1 text-xs font-medium"
          style={{
            backgroundColor: `${borderColor}20`,
            color: borderColor
          }}
        >
          {achievement.rarity === 'common' && '普通'}
          {achievement.rarity === 'rare' && '稀有'}
          {achievement.rarity === 'epic' && '史诗'}
          {achievement.rarity === 'legendary' && '传说'}
        </span>
      </div>
    </div>
  );
};

export default AchievementModal;
