/**
 * Unit tests for Pairing screen
 *
 * Minimal tests to verify the Pairing screen renders without crashing.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
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

// Mock Html5Qrcode
const mockScannerInstance = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
};
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: vi.fn(() => mockScannerInstance),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    pairing: { debug: vi.fn(), error: vi.fn(), info: vi.fn() },
  },
}));

// Mock constants
vi.mock('../constants', () => ({
  IMAGES: { WIZARD_BOY_LOGIN: '/wizard.png' },
}));

// Mock GlassPanel
vi.mock('../components/GlassPanel', () => ({
  default: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <div data-testid="glass-panel" onClick={onClick}>{children}</div>
  ),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock('../utils/pairingToast', () => ({
  PAIRING_REQUIRED_TOAST_ID: 'pairing-required',
  PAIRING_REQUIRED_TOAST_MESSAGE: 'Pairing required',
  PAIRING_REQUIRED_TOAST_OPTIONS: {},
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
  Scan: () => <svg data-testid="scan-icon" />,
  Keyboard: () => <svg data-testid="keyboard-icon" />,
  ChevronLeft: () => <svg data-testid="chevron-left-icon" />,
  ArrowLeft: () => <svg data-testid="arrow-left-icon" />,
  Wifi: () => <svg data-testid="wifi-icon" />,
  WifiOff: () => <svg data-testid="wifi-off-icon" />,
  Check: () => <svg data-testid="check-icon" />,
  X: () => <svg data-testid="x-icon" />,
  AlertCircle: () => <svg data-testid="alert-icon" />,
  Loader2: () => <svg data-testid="loader-icon" />,
  Camera: () => <svg data-testid="camera-icon" />,
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter>
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  </MemoryRouter>
);

describe('Pairing', () => {
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
    vi.useFakeTimers();
  });

  it('renders without crashing', async () => {
    const { default: Pairing } = await import('./Pairing');
    render(
      <TestWrapper>
        <Pairing />
      </TestWrapper>
    );

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(screen.getByText(/配对 TRIX Native/i)).toBeInTheDocument();
    });
  });

  it('renders pairing title', async () => {
    const { default: Pairing } = await import('./Pairing');
    render(
      <TestWrapper>
        <Pairing />
      </TestWrapper>
    );

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(screen.getByText(/配对 TRIX Native/i)).toBeInTheDocument();
    });
  });

  it('renders QR reader container', async () => {
    const { default: Pairing } = await import('./Pairing');
    render(
      <TestWrapper>
        <Pairing />
      </TestWrapper>
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(document.getElementById('qr-reader')).toBeInTheDocument();
    });
  });

  it('switches to manual input mode when button clicked', async () => {
    const { default: Pairing } = await import('./Pairing');
    render(
      <TestWrapper>
        <Pairing />
      </TestWrapper>
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(screen.getByText(/手动输入配对码/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/手动输入配对码/i));

    await waitFor(() => {
      expect(screen.getByText(/请输入 TRIX Native 上的 6 位配对码/i)).toBeInTheDocument();
    });
  });

  it('renders code input field in manual mode', async () => {
    const { default: Pairing } = await import('./Pairing');
    render(
      <TestWrapper>
        <Pairing />
      </TestWrapper>
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    fireEvent.click(screen.getByText(/手动输入配对码/i));

    await waitFor(() => {
      const input = screen.getByPlaceholderText('AB12CD') as HTMLInputElement;
      expect(input).toBeInTheDocument();
    });
  });

  it('accepts alphanumeric input in code field', async () => {
    const { default: Pairing } = await import('./Pairing');
    render(
      <TestWrapper>
        <Pairing />
      </TestWrapper>
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    fireEvent.click(screen.getByText(/手动输入配对码/i));

    await waitFor(() => {
      const input = screen.getByPlaceholderText('AB12CD') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'AB12CD' } });
      expect(input.value).toBe('AB12CD');
    });
  });

  it('calls pairWithCode when valid code submitted', async () => {
    const { default: Pairing } = await import('./Pairing');
    render(
      <TestWrapper>
        <Pairing />
      </TestWrapper>
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    fireEvent.click(screen.getByText(/手动输入配对码/i));

    await waitFor(() => {
      const input = screen.getByPlaceholderText('AB12CD') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'ABCDEF' } });
    });

    fireEvent.click(screen.getByText(/验证配对/i));

    await waitFor(() => {
      expect(mockChannelState.pairWithCode).toHaveBeenCalledWith('ABCDEF');
    });
  });

  it('shows paired status when isPaired is true', async () => {
    mockChannelState.isPaired = true;
    const { default: Pairing } = await import('./Pairing');
    render(
      <TestWrapper>
        <Pairing />
      </TestWrapper>
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(screen.getByText(/解除绑定/i)).toBeInTheDocument();
    });
  });

  it('calls unpair when unpair button clicked', async () => {
    mockChannelState.isPaired = true;
    const { default: Pairing } = await import('./Pairing');
    render(
      <TestWrapper>
        <Pairing />
      </TestWrapper>
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    await waitFor(() => {
      fireEvent.click(screen.getByText(/解除绑定/i));
    });

    await waitFor(() => {
      expect(mockChannelState.unpair).toHaveBeenCalled();
    });
  });
});
