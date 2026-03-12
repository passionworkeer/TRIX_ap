import React from 'react';
import { motion } from 'framer-motion';
import { Timer, Play } from 'lucide-react';
import { iosPressableMotion, iosQuickSpring } from '../../../utils/iosMotion';

interface DurationSelectorProps {
  /** 时间预设选项（分钟） */
  timePresets: number[];
  /** 当前选中的时长 */
  selectedDuration: number;
  /** 选择时长回调 */
  onSelectDuration: (duration: number) => void;
  /** 开始专注回调 */
  onStartFocus: () => void;
  /** 是否禁用（可选） */
  disabled?: boolean;
}

/**
 * DurationSelector - 专注时长选择器组件
 *
 * 显示时间预设按钮、当前选中的时长和开始专注按钮
 */
const DurationSelector: React.FC<DurationSelectorProps> = React.memo(({
  timePresets,
  selectedDuration,
  onSelectDuration,
  onStartFocus,
  disabled = false
}) => {
  return (
    <div
      className="absolute top-32 left-6 z-20"
      style={{ maxWidth: '240px' }}
    >
      <div className="ios-glass-surface rounded-[1.8rem] border border-white/14 p-3.5 text-white shadow-[0_24px_48px_rgba(15,23,42,0.24)]">
        {/* 标题 */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/12 bg-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
            aria-hidden="true"
          >
            <Timer size={14} className="text-white" />
          </div>
          <span className="text-[10px] font-bold tracking-wider uppercase text-white/90">
            Focus Timer
          </span>
        </div>

        {/* 时间选择器 */}
        <div
          className="mb-4 flex gap-1.5 rounded-full border border-white/8 bg-black/18 p-1"
          role="radiogroup"
          aria-label="选择专注时长"
        >
          {timePresets.map((time) => (
            <motion.button
              key={time}
              onClick={() => onSelectDuration(time)}
              disabled={disabled}
              aria-checked={selectedDuration === time}
              role="radio"
              transition={iosQuickSpring}
              {...iosPressableMotion}
              className={`ios-pressable flex-1 min-h-[44px] rounded-full px-4 text-sm font-semibold touch-manipulation ${
                selectedDuration === time
                  ? 'ios-pill-indicator bg-white text-slate-900 shadow-[0_14px_24px_rgba(255,255,255,0.26)]'
                  : 'text-white/72 hover:bg-white/10 hover:text-white'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {time}m
            </motion.button>
          ))}
        </div>

        {/* 时间显示和开始按钮 */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col" aria-live="polite">
            <span className="text-4xl font-bold text-white leading-none">
              {selectedDuration}
            </span>
            <span className="text-[9px] font-semibold text-white/60 uppercase tracking-wider mt-1">
              Minutes
            </span>
          </div>
          <motion.button
            onClick={onStartFocus}
            disabled={disabled}
            transition={iosQuickSpring}
            {...iosPressableMotion}
            className="ios-pressable ios-primary-button flex h-16 w-16 items-center justify-center rounded-full border border-white/20 shadow-[0_18px_32px_rgba(37,99,235,0.34)] disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
            aria-label={`开始专注 ${selectedDuration} 分钟`}
          >
            <Play fill="white" size={22} className="ml-0.5 text-white" />
          </motion.button>
        </div>
      </div>
    </div>
  );
});

DurationSelector.displayName = 'DurationSelector';

export default DurationSelector;
