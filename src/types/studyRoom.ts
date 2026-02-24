export type StudyRoomSessionState = 'idle' | 'focusing' | 'resting';
export type StudyRoomMemberStatus = 'online' | 'focusing' | 'resting';
export type StudyRoomHostAction = 'start_focus' | 'pause' | 'end';

export interface StudyRoomMember {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  joinedAt: number;
  lastActiveAt: number;
  status: StudyRoomMemberStatus;
}

export interface StudyRoomTimerState {
  durationSeconds: number;
  startedAt: number;
  endsAt: number;
  remainingSeconds: number;
}

export interface StudyRoomState {
  roomCode: string;
  hostUserId: string;
  sessionState: StudyRoomSessionState;
  members: StudyRoomMember[];
  maxMembers: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  timer: StudyRoomTimerState | null;
}

export interface StudyRoomStateEvent {
  roomCode: string;
  reason: string;
  room: StudyRoomState | null;
  serverTs: number;
}

export interface StudyRoomAckPayload {
  success: boolean;
  code?: string;
  error?: string;
  roomCode?: string;
  room?: StudyRoomState | null;
}
