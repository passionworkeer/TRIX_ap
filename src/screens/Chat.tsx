import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Camera, MessageSquare, X, Scan } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AddFriendModal from '../components/AddFriendModal';
import { useNavigate } from 'react-router-dom';
import { IMAGES } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '../components/Avatar';
import { AppRoutes } from '../types';
import { getFriends, addFriend } from '../services/databaseService';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import type { FriendLatestMessage } from '../config/supabase';
import { useNotification } from '../hooks/useNotification';
import { formatRelative } from '../utils/dateFormat';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';
import { getErrorMessage } from '../utils/errorHandler';

const BG_IMAGE = IMAGES.BACKGROUND;

// 推荐用户接口
interface RecommendedUser {
  id: string;
  username: string;
  display_name: string;
  email: string;
  bio: string | null;
}

const Chat: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { showError } = useNotification();
  const [friends, setFriends] = useState<FriendLatestMessage[]>([]);
  const [recommendedUsers, setRecommendedUsers] = useState<RecommendedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { isConnected: isClawbotChannelConnected, isPaired: isClawbotPaired } = useClawbotChannel();

  // 加载好友列表
  useEffect(() => {
    loadFriends();
    loadRecommendedUsers();
  }, []);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const data = await getFriends();
      setFriends(data);
    } catch (error) {
      logger.chat.error('加载好友列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载推荐用户（不是好友的其他用户）
  const loadRecommendedUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        logger.chat.debug('未登录，跳过加载推荐用户');
        return;
      }

      const currentUserId = session.user.id;
      const currentUserEmail = session.user.email;

      // 获取所有用户（排除自己）
      const { data: allProfiles, error: usersError } = await supabase
        .from('profiles')
        .select('id, username, full_name, email, bio')
        .neq('id', currentUserId)
        .limit(10);

      if (usersError) {
        logger.chat.error('获取推荐用户失败:', usersError);
        return;
      }

      // 获取已添加的好友ID列表
      const { data: existingFriends, error: friendsError } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', currentUserId);

      if (friendsError) {
        logger.chat.error('获取好友列表失败:', friendsError);
        return;
      }

      const friendIds = new Set(existingFriends?.map(f => f.friend_id) || []);

      // 过滤出不是好友的用户
      const notFriends = (allProfiles || []).filter(user =>
        !friendIds.has(user.id) &&
        user.id !== currentUserId &&
        user.email !== currentUserEmail
      );

      const normalizedUsers: RecommendedUser[] = notFriends.map(user => ({
        id: user.id,
        username: user.username,
        display_name: user.full_name || user.username,
        email: user.email,
        bio: user.bio
      }));

      setRecommendedUsers(normalizedUsers.slice(0, 5));
    } catch (error) {
      logger.chat.error('加载推荐用户失败:', error);
    }
  };

  // 快速添加好友
  const handleQuickAdd = async (username: string) => {
    try {
      await addFriend(username);
      await loadFriends();
      await loadRecommendedUsers();
    } catch (error: unknown) {
      showError(getErrorMessage(error, '添加失败'));
    }
  };

  // 获取好友头像
  const getFriendAvatar = (friendId: string, avatarUrl: string | null): string => {
    if (friendId === 'clawbot') return IMAGES.WIZARD_BOY;
    return avatarUrl || '';
  };

  // 过滤好友列表
  const filteredFriends = friends.filter(friend =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-screen w-full relative overflow-hidden" style={{ background: 'transparent' }}>
       {/* 背景层：z-index: 0 */}
       <div
          className="fixed inset-0 w-full h-full"
          style={{ zIndex: 0, pointerEvents: 'none' }}
       >
          <img
             src={BG_IMAGE}
             alt="Background"
             className="w-full h-full object-cover"
             style={{ filter: 'brightness(0.2)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/40" />
       </div>

       {/* 内容层：z-index: 10 */}
       <div className="relative z-10 h-full flex flex-col overflow-hidden">
          {/* 顶部导航与搜索 */}
          <div className="pt-24 pb-4 px-4 flex-shrink-0">
             {/* 标题 */}
             <h1 className="text-xl font-bold text-white text-center mb-4 tracking-wide">{t('chat.title')}</h1>

             {/* Snapchat 风格搜索栏 */}
             <div className="bg-white/5 border border-white/10 backdrop-blur-sm h-11 rounded-full flex items-center px-4 mx-auto max-w-md transition-all hover:bg-white/10">
                <Search size={18} className="text-white/60 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="搜索"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/50 ml-3 text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-white/60 hover:text-white flex-shrink-0 w-8 h-8 flex items-center justify-center"
                    aria-label="清除搜索"
                  >
                    <X size={16} />
                  </button>
                )}
             </div>
          </div>

          {/* 滚动内容区域 */}
          <div className="flex-1 overflow-y-auto pb-28">
             {/* 推荐好友区域 - Snapchat Quick Add 风格 */}
             {recommendedUsers.length > 0 && (
                <div className="mb-2">
                   <div className="px-4 mb-3">
                      <h3 className="text-white/80 font-bold text-sm uppercase tracking-wide">Quick Add</h3>
                   </div>

                   <div className="flex overflow-x-auto gap-3 px-4 pb-4">
                     {recommendedUsers.map((user, index) => (
                        <motion.div
                          key={user.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 min-w-[130px] flex flex-col items-center relative flex-shrink-0"
                        >
                          {/* 关闭按钮 */}
                          <button
                            className="absolute top-2 right-2 text-white/30 hover:text-white/60 transition-colors w-8 h-8 flex items-center justify-center"
                            onClick={() => {
                              const filtered = recommendedUsers.filter(u => u.id !== user.id);
                              setRecommendedUsers(filtered);
                            }}
                            aria-label={`移除${user.display_name}`}
                          >
                            <X size={14} />
                          </button>

                          {/* 头像 */}
                          <div className="mb-2 flex items-center justify-center">
                             <Avatar name={user.display_name} size="lg" className="w-16 h-16 rounded-full border-2 border-white/5" />
                          </div>

                          {/* 名字 */}
                          <span className="font-bold text-white text-sm truncate w-full text-center">{user.display_name}</span>

                          {/* Snapchat 风格明黄色按钮 */}
                          <button
                            onClick={() => handleQuickAdd(user.username)}
                            className="bg-amber-400 hover:bg-amber-500 text-black font-bold text-xs px-6 py-1.5 rounded-full mt-2 transition-all shadow-[0_0_10px_rgba(250,204,21,0.3)] hover:shadow-[0_0_15px_rgba(250,204,21,0.5)]"
                          >
                            + 添加
                          </button>
                        </motion.div>
                     ))}
                   </div>
                </div>
             )}

             {/* 聊天列表 - 轻盈透明风格 */}
             <div className="px-4 pt-4 pb-20">
                   {loading ? (
                      <div className="flex items-center justify-center py-10">
                        <div className="text-sm text-gray-400">{t('common.loading')}</div>
                      </div>
                   ) : (
                      <AnimatePresence>
                        {/* Clawbot 机器人 - 始终显示在最顶部 */}
                        <motion.div
                          key="clawbot"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center py-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors mb-2"
                          onClick={() => {
                            if (isClawbotChannelConnected && isClawbotPaired) {
                              // 已连接，进入聊天
                              navigate(AppRoutes.CHAT_DETAIL, {
                                state: {
                                  name: 'TRIX Bot',
                                  avatar: IMAGES.WIZARD_BOY,
                                  isBot: true,
                                  friendId: 'clawbot'
                                }
                              });
                            } else {
                              // 未连接，跳转到配对页面
                              navigate(AppRoutes.PAIRING);
                            }
                          }}
                        >
                          {/* 头像 */}
                          <div className="relative mr-4 flex-shrink-0 flex items-center justify-center">
                             <Avatar name="TRIX Bot" avatar={IMAGES.WIZARD_BOY} size="lg" className="w-12 h-12 rounded-full border border-white/10" />
                             {/* 连接状态指示器 */}
                             {isClawbotChannelConnected && isClawbotPaired ? (
                                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-black/30 shadow-lg shadow-green-400/50"></div>
                             ) : (
                                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-gray-400 rounded-full border-2 border-black/30"></div>
                             )}
                          </div>

                          {/* 文本区域 */}
                          <div className="flex-1 min-w-0">
                             <h3 className="text-white font-bold text-base leading-tight mb-0.5 flex items-center gap-2">
                               TRIX Bot
                               {!(isClawbotChannelConnected && isClawbotPaired) && (
                                 <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">{t('chat.unpaired')}</span>
                               )}
                             </h3>
                             <div className="flex items-center gap-1.5">
                                <MessageSquare size={14} className={isClawbotChannelConnected && isClawbotPaired ? "text-green-400" : "text-gray-500"} strokeWidth={2.5} />
                                <span className="text-sm text-gray-400 truncate">
                                  {isClawbotChannelConnected && isClawbotPaired ? 'AI 助手已就绪' : '点击配对'}
                                </span>
                             </div>
                          </div>

                          {/* 右侧图标 */}
                          <div className="flex-shrink-0 pl-2">
                             {isClawbotChannelConnected && isClawbotPaired ? (
                                <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-400/30 flex items-center justify-center">
                                   <Camera size={18} className="text-green-400" />
                                </div>
                             ) : (
                                <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-400/30 flex items-center justify-center">
                                   <Scan size={18} className="text-orange-400" />
                                </div>
                             )}
                          </div>
                        </motion.div>

                        {/* 分隔线 */}
                        {friends.length > 0 && (
                          <div className="my-2 flex items-center gap-3">
                            <div className="flex-1 h-px bg-white/5"></div>
                            <span className="text-xs text-white/40 uppercase tracking-wide">Friends</span>
                            <div className="flex-1 h-px bg-white/5"></div>
                          </div>
                        )}

                        {/* 好友列表 */}
                        {friends.length === 0 && !loading ? (
                          <div className="flex items-center justify-center py-10">
                            <div className="text-sm text-gray-400">{t('chat.noFriends')}</div>
                          </div>
                        ) : (
                        filteredFriends.map((friend, index) => {
                          const hasUnread = (friend.unread_count || 0) > 0;
                          const avatar = getFriendAvatar(friend.friend_id, friend.avatar_url);
                          const isBot = friend.friend_id === 'clawbot';

                          return (
                            <motion.div
                              key={friend.friend_id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ delay: index * 0.03 }}
                              className="flex items-center py-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                              onClick={() => {
                                navigate(AppRoutes.CHAT_DETAIL, {
                                  state: {
                                    name: friend.name,
                                    avatar: avatar,
                                    isBot: isBot,
                                    friendId: friend.friend_id
                                  }
                                });
                              }}
                            >
                              {/* 头像 */}
                              <div className="relative mr-4 flex-shrink-0 flex items-center justify-center">
                                 <Avatar name={friend.name} avatar={avatar} size="lg" className="w-12 h-12 rounded-full border border-white/10" />
                                 {/* 在线状态指示器 */}
                                 {friend.status === 'online' && (
                                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-black/30 shadow-lg shadow-green-400/50"></div>
                                 )}
                              </div>

                              {/* 文本区域 */}
                              <div className="flex-1 min-w-0">
                                 <h3 className="text-white font-bold text-base leading-tight mb-0.5">{friend.name}</h3>
                                 <div className="flex items-center gap-1.5">
                                    {hasUnread ? (
                                      <MessageSquare size={14} className="text-amber-400 fill-current" strokeWidth={2.5} />
                                    ) : (
                                      <MessageSquare size={14} className="text-gray-500" strokeWidth={2.5} />
                                    )}
                                    <span className={`text-sm truncate ${hasUnread ? 'text-white font-medium' : 'text-gray-400'}`}>
                                      {friend.last_message || (isBot ? 'Tap to chat' : '新快照')}
                                      {friend.last_message_time && (
                                         <>
                                           <span className="text-gray-600 mx-0.5">•</span>
                                           <span className="text-gray-500">{formatRelative(friend.last_message_time)}</span>
                                         </>
                                      )}
                                    </span>
                                 </div>
                              </div>

                              {/* 右侧图标 */}
                              <div className="flex-shrink-0 pl-2">
                                 {hasUnread ? (
                                    <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center shadow-[0_0_10px_rgba(250,204,21,0.3)]">
                                      <span className="text-xs font-bold text-black">
                                         {friend.unread_count! > 9 ? '9+' : friend.unread_count}
                                      </span>
                                    </div>
                                 ) : (
                                    <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors">
                                       <Camera size={18} className="text-gray-400" />
                                    </div>
                                 )}
                              </div>
                            </motion.div>
                          );
                        })
                        )}
                      </AnimatePresence>
                   )}
             </div>
          </div>

          {/* 右上角添加好友按钮 */}
          <button
             className="absolute top-[5.5rem] right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 hover:scale-110 transition-all z-20"
             onClick={() => setShowAddModal(true)}
             aria-label="添加好友"
          >
             <UserPlus size={18} className="text-white/80" />
          </button>

          {/* 添加好友弹窗 */}
          <AddFriendModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            onSend={async (account) => {
              await addFriend(account);
              await loadFriends();
            }}
          />
       </div>
    </div>
  );
};

export default Chat;
