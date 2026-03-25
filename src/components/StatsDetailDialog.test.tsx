/**
 * Component tests for StatsDetailDialog
 *
 * Tests stats detail dialog renders statistics
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('StatsDetailDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    stats: {
      daysActive: 30,
      totalPoints: 1250,
      interactions: 87,
      level: 5,
      nextLevelPoints: 2000,
      pointsToNextLevel: 750,
    },
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when isOpen is false', async () => {
    const StatsDetailDialog = (await import('./StatsDetailDialog')).StatsDetailDialog;

    const { container } = render(<StatsDetailDialog {...defaultProps} isOpen={false} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render dialog when isOpen is true', async () => {
    const StatsDetailDialog = (await import('./StatsDetailDialog')).StatsDetailDialog;

    render(<StatsDetailDialog {...defaultProps} />);

    expect(screen.getByText('数据统计')).toBeInTheDocument();
  });

  it('should render days active stat', async () => {
    const StatsDetailDialog = (await import('./StatsDetailDialog')).StatsDetailDialog;

    render(<StatsDetailDialog {...defaultProps} />);

    expect(screen.getByText('陪伴天数')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('should render total points stat', async () => {
    const StatsDetailDialog = (await import('./StatsDetailDialog')).StatsDetailDialog;

    render(<StatsDetailDialog {...defaultProps} />);

    expect(screen.getByText('总积分')).toBeInTheDocument();
    expect(screen.getByText('1250')).toBeInTheDocument();
  });

  it('should render level info', async () => {
    const StatsDetailDialog = (await import('./StatsDetailDialog')).StatsDetailDialog;

    render(<StatsDetailDialog {...defaultProps} />);

    expect(screen.getByText('Lv.5')).toBeInTheDocument();
  });

  it('should render interactions stat', async () => {
    const StatsDetailDialog = (await import('./StatsDetailDialog')).StatsDetailDialog;

    render(<StatsDetailDialog {...defaultProps} />);

    expect(screen.getByText('总互动次数')).toBeInTheDocument();
    expect(screen.getByText('87')).toBeInTheDocument();
  });

  it('should render progress bar', async () => {
    const StatsDetailDialog = (await import('./StatsDetailDialog')).StatsDetailDialog;

    render(<StatsDetailDialog {...defaultProps} />);

    // Progress bar div exists
    const progressBars = document.querySelectorAll('.rounded-full');
    expect(progressBars.length).toBeGreaterThan(0);
  });

  it('should render close button', async () => {
    const StatsDetailDialog = (await import('./StatsDetailDialog')).StatsDetailDialog;

    render(<StatsDetailDialog {...defaultProps} />);

    const closeButton = screen.getByRole('button', { name: '关闭' });
    expect(closeButton).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', async () => {
    const StatsDetailDialog = (await import('./StatsDetailDialog')).StatsDetailDialog;

    render(<StatsDetailDialog {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should show loading spinner when loading is true', async () => {
    const StatsDetailDialog = (await import('./StatsDetailDialog')).StatsDetailDialog;

    render(<StatsDetailDialog {...defaultProps} loading={true} />);

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('should render next level goal', async () => {
    const StatsDetailDialog = (await import('./StatsDetailDialog')).StatsDetailDialog;

    render(<StatsDetailDialog {...defaultProps} />);

    expect(screen.getByText('下个目标')).toBeInTheDocument();
    expect(screen.getByText('再获得 750 积分即可升级到 Lv.6')).toBeInTheDocument();
  });

  it('should render motivational message', async () => {
    const StatsDetailDialog = (await import('./StatsDetailDialog')).StatsDetailDialog;

    render(<StatsDetailDialog {...defaultProps} />);

    expect(screen.getByText(/你已经和 TRIX 相伴 30 天啦/)).toBeInTheDocument();
  });
});
