import React from 'react';
import { X, Trophy } from 'lucide-react';
import Avatar from '../../../components/Avatar';

interface TimerViewProps {
  /** 格式化后的时间对象 */
  timeObj: {
    m: string;
    s: string;
  };
  /** 是否完成 */
  isCompleted: boolean;
  /** 是否显示总结弹窗 */
  showSummaryModal: boolean;
  /** 学习时长（分钟） */
  studyDuration: number;
  /** 初始时长（分钟） */
  initialDuration: number;
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
  summaryModal
}) => {
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

      {/* SummaryModal */}
      {summaryModal}

      {/* 内容层：z-index: 10 */}
      <div className="relative z-10 flex flex-col h-full">
        {/* 关闭按钮 */}
        <button
          onClick={onCloseClick}
          className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"
          aria-label="关闭计时器"
        >
          <X size={20} className="text-white" />
        </button>

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
                    <div className="rounded-full ring-4 ring-blue-500/50 shadow-lg shadow-blue-500/30">
                      <Avatar
                        name={profile?.username || userEmail?.split('@')[0] || 'Me'}
                        avatar={profile?.avatar_url}
                        size="xl"
                      />
                    </div>
                    <span className="text-sm text-white/80 mt-2 font-medium">{profile?.username || '我'}</span>
                  </div>

                  {/* 连接线 */}
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse shadow-lg shadow-purple-400/50"></div>
                    <div className="w-10 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 animate-pulse"></div>
                  </div>

                  {/* 好友头像 */}
                  <div className="flex flex-col items-center">
                    <div className="rounded-full ring-4 ring-purple-500/50 shadow-lg shadow-purple-500/30">
                      <Avatar
                        name={companion.username}
                        avatar={companion.avatar}
                        size="xl"
                      />
                    </div>
                    <span className="text-sm text-white/80 mt-2 font-medium">{companion.username}</span>
                  </div>
                </div>

                {/* 共同专注提示 */}
                <div className="px-4 py-2 rounded-full bg-purple-500/20 backdrop-blur-xl border border-purple-400/30 shadow-lg">
                  <p className="text-sm font-medium text-purple-100 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                    正在与 <span className="font-bold">{companion.username}</span> 共同专注中
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
