import React from 'react';
import { MessageCircle, User, Clock, Zap } from 'lucide-react';

interface FriendPopupContentProps {
  friend: {
    friend_id: string;
    name: string;
    avatar_url?: string;
    status?: {
      emoji: string;
      text: string;
    };
  };
  onMessage?: () => void;
  onViewProfile?: () => void;
  onInvite?: () => void;
}

const FriendPopupContent: React.FC<FriendPopupContentProps> = ({
  friend,
  onMessage,
  onViewProfile,
  onInvite
}) => {
  // Mock data - in real app, this would come from the friend data
  const studyStatus = '正在学习中';
  const todayStudyTime = 45; // minutes
  const lastOnline = '5分钟前';

  return (
    <div className="friend-popup-content" style={{ minWidth: '200px' }}>
      {/* Header with avatar */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-md"
          style={{
            backgroundImage: friend.avatar_url
              ? `url(${friend.avatar_url})`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {!friend.avatar_url && friend.name.charAt(0)}
        </div>

        <div className="flex-1">
          <h3 className="font-bold text-gray-900 text-sm mb-0.5">
            {friend.name}
          </h3>
          {friend.status && (
            <div className="flex items-center gap-1">
              <span className="text-sm">{friend.status.emoji}</span>
              <span className="text-xs text-green-600 font-medium">
                {friend.status.text}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Status indicator */}
      <div className="bg-blue-50 rounded-lg p-2 mb-3">
        <div className="flex items-center gap-2 text-xs text-blue-700">
          <Zap size={14} className="text-blue-500" />
          <span className="font-medium">{studyStatus}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-blue-600 mt-1">
          <Clock size={12} />
          <span>今日已学习 {todayStudyTime} 分钟</span>
        </div>
      </div>

      {/* Last online */}
      <div className="flex items-center gap-1 mb-3 text-xs text-gray-500">
        <span>🟢</span>
        <span>{lastOnline}</span>
      </div>

      {/* Quick action buttons */}
      <div className="flex flex-col gap-2">
        {onMessage && (
          <button
            onClick={onMessage}
            className="w-full px-3 py-2 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-1"
          >
            <MessageCircle size={14} />
            发消息
          </button>
        )}

        <div className="flex gap-2">
          {onViewProfile && (
            <button
              onClick={onViewProfile}
              className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
            >
              <User size={14} />
              主页
            </button>
          )}

          {onInvite && (
            <button
              onClick={onInvite}
              className="flex-1 px-3 py-2 bg-purple-100 text-purple-700 text-xs font-medium rounded-lg hover:bg-purple-200 transition-colors"
            >
              邀请自习
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendPopupContent;
