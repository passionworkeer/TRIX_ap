import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const listeners = new Map<string, Set<(payload: any) => void>>();

vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
    },
  }),
}));

vi.mock('./VoiceSettingsContext', () => ({
  useVoiceSettings: () => ({
    voiceEnabled: false,
  }),
}));

vi.mock('../services/TrixNativeChannelClient', () => {
  const on = vi.fn((event: string, callback: (payload: unknown) => void) => {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)?.add(callback as (payload: any) => void);
  });
  const off = vi.fn((event: string, callback: (payload: unknown) => void) => {
    listeners.get(event)?.delete(callback as (payload: any) => void);
  });

  return {
    default: {
      on,
      off,
      setAuthUser: vi.fn(),
      bindCurrentSessionToAuthUser: vi.fn(async () => true),
      getSession: vi.fn(() => ({
        accountId: 'default',
        appUserId: 'test-user-123',
        serverUrl: 'https://trix.love',
        websocketUrl: 'wss://trix.love/ws',
        conversationId: 'conv_test',
        clientToken: 'client-token',
        clientId: 'web_client_1',
        pairingCode: 'ABC123',
      })),
      restoreSession: vi.fn(async () => null),
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(),
      checkPairingStatus: vi.fn(async () => ({ paired: true, botOnline: true, deviceId: 'web_client_1' })),
      pairWithCode: vi.fn(),
      pairWithQR: vi.fn(),
      sendMessage: vi.fn(async () => undefined),
      uploadMedia: vi.fn(async () => 'https://example.com/media.jpg'),
      uploadAttachment: vi.fn(async () => ({
        attachmentId: 'att_1',
        url: 'https://example.com/media.jpg',
        kind: 'image',
        mimeType: 'image/jpeg',
        fileName: 'upload.jpg',
        size: 1,
      })),
      unpair: vi.fn(),
      getOrCreateClientId: vi.fn(() => 'web_client_1'),
      isPaired: vi.fn(() => true),
    },
  };
});

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { ClawbotChannelProvider, useClawbotChannel } from './ClawbotChannelContext';
import trixNativeChannelClient from '../services/TrixNativeChannelClient';

function emit(event: string, payload: unknown) {
  listeners.get(event)?.forEach((callback) => callback(payload));
}

const Consumer = () => {
  const context = useClawbotChannel();
  return (
    <div>
      <span data-testid="bot-state">{context.botState}</span>
      <span data-testid="message-count">{context.messages.length}</span>
      <button
        data-testid="send-first"
        onClick={() => {
          void context.sendMessage('first');
        }}
      >
        send first
      </button>
      <button
        data-testid="send-second"
        onClick={() => {
          void context.sendMessage('second');
        }}
      >
        send second
      </button>
    </div>
  );
};

describe('ClawbotChannelContext reply lifecycle', () => {
  beforeEach(() => {
    listeners.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('keeps bot state active until every pending user message receives a reply', async () => {
    const { getByTestId } = render(
      <ClawbotChannelProvider>
        <Consumer />
      </ClawbotChannelProvider>,
    );

    await act(async () => {
      emit('connected', { agentOnline: true });
    });

    await act(async () => {
      getByTestId('send-first').click();
      getByTestId('send-second').click();
    });

    expect(getByTestId('bot-state').textContent).toBe('THINKING');

    const sendCalls = vi.mocked(trixNativeChannelClient.sendMessage).mock.calls;
    expect(sendCalls).toHaveLength(2);
    const firstClientMessageId = sendCalls[0]?.[0]?.clientMessageId as string;
    const secondClientMessageId = sendCalls[1]?.[0]?.clientMessageId as string;

    await act(async () => {
      emit('message', {
        id: 'srv_user_1',
        replyToMessageId: null,
        content: 'first',
        contentType: 'text',
        timestamp: Date.now(),
        sender: 'user',
        metadata: {
          clientMessageId: firstClientMessageId,
          serverMessageId: 'srv_user_1',
          serviceDispatchPending: true,
        },
      });
      emit('message', {
        id: 'srv_user_2',
        replyToMessageId: null,
        content: 'second',
        contentType: 'text',
        timestamp: Date.now() + 1,
        sender: 'user',
        metadata: {
          clientMessageId: secondClientMessageId,
          serverMessageId: 'srv_user_2',
          serviceDispatchPending: true,
        },
      });
      emit('message', {
        id: 'srv_bot_1',
        replyToMessageId: 'srv_user_1',
        content: 'reply one',
        contentType: 'text',
        timestamp: Date.now() + 2,
        sender: 'bot',
      });
    });

    expect(getByTestId('bot-state').textContent).toBe('SPEAKING');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(getByTestId('bot-state').textContent).toBe('THINKING');

    await act(async () => {
      emit('message', {
        id: 'srv_bot_2',
        replyToMessageId: 'srv_user_2',
        content: 'reply two',
        contentType: 'text',
        timestamp: Date.now() + 3,
        sender: 'bot',
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(getByTestId('bot-state').textContent).toBe('IDLE');
    expect(getByTestId('message-count').textContent).toBe('4');
  }, 15_000);
});
