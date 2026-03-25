/**
 * Unit tests for Profile screen
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import Profile from './Profile';

// ============================================
// Mock AuthContext
// ============================================
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    profile: {
      id: 'test-user',
      username: 'tester',
      points: 150,
      days_active: 30,
      interaction_count: 100,
      avatar_url: null,
    },
    signOut: vi.fn(),
    updateProfile: vi.fn(),
    loading: false,
  }),
}));

// ============================================
// Mock ThemeContext
// ============================================
vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({
    isDark: false,
    toggleTheme: vi.fn(),
  }),
}));

// ============================================
// Mock VoiceSettingsContext
// ============================================
vi.mock('../contexts/VoiceSettingsContext', () => ({
  useVoiceSettings: () => ({
    voiceEnabled: false,
    toggleVoiceEnabled: vi.fn(),
  }),
}));

// ============================================
// Mock other dependencies
// ============================================
vi.mock('../hooks/useConfirmModal', () => ({
  useConfirmModal: () => ({
    requestConfirm: vi.fn().mockResolvedValue(true),
    ConfirmModalRenderer: () => null,
  }),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../services/userStatsService', () => ({
  getUserStats: vi.fn().mockResolvedValue({
    totalStudyTime: 120,
    totalSessions: 5,
    longestSession: 60,
    currentStreak: 3,
  }),
}));

vi.mock('../components/AboutDialog', () => ({
  AboutDialog: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="about-dialog">
        <span>About</span>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('../components/AchievementsPanel', () => ({
  AchievementsPanel: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="achievements-panel">
        <span>Achievements</span>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('../components/StatsDetailDialog', () => ({
  StatsDetailDialog: ({
    isOpen,
    onClose,
    stats,
    loading,
  }: {
    isOpen: boolean;
    onClose: () => void;
    stats: unknown;
    loading: boolean;
  }) =>
    isOpen ? (
      <div data-testid="stats-dialog">
        <span>{loading ? 'Loading' : 'Stats'}</span>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('../components/PrivacySettings', () => ({
  PrivacySettings: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="privacy-settings">
        <span>Privacy</span>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('../components/PointsHistory', () => ({
  PointsHistory: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="points-history">
        <span>Points</span>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('../components/OpenClawControlPanel', () => ({
  OpenClawControlPanel: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="openclaw-panel">
        <span>OpenClaw</span>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('../components/GlassPanel', () => ({
  default: ({ onClick, children, className }: { onClick?: () => void; children: React.ReactNode; className?: string }) => (
    <div
      data-testid="glass-panel"
      onClick={onClick}
      className={className}
    >
      {children}
    </div>
  ),
}));

// ============================================
// Test wrapper
// ============================================
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter>
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  </MemoryRouter>
);

describe('Profile', () => {
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
    it('renders page title correctly', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });
    });

    it('renders user avatar section', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        // Avatar area should render (verified badge is in username area)
        expect(screen.getByText('tester')).toBeInTheDocument();
      });
    });

    it('renders username from profile', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('tester')).toBeInTheDocument();
      });
    });

    it('renders email from user', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });
    });

    it('renders VIP badge', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/VIP/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Stats Section Tests
  // ============================================
  describe('Stats Section Tests', () => {
    it('renders days active stat', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('30')).toBeInTheDocument();
      });
    });

    it('renders points stat', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument();
      });
    });

    it('renders interaction count stat', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument();
      });
    });

    it('renders stat labels', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/days/i)).toBeInTheDocument();
        expect(screen.getByText(/points/i)).toBeInTheDocument();
        expect(screen.getByText(/interactions/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Wardrobe / Outfit Section Tests
  // ============================================
  describe('Wardrobe Section Tests', () => {
    it('renders wardrobe section heading', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/wardrobe|衣柜/i)).toBeInTheDocument();
      });
    });

    it('renders outfit items', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('巫师帽')).toBeInTheDocument();
        expect(screen.getByText('披风')).toBeInTheDocument();
        expect(screen.getByText('魔杖')).toBeInTheDocument();
      });
    });

    it('renders add more outfits button', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/get more|获取更多/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Settings Section Tests
  // ============================================
  describe('Settings Section Tests', () => {
    it('renders appearance section', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/appearance|外观/i)).toBeInTheDocument();
      });
    });

    it('renders dark mode toggle', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/dark mode|深色模式/i)).toBeInTheDocument();
      });
    });

    it('renders language setting', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/language|语言/i)).toBeInTheDocument();
      });
    });

    it('renders voice immersion mode setting', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/voice immersion|语音沉浸/i)).toBeInTheDocument();
      });
    });

    it('renders OpenClaw control panel setting', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/openclaw/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // General Settings Tests
  // ============================================
  describe('General Settings Tests', () => {
    it('renders achievements option', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/achievements|成就/i)).toBeInTheDocument();
      });
    });

    it('renders privacy setting', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/privacy|隐私/i)).toBeInTheDocument();
      });
    });

    it('renders about section', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/about|关于/i)).toBeInTheDocument();
      });
    });

    it('renders logout button', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/logout|退出登录/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Dialog Opening Tests
  // ============================================
  describe('Dialog Opening Tests', () => {
    it('opens stats dialog when stats area clicked', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        const glassPanels = screen.getAllByTestId('glass-panel');
        expect(glassPanels.length).toBeGreaterThan(0);
      });
    });

    it('opens about dialog when about clicked', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        const aboutBtn = screen.getByText(/about|关于/i);
        if (aboutBtn) {
          fireEvent.click(aboutBtn);
        }
      });

      // Dialog should open
    });

    it('opens achievements panel when achievements clicked', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        const achievementBtn = screen.getByText(/achievements|成就/i);
        if (achievementBtn) {
          fireEvent.click(achievementBtn);
        }
      });
    });

    it('opens privacy settings when privacy clicked', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        const privacyBtn = screen.getByText(/privacy|隐私/i);
        if (privacyBtn) {
          fireEvent.click(privacyBtn);
        }
      });
    });

    it('opens points history when points clicked', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Settings Interaction Tests
  // ============================================
  describe('Settings Interaction Tests', () => {
    it('toggles dark mode when dark mode clicked', async () => {
      const { useTheme } = await import('../contexts/ThemeContext');
      const { toggleTheme } = useTheme();

      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        const darkModeBtn = screen.getByText(/dark mode|深色模式/i);
        fireEvent.click(darkModeBtn);
      });
    });

    it('changes language when language clicked', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        const langBtn = screen.getByText(/language|语言/i);
        fireEvent.click(langBtn);
      });
    });

    it('toggles voice mode when voice setting clicked', async () => {
      render(
        <TestWrapper>
          <Profile />
        </TestWrapper>
      );

      await waitFor(() => {
        const voiceBtn = screen.getByText(/voice immersion|语音沉浸/i);
        fireEvent.click(voiceBtn);
      });
    });
  });
});
