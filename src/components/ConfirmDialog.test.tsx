/**
 * Component tests for ConfirmDialog
 *
 * Tests confirm dialog with title, message, accept/reject buttons
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock ConfirmModal to avoid nested button issues
vi.mock('./ui/ConfirmModal', () => ({
  __esModule: true,
  default: ({ isOpen, title, message, confirmText, cancelText, variant, onConfirm, onCancel, isProcessing }: any) =>
    isOpen ? (
      <div data-testid="confirm-modal">
        <h3>{title}</h3>
        <p>{message}</p>
        <div role="button" onClick={onCancel} data-disabled={isProcessing}>{cancelText || '取消'}</div>
        <div role="button" onClick={onConfirm} data-disabled={isProcessing}>{isProcessing ? '处理中...' : (confirmText || '确认')}</div>
      </div>
    ) : null,
  ConfirmModalVariant: { danger: 'danger', warning: 'warning', info: 'info' },
}));

// Mock useConfirmModal hook
vi.mock('../hooks/useConfirmModal', () => ({
  useConfirmModal: () => ({
    requestConfirm: vi.fn(),
    ConfirmModalRenderer: () => <div data-testid="confirm-renderer" />,
  }),
}));

import { ConfirmDialog } from './ConfirmDialog';

const renderConfirmDialog = (props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) => {
  const defaultProps = {
    isOpen: true,
    title: '确认删除',
    message: '确定要删除吗？',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };
  return render(<ConfirmDialog {...defaultProps} {...props} />);
};

describe('ConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and message when open', () => {
    renderConfirmDialog();
    expect(screen.getByText('确认删除')).toBeInTheDocument();
    expect(screen.getByText('确定要删除吗？')).toBeInTheDocument();
  });

  it('renders confirm and cancel text', () => {
    renderConfirmDialog();
    expect(screen.getByText('确认')).toBeInTheDocument();
    expect(screen.getByText('取消')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    renderConfirmDialog({ onCancel });
    fireEvent.click(screen.getByText('取消'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    renderConfirmDialog({ onConfirm });
    fireEvent.click(screen.getByText('确认'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('renders with different variant', () => {
    renderConfirmDialog({ variant: 'danger' });
    expect(screen.getByText('确认删除')).toBeInTheDocument();
  });

  it('shows processing state when isProcessing is true', () => {
    renderConfirmDialog({ isProcessing: true });
    expect(screen.getByText('处理中...')).toBeInTheDocument();
  });

  it('disables buttons when isProcessing is true', () => {
    renderConfirmDialog({ isProcessing: true });
    expect(screen.getByText('取消')).toHaveAttribute('data-disabled', 'true');
  });

  it('renders with custom confirm text', () => {
    renderConfirmDialog({ confirmText: '删除' });
    expect(screen.getByText('删除')).toBeInTheDocument();
  });
});
