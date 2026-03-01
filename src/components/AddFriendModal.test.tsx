/**
 * Component tests for AddFriendModal
 *
 * Tests the modal for sending friend requests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock GlassPanel
vi.mock('../components/GlassPanel', () => ({
  default: ({ children, className }: any) => (
    <div data-testid="glass-panel" className={className}>
      {children}
    </div>
  ),
}));

// Mock utils
vi.mock('../utils/errorHandler', () => ({
  getErrorMessage: vi.fn((error, defaultMsg) => defaultMsg),
}));

describe('AddFriendModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal when isOpen is true', async () => {
    const AddFriendModal = (await import('../components/AddFriendModal')).default;

    render(
      <AddFriendModal
        isOpen={true}
        onClose={() => {}}
        onSend={async () => {}}
      />
    );

    expect(screen.getByText('添加好友')).toBeDefined();
    expect(screen.getByPlaceholderText('输入对方账号（邮箱或用户名）')).toBeDefined();
  });

  it('should not render when isOpen is false', async () => {
    const AddFriendModal = (await import('../components/AddFriendModal')).default;

    const { container } = render(
      <AddFriendModal
        isOpen={false}
        onClose={() => {}}
        onSend={async () => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should call onClose when close button is clicked', async () => {
    const AddFriendModal = (await import('../components/AddFriendModal')).default;
    const onClose = vi.fn();

    render(
      <AddFriendModal
        isOpen={true}
        onClose={onClose}
        onSend={async () => {}}
      />
    );

    // Click close button (aria-label)
    const closeButton = screen.getByRole('button', { name: '关闭对话框' });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('should show error when sending empty account', async () => {
    const AddFriendModal = (await import('../components/AddFriendModal')).default;

    render(
      <AddFriendModal
        isOpen={true}
        onClose={() => {}}
        onSend={async () => {}}
      />
    );

    // Click send button without entering account
    const sendButton = screen.getByRole('button', { name: '发送请求' });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText('请输入对方账号（邮箱或用户名）')).toBeDefined();
    });
  });

  it('should call onSend with account when form is submitted', async () => {
    const AddFriendModal = (await import('../components/AddFriendModal')).default;
    const onSend = vi.fn().mockResolvedValue(undefined);

    render(
      <AddFriendModal
        isOpen={true}
        onClose={() => {}}
        onSend={onSend}
      />
    );

    // Enter account
    const input = screen.getByPlaceholderText('输入对方账号（邮箱或用户名）');
    fireEvent.change(input, { target: { value: 'test@example.com' } });

    // Click send button
    const sendButton = screen.getByRole('button', { name: '发送请求' });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith('test@example.com');
    });
  });

  it('should show loading state when sending', async () => {
    const AddFriendModal = (await import('../components/AddFriendModal')).default;

    // Create a promise that doesn't resolve immediately
    let resolveOnSend: () => void;
    const onSend = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolveOnSend = resolve;
      });
    });

    render(
      <AddFriendModal
        isOpen={true}
        onClose={() => {}}
        onSend={onSend}
      />
    );

    // Enter account and click send
    const input = screen.getByPlaceholderText('输入对方账号（邮箱或用户名）');
    fireEvent.change(input, { target: { value: 'test@example.com' } });

    const sendButton = screen.getByRole('button', { name: '发送请求' });
    fireEvent.click(sendButton);

    // Button should show loading state
    await waitFor(() => {
      expect(screen.getByText('发送中...')).toBeDefined();
    });

    // Resolve the promise
    resolveOnSend!();
  });

  it('should show success message after successful send', async () => {
    const AddFriendModal = (await import('../components/AddFriendModal')).default;

    render(
      <AddFriendModal
        isOpen={true}
        onClose={() => {}}
        onSend={async () => {}}
      />
    );

    // Enter account and submit
    const input = screen.getByPlaceholderText('输入对方账号（邮箱或用户名）');
    fireEvent.change(input, { target: { value: 'test@example.com' } });

    const sendButton = screen.getByRole('button', { name: '发送请求' });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('好友请求已发送！')).toBeDefined();
    });
  });

  it('should clear input after successful send', async () => {
    const AddFriendModal = (await import('../components/AddFriendModal')).default;

    render(
      <AddFriendModal
        isOpen={true}
        onClose={() => {}}
        onSend={async () => {}}
      />
    );

    // Enter account and submit
    const input = screen.getByPlaceholderText('输入对方账号（邮箱或用户名）');
    fireEvent.change(input, { target: { value: 'test@example.com' } });

    const sendButton = screen.getByRole('button', { name: '发送请求' });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('');
    });
  });
});
