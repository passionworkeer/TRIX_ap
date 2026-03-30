/**
 * Component tests for QRScanner
 *
 * Tests QR scanner component (camera, scan button)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { createFramerMotionMock } from '../test/framerMotionMock';

vi.mock('framer-motion', () => createFramerMotionMock());

// Mock browser QR scanner
const mockScannerInstance = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
};
vi.mock('../utils/browserQrScanner', () => ({
  BrowserQrScanner: vi.fn(() => mockScannerInstance),
  toBrowserQrScannerError: vi.fn((error: unknown, fallback: string) => (
    error instanceof Error ? error : new Error(fallback)
  )),
}));

// Mock i18next
const mockT = (key: string) => key;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
  }),
}));

// Mock iosMotion
vi.mock('../utils/iosMotion', () => ({
  iosBackdropMotion: { initial: {}, animate: {}, exit: {} },
  iosIconButtonMotion: {},
  iosQuickSpring: {},
  iosSheetMotion: { initial: {}, animate: {}, exit: {} },
}));

// Mock errorHandler
vi.mock('../utils/errorHandler', () => ({
  getErrorMessage: vi.fn((err) => String(err)),
}));

describe('QRScanner', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onScanSuccess: vi.fn(),
    onScanError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getUserMedia
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
      writable: true,
    });
  });

  async function renderOpenScanner() {
    const QRScanner = (await import('./QRScanner')).default;

    render(<QRScanner {...defaultProps} />);

    await waitFor(() => {
      expect(mockScannerInstance.start).toHaveBeenCalledTimes(1);
    });
  }

  it('should render nothing when isOpen is false', async () => {
    const QRScanner = (await import('./QRScanner')).default;

    const { container } = render(<QRScanner {...defaultProps} isOpen={false} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render QR scanner modal when isOpen is true', async () => {
    await renderOpenScanner();

    // Should show QR scanner title
    expect(screen.getByText('qrScanner.title')).toBeInTheDocument();
  });

  it('should render close button', async () => {
    await renderOpenScanner();

    // Should have a close button
    const closeButton = document.querySelector('button');
    expect(closeButton).toBeTruthy();
  });

  it('should render qr-reader div for camera', async () => {
    await renderOpenScanner();

    const qrReader = document.getElementById('qr-reader');
    expect(qrReader).toBeTruthy();
  });

  it('should call onClose when backdrop is clicked', async () => {
    await renderOpenScanner();

    const backdrop = document.querySelector('.fixed.inset-0.z-50');
    expect(backdrop).toBeTruthy();

    fireEvent.click(backdrop as Element);

    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('should render camera icon', async () => {
    await renderOpenScanner();

    const cameraIcons = document.querySelectorAll('svg');
    expect(cameraIcons.length).toBeGreaterThan(0);
  });

  it('should render scan instructions', async () => {
    await renderOpenScanner();

    expect(screen.getByText('qrScanner.alignQRCode')).toBeInTheDocument();
  });
});
