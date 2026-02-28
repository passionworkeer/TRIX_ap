import React, { useState } from 'react';
import { X, Trophy, Music, Volume2 } from 'lucide-react';
import Avatar from '../../../components/Avatar';
import { MusicSelector } from './MusicSelector';
import { useAudioPlayer } from '../../../hooks/useAudioPlayer';
import { DynamicBackground } from '../../../components/DynamicBackground';

interface TimerViewProps {
  /** 格式化后的时间对象 */
  timeObj: {
    m: string;
    s: string;
  };
  /** 是否完成 */
  isCompleted: boolean;
  /** 学习伙伴信息 */
  companion?: {
    username: string;
    avatar?: string;
  };
  /** 当前用户信息 */
  profile?: {
    username?: string;
    avatar_url?: string;
  };
  /** 当前用户邮箱 */
  userEmail?: string;
  /** 关闭按钮点击回调 */
  onCloseClick: () => void;
  /** 停止专注回调 */
  onStopFocus: () => void;
  /** SummaryModal 组件 */
  summaryModal: React.ReactNode;
  /** 音频播放器（可选，用于背景音乐控制） */
  audioPlayer?: ReturnType<typeof useAudioPlayer>;
}

/**
 * TimerView - 计时器视图组件
 *
 * 显示专注计时器、好友头像（如果有）、状态指示器和控制按钮
 */
const TimerView: React.FC<TimerViewProps> = ({
  timeObj,
  isCompleted,
  companion,
  profile,
  userEmail,
  onCloseClick,
  onStopFocus,
  summaryModal,
  audioPlayer
}) => {
  const [showMusicSelector, setShowMusicSelector] = useState(false);

  // Audio player - unused but reserved for future use
  void _audio; // Acknowledge for TypeScript
  return (
    <div className="h-screen w-full relative overflow-hidden" style={{ background: 'transparent' }}>
      {/* 背景层：z-index: 0 */}
      <div
        className="fixed inset-0 w-full h-full"
        style={{ zIndex: 0, pointerEvents: 'none' }}
      >
        <img
          src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=2000&q=80"
          alt="Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* 动态背景效果 */}
      <DynamicBackground
        type="both"
        primaryColor="rgba(139, 92, 246, 0.15)"
        secondaryColor="rgba(236, 72, 153, 0.15)"
        particleCount={40}
      />

      {/* SummaryModal */}
      {summaryModal}

      {/* 内容层：z-index: 10 */}
      <div className="relative z-10 flex flex-col h-full">
        {/* 顶部按钮组 */}
        <div className="absolute top-6 left-6 right-6 flex justify-between items-start">
          {/* 关闭按钮 */}
          <button
            onClick={onCloseClick}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"
            aria-label="关闭计时器"
          >
            <X size={20} className="text-white" />
          </button>

          {/* 音乐控制按钮 */}
          {audioPlayer && (
            <button
              onClick={() => setShowMusicSelector(true)}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"
              aria-label="背景音乐"
            >
              {currentTrack && isPlaying ? (
                <div className="flex items-center gap-0.5">
                  <div className="w-1 bg-purple-400 rounded-full animate-pulse" style={{ height: '8px' }} />
                  <div className="w-1 bg-purple-400 rounded-full animate-pulse" style={{ height: '12px', animationDelay: '0.1s' }} />
                  <div className="w-1 bg-purple-400 rounded-full animate-pulse" style={{ height: '16px', animationDelay: '0.2s' }} />
                </div>
              ) : currentTrack ? (
                <Volume2 size={18} className="text-purple-300" />
              ) : (
                <Music size={18} className="text-white/70" />
              )}
            </button>
          )}
        </div>

      {/* 音乐选择器 */}
      {audioPlayer && (
        <MusicSelector
          isOpen={showMusicSelector}
          onClose={() => setShowMusicSelector(false)}
          audioPlayer={audioPlayer}
        />
      )}

        {/* 计时器内容 */}
        <div className="flex-1 flex flex-col items-center justify-center -mt-10">
          <div className="flex flex-col items-center">
            {/* 好友头像显示 */}
            {companion && (
              <div className="mb-8 flex flex-col items-center gap-4">
                {/* 头像和连接线 */}
                <div className="flex items-center gap-6">
                  {/* 我的头像 */}
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      {/* 呼吸光晕效果 */}
                      <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-pulse" style={{ animationDuration: '2s' }} />
                      <div className="rounded-full ring-4 ring-blue-500/50 shadow-lg shadow-blue-500/30 relative">
                        <Avatar
                          name={profile?.username || userEmail?.split('@')[0] || 'Me'}
                          avatar={profile?.avatar_url}
                          size="xl"
                        />
                      </div>
                      {/* 状态指示器 */}
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      </div>
                    </div>
                    <span className="text-sm text-white/80 mt-3 font-medium">{profile?.username || '我'}</span>
                    <span className="text-xs text-green-300 mt-1">专注中</span>
                  </div>

                  {/* 连接线动画 */}
                  <div className="flex items-center gap-2 relative">
                    {/* 左侧粒子流 */}
                    <div className="absolute left-0 w-2 h-2 rounded-full bg-blue-400 animate-ping" style={{ animationDuration: '1.5s' }} />
                    <div className="w-12 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-purple-500 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" style={{ animationDuration: '2s' }} />
                    </div>
                    {/* 中心脉冲点 */}
                    <div className="relative z-10">
                      <div className="w-4 h-4 rounded-full bg-purple-400 shadow-lg shadow-purple-400/50 animate-pulse" />
                      <div className="absolute inset-0 w-4 h-4 rounded-full bg-purple-400 animate-ping opacity-75" />
                    </div>
                    {/* 右侧粒子流 */}
                    <div className="w-12 h-0.5 bg-gradient-to-r from-purple-500 via-purple-500 to-blue-500 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                    </div>
                    <div className="absolute right-0 w-2 h-2 rounded-full bg-purple-400 animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.75s' }} />
                  </div>

                  {/* 好友头像 */}
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      {/* 呼吸光晕效果 */}
                      <div className="absolute inset-0 rounded-full bg-purple-500/30 animate-pulse" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                      <div className="rounded-full ring-4 ring-purple-500/50 shadow-lg shadow-purple-500/30 relative">
                        <Avatar
                          name={companion.username}
                          avatar={companion.avatar}
                          size="xl"
                        />
                      </div>
                      {/* 状态指示器 */}
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-purple-500 border-2 border-white flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      </div>
                    </div>
                    <span className="text-sm text-white/80 mt-3 font-medium">{companion.username}</span>
                    <span className="text-xs text-purple-300 mt-1">专注中</span>
                  </div>
                </div>

                {/* 共同专注提示 */}
                <div className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-xl border border-purple-400/30 shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" style={{ animationDuration: '3s' }} />
                  <p className="text-sm font-medium text-purple-100 flex items-center gap-2 relative z-10">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    正在与 <span className="font-bold text-pink-300">{companion.username}</span> 共同专注中
                  </p>
                </div>
              </div>
            )}

            {/* 时间显示 */}
            <div className="flex items-baseline justify-center gap-3 mb-8">
              <span className="text-8xl font-bold text-white tracking-tight" style={{ textShadow: '0 0 60px rgba(59,130,246,0.5)' }}>
                {timeObj.m}
              </span>
              <span className="text-6xl font-bold text-blue-400 animate-pulse">:</span>
              <span className="text-8xl font-bold text-white tracking-tight" style={{ textShadow: '0 0 60px rgba(59,130,246,0.5)' }}>
                {timeObj.s}
              </span>
            </div>

            {/* 状态显示 */}
            <div className="mb-6 px-6 py-2.5 rounded-full bg-blue-500/20 backdrop-blur-xl border border-blue-400/20 shadow-lg">
              {isCompleted ? (
                <div className="flex items-center gap-2">
                  <Trophy size={18} className="text-yellow-400" />
                  <span className="text-base font-semibold text-white">专注完成</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-sm font-semibold text-blue-100">深度专注中...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 放弃专注按钮 */}
        {!isCompleted && (
          <div className="pb-16 flex justify-center">
            <button
              onClick={onStopFocus}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-500/15 backdrop-blur-md border border-red-500/20 hover:bg-red-500/25 transition-all active:scale-95"
            >
              <X size={16} className="text-red-300" />
              <span className="text-sm font-medium text-red-300">放弃专注</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimerView;
