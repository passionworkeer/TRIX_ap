import React from 'react';
import { MapPin, Plus, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface StudyHeaderProps {
  totalStudyTime: number;
  onBuddyListOpen: () => void;
  onPointsClick?: () => void;
}

const StudyHeader: React.FC<StudyHeaderProps> = React.memo(({
  totalStudyTime,
  onBuddyListOpen,
  onPointsClick
}) => {
  const { t } = useTranslation();

  return (
    <div className="px-6 pt-14 pb-4 flex justify-between items-center">
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold text-blue-200 uppercase tracking-[0.2em] mb-1 flex items-center gap-1">
          <MapPin size={10} aria-hidden="true" /> VIRTUAL SPACE
        </span>
        <h1 className="text-2xl font-bold text-white">{t('study.title')}</h1>
      </div>

      <div className="flex items-center gap-2">
        {onPointsClick && (
          <button
            onClick={onPointsClick}
            className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/15 transition-all active:scale-95"
            aria-label={`${t('study.points')}, ${t('study.totalStudyTime')}: ${totalStudyTime} ${t('common.minutes')}`}
          >
            <Zap size={18} className="text-yellow-400" />
          </button>
        )}

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
