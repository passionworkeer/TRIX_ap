import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import Avatar from './Avatar';
import { IMAGES } from '../constants';

interface StudyBuddy {
  id: string;
  username: string;
  avatar: string;
  isMe: boolean;
}

const StudyBuddiesList: React.FC = () => {
  const [buddies, setBuddies] = useState<StudyBuddy[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // 获取自习伙伴列表
  const fetchStudyBuddies = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.log('⚠️ [StudyBuddies] 未登录');
        return;
      }

      const userId = session.user.id;
      setCurrentUserId(userId);

      // 1. 获取我的自习状态
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('is_studying, username, avatar_url')
        .eq('id', userId)
        .single();

      console.log('👤 [StudyBuddies] 我的状态:', myProfile);

      // 2. 第一步: 查询所有好友关系
      const { data: friendsData, error: friendsError } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (friendsError) {
        console.error('❌ [StudyBuddies] 获取好友关系失败:', friendsError);
        return;
      }

      console.log('📊 [StudyBuddies] 好友关系数据:', friendsData);

      // 3. 第二步: 如果有好友,批量查询他们的 profiles
      const studyingFriends: StudyBuddy[] = [];

      if (friendsData && friendsData.length > 0) {
        const friendIds = friendsData.map(f => f.friend_id);
        
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, is_studying')
          .in('id', friendIds)
          .eq('is_studying', true); // 只要正在自习的

        if (profilesError) {
          console.error('❌ [StudyBuddies] 获取好友 profiles 失败:', profilesError);
          return;
        }

        console.log('📊 [StudyBuddies] 正在自习的好友:', profiles);

        // 4. 转换为 StudyBuddy 格式
        if (profiles) {
          profiles.forEach((profile) => {
            studyingFriends.push({
              id: profile.id,
              username: profile.username || 'Unknown',
              avatar: profile.avatar_url || IMAGES.WIZARD_BOY_LOGIN,
              isMe: false
            });
          });
        }
      }

      // 5. 如果我也在自习,把自己放在第一位
      const allBuddies: StudyBuddy[] = [];
      
      if (myProfile?.is_studying) {
        allBuddies.push({
          id: userId,
          username: myProfile.username || 'Me',
          avatar: myProfile.avatar_url || IMAGES.WIZARD_BOY_LOGIN,
          isMe: true
        });
      }

      allBuddies.push(...studyingFriends);

      console.log('✅ [StudyBuddies] 自习伙伴列表:', allBuddies);
      setBuddies(allBuddies);
    } catch (error) {
      console.error('❌ [StudyBuddies] 加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchStudyBuddies();
  }, []);

  // 实时监听好友状态变化
  useEffect(() => {
    if (!currentUserId) return;

    console.log('🔌 [StudyBuddies] 启动实时监听');

    // 监听 profiles 表的更新 (好友的 is_studying 状态变化)
    const channel = supabase
      .channel('study-buddies-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          console.log('🔥 [StudyBuddies] 检测到 profile 更新:', payload);
          // 重新获取列表
          fetchStudyBuddies();
        }
      )
      .subscribe((status) => {
        console.log(`📡 [StudyBuddies] 订阅状态: ${status}`);
      });

    return () => {
      console.log('🧹 [StudyBuddies] 清理订阅');
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  if (loading) {
    return (
      <div className="absolute top-16 right-4 z-30">
        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-black/20 backdrop-blur-md border border-white/10">
          <div className="w-3 h-3 border-2 border-white/40 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-white/60 text-xs">加载中...</span>
        </div>
      </div>
    );
  }

  if (buddies.length === 0) {
    return null; // 没有好友在自习时不显示组件
  }

  return (
    <div className="absolute top-16 right-4 z-30 flex flex-col items-end gap-2">
      {/* 标题栏 - 半透明悬浮 */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-md border border-white/10 shadow-lg">
        <span className="text-xs font-medium text-white/90">📚</span>
        <span className="text-xs font-semibold text-white/90">{buddies.length}人专注中</span>
      </div>

      {/* 头像列表 - 从右往左排列 */}
      <div className="flex flex-row-reverse gap-2">
        {buddies.map((buddy) => (
          <div
            key={buddy.id}
            className="flex flex-col items-center gap-1 group"
            title={buddy.isMe ? '我' : buddy.username}
          >
            {/* 头像 */}
            <div className="relative">
              <div
                className={`rounded-full p-0.5 transition-all duration-300 ${
                  buddy.isMe
                    ? 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 shadow-lg shadow-yellow-500/50 ring-2 ring-yellow-400/50'
                    : 'bg-gradient-to-br from-white/30 to-white/20 group-hover:from-white/40 group-hover:to-white/30'
                }`}
              >
                <div className="w-10 h-10 rounded-full overflow-hidden bg-black/20 backdrop-blur-sm">
                  <Avatar
                    name={buddy.username}
                    avatar={buddy.avatar}
                    size="sm"
                  />
                </div>
              </div>

              {/* 在线状态指示器 */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-black/50 shadow-lg">
                <div className="w-full h-full bg-green-400 rounded-full animate-ping opacity-75"></div>
              </div>
            </div>

            {/* 用户名标签 - hover 显示 */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-md ${
                  buddy.isMe
                    ? 'bg-yellow-500/30 text-yellow-200'
                    : 'bg-black/30 text-white/80'
                }`}
              >
                {buddy.isMe ? '我' : buddy.username}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StudyBuddiesList;
