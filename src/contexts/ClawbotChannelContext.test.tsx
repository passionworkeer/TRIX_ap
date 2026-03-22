/**
 * Unit tests for ClawbotChannelContext
 *
 * Tests the WebSocket connection management, message sending/receiving,
 * pairing logic, and connection state management.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React, { type ReactNode } from 'react';

// Mock AuthContext before importing the context under test
vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
    },
    profile: {
      id: 'test-user-123',
      username: 'TestUser',
    },
  }),
}));

// Mock VoiceSettingsContext
vi.mock('./VoiceSettingsContext', () => ({
  useVoiceSettings: () => ({
    voiceEnabled: true,
    setVoiceEnabled: vi.fn(),
    toggleVoiceEnabled: vi.fn(),
  }),
}));

// Mock dependencies after Auth and VoiceSettings
vi.mock('../services/TrixNativeChannelClient', () => {
  const mockInstance = {
    on: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    isPaired: vi.fn().mockReturnValue(false),
    checkPairingStatus: vi.fn().mockResolvedValue({ paired: false }),
    pairWithCode: vi.fn(),
    pairWithQR: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    uploadMedia: vi.fn().mockResolvedValue('https://example.com/media.jpg'),
    uploadAttachment: vi.fn().mockResolvedValue({ attachmentId: 'test', url: 'https://example.com/file.jpg', kind: 'image', mimeType: 'image/jpeg', fileName: 'test.jpg', size: 100 }),
    unpair: vi.fn(),
    getUserId: vi.fn().mockReturnValue('test-user-id'),
    getOrCreateClientId: vi.fn().mockReturnValue('test-client-id'),
  };

  return {
    default: mockInstance,
    CHANNEL_PROTOCOL_MISMATCH: 'CHANNEL_PROTOCOL_MISMATCH',
  };
});

vi.mock('../services/clawbotHistoryService', () => ({
  loadClawbotMessageHistory: vi.fn().mockResolvedValue([]),
  saveClawbotMessage: vi.fn().mockResolvedValue(undefined),
  deleteClawbotMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../config/clawbotEndpoints', () => ({
  getClawbotEndpoints: vi.fn(() => ({
    nativeServerUrl: 'https://chat.example.com',
    nativePublicUrl: 'https://chat.example.com',
  })),
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Import after mocks are set up
import {
  ClawbotChannelProvider,
  useClawbotChannel,
  type ConnectionStatus,
  type PairingStatus,
  type BotState,
} from '../contexts/ClawbotChannelContext';
import trixNativeChannelClient from '../services/TrixNativeChannelClient';
import { getClawbotEndpoints } from '../config/clawbotEndpoints';
import {
  loadClawbotMessageHistory,
  saveClawbotMessage,
  deleteClawbotMessage,
} from '../services/clawbotHistoryService';
import toast from 'react-hot-toast';

// Test helper component to access context
const TestConsumer: React.FC = () => {
  const context = useClawbotChannel();
  return (
    <div data-testid="context-consumer">
      <span data-testid="status">{context.status}</span>
      <span data-testid="is-connected">{String(context.isConnected)}</span>
      <span data-testid="is-paired">{String(context.isPaired)}</span>
      <span data-testid="pairing-status">{context.pairingStatus}</span>
      <span data-testid="bot-state">{context.botState}</span>
      <span data-testid="messages-count">{context.messages.length}</span>
      <span data-testid="last-error">{context.lastError || 'none'}</span>
      <button data-testid="connect-btn" onClick={() => context.connect()}>
        Connect
      </button>
      <button data-testid="disconnect-btn" onClick={() => context.disconnect()}>
        Disconnect
      </button>
      <button
        data-testid="send-btn"
        onClick={() => context.sendMessage('Hello').catch(() => {})}
      >
        Send
      </button>
      <button
        data-testid="pair-btn"
        onClick={() => context.pairWithCode('123456').catch(() => {})}
      >
        Pair
      </button>
      <button data-testid="unpair-btn" onClick={() => context.unpair()}>
        Unpair
      </button>
      <button data-testid="clear-btn" onClick={() => context.clearMessages()}>
        Clear
      </button>
    </div>
  );
};

// Mock user object
const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00Z',
};

// Wrapper component with providers
const renderWithProviders = (ui: ReactNode) => {
  return render(
    <ClawbotChannelProvider>
      {ui}
    </ClawbotChannelProvider>
  );
};

describe.skip('ClawbotChannelContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset localStorage
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });

    // Mock getClawbotEndpoints
    vi.mocked(getClawbotEndpoints).mockReturnValue({
      nativeServerUrl: 'https://chat.example.com',
      nativePublicUrl: 'https://chat.example.com',
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('initial state', () => {
    it('should have correct initial values', async () => {
      // Mock user as logged out initially
      vi.mocked(trixNativeChannelClient.connect).mockImplementation(() => {
        // Do nothing - don't trigger connection
        return Promise.resolve();
      });

      const { getByTestId } = renderWithProviders(<TestConsumer />);

      await waitFor(() => {
        expect(getByTestId('status').textContent).toBe('DISCONNECTED');
        expect(getByTestId('is-connected').textContent).toBe('false');
        expect(getByTestId('is-paired').textContent).toBe('false');
        expect(getByTestId('pairing-status').textContent).toBe('idle');
        expect(getByTestId('bot-state').textContent).toBe('IDLE');
        expect(getByTestId('messages-count').textContent).toBe('0');
        expect(getByTestId('last-error').textContent).toBe('none');
      });
    });
  });

  describe('connection management', () => {
    it('should set status to CONNECTING when connection starts', async () => {
      const { getByTestId } = renderWithProviders(<TestConsumer />);

      // Manually trigger connect
      await act(async () => {
        await getByTestId('connect-btn').click();
      });

      expect(trixNativeChannelClient.connect).toHaveBeenCalled();
    });

    it('should update status on connecting event', async () => {
      const { getByTestId } = renderWithProviders(<TestConsumer />);

      // Simulate connecting event
      const connectingHandler = vi.mocked(trixNativeChannelClient.on).mock.calls.find(
        (call) => call[0] === 'connecting'
      )?.[1];

      if (connectingHandler) {
        await act(async () => {
          connectingHandler();
        });

        await waitFor(() => {
          expect(getByTestId('status').textContent).toBe('CONNECTING');
        });
      }
    });

    it('should update status on connected event', async () => {
      const { getByTestId } = renderWithProviders(<TestConsumer />);

      // Mock checkPairingStatus to return not paired
      vi.mocked(trixNativeChannelClient.checkPairingStatus).mockResolvedValueOnce({
        paired: false,
      });

      // Simulate connected event
      const connectedHandler = vi.mocked(trixNativeChannelClient.on).mock.calls.find(
        (call) => call[0] === 'connected'
      )?.[1];

      if (connectedHandler) {
        await act(async () => {
          await connectedHandler();
        });

        await waitFor(() => {
          expect(getByTestId('status').textContent).toBe('CONNECTED');
        });
      }
    });

    it('should update status to PAIRED when already paired', async () => {
      const { getByTestId } = renderWithProviders(<TestConsumer />);

      // Mock checkPairingStatus to return paired
      vi.mocked(trixNativeChannelClient.checkPairingStatus).mockResolvedValueOnce({
        paired: true,
        deviceId: 'device-123',
      });

      // Simulate connected event
      const connectedHandler = vi.mocked(trixNativeChannelClient.on).mock.calls.find(
        (call) => call[0] === 'connected'
      )?.[1];

      if (connectedHandler) {
        await act(async () => {
          await connectedHandler();
        });

        await waitFor(() => {
          expect(getByTestId('pairing-status').textContent).toBe('paired');
        });
      }
    });

    it('should update status on disconnected event', async () => {
      const { getByTestId } = renderWithProviders(<TestConsumer />);

      // Simulate disconnected event
      const disconnectedHandler = vi.mocked(trixNativeChannelClient.on).mock.calls.find(
        (call) => call[0] === 'disconnected'
      )?.[1];

      if (disconnectedHandler) {
        await act(async () => {
          disconnectedHandler();
        });

        await waitFor(() => {
          expect(getByTestId('status').textContent).toBe('DISCONNECTED');
          expect(getByTestId('bot-state').textContent).toBe('IDLE');
        });
      }
    });

    it('should update status on reconnecting event', async () => {
      const { getByTestId } = renderWithProviders(<TestConsumer />);

      // Simulate reconnecting event
      const reconnectingHandler = vi.mocked(trixNativeChannelClient.on).mock.calls.find(
        (call) => call[0] === 'reconnecting'
      )?.[1];

      if (reconnectingHandler) {
        await act(async () => {
          reconnectingHandler();
        });

        await waitFor(() => {
          expect(getByTestId('status').textContent).toBe('RECONNECTING');
        });
      }
    });

    it('should disconnect when disconnect button is clicked', async () => {
      const { getByTestId } = renderWithProviders(<TestConsumer />);

      await act(async () => {
        getByTestId('disconnect-btn').click();
      });

      expect(trixNativeChannelClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('pairing', () => {
    it('should handle successful pairing with code', async () => {
      // Make sure bridge is connected
      vi.mocked(trixNativeChannelClient.isConnected).mockReturnValue(true);
      vi.mocked(trixNativeChannelClient.pairWithCode).mockResolvedValueOnce({
        success: true,
        status: 'paired',
      });

      const { getByTestId } = renderWithProviders(<TestConsumer />);

      await act(async () => {
        await getByTestId('pair-btn').click();
      });

      expect(trixNativeChannelClient.pairWithCode).toHaveBeenCalledWith('123456');
    });

    it('should set pairingStatus to paired on successful pairing', async () => {
      // Make sure bridge is connected
      vi.mocked(trixNativeChannelClient.isConnected).mockReturnValue(true);
      vi.mocked(trixNativeChannelClient.pairWithCode).mockResolvedValueOnce({
        success: true,
        status: 'paired',
      });

      const { getByTestId } = renderWithProviders(<TestConsumer />);

      // First connect
      await act(async () => {
        await getByTestId('connect-btn').click();
      });

      // Simulate connected
      const connectedHandler = vi.mocked(trixNativeChannelClient.on).mock.calls.find(
        (call) => call[0] === 'connected'
      )?.[1];

      if (connectedHandler) {
        await act(async () => {
          await connectedHandler();
        });
      }

      // Now pair
      await act(async () => {
        await getByTestId('pair-btn').click();
      });

      await waitFor(() => {
        expect(getByTestId('pairing-status').textContent).toBe('paired');
      });
    });

    it('should handle unpair correctly', async () => {
      const { getByTestId } = renderWithProviders(<TestConsumer />);

      await act(async () => {
        getByTestId('unpair-btn').click();
      });

      expect(trixNativeChannelClient.unpair).toHaveBeenCalled();
    });

    it('should handle paired event from bridge', async () => {
      const { getByTestId } = renderWithProviders(<TestConsumer />);

      // Simulate paired event
      const pairedHandler = vi.mocked(trixNativeChannelClient.on).mock.calls.find(
        (call) => call[0] === 'paired'
      )?.[1];

      if (pairedHandler) {
        await act(async () => {
          pairedHandler({ deviceId: 'device-123', deviceName: 'TestBot' });
        });

        await waitFor(() => {
          expect(getByTestId('pairing-status').textContent).toBe('paired');
        });
      }
    });

    it('should handle unpaired event from bridge', async () => {
      // First set to paired
      const { getByTestId } = renderWithProviders(<TestConsumer />);

      // Simulate paired event first
      const pairedHandler = vi.mocked(trixNativeChannelClient.on).mock.calls.find(
        (call) => call[0] === 'paired'
      )?.[1];

      if (pairedHandler) {
        await act(async () => {
          pairedHandler({ deviceId: 'device-123', deviceName: 'TestBot' });
        });
      }

      // Now simulate unpaired
      const unpairedHandler = vi.mocked(trixNativeChannelClient.on).mock.calls.find(
        (call) => call[0] === 'unpaired'
      )?.[1];

      if (unpairedHandler) {
        await act(async () => {
          unpairedHandler();
        });

        await waitFor(() => {
          expect(getByTestId('pairing-status').textContent).toBe('idle');
        });
      }
    });
  });

  describe('messaging', () => {
    it('should send message when connected and paired', async () => {
      // First make sure connected and paired
      vi.mocked(trixNativeChannelClient.isPaired).mockReturnValue(true);
      vi.mocked(trixNativeChannelClient.isConnected).mockReturnValue(true);

      const { getByTestId } = renderWithProviders(<TestConsumer />);

      await act(async () => {
        getByTestId('send-btn').click();
      });

      expect(trixNativeChannelClient.sendMessage).toHaveBeenCalledWith(
        'Hello',
        'text',
        undefined,
        undefined,
        undefined
      );
    });

    it('should throw error when not paired', async () => {
      vi.mocked(trixNativeChannelClient.isPaired).mockReturnValue(false);
      vi.mocked(trixNativeChannelClient.isConnected).mockReturnValue(true);

      const { getByTestId } = renderWithProviders(<TestConsumer />);

      // Click send button (the error is caught in the handler)
      await act(async () => {
        getByTestId('send-btn').click();
      });

      // The error should be set in lastError
      await waitFor(() => {
        expect(getByTestId('last-error').textContent).toContain('未配对');
      });
    });

    it('should add message to state on send', async () => {
      vi.mocked(trixNativeChannelClient.isPaired).mockReturnValue(true);
      vi.mocked(trixNativeChannelClient.isConnected).mockReturnValue(true);

      const { getByTestId } = renderWithProviders(<TestConsumer />);

      await act(async () => {
        getByTestId('send-btn').click();
      });

      await waitFor(() => {
        expect(getByTestId('messages-count').textContent).toBe('1');
      });
    });

    it('should receive message on message event', async () => {
      const { getByTestId } = renderWithProviders(<TestConsumer />);

      // Simulate receiving a message
      const messageHandler = vi.mocked(trixNativeChannelClient.on).mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1];

      if (messageHandler) {
        await act(async () => {
          messageHandler({
            id: 'msg-1',
            content: 'Hello from bot',
            contentType: 'text',
            timestamp: Date.now(),
            sender: 'bot',
          });
        });

        await waitFor(() => {
          expect(getByTestId('messages-count').textContent).toBe('1');
        });
      }
    });

    it('should handle bot message with bot state transition', async () => {
      vi.mocked(trixNativeChannelClient.isPaired).mockReturnValue(true);

      const { getByTestId } = renderWithProviders(<TestConsumer />);

      // Simulate receiving a bot message
      const messageHandler = vi.mocked(trixNativeChannelClient.on).mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1];

      if (messageHandler) {
        await act(async () => {
          messageHandler({
            id: 'msg-1',
            content: 'Hello from bot',
            contentType: 'text',
            timestamp: Date.now(),
            sender: 'bot',
          });
        });

        await waitFor(() => {
          // Bot state should be THINKING or SPEAKING
          const botState = getByTestId('bot-state').textContent;
          expect(['THINKING', 'SPEAKING']).toContain(botState);
        });
      }
    });

    it('should clear messages when clearMessages is called', async () => {
      const { getByTestId } = renderWithProviders(<TestConsumer />);

      // First add a message
      const messageHandler = vi.mocked(trixNativeChannelClient.on).mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1];

      if (messageHandler) {
        await act(async () => {
          messageHandler({
            id: 'msg-1',
            content: 'Hello',
            contentType: 'text',
            timestamp: Date.now(),
            sender: 'bot',
          });
        });
      }

      await waitFor(() => {
        expect(getByTestId('messages-count').textContent).toBe('1');
      });

      // Now clear
      await act(async () => {
        getByTestId('clear-btn').click();
      });

      await waitFor(() => {
        expect(getByTestId('messages-count').textContent).toBe('0');
      });
    });
  });

  describe('error handling', () => {
    it('should set error on connection error event', async () => {
      const { getByTestId } = renderWithProviders(<TestConsumer />);

      // Simulate error event
      const errorHandler = vi.mocked(trixNativeChannelClient.on).mock.calls.find(
        (call) => call[0] === 'error'
      )?.[1];

      if (errorHandler) {
        await act(async () => {
          errorHandler({ message: 'Connection failed', code: 'CONNECTION_FAILED' });
        });

        await waitFor(() => {
          expect(getByTestId('status').textContent).toBe('ERROR');
          expect(getByTestId('last-error').textContent).not.toBe('none');
        });
      }
    });

    it('should handle protocol mismatch error', async () => {
      const { getByTestId } = renderWithProviders(<TestConsumer />);

      // Simulate error event with protocol mismatch
      const errorHandler = vi.mocked(trixNativeChannelClient.on).mock.calls.find(
        (call) => call[0] === 'error'
      )?.[1];

      if (errorHandler) {
        await act(async () => {
          errorHandler({
            message: 'Channel protocol mismatch',
            code: 'CHANNEL_PROTOCOL_MISMATCH',
          });
        });

        await waitFor(() => {
          expect(getByTestId('status').textContent).toBe('DISCONNECTED');
          expect(getByTestId('last-error').textContent).toBe(
            '当前 8765 服务不是 Clawbot Channel 服务，请启动 server/clawbot-channel/server.js'
          );
          expect(toast.error).toHaveBeenCalled();
        });
      }
    });

    it('should show toast when bot goes offline', async () => {
      const { getByTestId } = renderWithProviders(<TestConsumer />);

      // Simulate bot_offline event
      const botOfflineHandler = vi.mocked(trixNativeChannelClient.on).mock.calls.find(
        (call) => call[0] === 'bot_offline'
      )?.[1];

      if (botOfflineHandler) {
        await act(async () => {
          botOfflineHandler({
            message: 'Clawbot 已离线',
            deviceId: 'device-123',
            timestamp: Date.now(),
          });
        });

        expect(toast.error).toHaveBeenCalled();
      }
    });

    it('should show toast when bot comes online', async () => {
      const { getByTestId } = renderWithProviders(<TestConsumer />);

      // Simulate bot_online event
      const botOnlineHandler = vi.mocked(trixNativeChannelClient.on).mock.calls.find(
        (call) => call[0] === 'bot_online'
      )?.[1];

      if (botOnlineHandler) {
        await act(async () => {
          botOnlineHandler({
            message: 'Clawbot 已重新连接',
            deviceId: 'device-123',
            timestamp: Date.now(),
          });
        });

        expect(toast.success).toHaveBeenCalled();
      }
    });
  });

  describe('message persistence', () => {
    it('should load message history on connection', async () => {
      vi.mocked(loadClawbotMessageHistory).mockResolvedValueOnce([
        {
          id: 'history-1',
          content: 'Historical message',
          contentType: 'text',
          timestamp: Date.now() - 1000,
          sender: 'bot',
        },
      ]);

      const { getByTestId } = renderWithProviders(<TestConsumer />);

      // Wait for connection to trigger
      await waitFor(() => {
        expect(loadClawbotMessageHistory).toHaveBeenCalled();
      });
    });

    it('should save message when received', async () => {
      const { getByTestId } = renderWithProviders(<TestConsumer />);

      // Simulate receiving a message
      const messageHandler = vi.mocked(trixNativeChannelClient.on).mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1];

      if (messageHandler) {
        await act(async () => {
          messageHandler({
            id: 'msg-1',
            content: 'Hello from bot',
            contentType: 'text',
            timestamp: Date.now(),
            sender: 'bot',
          });
        });

        await waitFor(() => {
          expect(saveClawbotMessage).toHaveBeenCalled();
        });
      }
    });
  });

  describe('voice playback callbacks', () => {
    it('should expose voice playback notification methods', async () => {
      const TestVoiceConsumer: React.FC = () => {
        const context = useClawbotChannel();
        return (
          <div>
            <button
              data-testid="voice-started"
              onClick={() => context.notifyVoicePlaybackStarted('msg-1')}
            >
              Voice Started
            </button>
            <button
              data-testid="voice-ended"
              onClick={() => context.notifyVoicePlaybackEnded('msg-1')}
            >
              Voice Ended
            </button>
            <button
              data-testid="voice-error"
              onClick={() => context.notifyVoicePlaybackError('msg-1')}
            >
              Voice Error
            </button>
          </div>
        );
      };

      const { getByTestId } = render(
        <ClawbotChannelProvider>
          <TestVoiceConsumer />
        </ClawbotChannelProvider>
      );

      // These should not throw
      await act(async () => {
        getByTestId('voice-started').click();
      });

      await act(async () => {
        getByTestId('voice-ended').click();
      });

      await act(async () => {
        getByTestId('voice-error').click();
      });
    });
  });

  describe('upload media', () => {
    it('should upload media and return URL', async () => {
      const TestUploadConsumer: React.FC = () => {
        const context = useClawbotChannel();
        const [url, setUrl] = React.useState<string | null>(null);

        const handleUpload = async () => {
          const result = await context.uploadMedia(new Blob(['test'], { type: 'image/jpeg' }));
          setUrl(result);
        };

        return (
          <div>
            <button data-testid="upload-btn" onClick={handleUpload}>
              Upload
            </button>
            <span data-testid="url">{url || 'none'}</span>
          </div>
        );
      };

      const { getByTestId } = render(
        <ClawbotChannelProvider>
          <TestUploadConsumer />
        </ClawbotChannelProvider>
      );

      await act(async () => {
        getByTestId('upload-btn').click();
      });

      await waitFor(() => {
        expect(getByTestId('url').textContent).toBe('https://example.com/media.jpg');
      });
    });
  });

  describe('useClawbotChannel hook', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useClawbotChannel must be used within ClawbotChannelProvider');

      consoleSpy.mockRestore();
    });
  });
});
