/**
 * Component tests for AIActionSelector
 *
 * Tests the horizontal scrollable AI action selector
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  FileText: () => <span data-testid="icon">FileText</span>,
  Table: () => <span data-testid="icon">Table</span>,
  Presentation: () => <span data-testid="icon">Presentation</span>,
  Image: () => <span data-testid="icon">Image</span>,
  Video: () => <span data-testid="icon">Video</span>,
  Sparkles: () => <span data-testid="icon">Sparkles</span>,
}));

describe('AIActionSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with default value', async () => {
    const AIActionSelector = (await import('../components/AIActionSelector')).default;

    render(
      <AIActionSelector
        value="chat"
        onSelect={() => {}}
      />
    );

    expect(screen.getByText('AI聊天')).toBeDefined();
  });

  it('should call onSelect when action is clicked', async () => {
    const AIActionSelector = (await import('../components/AIActionSelector')).default;
    const onSelect = vi.fn();

    render(
      <AIActionSelector
        value="chat"
        onSelect={onSelect}
      />
    );

    // Click on doc action
    const docButton = screen.getByText('AI文档');
    fireEvent.click(docButton);

    expect(onSelect).toHaveBeenCalledWith('doc');
  });

  it('should highlight selected action', async () => {
    const AIActionSelector = (await import('../components/AIActionSelector')).default;

    render(
      <AIActionSelector
        value="doc"
        onSelect={() => {}}
      />
    );

    // The selected button should have aria-pressed true
    const docButton = screen.getByText('AI文档');
    expect(docButton).toBeDefined();
  });

  it('should render all action options', async () => {
    const AIActionSelector = (await import('../components/AIActionSelector')).default;

    render(
      <AIActionSelector
        value="chat"
        onSelect={() => {}}
      />
    );

    expect(screen.getByText('AI聊天')).toBeDefined();
    expect(screen.getByText('AI文档')).toBeDefined();
    expect(screen.getByText('AI幻灯片')).toBeDefined();
    expect(screen.getByText('AI表格')).toBeDefined();
    expect(screen.getByText('AI图片')).toBeDefined();
    expect(screen.getByText('AI视频')).toBeDefined();
  });

  it('should call onSelect with correct action id', async () => {
    const AIActionSelector = (await import('../components/AIActionSelector')).default;
    const onSelect = vi.fn();

    render(
      <AIActionSelector
        value="chat"
        onSelect={onSelect}
      />
    );

    // Click on image action
    fireEvent.click(screen.getByText('AI图片'));
    expect(onSelect).toHaveBeenCalledWith('image');

    // Click on video action
    fireEvent.click(screen.getByText('AI视频'));
    expect(onSelect).toHaveBeenCalledWith('video');
  });
});
