/**
 * Component tests for FriendPopupContent
 *
 * Tests FriendPopupContent renders friend info
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

describe('FriendPopupContent', () => {
  const defaultProps = {
    friend: {
      friend_id: 'friend-1',
      name: 'Test Friend',
      avatar_url: '',
      status: {
        emoji: '📚',
        text: '学习中',
      },
    },
    onMessage: vi.fn(),
    onViewProfile: vi.fn(),
    onInvite: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render friend name', async () => {
    const FriendPopupContent = (await import('./FriendPopupContent')).default;

    render(<FriendPopupContent {...defaultProps} />);

    expect(screen.getByText('Test Friend')).toBeInTheDocument();
  });

  it('should render status emoji and text', async () => {
    const FriendPopupContent = (await import('./FriendPopupContent')).default;

    render(<FriendPopupContent {...defaultProps} />);

    expect(screen.getByText('📚')).toBeInTheDocument();
    expect(screen.getByText('学习中')).toBeInTheDocument();
  });

  it('should render study status', async () => {
    const FriendPopupContent = (await import('./FriendPopupContent')).default;

    render(<FriendPopupContent {...defaultProps} />);

    expect(screen.getByText('正在学习中')).toBeInTheDocument();
  });

  it('should render message button when onMessage is provided', async () => {
    const FriendPopupContent = (await import('./FriendPopupContent')).default;

    render(<FriendPopupContent {...defaultProps} />);

    const messageButton = screen.getByRole('button', { name: /发消息/ });
    expect(messageButton).toBeInTheDocument();
  });

  it('should call onMessage when message button is clicked', async () => {
    const FriendPopupContent = (await import('./FriendPopupContent')).default;

    render(<FriendPopupContent {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /发消息/ }));

    expect(defaultProps.onMessage).toHaveBeenCalled();
  });

  it('should render profile button when onViewProfile is provided', async () => {
    const FriendPopupContent = (await import('./FriendPopupContent')).default;

    render(<FriendPopupContent {...defaultProps} />);

    const profileButton = screen.getByRole('button', { name: /主页/ });
    expect(profileButton).toBeInTheDocument();
  });

  it('should call onViewProfile when profile button is clicked', async () => {
    const FriendPopupContent = (await import('./FriendPopupContent')).default;

    render(<FriendPopupContent {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /主页/ }));

    expect(defaultProps.onViewProfile).toHaveBeenCalled();
  });

  it('should render invite button', async () => {
    const FriendPopupContent = (await import('./FriendPopupContent')).default;

    render(<FriendPopupContent {...defaultProps} />);

    const inviteButton = screen.getByRole('button', { name: /邀请自习/ });
    expect(inviteButton).toBeInTheDocument();
  });

  it('should call onInvite when invite button is clicked', async () => {
    const FriendPopupContent = (await import('./FriendPopupContent')).default;

    render(<FriendPopupContent {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /邀请自习/ }));

    expect(defaultProps.onInvite).toHaveBeenCalled();
  });

  it('should render with avatar when avatar_url is provided', async () => {
    const FriendPopupContent = (await import('./FriendPopupContent')).default;

    render(
      <FriendPopupContent
        {...defaultProps}
        friend={{ ...defaultProps.friend, avatar_url: 'https://example.com/avatar.png' }}
      />
    );

    expect(screen.getByText('Test Friend')).toBeInTheDocument();
  });

  it('should render without optional callbacks', async () => {
    const FriendPopupContent = (await import('./FriendPopupContent')).default;

    render(
      <FriendPopupContent
        friend={defaultProps.friend}
        onMessage={undefined}
        onViewProfile={undefined}
        onInvite={undefined}
      />
    );

    expect(screen.getByText('Test Friend')).toBeInTheDocument();
  });

  it('should show last online time', async () => {
    const FriendPopupContent = (await import('./FriendPopupContent')).default;

    render(<FriendPopupContent {...defaultProps} />);

    expect(screen.getByText(/5分钟前/)).toBeInTheDocument();
  });
});
