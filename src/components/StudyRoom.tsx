import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useNavigate } from 'react-router-dom';
import Avatar from './Avatar';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';
import { useNotification } from '../hooks/useNotification';
import clawbotChannelBridge from '../services/ClawbotChannelBridge';
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

const StudyRoom: React.FC<StudyRoomProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { connect } = useClawbotChannel();
  const { showError, showInfo, showSuccess, showWarning } = useNotification();

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

  const ensureSocketReady = useCallback(async () => {
    if (!currentUserId) throw new Error('请先登录');
    if (!clawbotChannelBridge.isConnected()) await connect();
  }, [connect, currentUserId]);

  const handleStudyRoomState = useCallback(
    (payload: StudyRoomStateEvent) => {
      if (!payload?.roomCode) return;

      setRoom((prev) => {
        if (payload.room) {
          const includesCurrentUser = Boolean(
            currentUserId && payload.room.members.some((member) => member.userId === currentUserId)
          );
          if (prev?.roomCode === payload.roomCode || includesCurrentUser) return payload.room;
          return prev;
        }

        if (prev?.roomCode === payload.roomCode) return null;
        return prev;
      });
    },
    [currentUserId]
  );

  useEffect(() => {
    if (!isOpen) return;

    clawbotChannelBridge.on('study_room_state', handleStudyRoomState);
    return () => clawbotChannelBridge.off('study_room_state', handleStudyRoomState);
  }, [handleStudyRoomState, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let disposed = false;

    void (async () => {
      try {
        await ensureSocketReady();
        const state = await clawbotChannelBridge.getStudyRoomState();
        if (disposed) return;
        setRoom(state);
        setRoomCodeInput(state.roomCode);
      } catch (error) {
        if (disposed) return;

        const msg = error instanceof Error ? error.message : '获取房间状态失败';
        if (
          msg.includes('NOT_IN_ROOM') ||
          msg.toLowerCase().includes('not in any room') ||
          msg.toLowerCase().includes('not in the room')
        ) {
          setRoom(null);
          return;
        }

        showError(msg);
      }
    })();

    return () => {
      disposed = true;
    };
  }, [ensureSocketReady, isOpen, showError]);

  useEffect(() => {
    if (!room?.timer || room.sessionState === 'idle') return;

    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [room?.timer?.endsAt, room?.sessionState]);

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

      const bridgeWithLookup = clawbotChannelBridge as typeof clawbotChannelBridge & {
        lookupStudyRoomsByUsers?: (userIds: string[]) => Promise<{ users: FriendRoomLookupResult[] }>;
      };

      const lookupMap = new Map<string, FriendRoomLookupResult>();
      if (bridgeWithLookup.lookupStudyRoomsByUsers) {
        const lookup = await bridgeWithLookup.lookupStudyRoomsByUsers(friendIds);
        for (const item of lookup.users || []) {
          lookupMap.set(item.userId, item);
        }
      }

      const nextList: FriendCandidate[] = (profiles || []).map((p) => {
        const lookup = lookupMap.get(p.id);
        return {
          id: p.id,
          username: p.username || 'Unknown',
          avatarUrl: p.avatar_url,
          isStudying: Boolean(p.is_studying),
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
    if (!isOpen || room) return;
    if (entryMode !== 'friend') return;
    void loadFriendCandidates();
  }, [entryMode, isOpen, loadFriendCandidates, room]);

  const handleStartSelfStudy = useCallback(() => {
    if (room) {
      showWarning('你已经在房间中，请先离开房间');
      return;
    }

    onClose();
    navigate('/study/timer', { state: { duration: selectedDuration } });
  }, [navigate, onClose, room, selectedDuration, showWarning]);

  const handleCreateRoom = useCallback(async () => {
    try {
      setIsBusy(true);
      await ensureSocketReady();
      const created = await clawbotChannelBridge.createStudyRoom(displayName, avatarUrl);
      setRoom(created);
      setRoomCodeInput(created.roomCode);
      showSuccess(`已创建房间 ${created.roomCode}`);
    } catch (error) {
      showError(error instanceof Error ? error.message : '创建房间失败');
    } finally {
      setIsBusy(false);
    }
  }, [avatarUrl, displayName, ensureSocketReady, showError, showSuccess]);

  const handleJoinRoomByCode = useCallback(async () => {
    const normalizedCode = roomCodeInput.trim().toUpperCase();
    if (!ROOM_CODE_REGEX.test(normalizedCode)) {
      showWarning('请输入 4-8 位房间号（字母/数字）');
      return;
    }

    try {
      setIsBusy(true);
      await ensureSocketReady();
      const joined = await clawbotChannelBridge.joinStudyRoom(normalizedCode, displayName, avatarUrl);
      setRoom(joined);
      setRoomCodeInput(joined.roomCode);
      showSuccess(`已加入房间 ${joined.roomCode}`);
    } catch (error) {
      showError(error instanceof Error ? error.message : '加入房间失败');
    } finally {
      setIsBusy(false);
    }
  }, [avatarUrl, displayName, ensureSocketReady, roomCodeInput, showError, showSuccess, showWarning]);

  const handleJoinFriendRoom = useCallback(
    async (friend: FriendCandidate) => {
      if (!friend.roomCode) {
        showWarning('该好友当前没有可加入的多人房间');
        return;
      }

      try {
        setJoiningFriendId(friend.id);
        await ensureSocketReady();
        const joined = await clawbotChannelBridge.joinStudyRoom(friend.roomCode, displayName, avatarUrl);
        setRoom(joined);
        setRoomCodeInput(joined.roomCode);
        showSuccess(`已加入 ${friend.username} 的房间`);
      } catch (error) {
        showError(error instanceof Error ? error.message : '加入好友房间失败');
      } finally {
        setJoiningFriendId(null);
      }
    },
    [avatarUrl, displayName, ensureSocketReady, showError, showSuccess, showWarning]
  );

  const handleLeaveRoom = useCallback(async () => {
    if (!room) return;

    try {
      setIsBusy(true);
      await ensureSocketReady();
      await clawbotChannelBridge.leaveStudyRoom(room.roomCode);
      setRoom(null);
      showInfo('已离开房间');
    } catch (error) {
      showError(error instanceof Error ? error.message : '离开房间失败');
    } finally {
      setIsBusy(false);
    }
  }, [ensureSocketReady, room, showError, showInfo]);

  const handleHostAction = useCallback(
    async (action: StudyRoomHostAction) => {
      if (!room) return;

      try {
        setIsActionBusy(true);
        await ensureSocketReady();

        const bridgeAny = clawbotChannelBridge as any;
        const payload = action === 'start_focus' ? { durationMinutes: selectedDuration } : undefined;
        const updated: StudyRoomState = await bridgeAny.hostActionStudyRoom(room.roomCode, action, payload);
        setRoom(updated);
      } catch (error) {
        showError(error instanceof Error ? error.message : '房间控制失败');
      } finally {
        setIsActionBusy(false);
      }
    },
    [ensureSocketReady, room, selectedDuration, showError]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950/80 shadow-[0_40px_140px_-70px_rgba(0,0,0,1)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.14),transparent_52%)]" />

        <div className="relative flex items-center justify-between border-b border-white/10 px-6 py-5 md:px-7">
          <h2 className="text-base font-medium tracking-[0.14em] text-white/90 md:text-lg">自习室</h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/55 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {!room && (
          <>
            <div className="relative border-b border-white/10 px-6 py-5 md:px-7">
              <div className="mx-auto grid w-full max-w-xl grid-cols-3 rounded-xl bg-slate-900/50 p-1 ring-1 ring-white/10">
                <button
                  onClick={() => setEntryMode('self')}
                  className={`flex h-10 items-center justify-center gap-1 rounded-lg px-3 text-[13px] font-normal tracking-[0.03em] transition ${
                    entryMode === 'self'
                      ? 'rounded-lg bg-white/10 text-white shadow-sm'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                  }`}
                >
                  <UserRound size={14} className="inline" />
                  自己自习
                </button>
                <button
                  onClick={() => setEntryMode('friend')}
                  className={`flex h-10 items-center justify-center gap-1 rounded-lg px-3 text-[13px] font-normal tracking-[0.03em] transition ${
                    entryMode === 'friend'
                      ? 'rounded-lg bg-white/10 text-white shadow-sm'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                  }`}
                >
                  <Users size={14} className="inline" />
                  加入好友
                </button>
                <button
                  onClick={() => setEntryMode('room')}
                  className={`flex h-10 items-center justify-center gap-1 rounded-lg px-3 text-[13px] font-normal tracking-[0.03em] transition ${
                    entryMode === 'room'
                      ? 'rounded-lg bg-white/10 text-white shadow-sm'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                  }`}
                >
                  <Hash size={14} className="inline" />
                  房间号加入
                </button>
              </div>
            </div>

            <div className="relative px-6 pb-6 pt-4 md:px-7">
              {entryMode === 'self' && (
                <div className="rounded-2xl border border-white/10 bg-slate-900/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_64px_-48px_rgba(0,0,0,1)] backdrop-blur-md">
                  <p className="mb-4 text-xs font-medium tracking-[0.12em] text-white/50">选择本次专注时长</p>
                  <div className="mb-5 flex flex-wrap gap-2">
                    {DURATION_PRESETS.map((minute) => (
                      <button
                        key={minute}
                        onClick={() => setSelectedDuration(minute)}
                        className={`rounded-full border px-4 py-2 text-[13px] font-normal transition ${
                          selectedDuration === minute
                            ? 'border-white/20 bg-white/10 text-white'
                            : 'border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/8 hover:text-white/90'
                        }`}
                      >
                        {minute} 分钟
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleStartSelfStudy}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500/80 px-5 text-sm font-normal text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-500"
                  >
                    <Play size={14} className="mr-1" />
                    开始自己自习
                  </button>
                </div>
              )}

              {entryMode === 'friend' && (
                <div className="rounded-2xl border border-white/10 bg-slate-900/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_64px_-48px_rgba(0,0,0,1)] backdrop-blur-md">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs font-medium tracking-wide text-white/50">好友房间</p>
                    <button
                      onClick={() => void loadFriendCandidates()}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-normal tracking-[0.06em] text-white/65 transition hover:bg-white/8 hover:text-white/90"
                    >
                      刷新
                    </button>
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
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3"
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

                          <button
                            onClick={() => void handleJoinFriendRoom(friend)}
                            disabled={!friend.inRoom || joiningFriendId !== null}
                            className={`rounded-full px-4 py-2 text-xs font-normal tracking-[0.04em] text-white transition ${
                              !friend.inRoom
                                ? 'cursor-not-allowed bg-slate-700/60 text-white/45'
                                : joiningFriendId === friend.id
                                  ? 'bg-cyan-500/55 text-white/75'
                                  : 'bg-cyan-500/70 shadow-lg shadow-cyan-950/25 hover:bg-cyan-500/85'
                            }`}
                          >
                            {joiningFriendId === friend.id ? '加入中...' : '加入'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {entryMode === 'room' && (
                <div className="rounded-2xl border border-white/10 bg-slate-900/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_64px_-48px_rgba(0,0,0,1)] backdrop-blur-md">
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
                      <button
                        onClick={handleCreateRoom}
                        disabled={isBusy}
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-cyan-600/70 px-4 text-sm font-normal text-white shadow-lg shadow-cyan-950/25 transition hover:bg-cyan-600/85 disabled:opacity-60"
                      >
                        创建
                      </button>
                      <button
                        onClick={handleJoinRoomByCode}
                        disabled={isBusy}
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-200/85 px-4 text-sm font-normal text-slate-900 transition hover:bg-white disabled:opacity-60"
                      >
                        <LogIn size={14} className="mr-1" />
                        加入
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {room && (
          <div className="relative px-6 pb-6 pt-4 md:px-7">
            <div className="mb-4 rounded-2xl border border-white/10 bg-slate-900/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_64px_-48px_rgba(0,0,0,1)] backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Room</p>
                  <p className="font-mono text-lg font-semibold text-white">{room.roomCode}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Session</p>
                  <p className="text-sm font-normal text-white/85">{sessionLabel(room.sessionState)}</p>
                </div>
              </div>

              {remainingSeconds !== null && (
                <div className="mt-3 inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-normal text-cyan-100">
                  <TimerReset size={13} className="mr-1" />
                  剩余 {formatSeconds(remainingSeconds)}
                </div>
              )}

              {isHost && (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {DURATION_PRESETS.map((minute) => (
                      <button
                        key={minute}
                        onClick={() => setSelectedDuration(minute)}
                        className={`rounded-full border px-3 py-1 text-[11px] font-normal tracking-[0.08em] transition ${
                          selectedDuration === minute
                            ? 'border-white/20 bg-white/10 text-white'
                            : 'border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/8 hover:text-white/90'
                        }`}
                      >
                        {minute}m
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      onClick={() => void handleHostAction('start_focus')}
                      disabled={isActionBusy}
                      className="inline-flex items-center justify-center rounded-xl bg-emerald-500/75 px-3 py-2 text-xs font-normal tracking-[0.05em] text-white shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-500/90 disabled:opacity-60"
                    >
                      <Play size={14} className="mr-1" />
                      开始
                    </button>
                    <button
                      onClick={() => void handleHostAction('pause')}
                      disabled={isActionBusy}
                      className="inline-flex items-center justify-center rounded-xl bg-amber-500/75 px-3 py-2 text-xs font-normal tracking-[0.05em] text-white shadow-lg shadow-amber-950/20 transition hover:bg-amber-500/90 disabled:opacity-60"
                    >
                      <Pause size={14} className="mr-1" />
                      暂停
                    </button>
                    <button
                      onClick={() => void handleHostAction('end')}
                      disabled={isActionBusy}
                      className="inline-flex items-center justify-center rounded-xl bg-slate-200/85 px-3 py-2 text-xs font-normal tracking-[0.05em] text-slate-900 transition hover:bg-white disabled:opacity-60"
                    >
                      <Square size={14} className="mr-1" />
                      结束
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {seats.map((member, index) => (
                <div
                  key={member?.userId || `seat-${index}`}
                  className="rounded-2xl border border-white/10 bg-slate-900/40 p-3 backdrop-blur-md"
                >
                  {member ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative">
                        <Avatar name={member.displayName} avatar={member.avatarUrl || ''} size="lg" />
                        {room.hostUserId === member.userId && (
                          <span className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white">
                            <Crown size={11} />
                          </span>
                        )}
                      </div>
                      <p className="max-w-[120px] truncate text-sm font-normal text-white/90">{member.displayName}</p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass(member.status)}`}
                      >
                        {statusLabel(member.status)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex min-h-[118px] flex-col items-center justify-center text-white/25">
                      <Users size={22} />
                      <p className="mt-1 text-[11px] tracking-[0.1em]">空位</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleLeaveRoom}
                disabled={isBusy}
                className="inline-flex items-center justify-center rounded-xl bg-rose-500/75 px-4 py-2 text-sm font-normal text-white shadow-lg shadow-rose-950/20 transition hover:bg-rose-500/90 disabled:opacity-60"
              >
                <DoorOpen size={15} className="mr-1" />
                离开房间
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyRoom;
