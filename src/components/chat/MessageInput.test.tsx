/**
 * Component tests for MessageInput
 *
 * Tests message input renders, handles text change, and submit
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { createFramerMotionMock } from '../../test/framerMotionMock';

vi.mock('framer-motion', () => createFramerMotionMock());

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock child components
vi.mock('../AIActionSelector', () => ({
  default: ({ value, onSelect }: any) => (
    <div data-testid="ai-action-selector">AI Action Selector</div>
  ),
}));

vi.mock('../FileAttachmentCard', () => ({
  default: () => <div data-testid="file-attachment-card">File Card</div>,
}));

// Mock iosMotion
vi.mock('../utils/iosMotion', () => ({
  iosIconButtonMotion: {},
  iosPressableMotion: {},
}));

describe('MessageInput', () => {
  let MessageInput: any;
  const defaultProps = {
    input: '',
    isInputFocused: false,
    isListening: false,
    transcript: '',
    isSpeechSupported: true,
    isBotConversation: true,
    isPaired: true,
    uploadingFile: false,
    attachmentPreviews: [] as any[],
    selectedAIAction: 'chat' as any,
    onInputChange: vi.fn(),
    onInputFocus: vi.fn(),
    onInputBlur: vi.fn(),
    onSend: vi.fn(),
    onFileSelect: vi.fn(),
    onStartListening: vi.fn(),
    onStopListening: vi.fn(),
    onToggleVoiceRecorder: vi.fn(),
    onRemoveAttachment: vi.fn(),
    onAIActionSelect: vi.fn(),
    fileInputRef: { current: null } as any,
    isUploadingVoice: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  beforeAll(async () => {
    MessageInput = (await import('./MessageInput')).default;
  });

  it('should render textarea for input', async () => {
    render(<MessageInput {...defaultProps} />);

    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('should display placeholder text', async () => {
    render(<MessageInput {...defaultProps} />);

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.placeholder).toBeTruthy();
  });

  it('should call onInputChange when text is entered', async () => {
    render(<MessageInput {...defaultProps} />);

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Hello' } });

    expect(defaultProps.onInputChange).toHaveBeenCalledWith('Hello');
  });

  it('should disable send button when input is empty', async () => {
    render(<MessageInput {...defaultProps} input="" />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  it('should enable send button when input has text', async () => {
    render(<MessageInput {...defaultProps} input="Hello" />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).not.toBeDisabled();
  });

  it('should call onSend when send button is clicked', async () => {
    render(<MessageInput {...defaultProps} input="Hello" />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendButton);

    expect(defaultProps.onSend).toHaveBeenCalledWith('Hello');
  });

  it('should call onSend when Enter is pressed', async () => {
    render(<MessageInput {...defaultProps} input="Hello" />);

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(defaultProps.onSend).toHaveBeenCalledWith('Hello');
  });

  it('should enable send button and pass transcript while listening', async () => {
    render(
      <MessageInput
        {...defaultProps}
        input=""
        isListening
        transcript="语音识别内容"
      />,
    );

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).not.toBeDisabled();

    fireEvent.click(sendButton);

    expect(defaultProps.onSend).toHaveBeenCalledWith('语音识别内容');
  });

  it('should send transcript when Enter is pressed while listening', async () => {
    render(
      <MessageInput
        {...defaultProps}
        input=""
        isListening
        transcript="语音识别内容"
      />,
    );

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(defaultProps.onSend).toHaveBeenCalledWith('语音识别内容');
  });

  it('should render attachment button', async () => {
    render(<MessageInput {...defaultProps} />);

    const attachmentButton = screen.getByRole('button', { name: /addAttachment/i });
    expect(attachmentButton).toBeInTheDocument();
  });

  it('should show voice button when isBotConversation and isSpeechSupported', async () => {
    render(
      <MessageInput
        {...defaultProps}
        isBotConversation={true}
        isSpeechSupported={true}
      />
    );

    const voiceButton = screen.getByRole('button', { name: /startVoiceInput/i });
    expect(voiceButton).toBeInTheDocument();
  });

  it('should show voice recorder button when isBotConversation is false', async () => {
    render(
      <MessageInput
        {...defaultProps}
        isBotConversation={false}
      />
    );

    const voiceRecorderButton = screen.getByRole('button', { name: /recordVoiceMessage/i });
    expect(voiceRecorderButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /startVoiceInput/i })).not.toBeInTheDocument();
  });

  it('should call onInputFocus when textarea is focused', async () => {
    render(<MessageInput {...defaultProps} />);

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.focus(textarea);

    expect(defaultProps.onInputFocus).toHaveBeenCalled();
  });

  it('should call onInputBlur when textarea loses focus', async () => {
    vi.useFakeTimers();
    render(<MessageInput {...defaultProps} />);

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.blur(textarea);

    // Component uses setTimeout(() => onInputBlur(), 200)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(defaultProps.onInputBlur).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should render with attachment previews when present', async () => {
    render(
      <MessageInput
        {...defaultProps}
        attachmentPreviews={[
          { uri: 'blob:test', type: 'image/png', category: 'image' as const },
        ]}
      />
    );

    const img = document.querySelector('img');
    expect(img).toBeTruthy();
  });

  it('should disable send button when uploadingFile is true', async () => {
    render(<MessageInput {...defaultProps} input="Hello" uploadingFile={true} />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
  });
});
