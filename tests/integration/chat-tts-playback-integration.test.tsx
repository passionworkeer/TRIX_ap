import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const { mockInstance, handlers } = vi.hoisted(() => {
  const eventHandlers: Record<string, ((...args: unknown[]) => unknown)[]> = {};
  const instance = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
      if (!eventHandlers[event]) {
        eventHandlers[event] = [];
      }
      eventHandlers[event].push(handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
      if (!eventHandlers[event]) {
        return;
      }
      eventHandlers[event] = eventHandlers[event].filter((entry) => entry !== handler);
    }),
    removeAllListeners: vi.fn(),
    setAuthUser: vi.fn(),
    getSession: vi.fn().mockReturnValue(null),
    clearSession: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    isPaired: vi.fn().mockReturnValue(true),
    checkPairingStatus: vi.fn().mockResolvedValue({ paired: true, botOnline: true, deviceId: 'device-1' }),
    bindCurrentSessionToAuthUser: vi.fn().mockResolvedValue(true),
    restoreSession: vi.fn().mockResolvedValue(null),
    pairWithCode: vi.fn(),
    pairWithQR: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue({ messageId: 'native-message-1' }),
    uploadMedia: vi.fn(),
    uploadAttachment: vi.fn(),
    unpair: vi.fn(),
    getUserId: vi.fn().mockReturnValue('user-123'),
    getOrCreateClientId: vi.fn().mockReturnValue('client-123'),
    getStoredPairingState: vi.fn().mockReturnValue({ hasSession: false, session: null }),
  };

  return { mockInstance: instance, handlers: eventHandlers };
});

function fireHandler(event: string, payload?: unknown) {
  for (const handler of handlers[event] || []) {
    handler(payload);
  }
}

vi.mock('../../src/services/TrixNativeChannelClient', () => ({
  default: mockInstance,
}));

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'test@example.com' },
    profile: { id: 'user-123', username: 'tester' },
    session: null,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    updateProfile: vi.fn(),
    refreshProfile: vi.fn(),
  }),
}));

vi.mock('../../src/contexts/VoiceSettingsContext', () => ({
  useVoiceSettings: () => ({
    voiceEnabled: true,
    setVoiceEnabled: vi.fn(),
    toggleVoiceEnabled: vi.fn(),
  }),
}));

vi.mock('../../src/utils/logger', () => ({
  logger: {
    clawbot: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    setLevel: vi.fn(),
    getLevel: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import {
  ClawbotChannelProvider,
  useClawbotChannel,
} from '../../src/contexts/ClawbotChannelContext';

function ChannelConsumer() {
  const channel = useClawbotChannel();

  return (
    <div>
      <span data-testid="status">{channel.status}</span>
      <span data-testid="bot-state">{channel.botState}</span>
      <span data-testid="messages-count">{channel.messages.length}</span>
      <span data-testid="latest-bot-msg">{channel.latestBotMessage?.content ?? 'none'}</span>
      <button
        data-testid="send-message"
        onClick={() => {
          void channel.sendMessage('hello from user');
        }}
      >
        Send
      </button>
      <button
        data-testid="notify-playback-started"
        onClick={() => {
          if (channel.latestBotMessage) {
            channel.notifyVoicePlaybackStarted(channel.latestBotMessage.id);
          }
        }}
      >
        Start playback
      </button>
      <button
        data-testid="notify-playback-ended"
        onClick={() => {
          if (channel.latestBotMessage) {
            channel.notifyVoicePlaybackEnded(channel.latestBotMessage.id);
          }
        }}
      >
        End playback
      </button>
    </div>
  );
}

function renderWithChannel() {
  return render(
    <ClawbotChannelProvider>
      <ChannelConsumer />
    </ClawbotChannelProvider>,
  );
}

describe('Clawbot message and voice-state integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(handlers).forEach((key) => delete handlers[key]);
    mockInstance.restoreSession.mockResolvedValue(null);

    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('adds an optimistic user message and enters THINKING when sending', async () => {
    renderWithChannel();

    await act(async () => {
      screen.getByTestId('send-message').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('messages-count').textContent).toBe('1');
      expect(screen.getByTestId('bot-state').textContent).toBe('THINKING');
    });

    expect(mockInstance.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockInstance.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      text: 'hello from user',
      contentType: 'text',
      clientMessageId: expect.any(String),
    }));
  });

  it('tracks incoming bot messages as the latest bot reply and enters SPEAKING', async () => {
    renderWithChannel();

    act(() => {
      fireHandler('message', {
        id: 'bot-message-1',
        replyToMessageId: null,
        content: 'Hello from TRIX',
        contentType: 'text',
        timestamp: Date.now(),
        sender: 'bot',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('messages-count').textContent).toBe('1');
      expect(screen.getByTestId('latest-bot-msg').textContent).toBe('Hello from TRIX');
      expect(screen.getByTestId('bot-state').textContent).toBe('SPEAKING');
    });
  });

  it('returns to IDLE after the active voice playback ends', async () => {
    renderWithChannel();

    act(() => {
      fireHandler('message', {
        id: 'bot-message-2',
        replyToMessageId: null,
        content: 'Voice response',
        contentType: 'text',
        timestamp: Date.now(),
        sender: 'bot',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('bot-state').textContent).toBe('SPEAKING');
    });

    await act(async () => {
      screen.getByTestId('notify-playback-started').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('bot-state').textContent).toBe('SPEAKING');
    });

    await act(async () => {
      screen.getByTestId('notify-playback-ended').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('bot-state').textContent).toBe('IDLE');
    });
  });
});
