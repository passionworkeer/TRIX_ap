import React from 'react';
import { Trophy, Sparkles, Heart, Zap } from 'lucide-react';
import Avatar from '../../../components/Avatar';

interface ConfettiEffectProps {
  /** Number of confetti particles (default: 50) */
  count?: number;
}

/**
 * ConfettiEffect - 撒花特效组件
 *
 * 用于在完成专注时展示庆祝动画
 */
export const ConfettiEffect: React.FC<ConfettiEffectProps> = ({ count = 50 }) => {
  const confettiElements = [];

  for (let i = 0; i < count; i++) {
    const style = {
      left: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 3}s`,
      animationDuration: `${2 + Math.random() * 3}s`,
      backgroundColor: ['#FF69B4', '#FFD700', '#87CEEB', '#FF1493', '#9370DB'][Math.floor(Math.random() * 5)],
      width: `${5 + Math.random() * 5}px`,
      height: `${5 + Math.random() * 5}px`,
      opacity: 0.7 + Math.random() * 0.3,
    };

    confettiElements.push(
      <div
        key={i}
        className="absolute top-0 animate-confetti-fall"
        style={style}
      />
    );
  }

  return <div className="absolute inset-0 overflow-hidden pointer-events-none">{confettiElements}</div>;
};

interface CompanionInfo {
  username: string;
  avatar?: string;
}

interface UserProfile {
  username?: string;
  avatar_url?: string;
}

interface SummaryModalProps {
  /** 是否显示模态框 */
  show: boolean;
  /** 专注时长（分钟） */
  studyDuration: number;
  /** 初始目标时长（分钟） */
  initialDuration: number;
  /** 学习伙伴信息 */
  companion?: CompanionInfo;
  /** 当前用户信息 */
  profile?: UserProfile;
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * SummaryModal - 学习完成总结模态框
 *
 * 展示专注时长、完成率、学习伙伴、获得积分等信息
 */
export const SummaryModal: React.FC<SummaryModalProps> = ({
  show,
  studyDuration,
  initialDuration,
  companion,
  profile,
  onClose
}) => {
  if (!show) return null;

  const hasCompanion = !!companion;
  const completionRate = initialDuration > 0
    ? Math.round((studyDuration / initialDuration) * 100)
    : 0;
  const earnedPoints = Math.floor(studyDuration * 2); // 每分钟2积分

  return (
    <>
      {/* 背景遮罩 */}
      <div
        role="presentation"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal内容 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="summary-title"
          className="bg-gradient-to-br from-purple-900/95 to-pink-900/95 backdrop-blur-xl border-2 border-white/30 rounded-3xl p-8 max-w-md w-full shadow-2xl pointer-events-auto animate-scale-in"
          style={{
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 100px rgba(219,39,119,0.3)',
          }}
        >
          {/* 撒花特效 */}
          <ConfettiEffect />

          {/* 顶部图标 */}
          <div className="flex justify-center mb-6 relative">
            <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg animate-bounce-gentle">
              <Trophy size={40} className="text-white" fill="white" />
            </div>
            <Sparkles className="absolute top-0 right-1/3 text-yellow-300 animate-sparkle" size={20} />
            <Sparkles className="absolute bottom-0 left-1/3 text-pink-300 animate-sparkle delay-300" size={16} />
          </div>

          {/* 标题 */}
          <h2 id="summary-title" className="text-3xl font-bold text-white text-center mb-2">
            {completionRate >= 100 ? '专注完成!' : '结束专注'}
          </h2>
          <p className="text-pink-200 text-center mb-6 text-sm">
            {completionRate >= 100 ? '太棒了! 你完成了全部专注时间 🎉' : '每一次专注都是进步 💪'}
          </p>

          {/* 核心数据卡片 */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-6 border border-white/20">
            {/* 专注时长 */}
            <div className="text-center mb-4">
              <p className="text-white/60 text-xs uppercase tracking-wider mb-2">本次专注时长</p>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl font-bold text-white">{studyDuration}</span>
                <span className="text-2xl text-white/80">分钟</span>
              </div>
              {studyDuration < initialDuration && (
                <p className="text-white/50 text-xs mt-2">
                  目标: {initialDuration} 分钟 ({completionRate}%)
                </p>
              )}
            </div>

            {/* 分隔线 */}
            <div className="h-px bg-white/20 my-4" />

            {/* 好友信息 */}
            {hasCompanion && (
              <div className="flex items-center justify-center gap-3 mb-4">
                <Avatar
                  name={profile?.username || 'Me'}
                  avatar={profile?.avatar_url}
                  size="md"
                />
                <Heart className="text-pink-400 animate-heartbeat" size={20} fill="currentColor" />
                <Avatar
                  name={companion.username}
                  avatar={companion.avatar}
                  size="md"
                />
              </div>
            )}

            <p className="text-center text-white/90 text-sm leading-relaxed">
              {hasCompanion ? (
                <>
                  你和 <span className="font-bold text-pink-300">{companion.username}</span> 共度了一段高效时光
                </>
              ) : (
                '独自专注也很棒! 继续保持 ✨'
              )}
            </p>

            {/* 获得积分 */}
            {earnedPoints > 0 && (
              <>
                <div className="h-px bg-white/20 my-4" />
                <div className="flex items-center justify-center gap-2">
                  <Zap className="text-yellow-400" size={18} fill="currentColor" />
                  <span className="text-white font-semibold">+{earnedPoints} 积分</span>
                </div>
              </>
            )}
          </div>

          {/* Kuromi风格贴纸 */}
          <div className="text-center mb-6">
            <div className="inline-block bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full text-lg font-bold shadow-lg transform -rotate-2">
              Great Job! 🎀
            </div>
          </div>

          {/* 按钮 */}
          <button
            onClick={onClose}
            className="w-full bg-white text-purple-900 py-4 rounded-full font-bold text-lg hover:scale-105 active:scale-95 transition-transform shadow-lg"
          >
            返回自习室
          </button>
        </div>
      </div>
    </>
  );
};

export default SummaryModal;
