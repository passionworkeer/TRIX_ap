/**
 * Component tests for Modal
 *
 * Tests Modal renders with children
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

vi.mock('../../utils/iosMotion', () => ({
  iosBackdropMotion: { initial: {}, animate: {}, exit: {} },
  iosSheetMotion: { initial: {}, animate: {}, exit: {} },
}));

import Modal from './Modal';

describe('Modal', () => {
  beforeEach(() => {
    portalContainers.forEach(c => {
      try { document.body.removeChild(c); } catch {}
    });
    portalContainers.length = 0;
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

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} labelledBy="t" describedBy="d">
        <p>Content</p>
      </Modal>
    );
    const closeBtn = screen.getByRole('button', { name: /关闭确认弹窗/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
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
