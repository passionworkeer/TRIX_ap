import React from 'react';
import { Zap } from 'lucide-react';

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
  const hours = Math.floor(totalStudyTime / 60);
  const minutes = totalStudyTime % 60;

  return (
    <div
      className="absolute bottom-32 right-6 z-10"
      style={{ maxWidth: '200px' }}
    >
      <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl p-3 flex items-center gap-3 shadow-lg">
        {/* 图标 */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-md">
          <Zap size={16} fill="white" className="text-white" aria-hidden="true" />
        </div>

        {/* 统计数据 */}
        <div>
          <p className="text-[9px] font-semibold text-white/60 uppercase tracking-wide">
            Total Focus
          </p>
          <p className="text-lg font-bold text-white" aria-live="polite">
            {hours}
            <span className="text-xs font-medium opacity-60">h</span> {' '}
            {minutes}
            <span className="text-xs font-medium opacity-60">m</span>
          </p>
        </div>
      </div>
    </div>
  );
});

StudyStats.displayName = 'StudyStats';

export default StudyStats;
