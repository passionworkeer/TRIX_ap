import { useState, useCallback, useRef, useEffect } from 'react';
import type { ClawbotChannelMessage } from '../types/clawbotChannel';

export type BotState = 'IDLE' | 'THINKING' | 'SPEAKING';

interface UseBotStateMachineOptions {
  voiceEnabled?: boolean;
  latestBotMessage?: ClawbotChannelMessage | null;
  onStateChange?: (state: BotState) => void;
}

interface UseBotStateMachineReturn {
  botState: BotState;
  enterIdle: () => void;
  enterThinking: () => void;
  enterSpeakingWithTimeout: (message: ClawbotChannelMessage) => void;
  handleBotMessageState: (message: ClawbotChannelMessage) => void;
  cleanup: () => void;
}

const SPEAKING_MIN_MS = 1200;
const SPEAKING_MAX_MS = 12000;
const SPEAKING_BASE_MS = 800;
const SPEAKING_PER_CHAR_MS = 45;

export function useBotStateMachine(options: UseBotStateMachineOptions = {}): UseBotStateMachineReturn {
  const { voiceEnabled = false, latestBotMessage, onStateChange } = options;
  const [botState, setBotState] = useState<BotState>('IDLE');

  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thinkingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeVoiceMessageIdRef = useRef<string | null>(null);
  const pendingVoiceMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    onStateChange?.(botState);
  }, [botState, onStateChange]);

  const clearSpeakingTimeout = useCallback(() => {
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }
  }, []);

  const clearThinkingTimeout = useCallback(() => {
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current);
      thinkingTimeoutRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    clearSpeakingTimeout();
    clearThinkingTimeout();
  }, [clearSpeakingTimeout, clearThinkingTimeout]);

  useEffect(() => () => {
    cleanup();
  }, [cleanup]);

  const enterIdle = useCallback(() => {
    clearSpeakingTimeout();
    clearThinkingTimeout();
    setBotState('IDLE');
    activeVoiceMessageIdRef.current = null;
    pendingVoiceMessageIdRef.current = null;
  }, [clearSpeakingTimeout, clearThinkingTimeout]);

  const enterThinking = useCallback(() => {
    clearSpeakingTimeout();
    clearThinkingTimeout();
    setBotState('THINKING');
  }, [clearSpeakingTimeout, clearThinkingTimeout]);

  const enterSpeakingWithTimeout = useCallback((message: ClawbotChannelMessage) => {
    clearSpeakingTimeout();
    clearThinkingTimeout();
    setBotState('SPEAKING');

    const contentLength = message.content.length;
    const durationMs = Math.min(
      Math.max(SPEAKING_BASE_MS + contentLength * SPEAKING_PER_CHAR_MS, SPEAKING_MIN_MS),
      SPEAKING_MAX_MS,
    );

    speakingTimeoutRef.current = setTimeout(() => {
      speakingTimeoutRef.current = null;
      setBotState('IDLE');
    }, durationMs);
  }, [clearSpeakingTimeout, clearThinkingTimeout]);

  const handleBotMessageState = useCallback((message: ClawbotChannelMessage) => {
    enterSpeakingWithTimeout(message);

    if (voiceEnabled) {
      const messageId = message.id || `bot-${message.timestamp}`;
      pendingVoiceMessageIdRef.current = messageId;
    }
  }, [enterSpeakingWithTimeout, voiceEnabled]);

  useEffect(() => {
    if (voiceEnabled || botState !== 'THINKING' || !latestBotMessage) {
      return;
    }

    const latestMessageId = latestBotMessage.id || `bot-${latestBotMessage.timestamp}`;
    if (pendingVoiceMessageIdRef.current !== latestMessageId) {
      return;
    }

    enterSpeakingWithTimeout(latestBotMessage);
  }, [botState, enterSpeakingWithTimeout, latestBotMessage, voiceEnabled]);

  return {
    botState,
    enterIdle,
    enterThinking,
    enterSpeakingWithTimeout,
    handleBotMessageState,
    cleanup,
  };
}
