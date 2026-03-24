/**
 * Component tests for ConfirmModal
 *
 * Tests ConfirmModal behavior by mocking the underlying Modal component.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Modal as a simple div that renders children — bypasses createPortal/framer-motion entirely
vi.mock('./Modal', () => ({
  __esModule: true,
  default: ({ isOpen, onClose, children }: {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
  }) => isOpen ? <div data-testid="modal-portal">{children}</div> : null,
}));

import ConfirmModal from './ConfirmModal';

const defaultProps = {
  isOpen: true,
  title: '确认操作',
  message: '确定要继续吗？',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog when open', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByTestId('modal-portal')).toBeInTheDocument();
    expect(screen.getByText('确认操作')).toBeInTheDocument();
  });

  it('renders confirm and cancel buttons', () => {
    render(<ConfirmModal {...defaultProps} />);
    // Match by exact text (no regex to avoid accidental double-match)
    expect(screen.getByText('确认')).toBeInTheDocument();
    expect(screen.getByText('取消')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    render(<ConfirmModal {...defaultProps} />);
    fireEvent.click(screen.getByText('确认'));
    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<ConfirmModal {...defaultProps} />);
    fireEvent.click(screen.getByText('取消'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('shows processing state when isProcessing is true', () => {
    render(<ConfirmModal {...defaultProps} isProcessing={true} />);
    expect(screen.getByText('处理中...')).toBeInTheDocument();
  });

  it('disables buttons when processing', () => {
    render(<ConfirmModal {...defaultProps} isProcessing={true} />);
    // When isProcessing=true, confirm shows "处理中...", cancel shows "取消"
    expect(screen.getByText('处理中...')).toBeDisabled();
    expect(screen.getByText('取消')).toBeDisabled();
  });
});
