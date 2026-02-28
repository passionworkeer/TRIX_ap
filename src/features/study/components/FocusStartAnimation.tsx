import React, { useEffect, useState } from 'react';

interface FocusStartAnimationProps {
  /** 是否显示 */
  show: boolean;
  /** 专注时长（分钟） */
  duration: number;
  /** 动画完成后回调 */
  onComplete: () => void;
}

/**
 * FocusStartAnimation - 开始专注动画
 *
 * 显示"进入专注"的仪式感动画
 */
export function FocusStartAnimation({ show, duration, onComplete }: FocusStartAnimationProps) {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState(0); // 0: 准备, 1: 倒计时, 2: 开始

  useEffect(() => {
    if (show) {
      setVisible(true);
      setPhase(0);

      // 阶段1: 准备
      const timer1 = setTimeout(() => setPhase(1), 500);

      // 阶段2: 倒计时
      const timer2 = setTimeout(() => setPhase(2), 2000);

      // 阶段3: 完成动画
      const timer3 = setTimeout(() => {
        setVisible(false);
        onComplete();
      }, 3500);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    } else {
      setVisible(false);
    }
  }, [show, onComplete]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
      {/* 背景光晕 */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)',
            animation: 'pulse 2s ease-in-out infinite'
          }}
        />
      </div>

      {/* 内容 */}
      <div className="relative z-10 text-center">
        {phase === 0 && (
          <div className="animate-fade-in">
            <div className="text-6xl mb-6">📚</div>
            <h2 className="text-4xl font-bold text-white mb-4">准备专注</h2>
            <p className="text-xl text-purple-200">接下来的 {duration} 分钟，只属于你</p>
          </div>
        )}

        {phase === 1 && (
          <div className="animate-fade-in">
            <div className="text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-pink-400 mb-6 animate-pulse">
              3
            </div>
            <p className="text-2xl text-white">深呼吸...</p>
          </div>
        )}

        {phase === 2 && (
          <div className="animate-scale-in">
            <div className="text-6xl mb-6 animate-bounce-gentle">✨</div>
            <h2 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-purple-300 to-pink-300 mb-4">
              开始专注！
            </h2>
            <p className="text-xl text-purple-200">加油，你可以的 💪</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.5;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}
