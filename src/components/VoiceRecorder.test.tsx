/**
 * Component tests for VoiceRecorder
 *
 * Tests voice recorder UI (start/stop button)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: React.ComponentProps<'button'>) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Mic: () => <svg data-testid="mic-icon" />,
  X: () => <svg data-testid="x-icon" />,
  Lock: () => <svg data-testid="lock-icon" />,
}));

// Mock useVoiceRecorder hook
vi.mock('../hooks/useVoiceRecorder', () => ({
  useVoiceRecorder: vi.fn(() => ({
    isRecording: false,
    duration: 0,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    cancelRecording: vi.fn(),
    error: null,
  })),
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
    media: {
      debug: vi.fn(),
      error: vi.fn(),
    },
  },
}));

describe('VoiceRecorder', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when isOpen is false', async () => {
    const VoiceRecorder = (await import('../components/VoiceRecorder')).default;

    const { container } = render(<VoiceRecorder {...defaultProps} isOpen={false} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render recording modal when isOpen is true', async () => {
    const VoiceRecorder = (await import('../components/VoiceRecorder')).default;

    render(<VoiceRecorder {...defaultProps} isOpen={true} />);

    expect(screen.getByText('语音录制')).toBeInTheDocument();
  });

  it('should render close button', async () => {
    const VoiceRecorder = (await import('../components/VoiceRecorder')).default;

    render(<VoiceRecorder {...defaultProps} />);

    const closeButton = screen.getByRole('button', { name: '关闭录音面板' });
    expect(closeButton).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', async () => {
    const VoiceRecorder = (await import('../components/VoiceRecorder')).default;

    render(<VoiceRecorder {...defaultProps} />);

    const closeButton = screen.getByRole('button', { name: '关闭录音面板' });
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should render instruction text', async () => {
    const VoiceRecorder = (await import('../components/VoiceRecorder')).default;

    render(<VoiceRecorder {...defaultProps} />);

    expect(screen.getByText('按住说话，上滑取消')).toBeInTheDocument();
  });

  it('should render microphone icon', async () => {
    const VoiceRecorder = (await import('../components/VoiceRecorder')).default;

    render(<VoiceRecorder {...defaultProps} />);

    // Should show mic icon
    const micIcons = document.querySelectorAll('svg');
    expect(micIcons.length).toBeGreaterThan(0);
  });

  it('should render duration display', async () => {
    const VoiceRecorder = (await import('../components/VoiceRecorder')).default;

    render(<VoiceRecorder {...defaultProps} />);

    // Duration should show 0:00
    expect(screen.getByText('0:00')).toBeInTheDocument();
  });

  it('should render cancel instruction when isRecording is true', async () => {
    const { useVoiceRecorder } = await import('../hooks/useVoiceRecorder');
    vi.mocked(useVoiceRecorder).mockReturnValue({
      isRecording: true,
      duration: 5,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      cancelRecording: vi.fn(),
      error: null,
    });

    const VoiceRecorder = (await import('../components/VoiceRecorder')).default;

    render(<VoiceRecorder {...defaultProps} />);

    // When recording, should show "松开手指完成录音" or "松开手指取消发送"
    expect(screen.getByText(/松开手指/)).toBeInTheDocument();
  });

  it('should show error state when error is present', async () => {
    const { useVoiceRecorder } = await import('../hooks/useVoiceRecorder');
    vi.mocked(useVoiceRecorder).mockReturnValue({
      isRecording: false,
      duration: 0,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      cancelRecording: vi.fn(),
      error: '麦克风权限被拒绝',
    });

    const VoiceRecorder = (await import('../components/VoiceRecorder')).default;

    render(<VoiceRecorder {...defaultProps} />);

    expect(screen.getByText('麦克风权限被拒绝')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
  });
});
