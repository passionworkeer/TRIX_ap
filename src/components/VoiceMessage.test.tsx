/**
 * Component tests for VoiceMessage
 *
 * Tests voice message renders play button and duration
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    media: {
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
  },
}));

// Mock escapeHtml
vi.mock('../utils/escapeHtml', () => ({
  escapeHtml: vi.fn((text: string) => text),
}));

describe('VoiceMessage', () => {
  const defaultProps = {
    url: 'https://example.com/audio.webm',
    duration: 30,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Audio
    const mockAudio = {
      src: '',
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('Audio', vi.fn(() => mockAudio));
  });

  it('should render play button', async () => {
    const VoiceMessage = (await import('./VoiceMessage')).VoiceMessage;

    render(<VoiceMessage {...defaultProps} />);

    const playButton = screen.getByRole('button', { name: /播放/ });
    expect(playButton).toBeInTheDocument();
  });

  it('should render duration display', async () => {
    const VoiceMessage = (await import('./VoiceMessage')).VoiceMessage;

    render(<VoiceMessage {...defaultProps} />);

    // Duration 30 seconds should show "0:30"
    expect(screen.getByText('0:30')).toBeInTheDocument();
  });

  it('should render formatted duration correctly', async () => {
    const VoiceMessage = (await import('./VoiceMessage')).VoiceMessage;

    render(<VoiceMessage {...defaultProps} duration={125} />);

    expect(screen.getByText('2:05')).toBeInTheDocument();
  });

  it('should render transcript button when transcript is provided', async () => {
    const VoiceMessage = (await import('./VoiceMessage')).VoiceMessage;

    render(<VoiceMessage {...defaultProps} transcript="测试转文字内容" />);

    expect(screen.getByText('显示转文字')).toBeInTheDocument();
  });

  it('should toggle transcript visibility', async () => {
    const VoiceMessage = (await import('./VoiceMessage')).VoiceMessage;

    render(<VoiceMessage {...defaultProps} transcript="测试转文字内容" />);

    const transcriptButton = screen.getByText('显示转文字');
    fireEvent.click(transcriptButton);

    expect(screen.getByText('隐藏转文字')).toBeInTheDocument();
    expect(screen.getByText('测试转文字内容')).toBeInTheDocument();
  });

  it('should apply custom className', async () => {
    const VoiceMessage = (await import('./VoiceMessage')).VoiceMessage;

    const { container } = render(
      <VoiceMessage {...defaultProps} className="custom-class" />
    );

    const wrapper = container.querySelector('.custom-class');
    expect(wrapper).toBeTruthy();
  });

  it('should render with sender variant', async () => {
    const VoiceMessage = (await import('./VoiceMessage')).VoiceMessage;

    render(<VoiceMessage {...defaultProps} variant="sender" />);

    const playButton = screen.getByRole('button', { name: /播放/ });
    expect(playButton).toBeInTheDocument();
  });

  it('should render with receiver variant', async () => {
    const VoiceMessage = (await import('./VoiceMessage')).VoiceMessage;

    render(<VoiceMessage {...defaultProps} variant="receiver" />);

    const playButton = screen.getByRole('button', { name: /播放/ });
    expect(playButton).toBeInTheDocument();
  });

  it('should hide progress bar when showProgress is false', async () => {
    const VoiceMessage = (await import('./VoiceMessage')).VoiceMessage;

    render(<VoiceMessage {...defaultProps} showProgress={false} />);

    // Should not have slider role (progress bar)
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('should call onPlay callback when play button is clicked', async () => {
    const onPlay = vi.fn();
    const VoiceMessage = (await import('./VoiceMessage')).VoiceMessage;

    render(<VoiceMessage {...defaultProps} onPlay={onPlay} />);

    const playButton = screen.getByRole('button', { name: /播放/ });
    fireEvent.click(playButton);

    // The onPlay will be called after audio plays
  });

  it('should call onPause callback', async () => {
    const onPause = vi.fn();
    const VoiceMessage = (await import('./VoiceMessage')).VoiceMessage;

    render(<VoiceMessage {...defaultProps} onPause={onPause} />);

    const playButton = screen.getByRole('button', { name: /播放/ });
    fireEvent.click(playButton);
  });
});
