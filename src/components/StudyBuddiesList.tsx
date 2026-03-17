import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { X, Users } from 'lucide-react';
import { AppRoutes } from '../types';
import { supabase } from '../config/supabase';
import Avatar from './Avatar';
import { IMAGES } from '../constants';
import { useNotification } from '../hooks/useNotification';
import {
  iosBackdropMotion,
  iosIconButtonMotion,
  iosPressableMotion,
  iosQuickSpring,
  iosSheetMotion
} from '../utils/iosMotion';

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
  const { showError } = useNotification();

  const [buddies, setBuddies] = useState<StudyBuddy[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');
  const [joiningBuddyId, setJoiningBuddyId] = useState<string | null>(null);

  const fetchStudyBuddies = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setBuddies([]);
        return;
      }

      const userId = session.user.id;
      setCurrentUserId(userId);

      const { data: friendsData, error: friendsError } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (friendsError) {
        console.error('[StudyBuddies] 获取好友关系失败:', friendsError);
        return;
      }

      if (!friendsData || friendsData.length === 0) {
        setBuddies([]);
        return;
      }

      const friendIds = friendsData.map((friend) => friend.friend_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, is_studying')
        .in('id', friendIds)
        .eq('is_studying', true);

      if (profilesError) {
        console.error('[StudyBuddies] 获取自习中好友失败:', profilesError);
        return;
      }

      const studyingFriends: StudyBuddy[] = (profiles || []).map((profile) => ({
        id: profile.id,
        username: profile.username || 'Unknown',
        avatar: profile.avatar_url || IMAGES.WIZARD_BOY_LOGIN,
        isMe: false,
      }));

      setBuddies(studyingFriends);
    } catch (error) {
      console.error('[StudyBuddies] 加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      void fetchStudyBuddies();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!currentUserId || !isOpen) {
      return;
    }

    let refreshTimeout: ReturnType<typeof setTimeout>;

    const channel = supabase
      .channel(`study-buddies-realtime-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          if ('is_studying' in payload.new || 'companion_id' in payload.new) {
            clearTimeout(refreshTimeout);
            refreshTimeout = setTimeout(() => {
              void fetchStudyBuddies();
            }, 500);
          }
        },
      )
      .subscribe();

    return () => {
      clearTimeout(refreshTimeout);
      supabase.removeChannel(channel);
    };
  }, [currentUserId, isOpen]);

  const handleJoinBuddy = async (buddyId: string, buddyName: string) => {
    setJoiningBuddyId(buddyId);

    try {
      const buddy = buddies.find((item) => item.id === buddyId);
      if (!buddy) {
        throw new Error('好友信息不存在');
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        throw new Error('用户未登录');
      }

      const myId = session.user.id;

      const { error: myError } = await supabase
        .from('profiles')
        .update({
          is_studying: true,
          companion_id: buddyId,
        })
        .eq('id', myId)
        .select();

      if (myError) {
        throw myError;
      }

      const { data: buddyData, error: buddyError } = await supabase
        .from('profiles')
        .update({ companion_id: myId })
        .eq('id', buddyId)
        .select();

      if (buddyError || !buddyData || buddyData.length === 0) {
        await supabase
          .from('profiles')
          .update({ is_studying: false, companion_id: null })
          .eq('id', myId);

        const message = buddyError?.message || '好友状态更新失败';
        throw new Error(`无法更新好友状态：${message}`);
      }

      onClose();
      navigate(AppRoutes.STUDY_TIMER, {
        state: {
          duration: 25,
          companion: {
            id: buddy.id,
            username: buddy.username,
            avatar: buddy.avatar,
          },
        },
      });
    } catch (error) {
      console.error('[StudyBuddies] 加入失败:', error);
      showError(`加入 ${buddyName} 的自习室失败，请稍后重试`);
    } finally {
      setJoiningBuddyId(null);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
        onClick={onClose}
        initial={iosBackdropMotion.initial}
        animate={iosBackdropMotion.animate}
        exit={iosBackdropMotion.exit}
      >
      <motion.div
        className="ios-glass-surface max-h-[80vh] w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/95 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        initial={iosSheetMotion.initial}
        animate={iosSheetMotion.animate}
        exit={iosSheetMotion.exit}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
              <Users size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">正在自习的好友</h2>
              <p className="text-xs text-white/50">
                {loading ? '加载中…' : `${buddies.length} 人正在专注`}
              </p>
            </div>
          </div>

          <motion.button
            type="button"
            onClick={onClose}
            transition={iosQuickSpring}
            {...iosIconButtonMotion}
            className="ios-pressable ios-secondary-button flex h-9 w-9 items-center justify-center rounded-full"
          >
            <X size={18} className="text-white/70" />
          </motion.button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-3 h-8 w-8 animate-spin rounded-full border-[3px] border-blue-500/30 border-t-blue-500" />
              <p className="text-sm text-white/40">加载好友列表...</p>
            </div>
          ) : buddies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
                <Users size={32} className="text-white/20" />
              </div>
              <h3 className="mb-2 font-semibold text-white/70">暂时没有好友在自习</h3>
              <p className="text-center text-sm text-white/40">
                去邀请好友一起学习吧，
                <br />
                互相监督，共同进步。
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {buddies.map((buddy) => (
                <div
                  key={buddy.id}
                  className="ios-list-row group flex items-center justify-between rounded-[1.2rem] border border-white/5 bg-white/5 p-4 hover:bg-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="h-12 w-12 overflow-hidden rounded-full bg-white/10 ring-2 ring-white/10">
                        <Avatar name={buddy.username} avatar={buddy.avatar} size="md" />
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-slate-900 bg-green-500">
                        <div className="h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                      </div>
                    </div>

                    <div>
                      <p className="font-semibold text-white">{buddy.username}</p>
                      <p className="flex items-center gap-1 text-xs text-white/50">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                        正在专注中
                      </p>
                    </div>
                  </div>

                  <motion.button
                    type="button"
                    onClick={() => handleJoinBuddy(buddy.id, buddy.username)}
                    disabled={joiningBuddyId !== null}
                    transition={iosQuickSpring}
                    {...iosPressableMotion}
                    className={`ios-pressable rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg ${
                      joiningBuddyId === buddy.id
                        ? 'cursor-wait bg-blue-400'
                        : joiningBuddyId !== null
                          ? 'cursor-not-allowed bg-gray-500 opacity-50'
                          : 'bg-blue-500 shadow-blue-500/30 hover:bg-blue-600 active:scale-95'
                    }`}
                  >
                    {joiningBuddyId === buddy.id ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        加入中...
                      </span>
                    ) : (
                      '加入'
                    )}
                  </motion.button>
                </div>
              ))}
            </div>
          )}
        </div>

        {buddies.length > 0 && (
          <div className="border-t border-white/10 bg-white/5 px-6 py-4">
            <p className="text-center text-xs text-white/40">加入好友自习室后可以实时查看对方进度。</p>
          </div>
        )}
      </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default StudyBuddiesList;
