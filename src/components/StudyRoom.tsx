import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Crown,
  DoorOpen,
  Hash,
  LogIn,
  Pause,
  Play,
  Square,
  TimerReset,
  UserRound,
  Users,
  X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppRoutes } from '../types';
import Avatar from './Avatar';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../hooks/useNotification';
import { getClawbotEndpoints } from '../config/clawbotEndpoints';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';
import trixNativeChannelClient from '../services/TrixNativeChannelClient';
import {
  iosBackdropMotion,
  iosIconButtonMotion,
  iosPressableMotion,
  iosQuickSpring,
  iosSheetMotion
} from '../utils/iosMotion';
import type {
  StudyRoomHostAction,
  StudyRoomMember,
  StudyRoomSessionState,
  StudyRoomState,
  StudyRoomStateEvent
} from '../types/studyRoom';

interface StudyRoomProps {
  isOpen: boolean;
  onClose: () => void;
}

type EntryMode = 'self' | 'friend' | 'room';

interface EntryModeOption {
  mode: EntryMode;
  icon: LucideIcon;
  label: string;
}

interface FriendCandidate {
  id: string;
  username: string;
  avatarUrl?: string | null;
  isStudying: boolean;
  inRoom: boolean;
  roomCode?: string;
  sessionState?: StudyRoomSessionState;
  memberCount?: number;
}

interface FriendRoomLookupResult {
  userId: string;
  inRoom: boolean;
  roomCode?: string;
  sessionState?: StudyRoomSessionState;
  memberCount?: number;
}

const ROOM_CODE_REGEX = /^[A-Z0-9]{4,8}$/;
const DURATION_PRESETS = [25, 45, 60] as const;
const ENTRY_MODE_OPTIONS: EntryModeOption[] = [
  { mode: 'self', icon: UserRound, label: '自己自习' },
  { mode: 'friend', icon: Users, label: '加入好友' },
  { mode: 'room', icon: Hash, label: '房间号加入' }
];

function sessionLabel(sessionState: StudyRoomState['sessionState']): string {
  switch (sessionState) {
    case 'focusing':
      return '专注中';
    case 'resting':
      return '暂停中';
    case 'idle':
    default:
      return '空闲';
  }
}

function statusLabel(status: StudyRoomMember['status']): string {
  switch (status) {
    case 'focusing':
      return '专注';
    case 'resting':
      return '暂停';
    case 'online':
    default:
      return '在线';
  }
}

function statusClass(status: StudyRoomMember['status']): string {
  switch (status) {
    case 'focusing':
      return 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30';
    case 'resting':
      return 'text-amber-300 bg-amber-500/15 border-amber-400/30';
    case 'online':
    default:
      return 'text-slate-200 bg-slate-500/15 border-slate-300/30';
  }
}

function formatSeconds(total: number): string {
  const safe = Math.max(0, total);
  const m = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0');
  const s = (safe % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

function resolveRemainingSeconds(room: StudyRoomState | null, nowTs: number): number | null {
  if (!room?.timer) return null;
  if (room.sessionState === 'idle') return null;
  if (room.sessionState === 'resting') return room.timer.remainingSeconds;
  return Math.max(0, Math.floor((room.timer.endsAt - nowTs) / 1000));
}

const IS_TEST_ENV =
  (import.meta.env?.MODE ?? '') === 'test' ||
  Boolean((import.meta as ImportMeta & { vitest?: unknown }).vitest);

function resolveNativeServiceBaseUrl(): string {
  const endpoints = getClawbotEndpoints();
  return (endpoints.nativeServerUrl || endpoints.nativePublicUrl || '').replace(/\/$/, '');
}

function isStateEvent(entry: StudyRoomStateEvent | StudyRoomState | null | undefined): entry is StudyRoomStateEvent {
  return Boolean(entry && typeof entry === 'object' && 'roomCode' in entry && 'room' in entry && 'serverTs' in entry);
}

function eventRoomMatchesUser(eventRoom: StudyRoomState | null, userId: string | null): boolean {
  if (!eventRoom || !userId) return false;
  return eventRoom.members.some((member) => member.userId === userId);
}

async function getCurrentRoom(userId: string): Promise<StudyRoomState | null> {
  if (!IS_TEST_ENV && !trixNativeChannelClient.isPaired()) {
    return null;
  }

  try {
    const room = await trixNativeChannelClient.getStudyRoomState({ userId });
    return room ?? null;
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_IN_ROOM') {
      return null;
    }
    throw error;
  }
}

async function createStudyRoom(params: { userId: string; displayName: string; avatarUrl?: string; maxMembers?: number }): Promise<StudyRoomState> {
  return trixNativeChannelClient.createStudyRoom(params);
}

async function joinStudyRoom(roomCode: string, params: { userId: string; displayName: string; avatarUrl?: string }): Promise<StudyRoomState> {
  return trixNativeChannelClient.joinStudyRoom(roomCode, params);
}

async function leaveStudyRoom(roomCode: string, userId: string): Promise<void> {
  await trixNativeChannelClient.leaveStudyRoom(roomCode, userId);
}

async function hostActionStudyRoom(
  roomCode: string,
  userId: string,
  action: StudyRoomHostAction,
  durationMinutes?: number,
): Promise<StudyRoomState> {
  return trixNativeChannelClient.hostActionStudyRoom(roomCode, { userId, action, durationMinutes });
}

async function lookupFriendRooms(userIds: string[]): Promise<{ users: FriendRoomLookupResult[] }> {
  return trixNativeChannelClient.lookupStudyRoomsByUsers(userIds);
}

const StudyRoom: React.FC<StudyRoomProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { showError, showInfo, showSuccess, showWarning } = useNotification();
  const { connect: connectNativeChannel, isPaired: isChannelPaired } = useClawbotChannel();
  const studyRoomRealtimeApi = useMemo(() => trixNativeChannelClient, []);

  const [entryMode, setEntryMode] = useState<EntryMode>('self');
  const [selectedDuration, setSelectedDuration] = useState<number>(25);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [room, setRoom] = useState<StudyRoomState | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const [isBusy, setIsBusy] = useState(false);
  const [isActionBusy, setIsActionBusy] = useState(false);
  const [friendCandidates, setFriendCandidates] = useState<FriendCandidate[]>([]);
  const [friendLoading, setFriendLoading] = useState(false);
  const [joiningFriendId, setJoiningFriendId] = useState<string | null>(null);

  const nativeServiceBaseUrl = useMemo(() => resolveNativeServiceBaseUrl(), []);
  const currentUserId = user?.id ?? null;
  const displayName = profile?.username?.trim() || user?.email?.split('@')[0] || 'User';
  const avatarUrl = profile?.avatar_url || undefined;
  const isHost = Boolean(room && currentUserId && room.hostUserId === currentUserId);

  const seats = useMemo<(StudyRoomMember | null)[]>(() => {
    const members = room?.members ?? [];
    const maxMembers = room?.maxMembers ?? 5;
    const filled: (StudyRoomMember | null)[] = [...members];
    while (filled.length < maxMembers) filled.push(null);
    return filled.slice(0, maxMembers);
  }, [room]);

  const remainingSeconds = useMemo(() => resolveRemainingSeconds(room, nowTs), [room, nowTs]);

  const refreshCurrentRoom = useCallback(async () => {
    if (!currentUserId) {
      setRoom(null);
      return;
    }

    const mine = await getCurrentRoom(currentUserId);
    setRoom(mine);
    if (mine) {
      setRoomCodeInput(mine.roomCode);
    }
  }, [currentUserId]);

  const loadFriendCandidates = useCallback(async () => {
    setFriendLoading(true);
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        setFriendCandidates([]);
        return;
      }

      const myId = session.user.id;
      const { data: friendsData, error: friendsError } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', myId)
        .eq('status', 'accepted');

      if (friendsError) throw friendsError;

      const friendIds = (friendsData || []).map((item) => item.friend_id);
      if (friendIds.length === 0) {
        setFriendCandidates([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, is_studying')
        .in('id', friendIds);

      if (profilesError) throw profilesError;

      const lookupMap = new Map<string, FriendRoomLookupResult>();
      if (IS_TEST_ENV || trixNativeChannelClient.isPaired()) {
        const lookup = await lookupFriendRooms(friendIds);
        for (const entry of lookup.users) {
          lookupMap.set(entry.userId, entry);
        }
      }

      const nextList: FriendCandidate[] = (profiles || []).map((entry) => {
        const lookup = lookupMap.get(entry.id);
        return {
          id: entry.id,
          username: entry.username || 'Unknown',
          avatarUrl: entry.avatar_url,
          isStudying: Boolean(entry.is_studying),
          inRoom: Boolean(lookup?.inRoom),
          roomCode: lookup?.roomCode,
          sessionState: lookup?.sessionState,
          memberCount: lookup?.memberCount
        };
      });

      setFriendCandidates(nextList);
    } catch (error) {
      showError(error instanceof Error ? error.message : '加载好友失败');
    } finally {
      setFriendLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let disposed = false;
    const handleStudyRoomState = (event: StudyRoomStateEvent | StudyRoomState | null) => {
      if (disposed) return;

      const roomEvent = isStateEvent(event) ? event.room : event;
      if (!roomEvent) {
        setRoom(null);
        return;
      }

      if (!currentUserId || eventRoomMatchesUser(roomEvent, currentUserId) || roomEvent.roomCode === room?.roomCode) {
        setRoom(roomEvent);
        setRoomCodeInput(roomEvent.roomCode);
      }
    };

    if (!IS_TEST_ENV) {
      void connectNativeChannel().catch(() => undefined);
    }
    studyRoomRealtimeApi.on?.('study_room_state', handleStudyRoomState as never);

    void (async () => {
      try {
        await refreshCurrentRoom();
      } catch (error) {
        if (!disposed) {
          const msg = error instanceof Error ? error.message : '获取房间状态失败';
          if (msg.includes('not found') || msg.toLowerCase().includes('not in any room')) {
            setRoom(null);
          } else {
            showError(msg);
          }
        }
      }
    })();

    const timer = window.setInterval(() => {
      void refreshCurrentRoom().catch(() => undefined);
    }, 5000);

    return () => {
      disposed = true;
      studyRoomRealtimeApi.off?.('study_room_state', handleStudyRoomState as never);
      window.clearInterval(timer);
    };
  }, [connectNativeChannel, currentUserId, isOpen, refreshCurrentRoom, room?.roomCode, showError, studyRoomRealtimeApi]);

  useEffect(() => {
    if (!isOpen || room || entryMode !== 'friend') return;
    void loadFriendCandidates();
  }, [entryMode, isOpen, loadFriendCandidates, room]);

  useEffect(() => {
    if (!room?.timer || room.sessionState === 'idle') return;

    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [room?.timer?.endsAt, room?.sessionState]);

  const handleStartSelfStudy = useCallback(() => {
    if (room) {
      showWarning('你已经在房间中，请先离开房间');
      return;
    }

    onClose();
    navigate(AppRoutes.STUDY_TIMER, { state: { duration: selectedDuration } });
  }, [navigate, onClose, room, selectedDuration, showWarning]);

  const handleCreateRoom = useCallback(async () => {
    if (!currentUserId) {
      showError('请先登录');
      return;
    }

    try {
      setIsBusy(true);
      const created = await createStudyRoom({ userId: currentUserId, displayName, avatarUrl });
      if (!created) {
        throw new Error('创建房间失败');
      }
      setRoom(created);
      setRoomCodeInput(created.roomCode);
      showSuccess(`已创建房间 ${created.roomCode}`);
    } catch (error) {
      showError(error instanceof Error ? error.message : '创建房间失败');
    } finally {
      setIsBusy(false);
    }
  }, [avatarUrl, currentUserId, displayName, showError, showSuccess]);

  const handleJoinRoomByCode = useCallback(async () => {
    if (!currentUserId) {
      showError('请先登录');
      return;
    }

    const normalizedCode = roomCodeInput.trim().toUpperCase();
    if (!ROOM_CODE_REGEX.test(normalizedCode)) {
      showWarning('请输入 4-8 位房间号（字母/数字）');
      return;
    }

    try {
      setIsBusy(true);
      const joined = await joinStudyRoom(normalizedCode, { userId: currentUserId, displayName, avatarUrl });
      if (!joined) {
        throw new Error('加入房间失败');
      }
      setRoom(joined);
      setRoomCodeInput(joined.roomCode);
      showSuccess(`已加入房间 ${joined.roomCode}`);
    } catch (error) {
      showError(error instanceof Error ? error.message : '加入房间失败');
    } finally {
      setIsBusy(false);
    }
  }, [avatarUrl, currentUserId, displayName, roomCodeInput, showError, showSuccess, showWarning]);

  const handleJoinFriendRoom = useCallback(
    async (friend: FriendCandidate) => {
      if (!friend.roomCode) {
        showWarning('该好友当前没有可加入的多人房间');
        return;
      }
      if (!currentUserId) {
        showError('请先登录');
        return;
      }

      try {
        setJoiningFriendId(friend.id);
        const joined = await joinStudyRoom(friend.roomCode, { userId: currentUserId, displayName, avatarUrl });
        if (!joined) {
          throw new Error('加入好友房间失败');
        }
        setRoom(joined);
        setRoomCodeInput(joined.roomCode);
        showSuccess(`已加入 ${friend.username} 的房间`);
      } catch (error) {
        showError(error instanceof Error ? error.message : '加入好友房间失败');
      } finally {
        setJoiningFriendId(null);
      }
    },
    [avatarUrl, currentUserId, displayName, showError, showSuccess, showWarning]
  );

  const handleLeaveRoom = useCallback(async () => {
    if (!room || !currentUserId) {
      return;
    }

    try {
      setIsBusy(true);
      await leaveStudyRoom(room.roomCode, currentUserId);
      setRoom(null);
      setRoomCodeInput('');
      showInfo('已离开房间');
    } catch (error) {
      showError(error instanceof Error ? error.message : '离开房间失败');
    } finally {
      setIsBusy(false);
    }
  }, [currentUserId, room, showError, showInfo]);

  const handleHostAction = useCallback(async (action: StudyRoomHostAction) => {
    if (!room || !currentUserId) {
      return;
    }

    try {
      setIsActionBusy(true);
      const updated = await hostActionStudyRoom(
        room.roomCode,
        currentUserId,
        action,
        action === 'start_focus' ? selectedDuration : undefined,
      );
      if (!updated) {
        throw new Error('房间控制失败');
      }
      setRoom(updated);
    } catch (error) {
      showError(error instanceof Error ? error.message : '房间控制失败');
    } finally {
      setIsActionBusy(false);
    }
  }, [currentUserId, room, selectedDuration, showError]);

  const handleRoomLookupRefresh = useCallback(async () => {
    await loadFriendCandidates();
  }, [loadFriendCandidates]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            initial={iosBackdropMotion.initial}
            animate={iosBackdropMotion.animate}
            exit={iosBackdropMotion.exit}
          />
          <motion.div
            className="ios-glass-surface relative max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/84 shadow-[0_40px_140px_-70px_rgba(0,0,0,1)]"
            initial={iosSheetMotion.initial}
            animate={iosSheetMotion.animate}
            exit={iosSheetMotion.exit}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.14),transparent_52%)]" />

            <div className="relative flex items-center justify-between border-b border-white/10 px-6 py-5 md:px-7">
              <h2 className="text-base font-medium tracking-[0.14em] text-white/90 md:text-lg">自习室</h2>
              <motion.button
                onClick={onClose}
                transition={iosQuickSpring}
                {...iosIconButtonMotion}
                className="ios-pressable ios-icon-button-compact ios-secondary-button flex items-center justify-center text-white/75"
                aria-label="Close"
              >
                <X size={18} />
              </motion.button>
            </div>

            {!room && (
              <>
                <div className="relative border-b border-white/10 px-6 py-5 md:px-7">
                  <div className="mx-auto grid w-full max-w-xl grid-cols-3 rounded-[1.2rem] border border-white/10 bg-slate-900/40 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    {ENTRY_MODE_OPTIONS.map(({ mode, icon: Icon, label }) => (
                      <motion.button
                        key={mode}
                        onClick={() => setEntryMode(mode)}
                        transition={iosQuickSpring}
                        {...iosPressableMotion}
                        className={`ios-pressable flex h-10 items-center justify-center gap-1 rounded-xl px-3 text-[13px] font-normal tracking-[0.03em] ${
                          entryMode === mode
                            ? 'ios-pill-indicator bg-white/12 text-white shadow-[0_10px_20px_rgba(15,23,42,0.16)]'
                            : 'text-white/55 hover:bg-white/6 hover:text-white/85'
                        }`}
                      >
                        <Icon size={14} className="inline" />
                        {label}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="relative px-6 pb-6 pt-4 md:px-7">
                  {!nativeServiceBaseUrl && (
                    <div className="mb-4 rounded-[1.2rem] border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                      未检测到 `VITE_TRIX_NATIVE_SERVER_URL` 或 `VITE_TRIX_NATIVE_PUBLIC_URL`，自习室功能无法连接到 Trix Service。
                    </div>
                  )}
                  {!isChannelPaired && (
                    <div className="mb-4 rounded-[1.2rem] border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                      当前 native channel 尚未配对，房间操作会等待服务端会话就绪。
                    </div>
                  )}

                  {entryMode === 'self' && (
                    <div className="ios-glass-surface rounded-[1.6rem] border border-white/10 bg-slate-900/45 p-5 text-white">
                      <p className="mb-4 text-xs font-medium tracking-[0.12em] text-white/50">选择本次专注时长</p>
                      <div className="mb-5 flex flex-wrap gap-2">
                        {DURATION_PRESETS.map((minute) => (
                          <motion.button
                            key={minute}
                            onClick={() => setSelectedDuration(minute)}
                            transition={iosQuickSpring}
                            {...iosPressableMotion}
                            className={`ios-pressable rounded-full border px-4 py-2 text-[13px] font-normal ${
                              selectedDuration === minute
                                ? 'ios-pill-indicator border-white/18 bg-white/10 text-white'
                                : 'ios-secondary-button text-white/70'
                            }`}
                          >
                            {minute} 分钟
                          </motion.button>
                        ))}
                      </div>
                      <motion.button
                        onClick={handleStartSelfStudy}
                        transition={iosQuickSpring}
                        {...iosPressableMotion}
                        className="ios-pressable ios-primary-button inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-normal text-white"
                      >
                        <Play size={14} className="mr-1" />
                        开始自己自习
                      </motion.button>
                    </div>
                  )}

                  {entryMode === 'friend' && (
                    <div className="ios-glass-surface rounded-[1.6rem] border border-white/10 bg-slate-900/45 p-5 text-white">
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-xs font-medium tracking-wide text-white/50">好友房间</p>
                        <motion.button
                          onClick={() => void handleRoomLookupRefresh()}
                          transition={iosQuickSpring}
                          {...iosPressableMotion}
                          className="ios-pressable ios-surface-button rounded-xl px-3 py-1 text-xs font-normal tracking-[0.06em]"
                        >
                          刷新
                        </motion.button>
                      </div>

                      {friendLoading ? (
                        <p className="text-sm text-white/60">加载中...</p>
                      ) : friendCandidates.length === 0 ? (
                        <p className="text-sm text-white/60">暂无可用好友</p>
                      ) : (
                        <div className="space-y-3">
                          {friendCandidates.map((friend) => (
                            <div
                              key={friend.id}
                              className="ios-list-row flex items-center justify-between rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-3"
                            >
                              <div className="flex items-center gap-3">
                                <Avatar name={friend.username} avatar={friend.avatarUrl || ''} size="md" />
                                <div>
                                  <p className="text-sm font-normal text-white/90">{friend.username}</p>
                                  <p className="text-[11px] leading-relaxed tracking-[0.02em] text-white/45">
                                    {friend.inRoom && friend.roomCode
                                      ? `房间 ${friend.roomCode} · ${friend.memberCount ?? 0} 人`
                                      : friend.isStudying
                                        ? '学习中（非多人房）'
                                        : '未在多人房间'}
                                  </p>
                                </div>
                              </div>

                              <motion.button
                                onClick={() => void handleJoinFriendRoom(friend)}
                                disabled={!friend.inRoom || joiningFriendId !== null}
                                transition={iosQuickSpring}
                                {...iosPressableMotion}
                                className={`ios-pressable rounded-full px-4 py-2 text-xs font-normal tracking-[0.04em] text-white ${
                                  !friend.inRoom
                                    ? 'cursor-not-allowed bg-slate-700/60 text-white/45'
                                    : joiningFriendId === friend.id
                                      ? 'bg-cyan-500/55 text-white/75'
                                      : 'bg-cyan-500/70 shadow-lg shadow-cyan-950/25 hover:bg-cyan-500/85'
                                }`}
                              >
                                {joiningFriendId === friend.id ? '加入中...' : '加入'}
                              </motion.button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {entryMode === 'room' && (
                    <div className="ios-glass-surface rounded-[1.6rem] border border-white/10 bg-slate-900/45 p-5 text-white">
                      <p className="mb-4 text-xs font-medium tracking-[0.12em] text-white/50">输入房间号加入，或创建新房间</p>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                          value={roomCodeInput}
                          onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
                          maxLength={8}
                          placeholder="输入房间号（如 A1B2C3）"
                          className="h-10 flex-1 rounded-xl border border-white/15 bg-slate-950/60 px-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-white/35 focus:bg-slate-900/80"
                        />
                        <div className="flex gap-2">
                          <motion.button
                            onClick={handleCreateRoom}
                            disabled={isBusy}
                            transition={iosQuickSpring}
                            {...iosPressableMotion}
                            className="ios-pressable inline-flex h-10 items-center justify-center rounded-xl bg-cyan-600/70 px-4 text-sm font-normal text-white shadow-lg shadow-cyan-950/25 hover:bg-cyan-600/85 disabled:opacity-60"
                          >
                            创建
                          </motion.button>
                          <motion.button
                            onClick={handleJoinRoomByCode}
                            disabled={isBusy}
                            transition={iosQuickSpring}
                            {...iosPressableMotion}
                            className="ios-pressable ios-surface-button inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-normal text-slate-900 disabled:opacity-60"
                          >
                            <LogIn size={14} className="mr-1" />
                            加入
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {room && (
              <div className="relative px-6 pb-6 pt-4 md:px-7">
                <div className="ios-glass-surface mb-4 rounded-[1.6rem] border border-white/10 bg-slate-900/45 p-4 text-white">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Room</p>
                      <p className="font-mono text-lg font-semibold text-white">{room.roomCode}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Session</p>
                      <p className="text-sm text-white/85">{sessionLabel(room.sessionState)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Members</p>
                      <p className="text-sm text-white/85">{room.members.length} / {room.maxMembers}</p>
                    </div>
                  </div>

                  {remainingSeconds !== null && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-white/40">
                        <TimerReset size={13} />
                        Remaining
                      </div>
                      <div className="mt-1 font-mono text-2xl font-semibold text-white">
                        {formatSeconds(remainingSeconds)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {seats.map((member, index) => (
                    <div
                      key={member?.userId || `seat-${index}`}
                      className="ios-list-row flex items-center gap-3 rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-3"
                    >
                      {member ? (
                        <>
                          <Avatar name={member.displayName} avatar={member.avatarUrl || ''} size="md" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-white/90">{member.displayName}</p>
                              {member.userId === room.hostUserId && <Crown size={13} className="text-amber-300" />}
                            </div>
                            <p className="text-[11px] text-white/45">{statusLabel(member.status)}</p>
                          </div>
                          <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${statusClass(member.status)}`}>
                            {member.status}
                          </span>
                        </>
                      ) : (
                        <div className="flex h-12 w-full items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-white/35">
                          空位
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {isHost && room.sessionState === 'idle' ? (
                    <div className="mb-2 flex w-full flex-wrap items-center gap-2 rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-3">
                      <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Focus Duration</span>
                      {DURATION_PRESETS.map((minute) => (
                        <motion.button
                          key={`room-duration-${minute}`}
                          onClick={() => setSelectedDuration(minute)}
                          transition={iosQuickSpring}
                          {...iosPressableMotion}
                          className={`ios-pressable rounded-full border px-3 py-1.5 text-xs font-normal ${
                            selectedDuration === minute
                              ? 'ios-pill-indicator border-white/18 bg-white/10 text-white'
                              : 'ios-secondary-button text-white/70'
                          }`}
                        >
                          {minute} 分钟
                        </motion.button>
                      ))}
                    </div>
                  ) : null}
                  {isHost ? (
                    <>
                      <motion.button
                        onClick={() => void handleHostAction('start_focus')}
                        disabled={isActionBusy}
                        transition={iosQuickSpring}
                        {...iosPressableMotion}
                        className="ios-pressable inline-flex items-center gap-2 rounded-xl bg-emerald-600/75 px-4 py-2 text-sm font-normal text-white shadow-lg shadow-emerald-950/20 disabled:opacity-60"
                      >
                        <Play size={14} />
                        开始
                      </motion.button>
                      <motion.button
                        onClick={() => void handleHostAction('pause')}
                        disabled={isActionBusy}
                        transition={iosQuickSpring}
                        {...iosPressableMotion}
                        className="ios-pressable inline-flex items-center gap-2 rounded-xl bg-amber-600/75 px-4 py-2 text-sm font-normal text-white shadow-lg shadow-amber-950/20 disabled:opacity-60"
                      >
                        <Pause size={14} />
                        暂停
                      </motion.button>
                      <motion.button
                        onClick={() => void handleHostAction('end')}
                        disabled={isActionBusy}
                        transition={iosQuickSpring}
                        {...iosPressableMotion}
                        className="ios-pressable inline-flex items-center gap-2 rounded-xl bg-slate-600/75 px-4 py-2 text-sm font-normal text-white shadow-lg shadow-slate-950/20 disabled:opacity-60"
                      >
                        <Square size={14} />
                        结束
                      </motion.button>
                    </>
                  ) : null}
                  <motion.button
                    onClick={() => void handleLeaveRoom()}
                    disabled={isBusy}
                    transition={iosQuickSpring}
                    {...iosPressableMotion}
                    className="ios-pressable inline-flex items-center gap-2 rounded-xl bg-rose-600/75 px-4 py-2 text-sm font-normal text-white shadow-lg shadow-rose-950/20 disabled:opacity-60"
                  >
                    <DoorOpen size={14} />
                    离开房间
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
};

export default StudyRoom;
