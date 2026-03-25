/**
 * Component tests for AchievementsPanel
 *
 * Tests achievements panel renders achievement list
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock achievementService
vi.mock('../services/achievementService', () => ({
  achievementService: {
    getUserAchievements: vi.fn().mockResolvedValue([]),
  },
}));

// Mock achievement types
vi.mock('../types/achievement', () => ({
  getAchievementColor: vi.fn(() => '#000'),
  getAchievementBgColor: vi.fn(() => 'rgba(0,0,0,0.1)'),
}));

describe('AchievementsPanel', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    userId: 'test-user-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when isOpen is false', async () => {
    const AchievementsPanel = (await import('./AchievementsPanel')).AchievementsPanel;

    const { container } = render(<AchievementsPanel {...defaultProps} isOpen={false} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render panel when isOpen is true', async () => {
    const AchievementsPanel = (await import('./AchievementsPanel')).AchievementsPanel;

    render(<AchievementsPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('成就')).toBeInTheDocument();
    });
  });

  it('should render title', async () => {
    const AchievementsPanel = (await import('./AchievementsPanel')).AchievementsPanel;

    render(<AchievementsPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('成就')).toBeInTheDocument();
    });
  });

  it('should render close button', async () => {
    const AchievementsPanel = (await import('./AchievementsPanel')).AchievementsPanel;

    render(<AchievementsPanel {...defaultProps} />);

    await waitFor(() => {
      const closeButton = screen.getByRole('button', { name: '关闭' });
      expect(closeButton).toBeInTheDocument();
    });
  });

  it('should show loading state initially', async () => {
    const { achievementService } = await import('../../src/services/achievementService');
    vi.mocked(achievementService.getUserAchievements).mockImplementation(
      () => new Promise(() => {}) // Never resolves to keep loading state
    );

    const AchievementsPanel = (await import('./AchievementsPanel')).AchievementsPanel;

    render(<AchievementsPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });
  });

  it('should render empty state when no achievements', async () => {
    const { achievementService } = await import('../../src/services/achievementService');
    vi.mocked(achievementService.getUserAchievements).mockResolvedValue([]);

    const AchievementsPanel = (await import('./AchievementsPanel')).AchievementsPanel;

    render(<AchievementsPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('暂无成就数据')).toBeInTheDocument();
    });
  });

  it('should render achievements when data is loaded', async () => {
    const { achievementService } = await import('../../src/services/achievementService');
    vi.mocked(achievementService.getUserAchievements).mockResolvedValue([
      {
        id: '1',
        name: '初学者',
        description: '完成第一次对话',
        icon: '🎯',
        rarity: 'common' as const,
        unlockedAt: '2026-01-01',
      },
    ]);

    const AchievementsPanel = (await import('./AchievementsPanel')).AchievementsPanel;

    render(<AchievementsPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('初学者')).toBeInTheDocument();
      expect(screen.getByText('完成第一次对话')).toBeInTheDocument();
    });
  });

  it('should show unlock count', async () => {
    const { achievementService } = await import('../../src/services/achievementService');
    vi.mocked(achievementService.getUserAchievements).mockResolvedValue([
      { id: '1', name: '初学者', description: 'Test', icon: '🎯', rarity: 'common' as const, unlockedAt: '2026-01-01' },
      { id: '2', name: '进阶', description: 'Test', icon: '⭐', rarity: 'rare' as const },
    ]);

    const AchievementsPanel = (await import('./AchievementsPanel')).AchievementsPanel;

    render(<AchievementsPanel {...defaultProps} />);

    await waitFor(() => {
      // Should show "1 / 2 已解锁"
      expect(screen.getByText(/1 \/ 2 已解锁/)).toBeInTheDocument();
    });
  });

  it('should render progress bar', async () => {
    const { achievementService } = await import('../../src/services/achievementService');
    vi.mocked(achievementService.getUserAchievements).mockResolvedValue([
      { id: '1', name: '初学者', description: 'Test', icon: '🎯', rarity: 'common' as const, unlockedAt: '2026-01-01' },
    ]);

    const AchievementsPanel = (await import('./AchievementsPanel')).AchievementsPanel;

    render(<AchievementsPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('完成进度')).toBeInTheDocument();
    });
  });
});
