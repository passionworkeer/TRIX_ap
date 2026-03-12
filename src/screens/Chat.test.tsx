import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Initialize i18next for testing
i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'chat.title': 'Chat',
        'chat.noFriends': 'No friends yet',
        'chat.unpaired': 'Not paired',
        'common.loading': 'Loading...',
      },
    },
    zh: {
      translation: {
        'chat.title': '聊天',
        'chat.noFriends': '暂无好友',
        'chat.unpaired': '未配对',
        'common.loading': '加载中...',
      },
    },
  },
  lng: 'zh',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

const mocks = vi.hoisted(() => ({
  getFriends: vi.fn(),
  addFriend: vi.fn(),
  showError: vi.fn(),
  isConnected: vi.fn(() => true),
  isPaired: vi.fn(() => true),
}));

vi.mock('../services/databaseService', () => ({
  getFriends: mocks.getFriends,
  addFriend: mocks.addFriend,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'tester@example.com' },
    profile: { username: 'tester', avatar_url: null }
  })
}));

vi.mock('../contexts/ClawbotChannelContext', () => ({
  useClawbotChannel: () => ({
    get isConnected() { return mocks.isConnected(); },
    get isPaired() { return mocks.isPaired(); },
  })
}));

vi.mock('../hooks/useNotification', () => ({
  useNotification: () => ({
    showError: mocks.showError,
  })
}));

// Mock supabase with proper chain
vi.mock('../config/supabase', () => {
  const UserOnlineStatus = {
    ONLINE: 'online',
    AWAY: 'away',
    OFFLINE: 'offline',
  } as const;

  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-1', email: 'tester@example.com' } } }
        }),
      },
      from: vi.fn((table: string) => ({
        select: vi.fn(() => {
          if (table === 'profiles') {
            return {
              neq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            };
          }

          return {
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }),
      })),
    },
    getUsersLastActive: vi.fn().mockResolvedValue({}),
    calculateOnlineStatus: vi.fn(() => UserOnlineStatus.OFFLINE),
    getOnlineStatusText: vi.fn(() => '离线'),
    UserOnlineStatus,
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </I18nextProvider>
  );
};

describe('Chat Screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFriends.mockResolvedValue([]);
    mocks.isConnected.mockReturnValue(true);
    mocks.isPaired.mockReturnValue(true);
  });

  it('renders loading state initially', async () => {
    mocks.getFriends.mockImplementation(
      () => new Promise(() => {}) // Never resolves to keep loading state
    );

    const Chat = (await import('./Chat')).default;
    renderWithRouter(<Chat />);

    await waitFor(() => {
      expect(screen.getByText(/加载中/)).toBeDefined();
    }, { timeout: 1000 });
  });

  it('renders friends list when loaded', async () => {
    const mockFriends = [
      {
        user_id: 'user-1',
        friend_id: 'friend-1',
        name: 'Alice',
        avatar_url: null,
        status: 'online' as const,
        bio: null,
        study_time: 0,
        is_studying: false,
        unread_count: 0,
        last_message: 'Hello',
        last_message_time: new Date().toISOString(),
      },
      {
        user_id: 'user-1',
        friend_id: 'friend-2',
        name: 'Bob',
        avatar_url: null,
        status: 'offline' as const,
        bio: null,
        study_time: 0,
        is_studying: false,
        unread_count: 2,
        last_message: 'Hi there',
        last_message_time: new Date().toISOString(),
      },
    ];

    mocks.getFriends.mockResolvedValue(mockFriends);

    const Chat = (await import('./Chat')).default;
    renderWithRouter(<Chat />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeDefined();
      expect(screen.getByText('Bob')).toBeDefined();
    });
  });

  it('renders TRIX Bot entry', async () => {
    mocks.getFriends.mockResolvedValue([]);

    const Chat = (await import('./Chat')).default;
    renderWithRouter(<Chat />);

    await waitFor(() => {
      expect(screen.getByText('TRIX Bot')).toBeDefined();
    });
  });

  it('shows unpaired status when TRIX Bot is not connected', async () => {
    mocks.getFriends.mockResolvedValue([]);
    mocks.isConnected.mockReturnValue(false);
    mocks.isPaired.mockReturnValue(false);

    const Chat = (await import('./Chat')).default;
    renderWithRouter(<Chat />);

    await waitFor(() => {
      expect(screen.getByText(/未配对/)).toBeDefined();
    });
  });

  it('shows empty state when no friends', async () => {
    mocks.getFriends.mockResolvedValue([]);

    const Chat = (await import('./Chat')).default;
    renderWithRouter(<Chat />);

    await waitFor(() => {
      expect(screen.getByText(/暂无好友/)).toBeDefined();
    });
  });

  it('filters friends based on search query', async () => {
    const mockFriends = [
      {
        user_id: 'user-1',
        friend_id: 'friend-1',
        name: 'Alice',
        avatar_url: null,
        status: 'online' as const,
        bio: null,
        study_time: 0,
        is_studying: false,
        unread_count: 0,
        last_message: 'Hello',
        last_message_time: null,
      },
      {
        user_id: 'user-1',
        friend_id: 'friend-2',
        name: 'Bob',
        avatar_url: null,
        status: 'offline' as const,
        bio: null,
        study_time: 0,
        is_studying: false,
        unread_count: 0,
        last_message: 'Hi',
        last_message_time: null,
      },
    ];

    mocks.getFriends.mockResolvedValue(mockFriends);

    const Chat = (await import('./Chat')).default;
    renderWithRouter(<Chat />);

    // Wait for initial render - both should be visible
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeDefined();
      expect(screen.getByText('Bob')).toBeDefined();
    });

    // Search for Alice
    const searchInput = screen.getByPlaceholderText('搜索');
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    // After filtering, Alice should still be visible
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeDefined();
    });
  });

  it('clears search when clear button is clicked', async () => {
    const mockFriends = [
      {
        user_id: 'user-1',
        friend_id: 'friend-1',
        name: 'Alice',
        avatar_url: null,
        status: 'online' as const,
        bio: null,
        study_time: 0,
        is_studying: false,
        unread_count: 0,
        last_message: 'Hello',
        last_message_time: null,
      },
    ];

    mocks.getFriends.mockResolvedValue(mockFriends);

    const Chat = (await import('./Chat')).default;
    renderWithRouter(<Chat />);

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeDefined();
    });

    // Search for Alice
    const searchInput = screen.getByPlaceholderText('搜索');
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    // Clear search
    const clearButton = screen.getByLabelText('清除搜索');
    fireEvent.click(clearButton);

    expect((searchInput as HTMLInputElement).value).toBe('');
  });

  it('opens add friend modal when button is clicked', async () => {
    mocks.getFriends.mockResolvedValue([]);

    const Chat = (await import('./Chat')).default;
    renderWithRouter(<Chat />);

    await waitFor(() => {
      expect(screen.getByLabelText('添加好友')).toBeDefined();
    });

    const addButton = screen.getByLabelText('添加好友');
    fireEvent.click(addButton);

    // The modal should be open now - we can check for modal content
    await waitFor(() => {
      expect(screen.getByText(/添加好友/)).toBeDefined();
    });
  });

  it('displays unread count badge', async () => {
    const mockFriends = [
      {
        user_id: 'user-1',
        friend_id: 'friend-1',
        name: 'Alice',
        avatar_url: null,
        status: 'online' as const,
        bio: null,
        study_time: 0,
        is_studying: false,
        unread_count: 5,
        last_message: 'Hello',
        last_message_time: new Date().toISOString(),
      },
    ];

    mocks.getFriends.mockResolvedValue(mockFriends);

    const Chat = (await import('./Chat')).default;
    renderWithRouter(<Chat />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeDefined();
    });
  });

  it('displays 9+ for unread count over 9', async () => {
    const mockFriends = [
      {
        user_id: 'user-1',
        friend_id: 'friend-1',
        name: 'Alice',
        avatar_url: null,
        status: 'online' as const,
        bio: null,
        study_time: 0,
        is_studying: false,
        unread_count: 15,
        last_message: 'Hello',
        last_message_time: new Date().toISOString(),
      },
    ];

    mocks.getFriends.mockResolvedValue(mockFriends);

    const Chat = (await import('./Chat')).default;
    renderWithRouter(<Chat />);

    await waitFor(() => {
      expect(screen.getByText('9+')).toBeDefined();
    });
  });

  it('handles error state when loading friends fails', async () => {
    mocks.getFriends.mockRejectedValue(new Error('Failed to load friends'));

    const Chat = (await import('./Chat')).default;
    renderWithRouter(<Chat />);

    // Should still render even on error (with empty list)
    await waitFor(() => {
      expect(screen.getByText(/暂无好友/)).toBeDefined();
    });
  });
});
