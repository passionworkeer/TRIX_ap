/**
 * Component tests for PointsHistory
 *
 * Tests points history renders transaction list
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock react-virtuoso
vi.mock('react-virtuoso', () => ({
  Virtuoso: vi.fn(({ data, itemContent }) => (
    <div data-testid="virtuoso-list">
      {data?.map((item: any, index: number) => (
        <div key={item.id || index}>
          {itemContent?.(index, item)}
        </div>
      ))}
    </div>
  )),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock supabase at config level
vi.mock('../config/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    }),
  },
}));

describe('PointsHistory', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    userId: 'test-user-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when isOpen is false', async () => {
    const PointsHistory = (await import('./PointsHistory')).PointsHistory;

    const { container } = render(<PointsHistory {...defaultProps} isOpen={false} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render dialog when isOpen is true', async () => {
    const PointsHistory = (await import('./PointsHistory')).PointsHistory;

    render(<PointsHistory {...defaultProps} />);

    expect(screen.getByText('积分历史')).toBeInTheDocument();
  });

  it('should render subtitle', async () => {
    const PointsHistory = (await import('./PointsHistory')).PointsHistory;

    render(<PointsHistory {...defaultProps} />);

    expect(screen.getByText('查看积分变动记录')).toBeInTheDocument();
  });

  it('should render close button', async () => {
    const PointsHistory = (await import('./PointsHistory')).PointsHistory;

    render(<PointsHistory {...defaultProps} />);

    const closeButton = screen.getByRole('button');
    expect(closeButton).toBeInTheDocument();
  });

  it('should show empty state when no transactions', async () => {
    const PointsHistory = (await import('./PointsHistory')).PointsHistory;

    render(<PointsHistory {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('暂无积分记录')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should render transaction items when data is available', async () => {
    const { supabase } = await import('../config/supabase');

    // Override to return data
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'tx-1',
                  transaction_type: 'study_complete',
                  points_change: 10,
                  description: '完成学习任务',
                  created_at: new Date().toISOString(),
                  balance_after: 100,
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    } as any);

    const PointsHistory = (await import('./PointsHistory')).PointsHistory;

    render(<PointsHistory {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('完成学习')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should render points change with correct sign', async () => {
    const { supabase } = await import('../config/supabase');

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'tx-1',
                  transaction_type: 'study_complete',
                  points_change: 10,
                  description: 'Test',
                  created_at: new Date().toISOString(),
                  balance_after: 100,
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    } as any);

    const PointsHistory = (await import('./PointsHistory')).PointsHistory;

    render(<PointsHistory {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('+10')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
