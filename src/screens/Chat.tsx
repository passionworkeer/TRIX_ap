import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Camera, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { IMAGES } from '../constants';
import { motion } from 'framer-motion';
import Avatar from '../components/Avatar';
import { AppRoutes } from '../types';
import { getFriends } from '../services/databaseService';
import type { FriendLatestMessage } from '../config/supabase';

// Mock Data for Quick Add (保留,因为这个不在数据库中)
const QUICK_ADD_USERS = [
  { id: 'qa1', name: 'Sarah Miller', username: 'sarah_m', avatar: '' },
  { id: 'qa2', name: 'Mike Chen', username: 'mike_c99', avatar: '' },
  { id: 'qa3', name: 'Jenny Wilson', username: 'j_wilson', avatar: '' },
  { id: 'qa4', name: 'Tom Hardy', username: 'tomh_official', avatar: '' },
  { id: 'qa5', name: 'Lisa Wang', username: 'lisa_wang', avatar: '' },
];

// 格式化时间显示
const formatTime = (timestamp: string | null): string => {
  if (!timestamp) return '';
  
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffMs = now.getTime() - messageTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return `${Math.floor(diffDays / 7)}w`;
};

// Mock Data for Chats - 已删除,使用数据库数据替代

const Chat: React.FC = () => {
  const navigate = useNavigate();
  const [friends, setFriends] = useState<FriendLatestMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // 加载好友列表
  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const data = await getFriends();
      setFriends(data);
    } catch (error) {
      console.error('加载好友列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取好友头像 (TRIX Bot 使用固定图片)
  const getFriendAvatar = (friendId: string, avatarUrl: string | null): string => {
    if (friendId === 'clawbot') return IMAGES.WIZARD_BOY;
    return avatarUrl || '';
  };

  return (
    <div className='h-screen w-full bg-white flex flex-col'>
       {/* 1. Header - 固定头部 */}
       <header className='px-4 pt-24 pb-4 bg-white flex justify-between items-center flex-shrink-0 w-full border-b border-gray-100'>
          {/* Left: Avatar (Small Profile) */}
          <div className='w-10 h-10 rounded-full bg-gray-200 overflow-hidden shadow-sm' onClick={() => navigate('/profile')}>
             <Avatar name='Me' size='md' className='w-full h-full object-cover' />
          </div>

          {/* Center: Title */}
          <h1 className='text-xl font-bold text-black tracking-wide font-sans'>Chat</h1>

          {/* Right: Actions */}
          <div className='flex items-center gap-4'>
             <div className='w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer'>
                <UserPlus size={20} className='text-gray-800' strokeWidth={2.5} />
             </div>
             <div className='w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer'>
                <Search size={22} className='text-gray-800' strokeWidth={2.5} />
             </div>
          </div>
       </header>

       {/* 2. 滚动内容区域 - 占据剩余空间并可滚动 */}
       <div className='flex-1 overflow-y-auto w-full pb-28'>
          
          {/* 2. Quick Add Section */}
          <div className='py-4 bg-white border-b border-gray-100'>
             <div className='px-4 mb-2'>
                <h3 className='text-[13px] font-bold text-gray-900 uppercase tracking-wide'>Quick Add</h3>
             </div>
             <div className='flex overflow-x-auto px-4 pb-2 gap-3 snap-x'>
                {QUICK_ADD_USERS.map((user) => (
                  <div key={user.id} className='min-w-[130px] p-3 bg-white rounded-lg border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col items-center relative snap-start'>
                     <button className='absolute top-1 right-1 text-gray-300 hover:text-gray-500 p-1'>
                        <span className='sr-only'>Dismiss</span>
                        <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><line x1='18' y1='6' x2='6' y2='18'></line><line x1='6' y1='6' x2='18' y2='18'></line></svg>
                     </button>
                     <div className='mb-2'>
                        <Avatar name={user.name} size='md' />
                     </div>
                     <span className='text-[13px] font-bold text-black truncate w-full text-center leading-tight'>{user.name}</span>
                     <span className='text-[11px] text-gray-400 truncate w-full text-center mb-3 leading-tight'>{user.username}</span>
                     <button className='w-full py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-[12px] font-bold text-black transition-colors'>
                        + Add
                     </button>
                  </div>
                ))}
             </div>
          </div>

          {/* 3. Chat List */}
          <div className='flex flex-col w-full'>
            {loading ? (
              <div className='flex items-center justify-center py-10'>
                <div className='text-sm text-gray-400'>加载中...</div>
              </div>
            ) : friends.length === 0 ? (
              <div className='flex items-center justify-center py-10'>
                <div className='text-sm text-gray-400'>暂无好友</div>
              </div>
            ) : (
              friends.map((friend) => {
                const hasUnread = (friend.unread_count || 0) > 0;
                const avatar = getFriendAvatar(friend.friend_id, friend.avatar_url);
                const isBot = friend.friend_id === 'clawbot';
                
                return (
                  <motion.div 
                    key={friend.friend_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className='flex items-center px-4 py-3 w-full hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer'
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
                    {/* Left: Huge Avatar */}
                    <div className='relative mr-3 flex-shrink-0'>
                      <Avatar name={friend.name} avatar={avatar} size='lg' className='w-[52px] h-[52px]' />
                      {/* 在线状态指示器 */}
                      {friend.status === 'online' && (
                        <div className='absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white' />
                      )}
                    </div>

                    {/* Middle: Name & Status */}
                    <div className='flex-1 min-w-0 pr-2'>
                      <h3 className='text-[16px] font-bold text-gray-900 leading-tight mb-0.5 truncate font-sans'>
                        {friend.name}
                      </h3>
                      <div className='flex items-center gap-1.5'>
                        {hasUnread ? (
                          <MessageSquare size={14} className='text-blue-500 fill-current' strokeWidth={2.5} />
                        ) : (
                          <MessageSquare size={14} className='text-gray-400' strokeWidth={2.5} />
                        )}
                        <span className={`text-[13px] font-medium truncate ${hasUnread ? 'text-blue-500' : 'text-gray-400'}`}>
                          {friend.last_message || (isBot ? 'Tap to chat' : '暂无消息')}
                          {friend.last_message_time && (
                            <>
                              <span className='text-gray-300 mx-0.5'>•</span>
                              <span className='text-gray-400'>{formatTime(friend.last_message_time)}</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Right: Unread Badge or Camera */}
                    <div className='flex-shrink-0 pl-2 border-l border-transparent'>
                      {hasUnread ? (
                        <div className='w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center'>
                          <span className='text-[11px] font-bold text-white'>
                            {friend.unread_count! > 9 ? '9+' : friend.unread_count}
                          </span>
                        </div>
                      ) : (
                        <div className='w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors'>
                          <Camera size={20} className='text-gray-400' />
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
       </div>
    </div>
  );
};

export default Chat;
