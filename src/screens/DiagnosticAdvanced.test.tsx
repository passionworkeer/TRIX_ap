/**
 * Unit tests for DiagnosticAdvanced screen
 *
 * Minimal tests to verify the DiagnosticAdvanced screen renders without crashing.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock TrixNativeChannelClient
vi.mock('../services/TrixNativeChannelClient', () => ({
  default: {
    getSession: vi.fn().mockReturnValue({
      conversationId: 'test-conv',
      clientId: 'test-client',
      clientToken: 'test-token',
      websocketUrl: 'ws://localhost:8788/ws',
    }),
  },
}));

// Mock config
vi.mock('../config/clawbotEndpoints', () => ({
  getClawbotEndpoints: vi.fn().mockReturnValue({
    nativeServerUrl: 'http://localhost:8788',
    nativePublicUrl: null,
  }),
}));

// Mock error handler
vi.mock('../utils/errorHandler', () => ({
  getErrorMessage: vi.fn((_e: unknown, fallback: string) => fallback),
}));

// Mock WebSocket
const mockWsInstance = {
  close: vi.fn(),
  send: vi.fn(),
  onopen: null as ((() => void) | null),
  onmessage: null as ((event: { data: string }) => void | null),
  onerror: null as ((() => void) | null),
  onclose: null as ((() => void) | null),
};

vi.stubGlobal('WebSocket', vi.fn(() => mockWsInstance));

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
  Activity: () => <svg data-testid="activity-icon" />,
  Trash2: () => <svg data-testid="trash-icon" />,
  Play: () => <svg data-testid="play-icon" />,
  Check: () => <svg data-testid="check-icon" />,
  X: () => <svg data-testid="x-icon" />,
  ChevronLeft: () => <svg data-testid="chevron-left-icon" />,
  Loader2: () => <svg data-testid="loader-icon" />,
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);

describe('DiagnosticAdvanced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock WebSocket instance
    mockWsInstance.close = vi.fn();
    mockWsInstance.send = vi.fn();
    mockWsInstance.onopen = null;
    mockWsInstance.onmessage = null;
    mockWsInstance.onerror = null;
    mockWsInstance.onclose = null;
    // Reset fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true, agentOnline: true }),
    }) as unknown as typeof fetch;
  });

  it('renders without crashing', async () => {
    const { default: DiagnosticAdvanced } = await import('./DiagnosticAdvanced');
    render(<TestWrapper><DiagnosticAdvanced /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText(/高级 Native 通道诊断/i)).toBeInTheDocument();
    });
  });

  it('renders page title', async () => {
    const { default: DiagnosticAdvanced } = await import('./DiagnosticAdvanced');
    render(<TestWrapper><DiagnosticAdvanced /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText(/高级 Native 通道诊断/i)).toBeInTheDocument();
    });
  });

  it('renders Test Trix Service button', async () => {
    const { default: DiagnosticAdvanced } = await import('./DiagnosticAdvanced');
    render(<TestWrapper><DiagnosticAdvanced /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText(/测试 Trix Service/i)).toBeInTheDocument();
    });
  });

  it('renders Clear Log button', async () => {
    const { default: DiagnosticAdvanced } = await import('./DiagnosticAdvanced');
    render(<TestWrapper><DiagnosticAdvanced /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText(/清空日志/i)).toBeInTheDocument();
    });
  });

  it('shows initial log prompt when no logs', async () => {
    const { default: DiagnosticAdvanced } = await import('./DiagnosticAdvanced');
    render(<TestWrapper><DiagnosticAdvanced /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText(/点击按钮开始测试/i)).toBeInTheDocument();
    });
  });

  it('starts test when Test Trix Service button clicked', async () => {
    const { default: DiagnosticAdvanced } = await import('./DiagnosticAdvanced');
    render(<TestWrapper><DiagnosticAdvanced /></TestWrapper>);

    await waitFor(() => {
      fireEvent.click(screen.getByText(/测试 Trix Service/i));
    });

    await waitFor(() => {
      expect(screen.getByText(/测试中/i)).toBeInTheDocument();
    });
  });
});
