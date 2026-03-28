import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetSession,
  mockFrom,
  mockRpc,
  mockChannel,
  mockRemoveChannel,
  mockHandleGlobalError,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockChannel: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockHandleGlobalError: vi.fn(),
}));

vi.mock('../../src/config/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
    from: mockFrom,
    rpc: mockRpc,
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}));

vi.mock('../../src/utils/errorHandler', () => ({
  handleGlobalError: mockHandleGlobalError,
}));

vi.mock('../../src/utils/logger', () => ({
  logger: {
    study: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    points: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    chat: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  },
}));

type QueryState = {
  data?: unknown;
  error?: unknown;
  count?: number | null;
};

function createQueryChain(state: QueryState = {}) {
  const chain: Record<string, unknown> = {
    data: state.data ?? [],
    error: state.error ?? null,
    count: state.count ?? null,
  };

  for (const method of ['select', 'eq', 'order', 'limit', 'lt', 'gte', 'insert', 'update', 'delete', 'upsert', 'single', 'maybeSingle', 'not']) {
    chain[method] = vi.fn(() => chain);
  }

  return chain as {
    data: unknown;
    error: unknown;
    count: number | null;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    lt: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    not: ReturnType<typeof vi.fn>;
  };
}

describe('Database service layer integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-123' },
        },
      },
      error: null,
    });
  });

  it('queries study_sessions through getStudySessions with the authenticated user', async () => {
    const query = createQueryChain({
      data: [{ id: 'session-1', user_id: 'user-123' }],
    });
    mockFrom.mockReturnValue(query);

    const { getStudySessions } = await import('../../src/services/studySessionService');
    const result = await getStudySessions(5);

    expect(mockFrom).toHaveBeenCalledWith('study_sessions');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(query.order).toHaveBeenCalledWith('started_at', { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(5);
    expect(result).toEqual([{ id: 'session-1', user_id: 'user-123' }]);
  });

  it('reads unlocked achievements from user_achievements through achievementService', async () => {
    const query = createQueryChain({
      data: [{ achievement_id: 'study_starter' }],
    });
    mockFrom.mockReturnValue(query);

    const { achievementService } = await import('../../src/services/achievementService');
    const result = await achievementService.getUserAchievements('user-123');

    expect(mockFrom).toHaveBeenCalledWith('user_achievements');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(result.length).toBeGreaterThan(0);
  });

  it('queries point_transactions through getPointsHistory', async () => {
    const query = createQueryChain({
      data: [{ id: 'tx-1', points_change: 10 }],
    });
    mockFrom.mockReturnValue(query);

    const { getPointsHistory } = await import('../../src/services/pointsService');
    const result = await getPointsHistory('user-123', 5);

    expect(mockFrom).toHaveBeenCalledWith('point_transactions');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(5);
    expect(result).toEqual([{ id: 'tx-1', points_change: 10 }]);
  });

  it('returns an empty chat history payload when the chat query fails', async () => {
    const query = createQueryChain({
      data: null,
      error: new Error('Network error'),
      count: 0,
    });
    mockFrom.mockReturnValue(query);

    const { getChatHistory } = await import('../../src/services/chatService');
    const result = await getChatHistory('friend-123');

    expect(mockFrom).toHaveBeenCalledWith('chat_messages');
    expect(query.eq).toHaveBeenCalledWith('conversation_id', 'friend-123_user-123');
    expect(result).toEqual({ messages: [], hasMore: false });
    expect(mockHandleGlobalError).toHaveBeenCalled();
  });
});
