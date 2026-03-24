/**
 * Unit tests for QRCodePairing screen
 *
 * Minimal tests to verify the QRCodePairing screen renders without crashing.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import React from 'react';

// Track mock state for context
let mockChannelState = {
  isConnected: false,
  isPaired: false,
  isReady: false,
  botState: 'idle',
  messages: [] as any[],
  sendMessage: vi.fn(),
  pairWithCode: vi.fn().mockResolvedValue(true),
  pairWithQR: vi.fn().mockResolvedValue(true),
  unpair: vi.fn(),
  uploadAttachment: vi.fn(),
  status: 'disconnected' as const,
  botOnline: false,
  lastError: null as string | null,
};

// Mock ClawbotChannelContext
vi.mock('../contexts/ClawbotChannelContext', () => ({
  useClawbotChannel: () => mockChannelState,
}));

// Mock QRScanner component
vi.mock('../components/QRScanner', () => ({
  default: ({
    isOpen,
    onClose,
    onScanSuccess,
    onScanError,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onScanSuccess: (text: string) => void;
    onScanError: (message: string) => void;
  }) =>
    isOpen ? (
      <div data-testid="qr-scanner">
        <button data-testid="scanner-close" onClick={onClose}>Close Scanner</button>
        <button
          data-testid="scanner-success"
          onClick={() => onScanSuccess('http://localhost/pair?code=ABC123&secret=xyz')}
        >
          Simulate Scan Success
        </button>
        <button
          data-testid="scanner-error"
          onClick={() => onScanError('Camera not found')}
        >
          Simulate Scan Error
        </button>
      </div>
    ) : null,
}));

// Mock hooks
vi.mock('../hooks/useNotification', () => ({
  useNotification: () => ({
    showWarning: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  QrCode: () => <svg data-testid="qr-icon" />,
  Keyboard: () => <svg data-testid="keyboard-icon" />,
  Check: () => <svg data-testid="check-icon" />,
  X: () => <svg data-testid="x-icon" />,
  ChevronLeft: () => <svg data-testid="chevron-left-icon" />,
  ArrowLeft: () => <svg data-testid="arrow-left-icon" />,
  Scan: () => <svg data-testid="scan-icon" />,
  Smartphone: () => <svg data-testid="smartphone-icon" />,
  AlertCircle: () => <svg data-testid="alert-icon" />,
  CheckCircle: () => <svg data-testid="check-circle-icon" />,
  Loader: () => <svg data-testid="loader-icon" />,
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter>
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  </MemoryRouter>
);

describe('QRCodePairing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock channel state
    mockChannelState = {
      isConnected: false,
      isPaired: false,
      isReady: false,
      botState: 'idle',
      messages: [],
      sendMessage: vi.fn(),
      pairWithCode: vi.fn().mockResolvedValue(true),
      pairWithQR: vi.fn().mockResolvedValue(true),
      unpair: vi.fn(),
      uploadAttachment: vi.fn(),
      status: 'disconnected' as const,
      botOnline: false,
      lastError: null,
    };
  });

  it('renders without crashing', async () => {
    const { default: QRCodePairing } = await import('./QRCodePairing');
    render(
      <TestWrapper>
        <QRCodePairing />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/TRIX Native 配对/i)).toBeInTheDocument();
    });
  });

  it('renders page title', async () => {
    const { default: QRCodePairing } = await import('./QRCodePairing');
    render(
      <TestWrapper>
        <QRCodePairing />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/TRIX Native 配对/i)).toBeInTheDocument();
    });
  });

  it('renders manual code input section', async () => {
    const { default: QRCodePairing } = await import('./QRCodePairing');
    render(
      <TestWrapper>
        <QRCodePairing />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/手动输入配对码/i)).toBeInTheDocument();
    });
  });

  it('renders code input placeholder', async () => {
    const { default: QRCodePairing } = await import('./QRCodePairing');
    render(
      <TestWrapper>
        <QRCodePairing />
      </TestWrapper>
    );

    await waitFor(() => {
      const input = screen.getByPlaceholderText('AB12CD') as HTMLInputElement;
      expect(input).toBeInTheDocument();
    });
  });

  it('accepts input in manual code field', async () => {
    const { default: QRCodePairing } = await import('./QRCodePairing');
    render(
      <TestWrapper>
        <QRCodePairing />
      </TestWrapper>
    );

    await waitFor(() => {
      const input = screen.getByPlaceholderText('AB12CD') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'TEST12' } });
      expect(input.value).toBe('TEST12');
    });
  });

  it('calls pairWithCode when valid code submitted', async () => {
    const { default: QRCodePairing } = await import('./QRCodePairing');
    render(
      <TestWrapper>
        <QRCodePairing />
      </TestWrapper>
    );

    await waitFor(() => {
      const input = screen.getByPlaceholderText('AB12CD') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'ABCDEF' } });
    });

    // The submit button is the one with Keyboard icon (no text label)
    const submitButtons = document.querySelectorAll('button');
    const submitBtn = Array.from(submitButtons).find(b => b.querySelector('[data-testid="keyboard-icon"]'));
    expect(submitBtn).toBeTruthy();
    fireEvent.click(submitBtn!);

    await waitFor(() => {
      expect(mockChannelState.pairWithCode).toHaveBeenCalledWith('ABCDEF');
    });
  });

  it('shows paired status when isPaired is true', async () => {
    mockChannelState.isPaired = true;
    const { default: QRCodePairing } = await import('./QRCodePairing');
    render(
      <TestWrapper>
        <QRCodePairing />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/已配对/i)).toBeInTheDocument();
    });
  });
});
