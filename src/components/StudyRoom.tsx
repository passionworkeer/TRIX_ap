import React, { useState, useEffect } from 'react';
import { X, Clock, User, Flame, Play, Square } from 'lucide-react';
import { supabase } from '../config/supabase';
import Avatar from './Avatar';

interface StudyRoomProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RoomMember {
  id: string;
  user_id: string | null;
  friend_id: string | null;
  display_name: string;
  avatar_url: string | null;
  status: 'focusing' | 'idle' | 'away';
  last_seen: string;
  joined_at: string;
}

interface StudyRoomProps {
  isOpen: boolean;
  onClose: () => void;
}

const StudyRoom: React.FC<StudyRoomProps> = ({ isOpen, onClose }) => {
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFocusing, setIsFocusing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [studyTime, setStudyTime] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);

  // 默认自习室 ID (可以改为动态选择)
  const DEFAULT_ROOM_ID = '00000000-0000-0000-0000-000000000001';

  // 获取当前用户 ID
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setCurrentUserId(session.user.id);
      }
    };
    getCurrentUser();
  }, []);

  // 加载自习室成员
  const loadMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('study_room_members')
        .select('*')
        .eq('room_id', DEFAULT_ROOM_ID)
        .eq('is_active', true);

      if (error) throw error;

      // 过滤出活跃成员 (5分钟内有活动)
      const now = new Date();
      const activeMembers = (data || []).filter(member => {
        const lastSeen = new Date(member.last_seen);
        const diffMinutes = (now.getTime() - lastSeen.getTime()) / 60000;
        return diffMinutes < 5 && member.status !== 'idle';
      });

      setMembers(activeMembers);
    } catch (error) {
      console.error('加载自习室成员失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    if (isOpen) {
      loadMembers();
    }
  }, [isOpen]);

  // 实时订阅自习室成员变化
  useEffect(() => {
    if (!isOpen) return;

    const channel = supabase
      .channel(`study_room:${DEFAULT_ROOM_ID}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'study_room_members',
          filter: `room_id=eq.${DEFAULT_ROOM_ID}`
        },
        (payload) => {
          console.log('自习室成员变化:', payload);
          loadMembers(); // 重新加载成员列表
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen]);

  // 开始专注
  const handleStartFocus = async () => {
    if (!currentUserId) {
      alert('请先登录');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.rpc('upsert_study_room_member', {
        p_room_id: DEFAULT_ROOM_ID,
        p_user_id: currentUserId,
        p_status: 'focusing',
        p_display_name: user?.email?.split('@')[0] || '匿名用户',
        p_avatar_url: user?.user_metadata?.avatar_url || null
      });

      if (error) throw error;

      setIsFocusing(true);
      setStudyTime(0);

      // 启动计时器
      const interval = setInterval(() => {
        setStudyTime(prev => prev + 1);
      }, 1000);
      setTimerInterval(interval);

    } catch (error) {
      console.error('开始专注失败:', error);
      alert('开始专注失败,请重试');
    }
  };

  // 停止专注
  const handleStopFocus = async () => {
    if (!currentUserId) return;

    try {
      await supabase
        .from('study_room_members')
        .update({ status: 'idle', is_active: false })
        .eq('room_id', DEFAULT_ROOM_ID)
        .eq('user_id', currentUserId);

      setIsFocusing(false);
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }
    } catch (error) {
      console.error('停止专注失败:', error);
    }
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [timerInterval]);

  const formatStudyTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 渲染座位 (最多6个座位)
  const renderSeats = () => {
    const maxSeats = 6;
    const seats = [];

    for (let i = 0; i < maxSeats; i++) {
      const member = members[i];
      seats.push(
        <div
          key={i}
          className="relative bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white/40 shadow-lg hover:shadow-xl transition-all"
        >
          {member ? (
            // 有人在座位上
            <div className="flex flex-col items-center gap-2">
              {/* 头像 */}
              <div className="relative">
                <Avatar 
                  name={member.display_name} 
                  avatar={member.avatar_url || ''} 
                  size="lg" 
                  className="ring-4 ring-green-400/50 shadow-lg"
                />
                {/* 专注状态指示器 */}
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-md border-2 border-white animate-pulse">
                  <Flame size={14} className="text-white" />
                </div>
              </div>

              {/* 名称 */}
              <div className="text-center">
                <div className="text-sm font-bold text-slate-800 truncate max-w-[100px]">
                  {member.display_name}
                </div>
                <div className="text-[10px] text-green-600 font-semibold">
                  正在专注
                </div>
              </div>

              {/* 学习时间 */}
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50">
                <Clock size={12} className="text-green-600" />
                <span className="text-xs font-mono text-green-700">
                  {(() => {
                    const joined = new Date(member.joined_at);
                    const now = new Date();
                    const diffSeconds = Math.floor((now.getTime() - joined.getTime()) / 1000);
                    return formatStudyTime(diffSeconds);
                  })()}
                </span>
              </div>
            </div>
          ) : (
            // 空座位
            <div className="flex flex-col items-center justify-center h-full opacity-40">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                <User size={32} className="text-slate-300" />
              </div>
              <div className="text-xs text-slate-400 font-medium">
                空座位
              </div>
            </div>
          )}
        </div>
      );
    }

    return seats;
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
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-cyan-400/10 to-blue-500/10 rounded-full blur-2xl"></div>
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <User className="text-white" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                  多人自习室
                  <span className="bg-green-500/20 text-green-600 text-[10px] px-1.5 py-0.5 rounded-full border border-green-200/50 animate-pulse">
                    LIVE
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  {members.length} / 6 人正在专注学习
                </p>
              </div>
            </div>

            {/* 我的学习时间 */}
            {isFocusing && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg">
                <Clock size={14} />
                <span className="text-sm font-mono font-bold">
                  {formatStudyTime(studyTime)}
                </span>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/60 hover:bg-white/80 flex items-center justify-center transition-all hover:rotate-90 shadow-md"
            >
              <X size={18} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-sm text-slate-400 animate-pulse">加载中...</div>
            </div>
          ) : (
            <>
              {/* 座位区域 */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {renderSeats()}
              </div>

              {/* 控制按钮 */}
              <div className="flex justify-center gap-3 mb-4">
                {!isFocusing ? (
                  <button
                    onClick={handleStartFocus}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-105"
                  >
                    <Play size={18} />
                    开始专注
                  </button>
                ) : (
                  <button
                    onClick={handleStopFocus}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-105"
                  >
                    <Square size={18} />
                    停止专注
                  </button>
                )}
              </div>

              {/* 提示信息 */}
              <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/30">
                <p className="text-xs text-blue-600 text-center">
                  💡 提示: 点击"开始专注"加入自习室,与其他同学一起学习吧!
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudyRoom;
