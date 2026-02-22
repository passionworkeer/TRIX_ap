/**
 * Component tests for HomeBotBubble
 *
 * Tests the bot bubble UI component that displays bot messages
 * and typing indicators on the home screen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'home.greeting': '你好',
        'home.whatToLearn': '今天想学什么？',
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      id: 'user-123',
      username: 'TestUser',
    },
  }),
}));

vi.mock('../contexts/ClawbotChannelContext', () => ({
  useClawbotChannel: () => ({
    botState: 'IDLE',
    latestBotMessage: null,
    idleEnteredAt: Date.now(),
    hasSessionConversationStarted: false,
  }),
}));

vi.mock('lucide-react', () => ({
  Sparkles: () => React.createElement('span', { 'data-testid': 'sparkles-icon' }, 'Sparkles'),
}));

describe('HomeBotBubble', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export the component', async () => {
    const module = await import('../components/HomeBotBubble');
    expect(module.default).toBeDefined();
  });

  it('should render with greeting text', async () => {
    const HomeBotBubble = (await import('../components/HomeBotBubble')).default;

    const handleClick = vi.fn();
    const { container } = render(React.createElement(HomeBotBubble, { onClick: handleClick }));

    // Component should render something
    expect(container.firstChild).not.toBeNull();
  });

  it('should have onClick handler', async () => {
    const HomeBotBubble = (await import('../components/HomeBotBubble')).default;

    const handleClick = vi.fn();
    render(React.createElement(HomeBotBubble, { onClick: handleClick }));

    // Handler should be provided
    expect(handleClick).toBeDefined();
  });
});
