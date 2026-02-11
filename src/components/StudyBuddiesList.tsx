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
        .select('is_studying, username, avatar')
        .eq('id', userId)
        .single();

      // 2. 获取所有正在自习的好友
      const { data: friendsData, error: friendsError } = await supabase
        .from('friends')
        .select(`
          friend_id,
          profiles:friend_id (
            id,
            username,
            avatar,
            is_studying
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (friendsError) {
        console.error('❌ [StudyBuddies] 获取好友失败:', friendsError);
        return;
      }

      console.log('📊 [StudyBuddies] 好友数据:', friendsData);

      // 3. 筛选正在自习的好友
      const studyingFriends: StudyBuddy[] = [];
      
      if (friendsData) {
        friendsData.forEach((friend: any) => {
          const profile = friend.profiles;
          if (profile && profile.is_studying) {
            studyingFriends.push({
              id: profile.id,
              username: profile.username || 'Unknown',
              avatar: profile.avatar || IMAGES.WIZARD_BOY_LOGIN,
              isMe: false
            });
          }
        });
      }

      // 4. 如果我也在自习,把自己放在第一位
      const allBuddies: StudyBuddy[] = [];
      
      if (myProfile?.is_studying) {
        allBuddies.push({
          id: userId,
          username: myProfile.username || 'Me',
          avatar: myProfile.avatar || IMAGES.WIZARD_BOY_LOGIN,
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
      <div className="w-full px-6 mb-6">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-white/40 text-sm">
            <div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin"></div>
            <span>加载自习伙伴...</span>
          </div>
        </div>
      </div>
    );
  }

  if (buddies.length === 0) {
    return (
      <div className="w-full px-6 mb-6">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <span className="text-lg">😴</span>
            <span>暂无好友在线自习</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 mb-6">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white/90 text-sm font-semibold flex items-center gap-2">
            <span className="text-xl">📚</span>
            <span>自习伙伴 ({buddies.length}人正在专注)</span>
          </h3>
        </div>

        {/* 横向滚动列表 */}
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          <div className="flex gap-4 pb-2">
            {buddies.map((buddy) => (
              <div
                key={buddy.id}
                className="flex flex-col items-center gap-2 min-w-[64px] group"
              >
                {/* 头像 */}
                <div className="relative">
                  <div
                    className={`rounded-full p-0.5 transition-all duration-300 ${
                      buddy.isMe
                        ? 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 shadow-lg shadow-yellow-500/50 ring-2 ring-yellow-400/50'
                        : 'bg-gradient-to-br from-white/20 to-white/10 group-hover:from-white/30 group-hover:to-white/20'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10">
                      <Avatar
                        name={buddy.username}
                        avatar={buddy.avatar}
                        size="md"
                      />
                    </div>
                  </div>

                  {/* 自习状态指示器 */}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900 shadow-lg">
                    <div className="w-full h-full bg-green-400 rounded-full animate-ping opacity-75"></div>
                  </div>
                </div>

                {/* 用户名 */}
                <div className="text-center">
                  <p
                    className={`text-xs font-medium truncate max-w-[64px] ${
                      buddy.isMe
                        ? 'text-yellow-300 font-bold'
                        : 'text-white/70 group-hover:text-white/90'
                    }`}
                  >
                    {buddy.isMe ? '我' : buddy.username}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 提示文字 */}
        {buddies.some(b => b.isMe) && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <p className="text-white/40 text-xs text-center flex items-center justify-center gap-1">
              <span>🔥</span>
              <span>保持专注,一起加油!</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyBuddiesList;
