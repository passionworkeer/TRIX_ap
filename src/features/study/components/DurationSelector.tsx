import React from 'react';
import { Timer, Play } from 'lucide-react';

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
      <div className="bg-black/30 backdrop-blur-xl border border-white/20 rounded-2xl p-3.5 shadow-2xl">
        {/* 标题 */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center" aria-hidden="true">
            <Timer size={14} className="text-white" />
          </div>
          <span className="text-[10px] font-bold tracking-wider uppercase text-white/90">
            Focus Timer
          </span>
        </div>

        {/* 时间选择器 */}
        <div className="flex gap-1.5 mb-4 p-1 bg-black/20 rounded-full" role="radiogroup" aria-label="选择专注时长">
          {timePresets.map((time) => (
            <button
              key={time}
              onClick={() => onSelectDuration(time)}
              disabled={disabled}
              aria-checked={selectedDuration === time}
              role="radio"
              className={`flex-1 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                selectedDuration === time
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-white/70 hover:text-white"
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {time}m
            </button>
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
          <button
            onClick={onStartFocus}
            disabled={disabled}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`开始专注 ${selectedDuration} 分钟`}
          >
            <Play fill="white" size={18} className="ml-0.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
});

DurationSelector.displayName = 'DurationSelector';

export default DurationSelector;
