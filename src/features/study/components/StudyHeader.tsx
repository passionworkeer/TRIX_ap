import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Plus, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { iosIconButtonMotion, iosQuickSpring } from '../../../utils/iosMotion';

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
          <motion.button
            onClick={onPointsClick}
            transition={iosQuickSpring}
            {...iosIconButtonMotion}
            className="ios-pressable ios-icon-button ios-glass-surface flex h-10 w-10 items-center justify-center rounded-full border border-yellow-300/20 text-yellow-300"
            aria-label={`${t('study.points')}, ${t('study.totalStudyTime')}: ${totalStudyTime} ${t('common.minutes')}`}
          >
            <Zap size={18} className="text-yellow-400" />
          </motion.button>
        )}

        <motion.button
          onClick={onBuddyListOpen}
          transition={iosQuickSpring}
          {...iosIconButtonMotion}
          className="ios-pressable ios-icon-button ios-glass-surface flex h-10 w-10 items-center justify-center rounded-full text-white"
          aria-label={t('study.addBuddy')}
        >
          <Plus size={18} className="text-white" />
        </motion.button>
      </div>
    </div>
  );
});

StudyHeader.displayName = 'StudyHeader';

export default StudyHeader;
