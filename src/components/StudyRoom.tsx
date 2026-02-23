import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Crown,
  DoorOpen,
  LogIn,
  Pause,
  Play,
  Square,
  Users,
  X
} from 'lucide-react';
import Avatar from './Avatar';
import { useAuth } from '../contexts/AuthContext';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';
import { useNotification } from '../hooks/useNotification';
import clawbotChannelBridge from '../services/ClawbotChannelBridge';
import type {
  StudyRoomHostAction,
  StudyRoomMember,
  StudyRoomState,
  StudyRoomStateEvent
} from '../types/studyRoom';

interface StudyRoomProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROOM_CODE_REGEX = /^[A-Z0-9]{4,8}$/;

function statusLabel(status: StudyRoomMember['status']): string {
  switch (status) {
    case 'focusing':
      return '专注中';
    case 'resting':
      return '休息中';
    case 'online':
    default:
      return '在线';
  }
}

function statusClass(status: StudyRoomMember['status']): string {
  switch (status) {
    case 'focusing':
      return 'text-emerald-700 bg-emerald-100 border-emerald-200';
    case 'resting':
      return 'text-amber-700 bg-amber-100 border-amber-200';
    case 'online':
    default:
      return 'text-slate-700 bg-slate-100 border-slate-200';
  }
}

function sessionLabel(sessionState: StudyRoomState['sessionState']): string {
  switch (sessionState) {
    case 'focusing':
      return '专注阶段';
    case 'resting':
      return '休息阶段';
    case 'idle':
    default:
      return '空闲';
  }
}

const StudyRoom: React.FC<StudyRoomProps> = ({ isOpen, onClose }) => {
  const { user, profile } = useAuth();
  const { connect } = useClawbotChannel();
  const { showError, showInfo, showSuccess, showWarning } = useNotification();

  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [room, setRoom] = useState<StudyRoomState | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isActionBusy, setIsActionBusy] = useState(false);

  const currentUserId = user?.id ?? null;
  const displayName = profile?.username?.trim() || user?.email?.split('@')[0] || 'User';
  const avatarUrl = profile?.avatar_url || undefined;
  const isHost = Boolean(room && currentUserId && room.hostUserId === currentUserId);

  const seats = useMemo<(StudyRoomMember | null)[]>(() => {
    const members = room?.members ?? [];
    const maxMembers = room?.maxMembers ?? 5;
    const filled: (StudyRoomMember | null)[] = [...members];
    while (filled.length < maxMembers) {
      filled.push(null);
    }
    return filled.slice(0, maxMembers);
  }, [room]);

  const ensureSocketReady = useCallback(async () => {
    if (!currentUserId) {
      throw new Error('请先登录');
    }

    if (!clawbotChannelBridge.isConnected()) {
      await connect();
    }
  }, [connect, currentUserId]);

  const handleStudyRoomState = useCallback((payload: StudyRoomStateEvent) => {
    if (!payload || !payload.roomCode) {
      return;
    }

    setRoom((prev) => {
      if (payload.room) {
        const includesCurrentUser = Boolean(
          currentUserId && payload.room.members.some((member) => member.userId === currentUserId)
        );

        if (prev?.roomCode === payload.roomCode || includesCurrentUser) {
          return payload.room;
        }

        return prev;
      }

      if (prev?.roomCode === payload.roomCode) {
        return null;
      }

      return prev;
    });
  }, [currentUserId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    clawbotChannelBridge.on('study_room_state', handleStudyRoomState);
    return () => {
      clawbotChannelBridge.off('study_room_state', handleStudyRoomState);
    };
  }, [handleStudyRoomState, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let disposed = false;

    void (async () => {
      try {
        await ensureSocketReady();
        const state = await clawbotChannelBridge.getStudyRoomState();
        if (disposed) {
          return;
        }
        setRoom(state);
        setRoomCodeInput(state.roomCode);
      } catch (error) {
        if (disposed) {
          return;
        }

        const message = error instanceof Error ? error.message : '获取房间状态失败';
        if (
          message.includes('NOT_IN_ROOM') ||
          message.toLowerCase().includes('not in any room') ||
          message.toLowerCase().includes('not in the room')
        ) {
          setRoom(null);
          return;
        }

        showError(message);
      }
    })();

    return () => {
      disposed = true;
    };
  }, [ensureSocketReady, isOpen, showError]);

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

  const handleJoinRoom = useCallback(async () => {
    const normalizedCode = roomCodeInput.trim().toUpperCase();
    if (!ROOM_CODE_REGEX.test(normalizedCode)) {
      showWarning('请输入 4-8 位房间码（字母或数字）');
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

  const handleLeaveRoom = useCallback(async () => {
    if (!room) {
      return;
    }

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

  const handleHostAction = useCallback(async (action: StudyRoomHostAction) => {
    if (!room) {
      return;
    }

    try {
      setIsActionBusy(true);
      await ensureSocketReady();
      const updated = await clawbotChannelBridge.hostActionStudyRoom(room.roomCode, action);
      setRoom(updated);
    } catch (error) {
      showError(error instanceof Error ? error.message : '房间控制失败');
    } finally {
      setIsActionBusy(false);
    }
  }, [ensureSocketReady, room, showError]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl rounded-3xl border border-white/30 bg-white/75 p-5 shadow-2xl backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">多人自习室</h2>
            <p className="text-sm text-slate-600">
              基于实时房间状态机，同步房主控制与成员状态
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-600 transition hover:bg-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {!room && (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Users size={16} />
              创建或加入房间
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={roomCodeInput}
                onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
                placeholder="输入 RoomCode（如 A1B2C3）"
                maxLength={8}
                className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-cyan-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateRoom}
                  disabled={isBusy}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  创建
                </button>
                <button
                  onClick={handleJoinRoom}
                  disabled={isBusy}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogIn size={14} className="mr-1" />
                  加入
                </button>
              </div>
            </div>
          </div>
        )}

        {room ? (
          <>
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">RoomCode</p>
                  <p className="font-mono text-lg font-bold text-slate-900">{room.roomCode}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Session</p>
                  <p className="text-sm font-semibold text-slate-800">{sessionLabel(room.sessionState)}</p>
                </div>
              </div>

              {isHost ? (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleHostAction('start_focus')}
                    disabled={isActionBusy}
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <Play size={14} className="mr-1" />
                    开始
                  </button>
                  <button
                    onClick={() => handleHostAction('pause')}
                    disabled={isActionBusy}
                    className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
                  >
                    <Pause size={14} className="mr-1" />
                    暂停
                  </button>
                  <button
                    onClick={() => handleHostAction('end')}
                    disabled={isActionBusy}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60"
                  >
                    <Square size={14} className="mr-1" />
                    结束
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-500">仅房主可控制开始/暂停/结束。</p>
              )}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {seats.map((member, index) => (
                <div
                  key={member?.userId || `seat-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white/80 p-3"
                >
                  {member ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative">
                        <Avatar
                          name={member.displayName}
                          avatar={member.avatarUrl || ''}
                          size="lg"
                        />
                        {room.hostUserId === member.userId && (
                          <span className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white">
                            <Crown size={11} />
                          </span>
                        )}
                      </div>
                      <p className="max-w-[120px] truncate text-sm font-semibold text-slate-900">
                        {member.displayName}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass(member.status)}`}
                      >
                        {statusLabel(member.status)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[118px] flex-col items-center justify-center text-slate-400">
                      <Users size={22} />
                      <p className="mt-1 text-xs">空位</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleLeaveRoom}
                disabled={isBusy}
                className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                <DoorOpen size={15} className="mr-1" />
                离开房间
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center">
            <p className="text-sm text-slate-600">
              创建新房间或输入 RoomCode 加入，支持 3-5 人状态实时同步。
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyRoom;
