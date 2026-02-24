import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(async () => {}),
  showError: vi.fn(),
  showInfo: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
  isConnected: vi.fn(() => true),
  on: vi.fn(),
  off: vi.fn(),
  getStudyRoomState: vi.fn(async () => {
    throw new Error('NOT_IN_ROOM');
  }),
  createStudyRoom: vi.fn(async () => ({
    roomCode: 'ABC123',
    hostUserId: 'user-1',
    sessionState: 'idle',
    members: [
      {
        userId: 'user-1',
        displayName: 'tester',
        avatarUrl: null,
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        status: 'online'
      }
    ],
    maxMembers: 5,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    timer: null
  })),
  joinStudyRoom: vi.fn(),
  leaveStudyRoom: vi.fn(),
  hostActionStudyRoom: vi.fn()
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'tester@example.com' },
    profile: { username: 'tester', avatar_url: null }
  })
}));

vi.mock('../contexts/ClawbotChannelContext', () => ({
  useClawbotChannel: () => ({
    connect: mocks.connect
  })
}));

vi.mock('../hooks/useNotification', () => ({
  useNotification: () => ({
    showError: mocks.showError,
    showInfo: mocks.showInfo,
    showSuccess: mocks.showSuccess,
    showWarning: mocks.showWarning
  })
}));

vi.mock('../services/ClawbotChannelBridge', () => ({
  default: {
    isConnected: mocks.isConnected,
    on: mocks.on,
    off: mocks.off,
    getStudyRoomState: mocks.getStudyRoomState,
    createStudyRoom: mocks.createStudyRoom,
    joinStudyRoom: mocks.joinStudyRoom,
    leaveStudyRoom: mocks.leaveStudyRoom,
    hostActionStudyRoom: mocks.hostActionStudyRoom
  }
}));

describe('StudyRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isConnected.mockReturnValue(true);
    mocks.getStudyRoomState.mockRejectedValue(new Error('NOT_IN_ROOM'));
  });

  it('renders three entry modes when no active room', async () => {
    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    expect(await screen.findByText('自己自习')).toBeDefined();
    expect(screen.getByText('加入好友')).toBeDefined();
    expect(screen.getByText('房间号加入')).toBeDefined();
    expect(mocks.on).toHaveBeenCalledWith('study_room_state', expect.any(Function));
  });

  it('calls createStudyRoom when create button is clicked in room-code mode', async () => {
    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: '房间号加入' }));
    fireEvent.click(await screen.findByRole('button', { name: '创建' }));

    await waitFor(() => {
      expect(mocks.createStudyRoom).toHaveBeenCalled();
    });
  });

  it('renders host controls when current user is room host', async () => {
    const now = Date.now();
    mocks.getStudyRoomState.mockResolvedValue({
      roomCode: 'ROOM01',
      hostUserId: 'user-1',
      sessionState: 'idle',
      members: [
        {
          userId: 'user-1',
          displayName: 'tester',
          avatarUrl: null,
          joinedAt: now,
          lastActiveAt: now,
          status: 'online'
        }
      ],
      maxMembers: 5,
      version: 1,
      createdAt: now,
      updatedAt: now,
      timer: null
    });

    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    expect(await screen.findByText('开始')).toBeDefined();
    expect(screen.getByText('暂停')).toBeDefined();
    expect(screen.getByText('结束')).toBeDefined();
  });
});
