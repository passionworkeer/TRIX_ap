const ROOM_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

class StudyRoomError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

class StudyRoomService {
  constructor(options = {}) {
    const envMaxMembers = toFiniteNumber(process.env.STUDY_ROOM_MAX_MEMBERS);
    const envCodeLength = toFiniteNumber(process.env.STUDY_ROOM_CODE_LENGTH);

    this.defaultMaxMembers = clamp(
      toFiniteNumber(options.defaultMaxMembers) ?? envMaxMembers ?? 5,
      2,
      20
    );
    this.roomCodeLength = clamp(
      toFiniteNumber(options.roomCodeLength) ?? envCodeLength ?? 6,
      4,
      8
    );

    this.roomsByCode = new Map();
    this.userToRoom = new Map();
    this.socketToUser = new Map();
  }

  createRoom({ userId, displayName, avatarUrl, maxMembers }) {
    this.ensureUserId(userId);

    const updates = [];
    const existingRoomCode = this.userToRoom.get(userId);
    if (existingRoomCode) {
      const prior = this.leaveRoomInternal(userId, existingRoomCode, 'switch_room');
      if (prior) {
        updates.push(prior);
      }
    }

    const roomCode = this.generateUniqueRoomCode();
    const nowTs = Date.now();
    const room = {
      roomCode,
      hostUserId: userId,
      sessionState: 'idle',
      members: [
        {
          userId,
          displayName: this.normalizeDisplayName(displayName, userId),
          avatarUrl: this.normalizeAvatarUrl(avatarUrl),
          joinedAt: nowTs,
          lastActiveAt: nowTs,
          status: 'online'
        }
      ],
      maxMembers: this.resolveMaxMembers(maxMembers),
      version: 1,
      createdAt: nowTs,
      updatedAt: nowTs
    };

    this.roomsByCode.set(roomCode, room);
    this.userToRoom.set(userId, roomCode);
    updates.push(this.makeRoomUpdate(roomCode, room, 'create'));

    return {
      roomCode,
      room: this.toRoomSnapshot(room),
      updates
    };
  }

  joinRoom({ userId, roomCode, displayName, avatarUrl }) {
    this.ensureUserId(userId);

    const normalizedRoomCode = this.normalizeRoomCode(roomCode);
    if (!normalizedRoomCode) {
      throw new StudyRoomError('ROOM_NOT_FOUND', 'Room not found');
    }

    const room = this.roomsByCode.get(normalizedRoomCode);
    if (!room) {
      throw new StudyRoomError('ROOM_NOT_FOUND', 'Room not found');
    }

    const currentRoomCode = this.userToRoom.get(userId);
    if (currentRoomCode === normalizedRoomCode) {
      throw new StudyRoomError('ALREADY_IN_ROOM', 'User already in this room');
    }

    const updates = [];
    if (currentRoomCode && currentRoomCode !== normalizedRoomCode) {
      const prior = this.leaveRoomInternal(userId, currentRoomCode, 'switch_room');
      if (prior) {
        updates.push(prior);
      }
    }

    if (room.members.length >= room.maxMembers) {
      throw new StudyRoomError('ROOM_FULL', 'Room is full');
    }

    const nowTs = Date.now();
    room.members.push({
      userId,
      displayName: this.normalizeDisplayName(displayName, userId),
      avatarUrl: this.normalizeAvatarUrl(avatarUrl),
      joinedAt: nowTs,
      lastActiveAt: nowTs,
      status: this.memberStatusForSession(room.sessionState)
    });
    this.userToRoom.set(userId, normalizedRoomCode);
    this.bumpRoom(room);

    updates.push(this.makeRoomUpdate(normalizedRoomCode, room, 'join'));
    return {
      roomCode: normalizedRoomCode,
      room: this.toRoomSnapshot(room),
      updates
    };
  }

  leaveRoom({ userId, roomCode, reason = 'leave' }) {
    this.ensureUserId(userId);

    const targetRoomCode = this.normalizeRoomCode(roomCode) || this.userToRoom.get(userId);
    if (!targetRoomCode) {
      throw new StudyRoomError('NOT_IN_ROOM', 'User is not in any room');
    }

    const update = this.leaveRoomInternal(userId, targetRoomCode, reason);
    if (!update) {
      throw new StudyRoomError('NOT_IN_ROOM', 'User is not in the room');
    }

    return {
      roomCode: targetRoomCode,
      room: update.room,
      updates: [update]
    };
  }

  hostAction({ userId, roomCode, action }) {
    this.ensureUserId(userId);

    const normalizedRoomCode = this.normalizeRoomCode(roomCode);
    if (!normalizedRoomCode) {
      throw new StudyRoomError('ROOM_NOT_FOUND', 'Room not found');
    }

    const room = this.roomsByCode.get(normalizedRoomCode);
    if (!room) {
      throw new StudyRoomError('ROOM_NOT_FOUND', 'Room not found');
    }

    const isMember = room.members.some((member) => member.userId === userId);
    if (!isMember) {
      throw new StudyRoomError('NOT_IN_ROOM', 'User is not in the room');
    }

    if (room.hostUserId !== userId) {
      throw new StudyRoomError('HOST_ONLY_ACTION', 'Only host can trigger this action');
    }

    const targetState = this.resolveSessionStateByAction(action);
    room.sessionState = targetState;
    this.applyMemberStatuses(room, targetState);
    this.bumpRoom(room);

    const update = this.makeRoomUpdate(normalizedRoomCode, room, 'host_action');
    return {
      roomCode: normalizedRoomCode,
      room: this.toRoomSnapshot(room),
      updates: [update]
    };
  }

  getRoomState({ userId, roomCode }) {
    this.ensureUserId(userId);

    const targetRoomCode = this.normalizeRoomCode(roomCode) || this.userToRoom.get(userId);
    if (!targetRoomCode) {
      throw new StudyRoomError('NOT_IN_ROOM', 'User is not in any room');
    }

    const room = this.roomsByCode.get(targetRoomCode);
    if (!room) {
      throw new StudyRoomError('ROOM_NOT_FOUND', 'Room not found');
    }

    const isMember = room.members.some((member) => member.userId === userId);
    if (!isMember) {
      throw new StudyRoomError('NOT_IN_ROOM', 'User is not in the room');
    }

    return {
      roomCode: targetRoomCode,
      room: this.toRoomSnapshot(room)
    };
  }

  bindSocketUser(socketId, userId) {
    if (!socketId || typeof socketId !== 'string') {
      return;
    }
    if (!userId || typeof userId !== 'string') {
      return;
    }
    this.socketToUser.set(socketId, userId);
  }

  unbindSocket(socketId) {
    if (!socketId || typeof socketId !== 'string') {
      return;
    }
    this.socketToUser.delete(socketId);
  }

  getRoomCodeForUser(userId) {
    if (!userId || typeof userId !== 'string') {
      return null;
    }
    return this.userToRoom.get(userId) || null;
  }

  handleDisconnect(socketId) {
    if (!socketId || typeof socketId !== 'string') {
      return { updates: [] };
    }

    const userId = this.socketToUser.get(socketId);
    this.socketToUser.delete(socketId);
    if (!userId) {
      return { updates: [] };
    }

    const roomCode = this.userToRoom.get(userId);
    if (!roomCode) {
      return { updates: [] };
    }

    const update = this.leaveRoomInternal(userId, roomCode, 'disconnect');
    if (!update) {
      return { updates: [] };
    }

    return { updates: [update] };
  }

  ensureUserId(userId) {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new StudyRoomError('USER_NOT_REGISTERED', 'User not registered');
    }
  }

  resolveMaxMembers(inputMaxMembers) {
    const parsed = toFiniteNumber(inputMaxMembers);
    if (!parsed) {
      return this.defaultMaxMembers;
    }
    return clamp(Math.floor(parsed), 2, 20);
  }

  normalizeRoomCode(roomCode) {
    if (!roomCode || typeof roomCode !== 'string') {
      return null;
    }
    const normalized = roomCode.trim().toUpperCase();
    if (!normalized) {
      return null;
    }
    return normalized;
  }

  normalizeDisplayName(displayName, userId) {
    if (typeof displayName === 'string' && displayName.trim()) {
      return displayName.trim().slice(0, 48);
    }
    return `User-${String(userId).slice(0, 6)}`;
  }

  normalizeAvatarUrl(avatarUrl) {
    if (typeof avatarUrl !== 'string') {
      return null;
    }
    const normalized = avatarUrl.trim();
    if (!normalized) {
      return null;
    }
    return normalized.slice(0, 500);
  }

  memberStatusForSession(sessionState) {
    switch (sessionState) {
      case 'focusing':
        return 'focusing';
      case 'resting':
        return 'resting';
      case 'idle':
      default:
        return 'online';
    }
  }

  resolveSessionStateByAction(action) {
    switch (action) {
      case 'start_focus':
        return 'focusing';
      case 'pause':
        return 'resting';
      case 'end':
        return 'idle';
      default:
        throw new StudyRoomError('INVALID_ACTION', 'Invalid host action');
    }
  }

  applyMemberStatuses(room, sessionState) {
    const status = this.memberStatusForSession(sessionState);
    const nowTs = Date.now();
    room.members.forEach((member) => {
      member.status = status;
      member.lastActiveAt = nowTs;
    });
  }

  leaveRoomInternal(userId, roomCode, reason) {
    const room = this.roomsByCode.get(roomCode);
    if (!room) {
      this.userToRoom.delete(userId);
      return null;
    }

    const memberIndex = room.members.findIndex((member) => member.userId === userId);
    if (memberIndex === -1) {
      return null;
    }

    const isHostLeaving = room.hostUserId === userId;
    room.members.splice(memberIndex, 1);
    this.userToRoom.delete(userId);

    if (room.members.length === 0) {
      this.roomsByCode.delete(roomCode);
      return {
        roomCode,
        room: null,
        reason: 'room_closed'
      };
    }

    if (isHostLeaving) {
      const nextHost = room.members.reduce((current, candidate) => {
        if (!current) {
          return candidate;
        }
        return candidate.joinedAt < current.joinedAt ? candidate : current;
      }, null);
      if (nextHost) {
        room.hostUserId = nextHost.userId;
      }
    }

    this.applyMemberStatuses(room, room.sessionState);
    this.bumpRoom(room);

    return this.makeRoomUpdate(roomCode, room, isHostLeaving ? 'host_transfer' : reason);
  }

  makeRoomUpdate(roomCode, room, reason) {
    return {
      roomCode,
      room: this.toRoomSnapshot(room),
      reason
    };
  }

  toRoomSnapshot(room) {
    if (!room) {
      return null;
    }
    return {
      roomCode: room.roomCode,
      hostUserId: room.hostUserId,
      sessionState: room.sessionState,
      members: room.members.map((member) => ({ ...member })),
      maxMembers: room.maxMembers,
      version: room.version,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt
    };
  }

  bumpRoom(room) {
    room.version += 1;
    room.updatedAt = Date.now();
  }

  generateRoomCode() {
    let code = '';
    for (let i = 0; i < this.roomCodeLength; i += 1) {
      const index = Math.floor(Math.random() * ROOM_CODE_CHARSET.length);
      code += ROOM_CODE_CHARSET[index];
    }
    return code;
  }

  generateUniqueRoomCode() {
    for (let i = 0; i < 128; i += 1) {
      const code = this.generateRoomCode();
      if (!this.roomsByCode.has(code)) {
        return code;
      }
    }
    throw new StudyRoomError('ROOM_CODE_EXHAUSTED', 'Failed to generate room code');
  }
}

function createStudyRoomService(options = {}) {
  return new StudyRoomService(options);
}

module.exports = {
  StudyRoomError,
  StudyRoomService,
  createStudyRoomService,
  studyRoomService: createStudyRoomService()
};
