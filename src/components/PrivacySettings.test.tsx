/**
 * Component tests for PrivacySettings
 *
 * Tests privacy settings renders toggle options
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

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock iosMotion
vi.mock('../utils/iosMotion', () => ({
  iosBackdropMotion: { initial: {}, animate: {}, exit: {} },
  iosIconButtonMotion: {},
  iosQuickSpring: {},
  iosSheetMotion: { initial: {}, animate: {}, exit: {} },
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

describe('PrivacySettings', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    userId: 'test-user-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when isOpen is false', async () => {
    const PrivacySettings = (await import('./PrivacySettings')).PrivacySettings;

    const { container } = render(<PrivacySettings {...defaultProps} isOpen={false} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render panel when isOpen is true', async () => {
    const PrivacySettings = (await import('./PrivacySettings')).PrivacySettings;

    render(<PrivacySettings {...defaultProps} />);

    expect(screen.getByText('隐私与安全')).toBeInTheDocument();
  });

  it('should render all toggle options', async () => {
    const PrivacySettings = (await import('./PrivacySettings')).PrivacySettings;

    render(<PrivacySettings {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('允许陌生人搜索')).toBeInTheDocument();
      expect(screen.getByText('显示在线状态')).toBeInTheDocument();
      expect(screen.getByText('允许学习邀请')).toBeInTheDocument();
    });
  });

  it('should render save and cancel buttons', async () => {
    const PrivacySettings = (await import('./PrivacySettings')).PrivacySettings;

    render(<PrivacySettings {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
    });
  });

  it('should call onClose when cancel is clicked', async () => {
    const PrivacySettings = (await import('./PrivacySettings')).PrivacySettings;

    render(<PrivacySettings {...defaultProps} />);

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: '取消' }));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('should show loading state initially', async () => {
    const PrivacySettings = (await import('./PrivacySettings')).PrivacySettings;

    render(<PrivacySettings {...defaultProps} />);

    // Should show spinner initially
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('should render description text for each setting', async () => {
    const PrivacySettings = (await import('./PrivacySettings')).PrivacySettings;

    render(<PrivacySettings {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('其他人可通过邮箱或用户名找到你')).toBeInTheDocument();
      expect(screen.getByText('好友可以看到你是否在线')).toBeInTheDocument();
      expect(screen.getByText('好友可以邀请你一起学习')).toBeInTheDocument();
    });
  });

  it('should render toggle buttons for each setting', async () => {
    const PrivacySettings = (await import('./PrivacySettings')).PrivacySettings;

    render(<PrivacySettings {...defaultProps} />);

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      // Should have toggle buttons + save/cancel
      expect(buttons.length).toBeGreaterThanOrEqual(5);
    });
  });
});
