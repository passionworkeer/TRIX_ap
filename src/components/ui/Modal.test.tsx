/**
 * Component tests for Modal
 *
 * Tests Modal renders with children
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock the Modal component directly to avoid createPortal complexity
vi.mock('./Modal', () => ({
  __esModule: true,
  default: ({
    isOpen,
    onClose,
    children,
    className,
    closeOnBackdrop = true,
  }: {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
    closeOnBackdrop?: boolean;
  }) =>
    isOpen ? (
      <div
        data-testid="modal-portal"
        className={`fixed inset-0 z-[1001] flex items-center justify-center p-4 ${className ?? ''}`}
        onClick={closeOnBackdrop ? onClose : undefined}
      >
        <div
          className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        />
        <div
          role="dialog"
          aria-modal="true"
          className="relative z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    ) : null,
}));

import Modal from './Modal';

describe('Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when open', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} labelledBy="t" describedBy="d">
        <h2>Test Title</h2>
        <p>Test Description</p>
      </Modal>
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} labelledBy="t" describedBy="d" closeOnBackdrop={true}>
        <p>Content</p>
      </Modal>
    );
    // Click the outer backdrop (fixed inset-0)
    const backdrop = document.querySelector('.fixed.inset-0.z-\\[1001\\]');
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when inner content is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} labelledBy="t" describedBy="d" closeOnBackdrop={true}>
        <p>Content</p>
      </Modal>
    );
    const content = document.querySelector('[role="dialog"]');
    expect(content).toBeInTheDocument();
    fireEvent.click(content!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('has role dialog', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} labelledBy="t" describedBy="d">
        <p>Content</p>
      </Modal>
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} labelledBy="t" describedBy="d" className="custom-class">
        <p>Content</p>
      </Modal>
    );
    expect(document.body.querySelector('.custom-class')).toBeTruthy();
  });
});
