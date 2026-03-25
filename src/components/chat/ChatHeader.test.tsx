/**
 * Component tests for ChatHeader
 *
 * Tests the chat header renders friend name, back button, and action menu
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

// Mock Avatar component
vi.mock('../Avatar', () => ({
  default: ({ name, size }: { name: string; size?: string }) => (
    <div data-testid="mock-avatar" data-name={name} data-size={size}>Avatar:{name}</div>
  ),
}));

describe('ChatHeader', () => {
  const defaultProps = {
    name: 'Test User',
    avatar: '',
    isBot: false,
    isBotConversation: false,
    isPaired: false,
    botOnline: false,
    status: 'DISCONNECTED',
    botState: 'IDLE',
    friendLastActive: null as string | null | undefined,
    onNavigateBack: vi.fn(),
    onToggleMenu: vi.fn(),
    showMenu: false,
    onUnpair: vi.fn(),
    onRequestConfirm: vi.fn().mockResolvedValue(false),
    onShowSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with friend name', async () => {
    const ChatHeader = (await import('./ChatHeader')).default;

    render(<ChatHeader {...defaultProps} />);

    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('should render back button', async () => {
    const ChatHeader = (await import('./ChatHeader')).default;

    render(<ChatHeader {...defaultProps} />);

    const backButton = screen.getByRole('button', { name: '返回' });
    expect(backButton).toBeInTheDocument();
  });

  it('should call onNavigateBack when back button is clicked', async () => {
    const ChatHeader = (await import('./ChatHeader')).default;

    render(<ChatHeader {...defaultProps} />);

    const backButton = screen.getByRole('button', { name: '返回' });
    fireEvent.click(backButton);

    expect(defaultProps.onNavigateBack).toHaveBeenCalled();
  });

  it('should render menu button', async () => {
    const ChatHeader = (await import('./ChatHeader')).default;

    render(<ChatHeader {...defaultProps} />);

    const menuButton = screen.getByRole('button', { name: '更多选项' });
    expect(menuButton).toBeInTheDocument();
  });

  it('should call onToggleMenu when menu button is clicked', async () => {
    const ChatHeader = (await import('./ChatHeader')).default;

    render(<ChatHeader {...defaultProps} />);

    const menuButton = screen.getByRole('button', { name: '更多选项' });
    fireEvent.click(menuButton);

    expect(defaultProps.onToggleMenu).toHaveBeenCalled();
  });

  it('should show unpair option when isBotConversation and isPaired', async () => {
    const ChatHeader = (await import('./ChatHeader')).default;

    render(
      <ChatHeader
        {...defaultProps}
        isBotConversation={true}
        isPaired={true}
        showMenu={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('解除配对')).toBeInTheDocument();
    });
  });

  it('should show bot avatar when isBot is true', async () => {
    const ChatHeader = (await import('./ChatHeader')).default;

    render(<ChatHeader {...defaultProps} isBot={true} />);

    // Should show bot avatar (img element)
    const img = document.querySelector('img[alt="Bot"]');
    expect(img).toBeTruthy();
  });

  it('should show status indicator with correct color for online user', async () => {
    const ChatHeader = (await import('./ChatHeader')).default;

    render(
      <ChatHeader {...defaultProps} friendLastActive={new Date().toISOString()} />
    );

    // Status indicator should exist
    const statusDot = document.querySelector('[class*="bg-green"]');
    expect(statusDot).toBeTruthy();
  });
});
