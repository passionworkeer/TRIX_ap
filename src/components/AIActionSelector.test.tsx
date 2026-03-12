import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('AIActionSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the current action as selected', async () => {
    const { default: AIActionSelector } = await import('../components/AIActionSelector');

    render(<AIActionSelector value="chat" onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'AI聊天' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'AI文档' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onSelect when a new action is chosen', async () => {
    const { default: AIActionSelector } = await import('../components/AIActionSelector');
    const onSelect = vi.fn();

    render(<AIActionSelector value="chat" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'AI视频' }));

    expect(onSelect).toHaveBeenCalledWith('video');
  });
});
