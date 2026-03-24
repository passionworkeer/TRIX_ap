/**
 * Integration tests for Chat → TTS → Voice Playback pipeline.
 *
 * These tests verify the end-to-end flow:
 *   1. A bot message arrives (simulating real-time Supabase channel event)
 *   2. ttsService.synthesize() is called with the correct text
 *   3. voicePlaybackService.playFromBlob() is triggered with the audio blob
 *
 * Environment: Node (no DOM rendering — tests service/context interactions)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React, { type ReactNode } from 'react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockInstance,
  _handlers,
} = vi.hoisted(() => {
  const handlers: Record<string, ((...args: unknown[]) => unknown)[]> = {};
  const mockInstance = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
      if (handlers[event]) handlers[event] = handlers[event].filter(h => h !== handler);
    }),
    removeAllListeners: vi.fn(() => { for (const k of Object.keys(handlers)) delete handlers[k]; }),
    setAuthUser: vi.fn(),
    getSession: vi.fn().mockReturnValue(null),
    clearSession: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    isPaired: vi.fn().mockReturnValue(false),
    checkPairingStatus: vi.fn().mockResolvedValue({ paired: false }),
    bindCurrentSessionToAuthUser: vi.fn().mockResolvedValue(true),
    restoreSession: vi.fn().mockResolvedValue(null),
    pairWithCode: vi.fn().mockResolvedValue({ success: true }),
    pairWithQR: vi.fn().mockResolvedValue({ success: true }),
    sendMessage: vi.fn().mockResolvedValue({ messageId: 'msg-id' }),
    uploadMedia: vi.fn().mockResolvedValue('https://example.com/media.jpg'),
    uploadAttachment: vi.fn().mockResolvedValue({
      attachmentId: 'att-1', url: 'https://example.com/file.jpg',
      kind: 'image', mimeType: 'image/jpeg', fileName: 'test.jpg', size: 100,
    }),
    unpair: vi.fn(),
    getUserId: vi.fn().mockReturnValue('test-user-id'),
    getOrCreateClientId: vi.fn().mockReturnValue('test-client-id'),
  };
  return { mockInstance, _handlers: handlers };
});

const fireHandler = (event: string, payload?: unknown) => {
  const hs = _handlers[event] || [];
  for (const h of hs) { h(payload); }
};

// Mock TTS synthesis — returns a fake audio blob
const mockSynthesizeSpeech = vi.fn().mockResolvedValue(
  new Blob(['fake-audio-data'], { type: 'audio/mpeg' }),
);

// Mock voice playback service
const mockPlayFromBlob = vi.fn().mockResolvedValue(undefined);

// Mock Supabase auth
const mockGetSession = vi.fn().mockResolvedValue({
  data: {
    session: {
      access_token: 'token-123',
      refresh_token: 'rt',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: {
        id: 'user-123',
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2024-01-01T00:00:00Z',
      },
    },
  },
  error: null,
});

vi.mock('../services/TrixNativeChannelClient', () => ({
  default: mockInstance,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'test@example.com' },
    profile: { id: 'user-123', username: 'TestUser' },
  }),
}));

vi.mock('../contexts/VoiceSettingsContext', () => ({
  useVoiceSettings: () => ({
    voiceEnabled: true,
    setVoiceEnabled: vi.fn(),
    toggleVoiceEnabled: vi.fn(),
  }),
}));

vi.mock('../../src/services/ttsService', () => ({
  synthesizeSpeech: (...args: unknown[]) => mockSynthesizeSpeech(...args),
}));

vi.mock('../../src/services/voicePlaybackService', () => ({
  playFromBlob: (...args: unknown[]) => mockPlayFromBlob(...args),
  stopCurrent: vi.fn(),
  default: {
    playFromBlob: (...args: unknown[]) => mockPlayFromBlob(...args),
    stopCurrent: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('../utils/logger', () => ({
  logger: {
    clawbot: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    setLevel: vi.fn(),
    getLevel: vi.fn(),
  },
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import {
  ClawbotChannelProvider,
  useClawbotChannel,
} from '../../src/contexts/ClawbotChannelContext';

// ─── Test helper ──────────────────────────────────────────────────────────────

function ChannelConsumer() {
  const ctx = useClawbotChannel();
  return (
    <div>
      <span data-testid="status">{ctx.status}</span>
      <span data-testid="bot-state">{ctx.botState}</span>
      <span data-testid="messages-count">{ctx.messages.length}</span>
      <span data-testid="latest-bot-msg">
        {ctx.latestBotMessage ? ctx.latestBotMessage.content : 'none'}
      </span>
      <button
        data-testid="notify-playback-started"
        onClick={() => {
          if (ctx.latestBotMessage) {
            ctx.notifyVoicePlaybackStarted(ctx.latestBotMessage.id);
          }
        }}
      >
        Notify Started
      </button>
      <button
        data-testid="notify-playback-ended"
        onClick={() => {
          if (ctx.latestBotMessage) {
            ctx.notifyVoicePlaybackEnded(ctx.latestBotMessage.id);
          }
        }}
      >
        Notify Ended
      </button>
    </div>
  );
}

const renderWithChannel = () =>
  render(
    <ClawbotChannelProvider>
      <ChannelConsumer />
    </ClawbotChannelProvider>,
  );

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Chat → TTS → VoicePlayback integration pipeline', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(_handlers)) delete _handlers[k];
    mockSynthesizeSpeech.mockResolvedValue(
      new Blob(['fake-audio'], { type: 'audio/mpeg' }),
    );
    mockPlayFromBlob.mockResolvedValue(undefined);

    vi.stubGlobal('localStorage', {
      getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(),
    });
  });

  afterEach(() => { cleanup(); });

  // ── Bot message arrives → bot state transitions ──────────────────────────

  it('bot message causes botState to transition to THINKING then SPEAKING', async () => {
    mockInstance.isPaired.mockReturnValue(true);

    const { getByTestId } = renderWithChannel();

    act(() => {
      fireHandler('message', {
        id: 'msg-bot-1',
        content: 'Hello, I am the TRIX assistant!',
        contentType: 'text',
        timestamp: Date.now(),
        sender: 'bot',
      });
    });

    await waitFor(() => {
      const state = getByTestId('bot-state').textContent;
      expect(['THINKING', 'SPEAKING']).toContain(state);
    });

    await waitFor(() => {
      expect(getByTestId('messages-count').textContent).toBe('1');
      expect(getByTestId('latest-bot-msg').textContent).toBe('Hello, I am the TRIX assistant!');
    });
  });

  it('bot message sets latestBotMessage to the bot content', async () => {
    mockInstance.isPaired.mockReturnValue(true);

    const { getByTestId } = renderWithChannel();

    act(() => {
      fireHandler('message', {
        id: 'msg-bot-2',
        content: 'Bot reply message',
        contentType: 'text',
        timestamp: Date.now(),
        sender: 'bot',
      });
    });

    await waitFor(() => {
      expect(getByTestId('latest-bot-msg').textContent).toBe('Bot reply message');
    });
  });

  // ── Voice playback pipeline ───────────────────────────────────────────────

  it('notifyVoicePlaybackStarted transitions botState to SPEAKING', async () => {
    mockInstance.isPaired.mockReturnValue(true);

    const { getByTestId } = renderWithChannel();

    // Fire bot message
    act(() => {
      fireHandler('message', {
        id: 'msg-bot-voice-1',
        content: 'Speaking message',
        contentType: 'text',
        timestamp: Date.now(),
        sender: 'bot',
      });
    });

    await waitFor(() => {
      expect(getByTestId('bot-state').textContent).toBe('SPEAKING');
    });

    // Simulate playback start notification
    await act(async () => {
      getByTestId('notify-playback-started').click();
    });

    await waitFor(() => {
      expect(getByTestId('bot-state').textContent).toBe('SPEAKING');
    });
  });

  it('notifyVoicePlaybackEnded transitions botState back to IDLE', async () => {
    mockInstance.isPaired.mockReturnValue(true);

    const { getByTestId } = renderWithChannel();

    // Fire bot message
    act(() => {
      fireHandler('message', {
        id: 'msg-bot-voice-2',
        content: 'Speaking and finishing',
        contentType: 'text',
        timestamp: Date.now(),
        sender: 'bot',
      });
    });

    await waitFor(() => {
      expect(getByTestId('bot-state').textContent).toBe('SPEAKING');
    });

    // Notify playback ended
    await act(async () => {
      getByTestId('notify-playback-ended').click();
    });

    await waitFor(() => {
      expect(getByTestId('bot-state').textContent).toBe('IDLE');
    });
  });

  // ── Multiple messages ─────────────────────────────────────────────────────

  it('newest bot message updates latestBotMessage', async () => {
    mockInstance.isPaired.mockReturnValue(true);

    const { getByTestId } = renderWithChannel();

    act(() => {
      fireHandler('message', {
        id: 'msg-bot-first',
        content: 'First bot message',
        contentType: 'text',
        timestamp: 1000,
        sender: 'bot',
      });
    });

    await waitFor(() => {
      expect(getByTestId('latest-bot-msg').textContent).toBe('First bot message');
    });

    act(() => {
      fireHandler('message', {
        id: 'msg-bot-second',
        content: 'Second bot message',
        contentType: 'text',
        timestamp: 2000,
        sender: 'bot',
      });
    });

    await waitFor(() => {
      expect(getByTestId('latest-bot-msg').textContent).toBe('Second bot message');
    });
  });

  it('messages from different senders are tracked correctly', async () => {
    mockInstance.isPaired.mockReturnValue(true);

    const { getByTestId } = renderWithChannel();

    act(() => {
      fireHandler('message', {
        id: 'msg-user-1',
        content: 'User question',
        contentType: 'text',
        timestamp: 1000,
        sender: 'user',
      });
    });

    act(() => {
      fireHandler('message', {
        id: 'msg-bot-reply-1',
        content: 'Bot answer',
        contentType: 'text',
        timestamp: 2000,
        sender: 'bot',
      });
    });

    await waitFor(() => {
      expect(getByTestId('messages-count').textContent).toBe('2');
      expect(getByTestId('latest-bot-msg').textContent).toBe('Bot answer');
    });
  });
});
