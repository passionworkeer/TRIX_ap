import { useState, useCallback, useRef, useEffect } from 'react';
import type { ClawbotChannelMessage } from '../services/ClawbotChannelBridge';

export type BotState = 'IDLE' | 'THINKING' | 'SPEAKING';

interface UseBotStateMachineOptions {
  /** 是否启用语音模式 */
  voiceEnabled?: boolean;
  /** 最新机器人消息 */
  latestBotMessage?: ClawbotChannelMessage | null;
  /** 机器人状态变化回�?*/
  onStateChange?: (state: BotState) => void;
}

interface UseBotStateMachineReturn {
  /** 当前状�?*/
  botState: BotState;
  /** 进入空闲状�?*/
  enterIdle: () => void;
  /** 进入思考状�?*/
  enterThinking: () => void;
  /** 进入说话状态（带超时） */
  enterSpeakingWithTimeout: (message: ClawbotChannelMessage) => void;
  /** 处理机器人消息状�?*/
  handleBotMessageState: (message: ClawbotChannelMessage) => void;
  /** 清理所有超�?*/
  cleanup: () => void;
}

const SPEAKING_MIN_MS = 1200;
const SPEAKING_MAX_MS = 12000;
const SPEAKING_BASE_MS = 800;
const SPEAKING_PER_CHAR_MS = 45;

/**
 * useBotStateMachine - 机器人状态机 Hook
 *
 * 管理 Clawbot 的状态转换：IDLE �?THINKING �?SPEAKING �?IDLE
 */
export function useBotStateMachine(options: UseBotStateMachineOptions = {}): UseBotStateMachineReturn {
  const { voiceEnabled = false, latestBotMessage, onStateChange } = options;

  const [botState, setBotState] = useState<BotState>('IDLE');

  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thinkingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeVoiceMessageIdRef = useRef<string | null>(null);
  const pendingVoiceMessageIdRef = useRef<string | null>(null);

  // 通知状态变�?
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

  // 组件卸载时清�?
  useEffect(() => {
    return () => {
      cleanup();
    };
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
    // 注意：已移除默认超时自动切回 IDLE 的逻辑
    // 现在完全由外部传入的实际消息事件去打�?THINKING 状�?
  }, [clearSpeakingTimeout, clearThinkingTimeout]);

  const enterSpeakingWithTimeout = useCallback((message: ClawbotChannelMessage) => {
    clearSpeakingTimeout();
    clearThinkingTimeout();
    setBotState('SPEAKING');

    const contentLength = message.content.length;
    const durationMs = Math.min(
      Math.max(SPEAKING_BASE_MS + contentLength * SPEAKING_PER_CHAR_MS, SPEAKING_MIN_MS),
      SPEAKING_MAX_MS
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
  }, [voiceEnabled, enterSpeakingWithTimeout]);

  // 语音模式切换时处�?
  useEffect(() => {
    if (voiceEnabled) return;
    if (botState !== 'THINKING' || !latestBotMessage) return;

    const latestMessageId = latestBotMessage.id || `bot-${latestBotMessage.timestamp}`;
    if (pendingVoiceMessageIdRef.current !== latestMessageId) return;

    enterSpeakingWithTimeout(latestBotMessage);
  }, [botState, enterSpeakingWithTimeout, latestBotMessage, voiceEnabled]);

  return {
    botState,
    enterIdle,
    enterThinking,
    enterSpeakingWithTimeout,
    handleBotMessageState,
    cleanup
  };
}

