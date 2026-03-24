/**
 * Component tests for ConfirmModal
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const portalContainers: HTMLElement[] = [];
const origAppend = document.body.appendChild.bind(document.body);
const origRemove = document.body.removeChild.bind(document.body);

// Mock framer-motion to render children directly (avoids portal complexity in tests)
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => (
      <div data-testid="modal-portal" {...props}>{children}</div>
    ),
  },
}));

document.body.appendChild = vi.fn((el: Node) => {
  const result = origAppend(el);
  if (el instanceof HTMLElement && el.dataset.testid === 'modal-portal') {
    portalContainers.push(el);
  }
  return result;
}) as typeof document.body.appendChild;
document.body.removeChild = vi.fn((el: Node) => {
  const idx = portalContainers.indexOf(el as HTMLElement);
  if (idx !== -1) portalContainers.splice(idx, 1);
  return origRemove(el);
}) as typeof document.body.removeChild;

vi.mock('lucide-react', () => ({
  AlertTriangle: () => <svg data-testid="alert-icon"><title>Alert</title></svg>,
  Info: () => <svg data-testid="info-icon"><title>Info</title></svg>,
  X: ({ onClick }: { onClick?: () => void }) =>
    <button type="button" onClick={onClick} data-testid="close-icon">X</button>,
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
    portalContainers.forEach(c => { try { document.body.removeChild(c); } catch {} });
    portalContainers.length = 0;
    vi.clearAllMocks();
  });

  it('renders dialog when open', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText('确认操作')).toBeInTheDocument();
  });

  it('renders confirm and cancel buttons', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /确认/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /取消/ })).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    render(<ConfirmModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /确认/ }));
    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<ConfirmModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /取消/ }));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('shows processing state when isProcessing is true', () => {
    render(<ConfirmModal {...defaultProps} isProcessing={true} />);
    expect(screen.getByText('处理中...')).toBeInTheDocument();
  });

  it('disables buttons when processing', () => {
    render(<ConfirmModal {...defaultProps} isProcessing={true} />);
    expect(screen.getByRole('button', { name: /确认/ })).toBeDisabled();
  });
});
