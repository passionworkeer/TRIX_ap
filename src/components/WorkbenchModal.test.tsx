import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('WorkbenchModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders cards when open', async () => {
    const { default: WorkbenchModal } = await import('../components/WorkbenchModal');

    render(<WorkbenchModal isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: '工作台' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '快拍' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '位置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '日程' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '待办' })).toBeInTheDocument();
  });

  it('forwards card clicks and closes for managed panels', async () => {
    const { default: WorkbenchModal } = await import('../components/WorkbenchModal');
    const onClose = vi.fn();
    const onCardClick = vi.fn();

    render(<WorkbenchModal isOpen onClose={onClose} onCardClick={onCardClick} />);

    fireEvent.click(screen.getByRole('button', { name: '日程' }));

    expect(onCardClick).toHaveBeenCalledWith('schedule');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
