/**
 * Component tests for AboutDialog
 *
 * Tests about dialog renders version info
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { createFramerMotionMock } from '../test/framerMotionMock';

vi.mock('framer-motion', () => createFramerMotionMock());

// Mock iosMotion
vi.mock('../utils/iosMotion', () => ({
  iosBackdropMotion: { initial: {}, animate: {}, exit: {} },
  iosIconButtonMotion: {},
  iosQuickSpring: {},
  iosSheetMotion: { initial: {}, animate: {}, exit: {} },
}));

describe('AboutDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when isOpen is false', async () => {
    const AboutDialog = (await import('./AboutDialog')).AboutDialog;

    const { container } = render(<AboutDialog {...defaultProps} isOpen={false} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render dialog when isOpen is true', async () => {
    const AboutDialog = (await import('./AboutDialog')).AboutDialog;

    render(<AboutDialog {...defaultProps} />);

    expect(screen.getByText('TRIX')).toBeInTheDocument();
  });

  it('should render version info', async () => {
    const AboutDialog = (await import('./AboutDialog')).AboutDialog;

    render(<AboutDialog {...defaultProps} />);

    // Version v1.2.0
    expect(screen.getByText(/v1\.2\.0/)).toBeInTheDocument();
    expect(screen.getByText(/版本 1\.2\.0/)).toBeInTheDocument();
  });

  it('should render developer info', async () => {
    const AboutDialog = (await import('./AboutDialog')).AboutDialog;

    render(<AboutDialog {...defaultProps} />);

    expect(screen.getByText('TRIX Studio')).toBeInTheDocument();
  });

  it('should render close button', async () => {
    const AboutDialog = (await import('./AboutDialog')).AboutDialog;

    render(<AboutDialog {...defaultProps} />);

    const closeButton = screen.getByRole('button', { name: '关闭' });
    expect(closeButton).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', async () => {
    const AboutDialog = (await import('./AboutDialog')).AboutDialog;

    render(<AboutDialog {...defaultProps} />);

    const closeButton = screen.getByRole('button', { name: '关闭' });
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should render features section', async () => {
    const AboutDialog = (await import('./AboutDialog')).AboutDialog;

    render(<AboutDialog {...defaultProps} />);

    expect(screen.getByText('原生聊天')).toBeInTheDocument();
    expect(screen.getByText('智能回复')).toBeInTheDocument();
  });

  it('should render copyright info', async () => {
    const AboutDialog = (await import('./AboutDialog')).AboutDialog;

    render(<AboutDialog {...defaultProps} />);

    expect(screen.getByText(/© \d{4} TRIX Studio/)).toBeInTheDocument();
  });

  it('should render development team section', async () => {
    const AboutDialog = (await import('./AboutDialog')).AboutDialog;

    render(<AboutDialog {...defaultProps} />);

    expect(screen.getByText('开发团队')).toBeInTheDocument();
  });

  it('should render release date info', async () => {
    const AboutDialog = (await import('./AboutDialog')).AboutDialog;

    render(<AboutDialog {...defaultProps} />);

    expect(screen.getByText('2026年2月')).toBeInTheDocument();
  });
});
