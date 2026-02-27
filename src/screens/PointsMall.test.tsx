/**
 * Unit tests for PointsMall screen
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';

// Mock mallService
vi.mock('../services/mallService', () => ({
  getMallItems: vi.fn(),
  getUserPointsBalance: vi.fn(),
  purchaseItem: vi.fn(),
}));

// Mock useTheme
vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks
import { getMallItems, getUserPointsBalance, purchaseItem } from '../services/mallService';
import PointsMall from './PointsMall';

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  </BrowserRouter>
);

describe('PointsMall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMallItems).mockResolvedValue([]);
    vi.mocked(getUserPointsBalance).mockResolvedValue({
      userId: 'test-user',
      balance: 1000,
      totalEarned: 2000,
      totalSpent: 1000,
      updatedAt: '2024-01-01',
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ============================================
  // Basic Rendering Tests
  // ============================================

  describe('rendering', () => {
    it('should render without crashing', async () => {
      render(
        <TestWrapper>
          <PointsMall />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('积分商城')).toBeInTheDocument();
      });
    });

    it('should display all category buttons', async () => {
      render(
        <TestWrapper>
          <PointsMall />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('全部')).toBeInTheDocument();
        expect(screen.getByText('服装')).toBeInTheDocument();
        expect(screen.getByText('配饰')).toBeInTheDocument();
        expect(screen.getByText('道具')).toBeInTheDocument();
      });
    });

    it('should display points section', async () => {
      render(
        <TestWrapper>
          <PointsMall />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('我的积分')).toBeInTheDocument();
      });
    });

    it('should display empty state when no items', async () => {
      render(
        <TestWrapper>
          <PointsMall />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('暂无商品')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Service Integration Tests
  // ============================================

  describe('service calls', () => {
    it('should call getMallItems on mount', async () => {
      vi.mocked(getMallItems).mockResolvedValue([]);

      render(
        <TestWrapper>
          <PointsMall />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getMallItems).toHaveBeenCalled();
      });
    });

    it('should call getUserPointsBalance on mount', async () => {
      vi.mocked(getUserPointsBalance).mockResolvedValue({
        userId: 'test-user',
        balance: 500,
        totalEarned: 1000,
        totalSpent: 500,
        updatedAt: '2024-01-01',
      });

      render(
        <TestWrapper>
          <PointsMall />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getUserPointsBalance).toHaveBeenCalled();
      });
    });

    it('should load items with category filter', async () => {
      vi.mocked(getMallItems).mockResolvedValue([]);

      render(
        <TestWrapper>
          <PointsMall />
        </TestWrapper>
      );

      await waitFor(() => {
        // Initial call without filter
        expect(getMallItems).toHaveBeenCalledWith(undefined);
      });
    });
  });

  // ============================================
  // Data Handling Tests
  // ============================================

  describe('data handling', () => {
    it('should handle empty items array', async () => {
      vi.mocked(getMallItems).mockResolvedValue([]);

      render(
        <TestWrapper>
          <PointsMall />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('暂无商品')).toBeInTheDocument();
      });
    });

    it('should handle null balance', async () => {
      vi.mocked(getUserPointsBalance).mockResolvedValue(null);

      render(
        <TestWrapper>
          <PointsMall />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getUserPointsBalance).toHaveBeenCalled();
      });
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(getMallItems).mockRejectedValue(new Error('Network error'));
      vi.mocked(getUserPointsBalance).mockResolvedValue(null);

      render(
        <TestWrapper>
          <PointsMall />
        </TestWrapper>
      );

      // Should still render
      await waitFor(() => {
        expect(screen.getByText('积分商城')).toBeInTheDocument();
      });
    });
  });
});
