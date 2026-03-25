/**
 * Unit tests for ChatDetail screen
 *
 * Minimal tests to verify the screen renders without crashing.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

// Mock ClawbotChannelContext
vi.mock('../contexts/ClawbotChannelContext', () => ({
  useClawbotChannel: () => ({
    isConnected: false,
    isPaired: false,
    isReady: false,
    botState: 'idle',
    messages: [],
    sendMessage: vi.fn(),
    pairWithCode: vi.fn(),
    pairWithQR: vi.fn(),
    unpair: vi.fn(),
    uploadAttachment: vi.fn(),
    status: 'disconnected',
    botOnline: false,
    lastError: null,
  }),
}));

vi.mock('../hooks/useNotification', () => ({
  useNotification: () => ({
    showWarning: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

vi.mock('../utils/errorHandler', () => ({
  useErrorHandler: () => ({ handleError: vi.fn() }),
  getErrorMessage: vi.fn((_e: unknown, fallback: string) => fallback),
}));

vi.mock('../hooks/useSpeechToText', () => ({
  useSpeechToText: vi.fn(() => ({
    isListening: false,
    transcript: '',
    startListening: vi.fn(),
    stopListening: vi.fn(),
    isSupported: false,
  })),
}));

vi.mock('../hooks/useConfirmModal', () => ({
  useConfirmModal: () => ({
    requestConfirm: vi.fn(),
    ConfirmModalRenderer: () => null,
  }),
}));

vi.mock('../components/chat/ChatHeader', () => ({
  default: ({ name, onNavigateBack, onToggleMenu }: any) => (
    <div data-testid="chat-header">
      <span data-testid="chat-header-name">{name}</span>
      <button data-testid="nav-back-btn" onClick={onNavigateBack}>Back</button>
      <button data-testid="toggle-menu-btn" onClick={onToggleMenu}>Menu</button>
    </div>
  ),
}));

vi.mock('../components/chat/MessageList', () => ({
  default: ({ messages, loading }: any) => (
    <div data-testid="message-list">
      {loading && <div data-testid="message-loading">Loading...</div>}
      {messages.map((msg: any) => (
        <div key={msg.id} data-testid={`message-${msg.id}`}>
          {msg.text}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../components/chat/MessageInput', () => ({
  default: ({ input, onInputChange, onSend, onStartListening, onToggleVoiceRecorder, selectedAIAction, isPaired, isBotConversation }: any) => (
    <div data-testid="message-input">
      <input
        data-testid="chat-text-input"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
      />
      <button data-testid="send-btn" onClick={onSend}>Send</button>
      <button data-testid="mic-btn" onClick={onStartListening}>Mic</button>
      <button data-testid="voice-recorder-btn" onClick={onToggleVoiceRecorder}>Voice</button>
      <span data-testid="selected-ai-action">{selectedAIAction}</span>
      <span data-testid="is-paired">{String(isPaired)}</span>
      <span data-testid="is-bot-conversation">{String(isBotConversation)}</span>
    </div>
  ),
}));

vi.mock('../components/VoiceRecorder', () => ({
  default: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="voice-recorder">
        <button data-testid="close-voice-recorder" onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('../services/databaseService', () => ({
  getChatHistory: vi.fn().mockResolvedValue({ messages: [], hasMore: false }),
  sendMessage: vi.fn().mockResolvedValue('msg-id-1'),
  sendMessageWithMedia: vi.fn().mockResolvedValue('msg-id-1'),
  markMessagesAsRead: vi.fn().mockResolvedValue(undefined),
  getFriendById: vi.fn().mockResolvedValue(null),
}));

vi.mock('../services/uploadService', () => ({
  uploadAudio: vi.fn().mockResolvedValue({ uri: 'audio-uri', type: 'audio/webm', size: 1024 }),
  uploadFile: vi.fn().mockResolvedValue({
    uri: 'file-uri',
    type: 'image/jpeg',
    size: 1024,
    metadata: {},
  }),
  IMAGE_COMPRESSION_OPTIONS: {},
  resolveFileCategory: vi.fn().mockReturnValue('image'),
}));

vi.mock('../features/chat/utils/aiPrompt', () => ({
  AIActionId: { Chat: 'chat', Analyze: 'analyze', Extract: 'extract' },
  detectAIActionFromInput: vi.fn().mockReturnValue('chat'),
}));

vi.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    channel: vi.fn(() => ({
      on: vi.fn(() => ({ subscribe: vi.fn() })),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
  getUsersLastActive: vi.fn().mockResolvedValue({}),
}));

vi.mock('../utils/dateFormat', () => ({
  formatTime: vi.fn().mockReturnValue('12:00'),
}));

vi.mock('../config/clawbotEndpoints', () => ({
  getClawbotEndpoints: vi.fn().mockReturnValue({}),
}));

vi.mock('../services/TrixNativeChannelClient', () => ({
  default: {
    getSession: vi.fn().mockReturnValue(null),
  },
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter initialEntries={['/chat/clawbot']}>
    <Routes>
      <Route path="/chat/:friendId" element={children} />
    </Routes>
  </MemoryRouter>
);

describe('ChatDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('renders without crashing', async () => {
    const ChatDetail = (await import('./ChatDetail')).default;
    render(
      <TestWrapper>
        <ChatDetail />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('chat-header')).toBeInTheDocument();
    });
  });

  it('renders chat header with default bot name', async () => {
    const ChatDetail = (await import('./ChatDetail')).default;
    render(
      <TestWrapper>
        <ChatDetail />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('chat-header-name')).toHaveTextContent('TRIX 原生助手');
    });
  });

  it('renders message input area', async () => {
    const ChatDetail = (await import('./ChatDetail')).default;
    render(
      <TestWrapper>
        <ChatDetail />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('message-input')).toBeInTheDocument();
    });
  });

  it('renders message list area', async () => {
    const ChatDetail = (await import('./ChatDetail')).default;
    render(
      <TestWrapper>
        <ChatDetail />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('message-list')).toBeInTheDocument();
    });
  });

  it('allows text input in message field', async () => {
    const ChatDetail = (await import('./ChatDetail')).default;
    render(
      <TestWrapper>
        <ChatDetail />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('chat-text-input')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('chat-text-input'), {
      target: { value: 'Hello TRIX' },
    });

    expect(screen.getByTestId('chat-text-input')).toHaveValue('Hello TRIX');
  });

  it('shows isPaired status in input area', async () => {
    const ChatDetail = (await import('./ChatDetail')).default;
    render(
      <TestWrapper>
        <ChatDetail />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-paired')).toHaveTextContent('false');
    });
  });

  it('opens voice recorder when voice button clicked', async () => {
    const ChatDetail = (await import('./ChatDetail')).default;
    render(
      <TestWrapper>
        <ChatDetail />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('voice-recorder-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('voice-recorder-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('voice-recorder')).toBeInTheDocument();
    });
  });
});
