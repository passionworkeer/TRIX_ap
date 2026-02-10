import React, { useState, useEffect } from 'react';
import { X, Clock, User, MessageCircle, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getFriends } from '../services/databaseService';
import type { FriendLatestMessage } from '../config/supabase';
import { AppRoutes } from '../types';
import Avatar from './Avatar';

interface StudyRoomProps {
  isOpen: boolean;
  onClose: () => void;
}

const StudyRoom: React.FC<StudyRoomProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [studyingFriends, setStudyingFriends] = useState<FriendLatestMessage[]>([]);
  const [allFriends, setAllFriends] = useState<FriendLatestMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadFriends();
    }
  }, [isOpen]);

  const loadFriends = async () => {
    setLoading(true);
    const friends = await getFriends();
    setAllFriends(friends);
    setStudyingFriends(friends.filter(f => f.is_studying));
    setLoading(false);
  };

  const formatStudyTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`;
    }
    return `${mins}分钟`;
  };

  const getStudyStreak = (studyTime: number) => {
    if (studyTime > 120) return { level: '学霸', color: 'from-purple-500 to-pink-500', emoji: '🔥' };
    if (studyTime > 60) return { level: '努力', color: 'from-orange-500 to-red-500', emoji: '💪' };
    return { level: '加油', color: 'from-cyan-500 to-blue-500', emoji: '📚' };
  };

  const handleChatWithFriend = (friend: FriendLatestMessage) => {
    onClose();
    navigate(AppRoutes.CHAT_DETAIL, {
      state: {
        name: friend.name,
        avatar: friend.avatar_url,
        isBot: false,
        friendId: friend.friend_id,
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 深色遮罩层 - 半透明保留背景可见 */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />

      {/* iOS 风格毛玻璃面板 - 缩小尺寸 */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl shadow-2xl max-h-[75vh] flex flex-col animate-scaleIn"
           style={{
             background: 'rgba(255, 255, 255, 0.65)',
             backdropFilter: 'blur(40px) saturate(180%)',
             WebkitBackdropFilter: 'blur(40px) saturate(180%)',
             border: '1px solid rgba(255, 255, 255, 0.3)',
           }}>

        {/* Header */}
        <div className="relative z-10 p-4 border-b border-white/20">
          {/* Background decorative elements */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-cyan-400/10 to-blue-500/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-purple-400/10 to-pink-500/10 rounded-full blur-xl"></div>

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <User className="text-white" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                  好友自习�?
                  <span className="bg-green-500/20 text-green-600 text-[10px] px-1.5 py-0.5 rounded-full border border-green-200/50 animate-pulse">
                    LIVE
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  {studyingFriends.length} 位好友正在学�?
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/60 hover:bg-white/80 flex items-center justify-center transition-all hover:rotate-90 shadow-md"
            >
              <X size={18} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4">
          {studyingFriends.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 py-12">
              <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <User size={48} className="opacity-50" />
              </div>
              <p className="text-lg font-semibold mb-2">暂无好友在线学习</p>
              <p className="text-sm">邀请好友一起加入自习室吧！</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {studyingFriends.map(friend => {
                const streak = getStudyStreak(friend.study_time || 0);
                return (
                  <div
                    key={friend.friend_id}
                    className="group relative bg-white/70 backdrop-blur-md rounded-xl p-3 border border-white/40 shadow-md hover:shadow-lg transition-all hover:scale-[1.01] cursor-pointer"
                    onClick={() => handleChatWithFriend(friend)}
                  >
                    {/* Status indicator */}
                    <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-md border-2 border-white animate-pulse">
                      <span className="text-sm">{streak.emoji}</span>
                    </div>

                    {/* Friend info */}
                    <div className="flex items-start gap-2 mb-2">
                      <div className="relative">
                        <Avatar name={friend.name} avatar={friend.avatar_url || ''} size="md" className="ring-2 ring-white shadow-sm" />
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-800 mb-0.5">
                          {friend.name}
                        </h3>
                        <div className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r ${streak.color} text-white text-[10px] font-bold shadow-sm`}>
                          <Flame size={10} />
                          {streak.level}
                        </div>
                      </div>
                    </div>

                    {/* Study time */}
                    <div className="flex items-center gap-1.5 mb-2 p-2 rounded-lg bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200/50">
                      <Clock size={14} className="text-cyan-600" />
                      <div className="flex-1">
                        <div className="text-[10px] text-slate-500">
                          已学习
                        </div>
                        <div className="text-sm font-bold text-cyan-700">
                          {formatStudyTime(friend.study_time || 0)}
                        </div>
                      </div>
                    </div>

                    {/* Last message */}
                    {friend.last_message && (
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-2">
                        <MessageCircle size={12} />
                        <span className="truncate">{friend.last_message}</span>
                      </div>
                    )}

                    {/* Action button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleChatWithFriend(friend);
                      }}
                      className="w-full py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle size={12} />
                      发送消息
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Offline friends section */}
          {allFriends.filter(f => !f.is_studying && f.friend_id !== 'clawbot').length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                离线好友
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {allFriends
                  .filter(f => !f.is_studying && f.friend_id !== 'clawbot')
                  .map(friend => (
                    <div
                      key={friend.friend_id}
                      onClick={() => handleChatWithFriend(friend)}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all cursor-pointer"
                    >
                      <div className="relative opacity-60">
                        <Avatar name={friend.name} avatar={friend.avatar_url || ''} size="md" className="ring-2 ring-white dark:ring-slate-700" />
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-slate-400 rounded-full border-2 border-white dark:border-slate-800"></div>
                      </div>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate w-full text-center">
                        {friend.name}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudyRoom;
