import React from 'react';
import { MapPin, Zap, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface StudyHeaderProps {
  /** 累计学习时长（分钟） */
  totalStudyTime: number;
  /** 打开学习伙伴列表的回调 */
  onBuddyListOpen: () => void;
  /** 点击积分按钮的回调（可选） */
  onPointsClick?: () => void;
}

/**
 * StudyHeader - 自习室头部导航栏组件
 *
 * 显示标题、位置标识、积分按钮和添加好友按钮
 */
const StudyHeader: React.FC<StudyHeaderProps> = React.memo(({
  totalStudyTime,
  onBuddyListOpen,
  onPointsClick
}) => {
  const { t } = useTranslation();

  return (
    <div className="px-6 pt-14 pb-4 flex justify-between items-center">
      {/* 左侧：标题和位置 */}
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold text-blue-200 uppercase tracking-[0.2em] mb-1 flex items-center gap-1">
          <MapPin size={10} aria-hidden="true" /> VIRTUAL SPACE
        </span>
        <h1 className="text-2xl font-bold text-white">{t('study.title')}</h1>
      </div>

      {/* 右侧：按钮组 */}
      <div className="flex items-center gap-2">
        {/* 积分按钮 */}
        {onPointsClick && (
          <button
            onClick={onPointsClick}
            className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/15 transition-all active:scale-95"
            aria-label={`${t('study.points')}, ${t('study.totalStudyTime')}: ${totalStudyTime} ${t('common.minutes')}`}
          >
            <Zap size={18} className="text-yellow-400" />
          </button>
        )}

        {/* 添加好友按钮 */}
        <button
          onClick={onBuddyListOpen}
          className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/15 transition-all active:scale-95"
          aria-label={t('study.addBuddy')}
        >
          <Plus size={18} className="text-white" />
        </button>
      </div>
    </div>
  );
});

StudyHeader.displayName = 'StudyHeader';

export default StudyHeader;
