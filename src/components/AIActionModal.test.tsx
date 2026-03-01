/**
 * Component tests for AIActionModal
 *
 * Tests the AI action selection modal with animation effects
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  FileText: () => <span data-testid="icon">FileText</span>,
  Table: () => <span data-testid="icon">Table</span>,
  Presentation: () => <span data-testid="icon">Presentation</span>,
  Image: () => <span data-testid="icon">Image</span>,
  Video: () => <span data-testid="icon">Video</span>,
  Sparkles: () => <span data-testid="icon">Sparkles</span>,
  Check: () => <span data-testid="icon">Check</span>,
}));

describe('AIActionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal when isOpen is true', async () => {
    const AIActionModal = (await import('../components/AIActionModal')).default;

    render(
      <AIActionModal
        isOpen={true}
        onClose={() => {}}
        onSelect={() => {}}
      />
    );

    expect(screen.getByText('选择 AI 功能')).toBeDefined();
  });

  it('should not render when isOpen is false', async () => {
    const AIActionModal = (await import('../components/AIActionModal')).default;

    const { container } = render(
      <AIActionModal
        isOpen={false}
        onClose={() => {}}
        onSelect={() => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should call onSelect when action is clicked', async () => {
    const AIActionModal = (await import('../components/AIActionModal')).default;
    const onSelect = vi.fn();

    render(
      <AIActionModal
        isOpen={true}
        onClose={() => {}}
        onSelect={onSelect}
      />
    );

    // Click on AI chat action
    const chatButton = screen.getByText('AI 聊天');
    fireEvent.click(chatButton);

    // Should call onSelect after delay
    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith('chat');
    }, { timeout: 500 });
  });

  it('should call onClose when cancel button is clicked', async () => {
    const AIActionModal = (await import('../components/AIActionModal')).default;
    const onClose = vi.fn();

    render(
      <AIActionModal
        isOpen={true}
        onClose={onClose}
        onSelect={() => {}}
      />
    );

    // Click cancel button
    const cancelButton = screen.getByText('取消');
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('should render all AI actions', async () => {
    const AIActionModal = (await import('../components/AIActionModal')).default;

    render(
      <AIActionModal
        isOpen={true}
        onClose={() => {}}
        onSelect={() => {}}
      />
    );

    // All action buttons should be visible
    expect(screen.getByText('AI 聊天')).toBeDefined();
    expect(screen.getByText('AI 文档')).toBeDefined();
    expect(screen.getByText('AI 幻灯片')).toBeDefined();
    expect(screen.getByText('AI 表格')).toBeDefined();
    expect(screen.getByText('AI 图片')).toBeDefined();
    expect(screen.getByText('AI 视频')).toBeDefined();
  });

  it('should call onClose when backdrop is clicked', async () => {
    const AIActionModal = (await import('../components/AIActionModal')).default;
    const onClose = vi.fn();

    const { container } = render(
      <AIActionModal
        isOpen={true}
        onClose={onClose}
        onSelect={() => {}}
      />
    );

    // Click on backdrop (first div with fixed class)
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalled();
  });
});
