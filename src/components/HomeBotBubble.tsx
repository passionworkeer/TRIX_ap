import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';
import { iosPressableMotion, iosQuickSpring } from '../utils/iosMotion';

interface HomeBotBubbleProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const IDLE_GREETING_DELAY_MS = 30000;

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

const HomeBotBubble: React.FC<HomeBotBubbleProps> = ({ onClick }) => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const { botState, latestBotMessage, idleEnteredAt, hasSessionConversationStarted } = useClawbotChannel();
  const [showDefaultGreeting, setShowDefaultGreeting] = useState(false);
  const isFreshLaunch = !hasSessionConversationStarted;

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
    <motion.button
      type="button"
      className="fixed top-[15%] right-[5%] z-50 cursor-pointer border-0 bg-transparent p-0 text-left"
      onClick={onClick}
      aria-label="打开 TRIX Bot 会话"
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
              {botState === 'THINKING' ? (
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
  );
};

export default HomeBotBubble;
