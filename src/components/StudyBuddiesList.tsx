import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { AppRoutes } from '../types';
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
  const navigate = useNavigate();
  const [buddies, setBuddies] = useState<StudyBuddy[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [joiningBuddyId, setJoiningBuddyId] = useState<string | null>(null); // 正在加入的好友 ID

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
        console.log('🔍 [StudyBuddies] 好友 ID 列表:', friendIds);
        
        // 先查询所有好友的 profiles（包含 is_studying 状态）
        const { data: allProfiles, error: allProfilesError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, is_studying')
          .in('id', friendIds);

        if (allProfilesError) {
          console.error('❌ [StudyBuddies] 获取好友 profiles 失败:', allProfilesError);
          return;
        }

        console.log('📊 [StudyBuddies] 所有好友的 profiles:', allProfiles);
        
        // 再查询正在自习的好友
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, is_studying')
          .in('id', friendIds)
          .eq('is_studying', true); // ✅ 直接筛选正在自习的好友

        if (profilesError) {
          console.error('❌ [StudyBuddies] 获取自习中好友失败:', profilesError);
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

    console.log('🔌 [StudyBuddies] 启动实时监听 profiles 表');

    let refreshTimeout: NodeJS.Timeout;

    // 监听 profiles 表的 is_studying 和 companion_id 字段更新
    const channel = supabase
      .channel(`study-buddies-realtime-${currentUserId}`) // 唯一 channel 名称
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          // filter: `id=neq.${currentUserId}` // 可选：只监听其他用户的更新
        },
        (payload) => {
          console.log('🔥 [StudyBuddies] 检测到 profiles 更新:', payload);
          console.log('🔍 [StudyBuddies] 更新的字段:', payload.new);
          
          // 检查是否是 is_studying 或 companion_id 字段变化
          if ('is_studying' in payload.new || 'companion_id' in payload.new) {
            console.log(`📊 [StudyBuddies] 状态变化:`, {
              is_studying: `${payload.old?.is_studying} → ${payload.new.is_studying}`,
              companion_id: `${payload.old?.companion_id} → ${payload.new.companion_id}`
            });
            
            // 🎯 优化：防抖刷新（避免频繁查询）
            clearTimeout(refreshTimeout);
            refreshTimeout = setTimeout(() => {
              console.log('🔄 [StudyBuddies] 刷新好友列表...');
              fetchStudyBuddies();
            }, 500); // 500ms 防抖
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 [StudyBuddies] 订阅状态: ${status}`);
        if (status === 'SUBSCRIBED') {
          console.log('✅ [StudyBuddies] Realtime 订阅成功！');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [StudyBuddies] Realtime 订阅失败！');
        }
      });

    return () => {
      console.log('🧹 [StudyBuddies] 清理订阅');
      clearTimeout(refreshTimeout);
      supabase.removeChannel(channel);
    };
  }, [currentUserId, isOpen]); // fetchStudyBuddies 通过闭包访问，不需要加入依赖

  // 如果未打开,不渲染
  if (!isOpen) return null;

  // 加入好友的自习室
  const handleJoinBuddy = async (buddyId: string, buddyName: string) => {
    console.log(`🚀 [StudyBuddies] 准备加入 ${buddyName} 的自习室`, { buddyId });
    
    // 设置加入中状态（显示 Loading）
    setJoiningBuddyId(buddyId);
    
    try {
      // 获取好友信息
      const buddy = buddies.find(b => b.id === buddyId);
      if (!buddy) {
        throw new Error('好友信息不存在');
      }

      // 获取当前用户 session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error('用户未登录');
      }

      const myId = session.user.id;

      console.log(`🔗 [StudyBuddies] 建立双向连接: ${myId} ↔️ ${buddyId}`);

      // 🎯 双向更新：使用事务确保数据一致性
      // 1. 更新自己的状态：设置为正在自习 + 关联到好友
      const { error: myError } = await supabase
        .from('profiles')
        .update({ 
          is_studying: true,
          companion_id: buddyId  // 关联到好友
        })
        .eq('id', myId);

      if (myError) {
        console.error('❌ [StudyBuddies] 更新自己的状态失败:', myError);
        throw myError;
      }

      // 2. 更新好友的状态：关联到我
      const { error: buddyError } = await supabase
        .from('profiles')
        .update({ 
          companion_id: myId  // 好友关联到我
        })
        .eq('id', buddyId);

      if (buddyError) {
        console.error('❌ [StudyBuddies] 更新好友的状态失败:', buddyError);
        // 回滚自己的状态
        await supabase
          .from('profiles')
          .update({ is_studying: false, companion_id: null })
          .eq('id', myId);
        throw buddyError;
      }
      
      console.log(`✅ [StudyBuddies] 双向连接建立成功！`);
      
      // 关闭弹窗
      onClose();

      // 跳转到计时器页面，传递好友信息
      navigate(AppRoutes.TIMER, {
        state: {
          duration: 25, // 默认25分钟
          companion: {
            id: buddy.id,
            username: buddy.username,
            avatar: buddy.avatar
          }
        }
      });
      
    } catch (error) {
      console.error(`❌ [StudyBuddies] 加入失败:`, error);
      alert(`加入 ${buddyName} 的自习室失败，请稍后重试`);
    } finally {
      setJoiningBuddyId(null);
    }
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
                    disabled={joiningBuddyId !== null}
                    className={`
                      px-4 py-2 rounded-full text-white text-sm font-semibold transition-all shadow-lg
                      ${joiningBuddyId === buddy.id 
                        ? 'bg-blue-400 cursor-wait' 
                        : joiningBuddyId !== null
                        ? 'bg-gray-500 cursor-not-allowed opacity-50'
                        : 'bg-blue-500 hover:bg-blue-600 active:scale-95 shadow-blue-500/30'
                      }
                    `}
                  >
                    {joiningBuddyId === buddy.id ? (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>加入中...</span>
                      </div>
                    ) : (
                      '加入'
                    )}
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
