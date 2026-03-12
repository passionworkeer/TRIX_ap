import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { iosFloatingMotion, iosQuickSpring } from '../../../utils/iosMotion';

interface StudyStatsProps {
  /** 累计学习时长（分钟） */
  totalStudyTime: number;
}

/**
 * StudyStats - 学习统计卡片组件
 *
 * 显示累计专注时长（小时和分钟）
 */
const StudyStats: React.FC<StudyStatsProps> = React.memo(({ totalStudyTime }) => {
  const { t } = useTranslation();
  const hours = Math.floor(totalStudyTime / 60);
  const minutes = totalStudyTime % 60;

  return (
    <motion.div
      className="absolute bottom-32 right-6 z-10"
      initial={iosFloatingMotion.initial}
      animate={iosFloatingMotion.animate}
      exit={iosFloatingMotion.exit}
      transition={iosQuickSpring}
      style={{ maxWidth: '200px' }}
    >
      <div className="ios-glass-surface flex items-center gap-3 rounded-[1.35rem] border border-white/12 p-3">
        {/* 图标 */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-md">
          <Zap size={16} fill="white" className="text-white" aria-hidden="true" />
        </div>

        {/* 统计数据 */}
        <div>
          <p className="text-[9px] font-semibold text-white/60 uppercase tracking-wide">
            {t('study.totalFocus')}
          </p>
          <p className="text-lg font-bold text-white" aria-live="polite">
            {hours}
            <span className="text-xs font-medium opacity-60">h</span> {' '}
            {minutes}
            <span className="text-xs font-medium opacity-60">m</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
});

StudyStats.displayName = 'StudyStats';

export default StudyStats;
