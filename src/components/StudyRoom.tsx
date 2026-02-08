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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-gradient-to-br from-white/95 to-blue-50/95 dark:from-slate-800/95 dark:to-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl max-h-[85vh] flex flex-col animate-scaleIn">
        {/* Header */}
        <div className="relative p-6 border-b border-slate-200/50 dark:border-slate-700/50">
          {/* Background decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-400/20 to-pink-500/20 rounded-full blur-2xl"></div>
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                <User className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                  好友自习�?
                  <span className="bg-green-500/20 text-green-600 dark:text-green-400 text-xs px-2 py-0.5 rounded-full border border-green-200/50 animate-pulse">
                    LIVE
                  </span>
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {studyingFriends.length} 位好友正在学�?
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/80 dark:bg-slate-700/80 hover:bg-white dark:hover:bg-slate-700 flex items-center justify-center transition-all hover:rotate-90 shadow-lg"
            >
              <X size={20} className="text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {studyingFriends.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 py-12">
              <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <User size={48} className="opacity-50" />
              </div>
              <p className="text-lg font-semibold mb-2">暂无好友在线学习</p>
              <p className="text-sm">邀请好友一起加入自习室吧！</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {studyingFriends.map(friend => {
                const streak = getStudyStreak(friend.study_time || 0);
                return (
                  <div
                    key={friend.friend_id}
                    className="group relative bg-white/60 dark:bg-slate-800/60 backdrop-blur-lg rounded-2xl p-4 border border-white/50 dark:border-slate-700/50 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer"
                    onClick={() => handleChatWithFriend(friend)}
                  >
                    {/* Status indicator */}
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-800 animate-pulse">
                      <span className="text-lg">{streak.emoji}</span>
                    </div>

                    {/* Friend info */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="relative">
                        <Avatar name={friend.name} avatar={friend.avatar_url || ''} size="lg" className="ring-2 ring-white dark:ring-slate-700 shadow-md" />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-slate-800"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
                          {friend.name}
                        </h3>
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r ${streak.color} text-white text-xs font-bold shadow-md`}>
                          <Flame size={12} />
                          {streak.level}
                        </div>
                      </div>
                    </div>

                    {/* Study time */}
                    <div className="flex items-center gap-2 mb-3 p-3 rounded-xl bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border border-cyan-200/50 dark:border-cyan-700/50">
                      <Clock size={18} className="text-cyan-600 dark:text-cyan-400" />
                      <div className="flex-1">
                        <div className="text-xs text-slate-600 dark:text-slate-400 mb-0.5">
                          已学�?
                        </div>
                        <div className="text-lg font-black text-cyan-700 dark:text-cyan-300">
                          {formatStudyTime(friend.study_time || 0)}
                        </div>
                      </div>
                    </div>

                    {/* Last message */}
                    {friend.last_message && (
                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 mb-3">
                        <MessageCircle size={14} />
                        <span className="truncate">{friend.last_message}</span>
                      </div>
                    )}

                    {/* Action button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleChatWithFriend(friend);
                      }}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 group-hover:shadow-xl"
                    >
                      <MessageCircle size={16} />
                      发送消�?
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
