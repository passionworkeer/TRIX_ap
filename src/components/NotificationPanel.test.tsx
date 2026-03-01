/**
 * Component tests for NotificationPanel
 *
 * Tests the notification panel for viewing system notifications
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock database service
vi.mock('../services/databaseService', () => ({
  getNotifications: vi.fn(),
  markNotificationAsRead: vi.fn(),
  acceptFriendRequest: vi.fn(),
  rejectFriendRequest: vi.fn(),
  getNotificationDisplayContent: vi.fn((content) => content.title || 'Test content'),
}));

// Mock Avatar component
vi.mock('../components/Avatar', () => ({
  default: ({ name, avatar, size }: any) => (
    <div data-testid="avatar" data-name={name} data-size={size}>
      {name.charAt(0)}
    </div>
  ),
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  X: () => <span data-testid="icon">X</span>,
  Bell: () => <span data-testid="icon">Bell</span>,
  MessageCircle: () => <span data-testid="icon">MessageCircle</span>,
  UserPlus: () => <span data-testid="icon">UserPlus</span>,
  AlertCircle: () => <span data-testid="icon">AlertCircle</span>,
  Check: () => <span data-testid="icon">Check</span>,
}));

// Mock error handler
vi.mock('../utils/errorHandler', () => ({
  getErrorMessage: vi.fn((error, defaultMsg) => defaultMsg),
}));

describe('NotificationPanel', () => {
  const mockNotifications = [
    {
      id: 'notif-1',
      type: 'message' as const,
      title: 'New Message',
      content: { title: 'Alice sent you a message' },
      avatar_url: '',
      is_read: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 'notif-2',
      type: 'system' as const,
      title: 'System Notification',
      content: { title: 'System update available' },
      avatar_url: '',
      is_read: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'notif-3',
      type: 'friend_request' as const,
      title: 'Friend Request',
      content: { title: 'Bob wants to be your friend' },
      avatar_url: '',
      is_read: false,
      created_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal when isOpen is true', async () => {
    const { getNotifications } = await import('../services/databaseService');
    getNotifications.mockResolvedValue([]);

    const NotificationPanel = (await import('../components/NotificationPanel')).default;

    render(
      <NotificationPanel
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('通知')).toBeDefined();
  });

  it('should not render when isOpen is false', async () => {
    const NotificationPanel = (await import('../components/NotificationPanel')).default;

    const { container } = render(
      <NotificationPanel
        isOpen={false}
        onClose={() => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should call onClose when close button is clicked', async () => {
    const { getNotifications } = await import('../services/databaseService');
    getNotifications.mockResolvedValue([]);

    const NotificationPanel = (await import('../components/NotificationPanel')).default;
    const onClose = vi.fn();

    render(
      <NotificationPanel
        isOpen={true}
        onClose={onClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: '关闭通知面板' });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('should display notification list', async () => {
    const { getNotifications } = await import('../services/databaseService');
    getNotifications.mockResolvedValue(mockNotifications);

    const NotificationPanel = (await import('../components/NotificationPanel')).default;

    render(
      <NotificationPanel
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('New Message')).toBeDefined();
      expect(screen.getByText('System Notification')).toBeDefined();
      expect(screen.getByText('Friend Request')).toBeDefined();
    });
  });

  it('should show unread count', async () => {
    const { getNotifications } = await import('../services/databaseService');
    getNotifications.mockResolvedValue(mockNotifications);

    const NotificationPanel = (await import('../components/NotificationPanel')).default;

    render(
      <NotificationPanel
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('2 条未读')).toBeDefined();
    });
  });

  it('should show empty state when no notifications', async () => {
    const { getNotifications } = await import('../services/databaseService');
    getNotifications.mockResolvedValue([]);

    const NotificationPanel = (await import('../components/NotificationPanel')).default;

    render(
      <NotificationPanel
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('没有通知')).toBeDefined();
    });
  });

  it('should have mark all as read button when there are unread notifications', async () => {
    const { getNotifications } = await import('../services/databaseService');
    getNotifications.mockResolvedValue(mockNotifications);

    const NotificationPanel = (await import('../components/NotificationPanel')).default;

    render(
      <NotificationPanel
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      const markAllButton = screen.getByRole('button', { name: '全部标记为已读' });
      expect(markAllButton).toBeDefined();
    });
  });

  it('should show friend request action buttons for unread friend requests', async () => {
    const { getNotifications } = await import('../services/databaseService');
    getNotifications.mockResolvedValue(mockNotifications);

    const NotificationPanel = (await import('../components/NotificationPanel')).default;

    render(
      <NotificationPanel
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('接受')).toBeDefined();
      expect(screen.getByText('拒绝')).toBeDefined();
    });
  });

  it('should call acceptFriendRequest when accept button is clicked', async () => {
    const { getNotifications, acceptFriendRequest } = await import('../services/databaseService');
    getNotifications.mockResolvedValue(mockNotifications);
    acceptFriendRequest.mockResolvedValue(undefined);

    const NotificationPanel = (await import('../components/NotificationPanel')).default;

    render(
      <NotificationPanel
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      const acceptButton = screen.getByText('接受');
      fireEvent.click(acceptButton);
    });

    expect(acceptFriendRequest).toHaveBeenCalledWith('notif-3');
  });
});
