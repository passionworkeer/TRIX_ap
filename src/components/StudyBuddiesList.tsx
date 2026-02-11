import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import Avatar from './Avatar';
import { IMAGES } from '../constants';
import { X, Users } from 'lucide-react';

interface StudyBuddy {
  id: string;
  username: string;
  avatar: string;
  isMe: boolean;
}

interface StudyBuddiesListProps {
  isOpen: boolean;
  onClose: () => void;
}

const StudyBuddiesList: React.FC<StudyBuddiesListProps> = ({ isOpen, onClose }) => {
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

      console.log('👤 [StudyBuddies] 当前用户 ID:', userId);

      // 🎯 新逻辑: is_studying 在 profiles 表中,查询更简单
      // 1. 第一步: 查询 friends 表,获取好友 ID 列表
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

      // 2. 第二步: 如果有好友,查询 profiles 表筛选正在自习的
      const studyingFriends: StudyBuddy[] = [];

      if (friendsData && friendsData.length > 0) {
        const friendIds = friendsData.map(f => f.friend_id);
        
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, is_studying')
          .in('id', friendIds)
          .eq('is_studying', true); // ✅ 直接筛选正在自习的好友

        if (profilesError) {
          console.error('❌ [StudyBuddies] 获取好友 profiles 失败:', profilesError);
          return;
        }

        console.log('📊 [StudyBuddies] 正在自习的好友:', profiles);

        // 3. 第三步: 转换数据格式
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

      console.log('✅ [StudyBuddies] 自习伙伴列表:', studyingFriends);
      setBuddies(studyingFriends);
    } catch (error) {
      console.error('❌ [StudyBuddies] 加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchStudyBuddies();
    }
  }, [isOpen]);

  // 实时监听好友状态变化
  useEffect(() => {
    if (!currentUserId || !isOpen) return;

    console.log('🔌 [StudyBuddies] 启动实时监听');

    // 监听 profiles 表的 is_studying 字段更新
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
          console.log('🔥 [StudyBuddies] 检测到 profiles 更新:', payload);
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
  }, [currentUserId, isOpen]);

  // 如果未打开,不渲染
  if (!isOpen) return null;

  // 加入好友的自习室
  const handleJoinBuddy = (buddyId: string, buddyName: string) => {
    console.log(`🚀 [StudyBuddies] 加入 ${buddyName} 的自习室`);
    // TODO: 实现加入逻辑
    alert(`即将加入 ${buddyName} 的自习室 (功能开发中)`);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      {/* Modal 卡片 */}
      <div
        className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Users size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">正在自习的好友</h2>
              <p className="text-xs text-white/50">
                {loading ? '加载中...' : `${buddies.length} 人正在专注`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X size={18} className="text-white/70" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="overflow-y-auto max-h-[60vh] px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-3"></div>
              <p className="text-white/40 text-sm">加载好友列表...</p>
            </div>
          ) : buddies.length === 0 ? (
            // 空状态
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <Users size={32} className="text-white/20" />
              </div>
              <h3 className="text-white/70 font-semibold mb-2">暂时没有好友在自习</h3>
              <p className="text-white/40 text-sm text-center">
                快去邀请好友一起学习吧！<br />
                相互监督,共同进步
              </p>
            </div>
          ) : (
            // 好友列表
            <div className="space-y-3">
              {buddies.map((buddy) => (
                <div
                  key={buddy.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    {/* 头像 */}
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 ring-2 ring-white/10">
                        <Avatar
                          name={buddy.username}
                          avatar={buddy.avatar}
                          size="md"
                        />
                      </div>
                      {/* 在线状态 */}
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900">
                        <div className="w-full h-full bg-green-400 rounded-full animate-ping opacity-75"></div>
                      </div>
                    </div>

                    {/* 信息 */}
                    <div>
                      <p className="font-semibold text-white">{buddy.username}</p>
                      <p className="text-xs text-white/50 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                        正在专注中
                      </p>
                    </div>
                  </div>

                  {/* 加入按钮 */}
                  <button
                    onClick={() => handleJoinBuddy(buddy.id, buddy.username)}
                    className="px-4 py-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-all active:scale-95 shadow-lg shadow-blue-500/30"
                  >
                    加入
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部提示 */}
        {buddies.length > 0 && (
          <div className="px-6 py-4 border-t border-white/10 bg-white/5">
            <p className="text-xs text-white/40 text-center">
              💡 加入好友的自习室可以实时查看对方进度
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyBuddiesList;
