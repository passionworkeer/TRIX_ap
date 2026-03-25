/**
 * Component tests for SnapshotModal
 *
 * Tests snapshot modal renders, has close button and camera functionality
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('SnapshotModal', () => {
  const defaultProps = {
    isOpen: true,
    onImageSelect: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when isOpen is false', async () => {
    const SnapshotModal = (await import('./SnapshotModal')).default;

    const { container } = render(<SnapshotModal {...defaultProps} isOpen={false} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render snapshot modal when isOpen is true', async () => {
    const SnapshotModal = (await import('./SnapshotModal')).default;

    render(<SnapshotModal {...defaultProps} />);

    expect(screen.getByText('快拍功能')).toBeInTheDocument();
  });

  it('should render camera button', async () => {
    const SnapshotModal = (await import('./SnapshotModal')).default;

    render(<SnapshotModal {...defaultProps} />);

    const cameraButtons = document.querySelectorAll('button');
    expect(cameraButtons.length).toBeGreaterThan(0);
  });

  it('should render gallery option text', async () => {
    const SnapshotModal = (await import('./SnapshotModal')).default;

    render(<SnapshotModal {...defaultProps} />);

    expect(screen.getByText('从相册选择')).toBeInTheDocument();
  });

  it('should render subtitle text', async () => {
    const SnapshotModal = (await import('./SnapshotModal')).default;

    render(<SnapshotModal {...defaultProps} />);

    expect(screen.getByText('拍照或选图发送')).toBeInTheDocument();
  });

  it('should render thumbnail previews', async () => {
    const SnapshotModal = (await import('./SnapshotModal')).default;

    render(<SnapshotModal {...defaultProps} />);

    // Should show the 3 thumbnail previews
    const thumbnails = document.querySelectorAll('[class*="rounded-full"]');
    expect(thumbnails.length).toBeGreaterThan(0);
  });

  it('should call onClose when backdrop is clicked', async () => {
    const SnapshotModal = (await import('./SnapshotModal')).default;

    render(<SnapshotModal {...defaultProps} />);

    // Find the backdrop div (first fixed div)
    const fixedDiv = document.querySelector('div[class*="fixed"]');
    if (fixedDiv) {
      fireEvent.click(fixedDiv);
    }

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should have file inputs for camera and gallery', async () => {
    const SnapshotModal = (await import('./SnapshotModal')).default;

    render(<SnapshotModal {...defaultProps} />);

    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBe(2); // One for gallery, one for camera
  });

  it('should render decoration dots', async () => {
    const SnapshotModal = (await import('./SnapshotModal')).default;

    render(<SnapshotModal {...defaultProps} />);

    // Should have 3 decoration dots
    const dots = document.querySelectorAll('[class*="w-1 h-1 rounded-full"]');
    expect(dots.length).toBe(3);
  });
});
