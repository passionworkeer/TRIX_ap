/**
 * Component tests for UserSwitcher
 *
 * Tests the user identity switching component
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Users: () => <span data-testid="icon">Users</span>,
}));

describe('UserSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should render with default user', async () => {
    const UserSwitcher = (await import('../components/UserSwitcher')).default;

    render(
      <UserSwitcher />
    );

    expect(screen.getByText('我')).toBeDefined();
    expect(screen.getByText('测试好友')).toBeDefined();
  });

  it('should show ACTIVE badge for current user', async () => {
    const UserSwitcher = (await import('../components/UserSwitcher')).default;

    render(
      <UserSwitcher />
    );

    // First user should be active
    const activeBadge = screen.getByText('ACTIVE');
    expect(activeBadge).toBeDefined();
  });

  it('should call onUserChange when switching users', async () => {
    const UserSwitcher = (await import('../components/UserSwitcher')).default;
    const onUserChange = vi.fn();

    render(
      <UserSwitcher onUserChange={onUserChange} />
    );

    // Click on test friend button
    const friendButton = screen.getByText('测试好友');
    fireEvent.click(friendButton);

    // Should call onUserChange with user details
    await waitFor(() => {
      expect(onUserChange).toHaveBeenCalled();
    });
  });

  it('should store user ID in localStorage when switching', async () => {
    const UserSwitcher = (await import('../components/UserSwitcher')).default;

    render(
      <UserSwitcher />
    );

    // Click on test friend button
    const friendButton = screen.getByText('测试好友');
    fireEvent.click(friendButton);

    // Should save to localStorage
    await waitFor(() => {
      expect(localStorage.getItem('current_user_id')).toBeDefined();
    });
  });

  it('should reload page when switching users', async () => {
    const UserSwitcher = (await import('../components/UserSwitcher')).default;

    // Spy on location.reload
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});

    render(
      <UserSwitcher />
    );

    // Click on test friend button
    const friendButton = screen.getByText('测试好友');
    fireEvent.click(friendButton);

    await waitFor(() => {
      expect(reloadSpy).toHaveBeenCalled();
    });

    reloadSpy.mockRestore();
  });

  it('should not call onUserChange when clicking current user', async () => {
    const UserSwitcher = (await import('../components/UserSwitcher')).default;
    const onUserChange = vi.fn();

    render(
      <UserSwitcher onUserChange={onUserChange} />
    );

    // Click on current user button (disabled)
    const currentUserButton = screen.getByText('我');
    fireEvent.click(currentUserButton);

    // Should not trigger change
    expect(onUserChange).not.toHaveBeenCalled();
  });

  it('should load saved user from localStorage on mount', async () => {
    // Set localStorage to user2
    localStorage.setItem('current_user_id', '00000000-0000-0000-0000-000000000002');

    const UserSwitcher = (await import('../components/UserSwitcher')).default;

    render(
      <UserSwitcher />
    );

    // Should show ACTIVE badge on second user
    await waitFor(() => {
      const activeBadges = screen.getAllByText('ACTIVE');
      expect(activeBadges.length).toBe(1);
    });
  });
});
