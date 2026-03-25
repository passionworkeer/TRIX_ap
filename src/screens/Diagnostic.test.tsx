/**
 * Unit tests for Diagnostic screen
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Diagnostic from './Diagnostic';

// ============================================
// Mock TrixNativeChannelClient
// ============================================
vi.mock('../services/TrixNativeChannelClient', () => ({
  default: {
    getSession: vi.fn().mockReturnValue(null),
  },
}));

// ============================================
// Mock config
// ============================================
vi.mock('../config/clawbotEndpoints', () => ({
  getClawbotEndpoints: vi.fn().mockReturnValue({
    nativeServerUrl: 'http://localhost:8788',
    nativePublicUrl: null,
  }),
}));

// ============================================
// Mock error handler
// ============================================
vi.mock('../utils/errorHandler', () => ({
  getErrorMessage: vi.fn((_e: unknown, fallback: string) => fallback),
}));

// ============================================
// Test wrapper
// ============================================
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);

describe('Diagnostic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ============================================
  // Basic Rendering Tests
  // ============================================
  describe('基础渲染测试', () => {
    it('renders without crashing', async () => {
      render(<TestWrapper><Diagnostic /></TestWrapper>);

      await waitFor(() => {
        expect(screen.getByText(/Trix Native Diagnostic/i)).toBeInTheDocument();
      });
    });

    it('renders page title', async () => {
      render(<TestWrapper><Diagnostic /></TestWrapper>);

      await waitFor(() => {
        expect(screen.getByText('Trix Native Diagnostic')).toBeInTheDocument();
      });
    });

    it('renders service URL section', async () => {
      render(<TestWrapper><Diagnostic /></TestWrapper>);

      await waitFor(() => {
        expect(screen.getByText(/Trix Service URL/i)).toBeInTheDocument();
      });
    });

    it('renders pairing session section', async () => {
      render(<TestWrapper><Diagnostic /></TestWrapper>);

      await waitFor(() => {
        expect(screen.getByText(/Local Pairing Session/i)).toBeInTheDocument();
      });
    });

    it('displays service URL value', async () => {
      render(<TestWrapper><Diagnostic /></TestWrapper>);

      await waitFor(() => {
        expect(screen.getByText(/localhost:8788/i)).toBeInTheDocument();
      });
    });

    it('shows NOT PAIRED when no session exists', async () => {
      render(<TestWrapper><Diagnostic /></TestWrapper>);

      await waitFor(() => {
        expect(screen.getByText(/NOT PAIRED/i)).toBeInTheDocument();
      });
    });

    it('shows READY with conversationId when session exists', async () => {
      const { default: trixNativeChannelClient } = await import('../services/TrixNativeChannelClient');
      vi.mocked(trixNativeChannelClient.getSession).mockReturnValueOnce({
        conversationId: 'test-conv-id',
        clientId: 'test-client',
        clientToken: 'test-token',
        websocketUrl: 'ws://localhost:8788/ws',
      });

      render(<TestWrapper><Diagnostic /></TestWrapper>);

      await waitFor(() => {
        expect(screen.getByText(/READY/i)).toBeInTheDocument();
        expect(screen.getByText(/test-conv-id/i)).toBeInTheDocument();
      });
    });

    it('renders Run Service Test button', async () => {
      render(<TestWrapper><Diagnostic /></TestWrapper>);

      await waitFor(() => {
        expect(screen.getByText(/Run Service Test/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Service Test Button Tests
  // ============================================
  describe('Service Test Button Tests', () => {
    it('is enabled initially', async () => {
      render(<TestWrapper><Diagnostic /></TestWrapper>);

      await waitFor(() => {
        const btn = screen.getByText(/Run Service Test/i);
        expect(btn).not.toBeDisabled();
      });
    });

    it('shows Testing Service... text while testing', async () => {
      render(<TestWrapper><Diagnostic /></TestWrapper>);

      await waitFor(() => {
        const btn = screen.getByText(/Run Service Test/i);
        fireEvent.click(btn);
      });

      await waitFor(() => {
        expect(screen.getByText(/Testing Service/i)).toBeInTheDocument();
      });
    });

    it('displays result panel after test', async () => {
      // Mock global.fetch
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ ok: true, agentOnline: true }),
      });
      global.fetch = fetchMock;

      render(<TestWrapper><Diagnostic /></TestWrapper>);

      await waitFor(() => {
        const btn = screen.getByText(/Run Service Test/i);
        fireEvent.click(btn);
      });

      await waitFor(() => {
        // Result panel should appear
        const resultPanels = document.querySelectorAll('.rounded-2xl');
        expect(resultPanels.length).toBeGreaterThan(0);
      });

      global.fetch = vi.fn() as typeof fetch;
    });

    it('handles missing service URL', async () => {
      const { getClawbotEndpoints } = await import('../config/clawbotEndpoints');
      vi.mocked(getClawbotEndpoints).mockReturnValueOnce({
        nativeServerUrl: null,
        nativePublicUrl: null,
      });

      render(<TestWrapper><Diagnostic /></TestWrapper>);

      await waitFor(() => {
        expect(screen.getByText('NONE')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Health URL Display Tests
  // ============================================
  describe('Health URL Display Tests', () => {
    it('constructs health URL from service URL', async () => {
      render(<TestWrapper><Diagnostic /></TestWrapper>);

      await waitFor(() => {
        // Health URL should include /health suffix
        const monospacedDiv = document.querySelector('.font-mono');
        expect(monospacedDiv?.textContent).toContain('localhost:8788');
      });
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================
  describe('Error Handling Tests', () => {
    it('handles fetch failure gracefully', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = fetchMock;

      render(<TestWrapper><Diagnostic /></TestWrapper>);

      await waitFor(() => {
        const btn = screen.getByText(/Run Service Test/i);
        fireEvent.click(btn);
      });

      await waitFor(() => {
        // Error result should be shown
        const resultPanels = document.querySelectorAll('.rounded-2xl');
        expect(resultPanels.length).toBeGreaterThan(0);
      });

      global.fetch = vi.fn() as typeof fetch;
    });

    it('handles HTTP error responses', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({ ok: false }),
      });
      global.fetch = fetchMock;

      render(<TestWrapper><Diagnostic /></TestWrapper>);

      await waitFor(() => {
        const btn = screen.getByText(/Run Service Test/i);
        fireEvent.click(btn);
      });

      await waitFor(() => {
        // HTTP error result should be shown
        const resultPanels = document.querySelectorAll('.rounded-2xl');
        expect(resultPanels.length).toBeGreaterThan(0);
      });

      global.fetch = vi.fn() as typeof fetch;
    });
  });
});
