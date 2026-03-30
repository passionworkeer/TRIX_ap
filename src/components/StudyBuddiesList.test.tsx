/**
 * Component tests for StudyBuddiesList
 *
 * Tests study buddies list renders items
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { createFramerMotionMock } from '../test/framerMotionMock';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock('framer-motion', () => createFramerMotionMock());

vi.mock('./Avatar', () => ({
  default: ({ name }: { name: string }) => <div data-testid="mock-avatar">{name}</div>,
}));

vi.mock('../utils/iosMotion', () => ({
  iosBackdropMotion: { initial: {}, animate: {}, exit: {} },
  iosIconButtonMotion: {},
  iosPressableMotion: {},
  iosQuickSpring: {},
  iosSheetMotion: { initial: {}, animate: {}, exit: {} },
}));

vi.mock('../utils/logger', () => ({
  logger: { error: vi.fn() },
}));

vi.mock('../hooks/useNotification', () => ({
  useNotification: () => ({ showError: vi.fn() }),
}));

vi.mock('../types', () => ({
  AppRoutes: { STUDY_TIMER: '/study-timer' },
}));

vi.mock('../constants', () => ({
  IMAGES: { WIZARD_BOY_LOGIN: 'wizard.png' },
}));

describe('StudyBuddiesList', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when isOpen is false', async () => {
    const StudyBuddiesList = (await import('./StudyBuddiesList')).default;
    const { container } = render(<StudyBuddiesList {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render panel when isOpen is true', async () => {
    const StudyBuddiesList = (await import('./StudyBuddiesList')).default;
    render(<StudyBuddiesList {...defaultProps} />);
    expect(screen.getByText('正在自习的好友')).toBeInTheDocument();
  });

  it('should render close button', async () => {
    const StudyBuddiesList = (await import('./StudyBuddiesList')).default;
    render(<StudyBuddiesList {...defaultProps} />);
    const closeButton = document.querySelector('button');
    expect(closeButton).toBeTruthy();
  });
});
