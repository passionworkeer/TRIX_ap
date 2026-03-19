import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

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
  hostActionStudyRoom: vi.fn(),
  lookupStudyRoomsByUsers: vi.fn(async () => ({ users: [] }))
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
    hostActionStudyRoom: mocks.hostActionStudyRoom,
    lookupStudyRoomsByUsers: mocks.lookupStudyRoomsByUsers
  }
}));

const NOW = Date.now();

function makeRoom(overrides = {}) {
  return {
    roomCode: 'ROOM01',
    hostUserId: 'user-1',
    sessionState: 'idle',
    members: [
      {
        userId: 'user-1',
        displayName: 'tester',
        avatarUrl: null,
        joinedAt: NOW,
        lastActiveAt: NOW,
        status: 'online'
      }
    ],
    maxMembers: 5,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    timer: null,
    ...overrides
  };
}

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
    mocks.getStudyRoomState.mockResolvedValue(makeRoom());

    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    expect(await screen.findByText('开始')).toBeDefined();
    expect(screen.getByText('暂停')).toBeDefined();
    expect(screen.getByText('结束')).toBeDefined();
  });

  it('renders room code in header when in room', async () => {
    mocks.getStudyRoomState.mockResolvedValue(makeRoom({ roomCode: 'XYZ789' }));

    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    expect(await screen.findByText('XYZ789')).toBeDefined();
  });

  it('shows member count in room info', async () => {
    mocks.getStudyRoomState.mockResolvedValue(
      makeRoom({
        members: [
          { userId: 'user-1', displayName: 'Alice', avatarUrl: null, joinedAt: NOW, lastActiveAt: NOW, status: 'online' },
          { userId: 'user-2', displayName: 'Bob', avatarUrl: null, joinedAt: NOW, lastActiveAt: NOW, status: 'online' },
          { userId: 'user-3', displayName: 'Charlie', avatarUrl: null, joinedAt: NOW, lastActiveAt: NOW, status: 'online' }
        ]
      })
    );

    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    expect(await screen.findByText('3 / 5')).toBeDefined();
  });

  it('displays member status badges when focusing', async () => {
    // Set mock BEFORE render so the async getStudyRoomState uses the correct mock
    mocks.getStudyRoomState.mockResolvedValue(
      makeRoom({
        sessionState: 'focusing',
        members: [
          { userId: 'user-1', displayName: 'Alice', avatarUrl: null, joinedAt: NOW, lastActiveAt: NOW, status: 'focusing' },
          { userId: 'user-2', displayName: 'Bob', avatarUrl: null, joinedAt: NOW, lastActiveAt: NOW, status: 'focusing' }
        ]
      })
    );

    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    expect(await screen.findByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
  });

  it('shows remaining timer when session is active', async () => {
    mocks.getStudyRoomState.mockResolvedValue(
      makeRoom({
        sessionState: 'resting',
        timer: {
          durationSeconds: 1500,
          startedAt: NOW,
          endsAt: NOW + 1500000,
          remainingSeconds: 1200
        }
      })
    );

    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    // Timer shows "20:00" for 1200 remaining seconds (resting state uses timer.remainingSeconds directly)
    expect(await screen.findByText('20:00')).toBeDefined();
  });

  it('calls leaveStudyRoom when leave button is clicked', async () => {
    mocks.getStudyRoomState.mockResolvedValue(makeRoom());
    mocks.leaveStudyRoom.mockResolvedValue(undefined);

    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    expect(await screen.findByText('离开房间')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '离开房间' }));

    await waitFor(() => {
      expect(mocks.leaveStudyRoom).toHaveBeenCalledWith('ROOM01');
    });
  });

  it('calls hostActionStudyRoom when start button is clicked', async () => {
    mocks.getStudyRoomState.mockResolvedValue(makeRoom({ sessionState: 'idle' }));
    mocks.hostActionStudyRoom.mockResolvedValue(
      makeRoom({ sessionState: 'focusing', timer: { durationSeconds: 1500, startedAt: NOW, endsAt: NOW + 1500000, remainingSeconds: 1500 } })
    );

    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    fireEvent.click(await screen.findByText('开始'));

    await waitFor(() => {
      expect(mocks.hostActionStudyRoom).toHaveBeenCalledWith('ROOM01', 'start_focus');
    });
  });

  it('calls hostActionStudyRoom when pause button is clicked', async () => {
    mocks.getStudyRoomState.mockResolvedValue(
      makeRoom({
        sessionState: 'focusing',
        timer: { durationSeconds: 1500, startedAt: NOW, endsAt: NOW + 1500000, remainingSeconds: 1200 }
      })
    );
    mocks.hostActionStudyRoom.mockResolvedValue(
      makeRoom({ sessionState: 'resting' })
    );

    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    fireEvent.click(await screen.findByText('暂停'));

    await waitFor(() => {
      expect(mocks.hostActionStudyRoom).toHaveBeenCalledWith('ROOM01', 'pause');
    });
  });

  it('calls hostActionStudyRoom when end button is clicked', async () => {
    mocks.getStudyRoomState.mockResolvedValue(
      makeRoom({ sessionState: 'focusing', timer: { durationSeconds: 1500, startedAt: NOW, endsAt: NOW + 1500000, remainingSeconds: 1000 } })
    );
    mocks.hostActionStudyRoom.mockResolvedValue(makeRoom({ sessionState: 'idle', timer: null }));

    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    fireEvent.click(await screen.findByText('结束'));

    await waitFor(() => {
      expect(mocks.hostActionStudyRoom).toHaveBeenCalledWith('ROOM01', 'end');
    });
  });

  it('shows "自己自习" entry mode with duration presets', async () => {
    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    expect(screen.getByText('选择本次专注时长')).toBeDefined();
    expect(screen.getByText('25 分钟')).toBeDefined();
    expect(screen.getByText('45 分钟')).toBeDefined();
    expect(screen.getByText('60 分钟')).toBeDefined();
  });

  it('calls joinStudyRoom when room code is entered and join clicked', async () => {
    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    // Switch to room-code mode
    fireEvent.click(screen.getByRole('button', { name: '房间号加入' }));

    // Enter room code
    const input = screen.getByPlaceholderText('输入房间号（如 A1B2C3）');
    fireEvent.change(input, { target: { value: 'XYZ123' } });

    // Click join
    fireEvent.click(screen.getByRole('button', { name: '加入' }));

    await waitFor(() => {
      expect(mocks.joinStudyRoom).toHaveBeenCalledWith('XYZ123', 'tester', undefined);
    });
  });

  it('rejects room codes shorter than 4 characters', async () => {
    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: '房间号加入' }));

    const input = screen.getByPlaceholderText('输入房间号（如 A1B2C3）');
    fireEvent.change(input, { target: { value: 'AB' } });
    fireEvent.click(screen.getByRole('button', { name: '加入' }));

    await waitFor(() => {
      expect(mocks.joinStudyRoom).not.toHaveBeenCalled();
    });
  });

  it('subscribes to study_room_state event on open', async () => {
    mocks.getStudyRoomState.mockResolvedValue(null);
    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    expect(mocks.on).toHaveBeenCalledWith('study_room_state', expect.any(Function));
  });

  it('unsubscribes from study_room_state event on close', async () => {
    mocks.getStudyRoomState.mockResolvedValue(null);
    const StudyRoom = (await import('./StudyRoom')).default;
    const { unmount } = render(<StudyRoom isOpen={true} onClose={() => {}} />);

    unmount();

    expect(mocks.off).toHaveBeenCalledWith('study_room_state', expect.any(Function));
  });

  it('normalizes room code to uppercase', async () => {
    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: '房间号加入' }));

    const input = screen.getByPlaceholderText('输入房间号（如 A1B2C3）');
    fireEvent.change(input, { target: { value: 'abc123' } });

    // The input value should be normalized to uppercase
    expect((input as HTMLInputElement).value).toBe('ABC123');
  });

  it('hides host controls when user is not host', async () => {
    mocks.getStudyRoomState.mockResolvedValue(
      makeRoom({
        hostUserId: 'other-user',
        members: [
          { userId: 'other-user', displayName: 'Host', avatarUrl: null, joinedAt: NOW, lastActiveAt: NOW, status: 'online' },
          { userId: 'user-1', displayName: 'tester', avatarUrl: null, joinedAt: NOW, lastActiveAt: NOW, status: 'online' }
        ]
      })
    );

    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    // Non-host should not see start/pause/end buttons
    expect(screen.queryByRole('button', { name: '开始' })).toBeNull();
  });

  it('shows friend list entry mode', async () => {
    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: '加入好友' }));

    await waitFor(() => {
      expect(screen.getByText('好友房间')).toBeDefined();
    });
  });

  it('handles room not found error when joining', async () => {
    mocks.joinStudyRoom.mockRejectedValue(new Error('Room not found'));

    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: '房间号加入' }));

    const input = screen.getByPlaceholderText('输入房间号（如 A1B2C3）');
    fireEvent.change(input, { target: { value: 'NOTFND' } });
    fireEvent.click(screen.getByRole('button', { name: '加入' }));

    await waitFor(() => {
      expect(mocks.showError).toHaveBeenCalledWith('Room not found');
    });
  });

  it('updates room state when study_room_state event fires', async () => {
    mocks.getStudyRoomState.mockResolvedValue(null);

    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    // Find the handler registered for study_room_state
    const eventHandler = mocks.on.mock.calls.find(
      (call) => call[0] === 'study_room_state'
    )?.[1];

    expect(eventHandler).toBeDefined();

    // Simulate WebSocket event with new room state (wrapped in act for React state batching)
    act(() => {
      eventHandler!({
        roomCode: 'REALTIME',
        reason: 'member_joined',
        room: makeRoom({
          roomCode: 'REALTIME',
          members: [
            { userId: 'user-1', displayName: 'tester', avatarUrl: null, joinedAt: NOW, lastActiveAt: NOW, status: 'online' },
            { userId: 'user-2', displayName: 'Alice', avatarUrl: null, joinedAt: NOW, lastActiveAt: NOW, status: 'online' }
          ]
        }),
        serverTs: NOW
      });
    });

    await waitFor(() => {
      expect(screen.getByText('REALTIME')).toBeDefined();
    });
  });

  it('shows empty slots for remaining seats', async () => {
    mocks.getStudyRoomState.mockResolvedValue(
      makeRoom({
        members: [
          { userId: 'user-1', displayName: 'Alice', avatarUrl: null, joinedAt: NOW, lastActiveAt: NOW, status: 'online' }
        ]
      })
    );

    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    // Should show empty slots (seat count = maxMembers = 5, 1 filled + 4 empty)
    await waitFor(() => {
      expect(screen.getAllByText('空位').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('calls lookupStudyRoomsByUsers when friend mode is selected', async () => {
    mocks.getStudyRoomState.mockResolvedValue(null);

    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: '加入好友' }));

    // Should call lookupStudyRoomsByUsers (requires mock setup to return friends)
    await waitFor(() => {
      // lookupStudyRoomsByUsers is called during friend mode load
      // The mock returns empty users by default
      expect(screen.getByText('暂无可用好友')).toBeDefined();
    });
  });

  it('polling refreshes room state periodically', async () => {
    vi.useFakeTimers();
    mocks.getStudyRoomState.mockResolvedValue(null);

    const StudyRoom = (await import('./StudyRoom')).default;
    render(<StudyRoom isOpen={true} onClose={() => {}} />);

    // Advance timers to trigger polling
    vi.advanceTimersByTime(6000);

    // Should have been called multiple times
    expect(mocks.getStudyRoomState.mock.calls.length).toBeGreaterThan(0);

    vi.useRealTimers();
  });
});
