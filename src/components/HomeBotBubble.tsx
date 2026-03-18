import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Mic, X, Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { useNotification } from '../hooks/useNotification';
import { useVoiceSettings } from '../contexts/VoiceSettingsContext';
import { audioContextUnlock } from '../services/voicePlaybackService';
import { iosPressableMotion, iosQuickSpring } from '../utils/iosMotion';
import { logger } from '../utils/logger';

interface HomeBotBubbleProps {}

const IDLE_GREETING_DELAY_MS = 30000;
const MAX_HISTORY_MESSAGES = 3;

const TypingIndicator: React.FC = () => (
  <div className="flex items-center gap-1 py-0.5" aria-label="Bot is thinking">
    {[0, 1, 2].map((index) => (
      <span
        key={index}
        className="h-1.5 w-1.5 rounded-full bg-white/90 animate-bounce"
        style={{ animationDelay: `${index * 120}ms` }}
      />
    ))}
  </div>
);

const HomeBotBubble: React.FC<HomeBotBubbleProps> = () => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const { showError } = useNotification();
  const { voiceEnabled, toggleVoiceEnabled } = useVoiceSettings();
  const {
    botState,
    latestBotMessage,
    idleEnteredAt,
    hasSessionConversationStarted,
    messages,
    sendMessage,
  } = useClawbotChannel();

  const [showDefaultGreeting, setShowDefaultGreeting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const isFreshLaunch = !hasSessionConversationStarted;
  const inputRef = useRef<HTMLInputElement>(null);

  // Speech to text
  const {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    isSupported: isSpeechSupported,
  } = useSpeechToText({
    lang: 'zh-CN',
    onResult: (text) => {
      setInputText((prev) => prev + text);
    },
    onError: (error) => {
      showError(error);
    },
  });

  // 最近3条消息
  const recentMessages = useMemo(() => {
    const userAndBot = messages.filter(
      (msg) => msg.sender === 'user' || msg.sender === 'bot'
    );
    return userAndBot.slice(-MAX_HISTORY_MESSAGES);
  }, [messages]);

  // 自动聚焦输入框
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isExpanded]);

  // 语音识别结果同步到输入框
  useEffect(() => {
    if (transcript) {
      setInputText(transcript);
    }
  }, [transcript]);

  // 监听发送消息，发送后自动收起
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    try {
      // 发送消息前解锁音频，确保 TTS 能播放
      try {
        await audioContextUnlock();
      } catch (error) {
        // 静默失败
        logger.debug('HomeBotBubble', 'Audio context unlock failed:', error);
      }

      await sendMessage(text, 'text');
      setInputText('');
      setIsExpanded(false); // 发送后立即收起
    } catch (error) {
      showError('发送消息失败，请重试');
    } finally {
      setIsSending(false);
    }
  }, [inputText, isSending, sendMessage, showError]);

  // 语音按钮处理
  const handleVoicePress = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      setInputText(''); // 清空之前的输入
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // 处理按键
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // 切换展开状态
  const toggleExpanded = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const willExpand = !isExpanded;

      // 用户展开对话框时，解锁音频上下文
      if (willExpand) {
        try {
          await audioContextUnlock();
        } catch (error) {
          // 静默失败，音频会在实际播放时再次尝试解锁
          logger.debug('HomeBotBubble', 'Audio context unlock failed:', error);
        }
      }

      setIsExpanded(willExpand);
    },
    [isExpanded]
  );

  useEffect(() => {
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    if (botState !== 'IDLE') {
      setShowDefaultGreeting(false);
      return () => {
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
        }
      };
    }

    const elapsedMs = Date.now() - idleEnteredAt;
    if (elapsedMs >= IDLE_GREETING_DELAY_MS) {
      setShowDefaultGreeting(true);
      return () => {
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
        }
      };
    }

    setShowDefaultGreeting(false);
    fallbackTimer = setTimeout(() => {
      setShowDefaultGreeting(true);
    }, IDLE_GREETING_DELAY_MS - elapsedMs);

    return () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
    };
  }, [botState, idleEnteredAt, latestBotMessage?.id]);

  const defaultGreeting = useMemo(() => {
    if (profile?.username) {
      return `${t('home.greeting')} ${profile.username}, ${t('home.whatToLearn')}`;
    }
    return `${t('home.greeting')}, ${t('home.whatToLearn')}`;
  }, [profile?.username, t]);

  const bubbleText = useMemo(() => {
    if (botState === 'IDLE' && isFreshLaunch) {
      return defaultGreeting;
    }

    const botText = latestBotMessage?.content?.trim();
    if (!showDefaultGreeting && botText) {
      return botText;
    }
    return defaultGreeting;
  }, [botState, defaultGreeting, isFreshLaunch, latestBotMessage?.content, showDefaultGreeting]);

  return (
    <div className="fixed top-[15%] right-[5%] z-50">
      <AnimatePresence mode="wait">
        {isExpanded ? (
          // 展开模式：对话窗口
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 20 }}
            transition={iosQuickSpring}
            className="ios-glass-surface w-[280px] sm:w-[320px] rounded-2xl border border-white/20 shadow-lg overflow-hidden"
          >
            {/* 头部：关闭按钮 + 语音开关 */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-300 animate-glow-pulse" />
                <span className="text-white text-sm font-medium">TRIX</span>
                {/* 语音状态指示 */}
                {botState === 'SPEAKING' && (
                  <span className="text-xs text-amber-400 animate-pulse">🔊</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {/* 语音开关按钮 */}
                <motion.button
                  type="button"
                  onClick={toggleVoiceEnabled}
                  className={`ios-pressable p-1.5 rounded-full ${
                    voiceEnabled
                      ? 'text-amber-400 hover:text-amber-300'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                  whileTap={{ scale: 0.95 }}
                  aria-label={voiceEnabled ? t('homeBotBubble.voiceOff') : t('homeBotBubble.voiceOn')}
                  title={voiceEnabled ? t('homeBotBubble.voiceBroadcastOn') : t('homeBotBubble.voiceBroadcastOff')}
                >
                  {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </motion.button>
                <motion.button
                  type="button"
                  onClick={toggleExpanded}
                  className="ios-pressable p-1.5 rounded-full text-white/60 hover:text-white"
                  {...iosPressableMotion}
                  aria-label={t('homeBotBubble.closeConversation')}
                >
                  <X size={16} />
                </motion.button>
              </div>
            </div>

            {/* 历史消息 */}
            <div className="max-h-[120px] overflow-y-auto px-3 py-2 space-y-2 bg-black/10">
              {recentMessages.length === 0 ? (
                <p className="text-white/40 text-xs text-center py-2">
                  {t('homeBotBubble.startConversation')}
                </p>
              ) : (
                recentMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`text-xs ${
                      msg.sender === 'user'
                        ? 'text-right text-white/70'
                        : 'text-left text-white'
                    }`}
                  >
                    <span className="font-medium">
                      {msg.sender === 'user' ? '你: ' : 'TRIX: '}
                    </span>
                    <span className="line-clamp-1">
                      {msg.content}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* 输入区域 */}
            <div className="p-3 border-t border-white/10">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={isListening ? (interimTranscript || inputText) : inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isListening ? t('homeBotBubble.listening') : t('homeBotBubble.sendMessage')}
                    className="w-full px-3 py-2 bg-white/10 rounded-full text-white text-sm placeholder-white/40 border border-white/10 focus:outline-none focus:border-white/30"
                  />
                </div>

                {/* 语音按钮 */}
                {isSpeechSupported && (
                  <motion.button
                    type="button"
                    onClick={handleVoicePress}
                    className={`ios-pressable p-2 rounded-full ${
                      isListening
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-white/10 text-white/70 hover:text-white'
                    }`}
                    whileTap={{ scale: 0.95 }}
                    aria-label={isListening ? t('homeBotBubble.stopRecording') : t('homeBotBubble.voiceInput')}
                  >
                    <Mic size={18} />
                  </motion.button>
                )}

                {/* 发送按钮 */}
                <motion.button
                  type="button"
                  onClick={handleSend}
                  disabled={!inputText.trim() || isSending}
                  className={`ios-pressable p-2 rounded-full ${
                    inputText.trim() && !isSending
                      ? 'bg-sky-500 text-white'
                      : 'bg-white/10 text-white/30'
                  }`}
                  whileTap={{ scale: 0.95 }}
                  aria-label={t('homeBotBubble.sendMessageAria')}
                >
                  <Send size={18} />
                </motion.button>
              </div>
            </div>
          </motion.div>
        ) : (
          // 收起模式：小气泡
          <motion.button
            key="collapsed"
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 text-left"
            onClick={toggleExpanded}
            aria-label={t('homeBotBubble.openTrixBot')}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: iosQuickSpring }}
            {...iosPressableMotion}
          >
            <div className="relative max-w-[180px] sm:max-w-[200px]">
              <div className="ios-glass-surface relative rounded-2xl rounded-br-none border border-white/20 p-3 shadow-lg">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-yellow-300 animate-glow-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {botState === 'THINKING' || botState === 'SPEAKING' ? (
                      <TypingIndicator />
                    ) : (
                      <p className="text-white text-xs font-medium leading-relaxed line-clamp-2">
                        {bubbleText}
                      </p>
                    )}
                  </div>
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-sky-300/20 blur-xl pointer-events-none" />
              </div>
              <div
                className="absolute -bottom-1 right-0 h-3 w-3 origin-top-left rotate-45 border-r border-b border-white/20 bg-white/20 backdrop-blur-xl pointer-events-none"
                style={{ clipPath: 'polygon(100% 0, 0 100%, 100% 100%)' }}
              />
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HomeBotBubble;
