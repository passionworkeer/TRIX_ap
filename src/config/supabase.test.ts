import { beforeEach, describe, expect, it, vi } from 'vitest';

const { inMock, selectMock, fromMock } = vi.hoisted(() => {
  const inMock = vi.fn();
  const selectMock = vi.fn(() => ({ in: inMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));

  return { inMock, selectMock, fromMock };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getSession: vi.fn() },
    from: fromMock,
  })),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    auth: {
      error: vi.fn(),
    },
  },
}));

import { getUsersLastActive } from './supabase';

describe('getUsersLastActive', () => {
  beforeEach(() => {
    inMock.mockReset();
    selectMock.mockClear();
    fromMock.mockClear();
  });

  it('skips invalid ids and preserves null fallbacks', async () => {
    const validId = '00000000-0000-4000-8000-000000000101';

    inMock.mockResolvedValue({
      data: [{ id: validId, last_active_at: '2026-03-13T00:00:00.000Z' }],
      error: null,
    });

    const result = await getUsersLastActive([validId, 'demo-friend-ava', validId, '']);

    expect(fromMock).toHaveBeenCalledWith('profiles');
    expect(selectMock).toHaveBeenCalledWith('id, last_active_at');
    expect(inMock).toHaveBeenCalledWith('id', [validId]);
    expect(result).toEqual({
      [validId]: '2026-03-13T00:00:00.000Z',
      'demo-friend-ava': null,
    });
  });

  it('avoids querying Supabase when all ids are invalid', async () => {
    const result = await getUsersLastActive(['demo-friend-ava', 'demo-friend-leo']);

    expect(fromMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      'demo-friend-ava': null,
      'demo-friend-leo': null,
    });
  });
});
