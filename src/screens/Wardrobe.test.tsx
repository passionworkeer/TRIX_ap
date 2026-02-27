/**
 * Unit tests for Wardrobe screen
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import type { Outfit, UserOutfits } from '../types/wardrobe';

// Mock data
const mockOutfits: Outfit[] = [
  {
    id: 'outfit-1',
    name: 'Test Hat',
    category: 'hat',
    image: 'https://example.com/hat.png',
    previewImage: 'https://example.com/hat-preview.png',
    isOwned: true,
    isEquipped: false,
    description: 'A test hat',
    price: 100,
  },
  {
    id: 'outfit-2',
    name: 'Test Cape',
    category: 'cape',
    image: 'https://example.com/cape.png',
    previewImage: 'https://example.com/cape-preview.png',
    isOwned: true,
    isEquipped: true,
    description: 'A test cape',
    price: 150,
  },
  {
    id: 'outfit-3',
    name: 'Test Wand',
    category: 'wand',
    image: 'https://example.com/wand.png',
    previewImage: 'https://example.com/wand-preview.png',
    isOwned: false,
    isEquipped: false,
    description: 'A test wand',
    price: 200,
  },
];

const mockWardrobeSummary: UserOutfits = {
  userId: 'test-user',
  ownedOutfits: mockOutfits.filter((o) => o.isOwned),
  equippedOutfits: mockOutfits.filter((o) => o.isEquipped),
  totalOutfits: 3,
  ownedCount: 2,
  equippedCount: 1,
};

// Mock wardrobeService
vi.mock('../services/wardrobeService', () => ({
  getOutfitsByCategory: vi.fn(),
  equipOutfit: vi.fn(),
  unequipOutfit: vi.fn(),
  getUserWardrobeSummary: vi.fn(),
}));

// Mock useAuth
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
  }),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// Import after mocks
import {
  getOutfitsByCategory,
  equipOutfit,
  unequipOutfit,
  getUserWardrobeSummary,
} from '../services/wardrobeService';
import Wardrobe from './Wardrobe';

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  </BrowserRouter>
);

describe('Wardrobe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOutfitsByCategory).mockResolvedValue([]);
    vi.mocked(getUserWardrobeSummary).mockResolvedValue(mockWardrobeSummary);
    vi.mocked(equipOutfit).mockResolvedValue({
      success: true,
      message: '装备成功',
    });
    vi.mocked(unequipOutfit).mockResolvedValue({
      success: true,
      message: '已卸下',
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ============================================
  // Basic Rendering Tests
  // ============================================

  describe('基础渲染测试', () => {
    it('renders page title correctly', async () => {
      render(
        <TestWrapper>
          <Wardrobe />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('我的衣柜')).toBeInTheDocument();
      });
    });

    it('renders all category filter tabs', async () => {
      render(
        <TestWrapper>
          <Wardrobe />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('全部')).toBeInTheDocument();
        expect(screen.getByText('帽子')).toBeInTheDocument();
        expect(screen.getByText('披风')).toBeInTheDocument();
        expect(screen.getByText('魔杖')).toBeInTheDocument();
        expect(screen.getByText('背景')).toBeInTheDocument();
      });
    });

    it('renders wardrobe summary correctly', async () => {
      render(
        <TestWrapper>
          <Wardrobe />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('已拥有')).toBeInTheDocument();
        expect(screen.getByText('已装备')).toBeInTheDocument();
      });
    });

    it('renders empty state when no outfits', async () => {
      vi.mocked(getOutfitsByCategory).mockResolvedValue([]);
      vi.mocked(getUserWardrobeSummary).mockResolvedValue({
        userId: 'test-user',
        ownedOutfits: [],
        equippedOutfits: [],
        totalOutfits: 0,
        ownedCount: 0,
        equippedCount: 0,
      });

      render(
        <TestWrapper>
          <Wardrobe />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('暂无服装')).toBeInTheDocument();
      });
    });

    it('renders outfits after loading', async () => {
      vi.mocked(getOutfitsByCategory).mockResolvedValue(mockOutfits);

      render(
        <TestWrapper>
          <Wardrobe />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Hat')).toBeInTheDocument();
        expect(screen.getByText('Test Cape')).toBeInTheDocument();
        expect(screen.getByText('Test Wand')).toBeInTheDocument();
      });
    });

    it('shows equipped badge on equipped items', async () => {
      vi.mocked(getOutfitsByCategory).mockResolvedValue(mockOutfits);

      render(
        <TestWrapper>
          <Wardrobe />
        </TestWrapper>
      );

      await waitFor(() => {
        const equippedBadges = screen.getAllByText('已装备');
        expect(equippedBadges.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ============================================
  // Interaction Tests
  // ============================================

  describe('交互测试', () => {
    it('filters items by category when clicked', async () => {
      vi.mocked(getOutfitsByCategory).mockResolvedValue(mockOutfits);

      render(
        <TestWrapper>
          <Wardrobe />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('帽子')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('帽子'));

      await waitFor(() => {
        expect(getOutfitsByCategory).toHaveBeenCalledWith('hat');
      });
    });

    it('calls equipOutfit when clicking on unequipped owned item', async () => {
      vi.mocked(getOutfitsByCategory).mockResolvedValue(mockOutfits);

      render(
        <TestWrapper>
          <Wardrobe />
        </TestWrapper>
      );

      await waitFor(() => {
        const equipButtons = screen.getAllByText('装备');
        expect(equipButtons.length).toBeGreaterThan(0);
      });

      const equipButtons = screen.getAllByText('装备');
      fireEvent.click(equipButtons[0]);

      await waitFor(() => {
        expect(equipOutfit).toHaveBeenCalled();
      });
    });

    it('calls unequipOutfit when clicking on equipped item', async () => {
      vi.mocked(getOutfitsByCategory).mockResolvedValue(mockOutfits);

      render(
        <TestWrapper>
          <Wardrobe />
        </TestWrapper>
      );

      await waitFor(() => {
        const unequipButtons = screen.getAllByText('卸下');
        expect(unequipButtons.length).toBeGreaterThan(0);
      });

      const unequipButtons = screen.getAllByText('卸下');
      fireEvent.click(unequipButtons[0]);

      await waitFor(() => {
        expect(unequipOutfit).toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // Service Integration Tests
  // ============================================

  describe('service calls', () => {
    it('calls getOutfitsByCategory on mount', async () => {
      render(
        <TestWrapper>
          <Wardrobe />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getOutfitsByCategory).toHaveBeenCalled();
      });
    });

    it('calls getUserWardrobeSummary on mount', async () => {
      render(
        <TestWrapper>
          <Wardrobe />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getUserWardrobeSummary).toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // Loading State Tests
  // ============================================

  describe('loading state', () => {
    it('shows loading spinner while loading', async () => {
      vi.mocked(getOutfitsByCategory).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      render(
        <TestWrapper>
          <Wardrobe />
        </TestWrapper>
      );

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('hides loading spinner after loading completes', async () => {
      render(
        <TestWrapper>
          <Wardrobe />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('暂无服装')).toBeInTheDocument();
      });

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).not.toBeInTheDocument();
    });
  });
});
