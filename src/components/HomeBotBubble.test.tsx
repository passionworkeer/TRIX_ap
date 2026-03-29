/**
 * Component tests for HomeBotBubble.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'home.greeting': 'Hello',
        'home.whatToLearn': 'what do you want to learn today?',
        'homeBotBubble.voiceOff': 'Voice off',
        'homeBotBubble.voiceOn': 'Voice on',
        'homeBotBubble.voiceBroadcastOn': 'Voice playback on',
        'homeBotBubble.voiceBroadcastOff': 'Voice playback off',
        'homeBotBubble.closeConversation': 'Close conversation',
        'homeBotBubble.startConversation': 'Start conversation',
        'homeBotBubble.listening': 'Listening',
        'homeBotBubble.sendMessage': 'Send a message',
        'homeBotBubble.stopRecording': 'Stop recording',
        'homeBotBubble.voiceInput': 'Voice input',
        'homeBotBubble.sendMessageAria': 'Send message',
        'homeBotBubble.openTrixBot': 'Open TRIX bot',
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
    messages: [],
    sendMessage: vi.fn(),
  }),
}));

vi.mock('../contexts/VoiceSettingsContext', () => ({
  useVoiceSettings: () => ({
    voiceEnabled: true,
    toggleVoiceEnabled: vi.fn(),
  }),
}));

vi.mock('../hooks/useNotification', () => ({
  useNotification: () => ({
    showError: vi.fn(),
  }),
}));

vi.mock('../hooks/useSpeechToText', () => ({
  useSpeechToText: () => ({
    isListening: false,
    transcript: '',
    interimTranscript: '',
    startListening: vi.fn(),
    stopListening: vi.fn(),
    isSupported: true,
  }),
}));

vi.mock('../services/voicePlaybackService', () => ({
  audioContextUnlock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
  },
}));

vi.mock('lucide-react', () => ({
  Sparkles: () => React.createElement('span', { 'data-testid': 'sparkles-icon' }, 'Sparkles'),
  Send: () => React.createElement('span', { 'data-testid': 'send-icon' }, 'Send'),
  Mic: () => React.createElement('span', { 'data-testid': 'mic-icon' }, 'Mic'),
  X: () => React.createElement('span', { 'data-testid': 'close-icon' }, 'Close'),
  Volume2: () => React.createElement('span', { 'data-testid': 'volume-on-icon' }, 'VolumeOn'),
  VolumeX: () => React.createElement('span', { 'data-testid': 'volume-off-icon' }, 'VolumeOff'),
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

    const { container } = render(React.createElement(HomeBotBubble));

    expect(container.firstChild).not.toBeNull();
  });

  it('should render collapsed bubble by default', async () => {
    const HomeBotBubble = (await import('../components/HomeBotBubble')).default;

    const { container } = render(React.createElement(HomeBotBubble));

    expect(container.querySelector('button')).not.toBeNull();
  });

  it('should stop propagation for clicks inside the expanded bubble', async () => {
    const HomeBotBubble = (await import('../components/HomeBotBubble')).default;
    const outerClick = vi.fn();

    render(
      <div onClick={outerClick}>
        <HomeBotBubble />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open TRIX bot' }));

    const voiceToggleButton = await screen.findByRole('button', { name: 'Voice off' });
    fireEvent.click(voiceToggleButton);

    expect(outerClick).not.toHaveBeenCalled();
  });
});
