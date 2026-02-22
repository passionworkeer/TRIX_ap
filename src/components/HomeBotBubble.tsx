import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';

interface HomeBotBubbleProps {
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
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
  const { botState, latestBotMessage, idleEnteredAt } = useClawbotChannel();
  const [showDefaultGreeting, setShowDefaultGreeting] = useState(false);

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
    const botText = latestBotMessage?.content?.trim();
    if (!showDefaultGreeting && botText) {
      return botText;
    }
    return defaultGreeting;
  }, [defaultGreeting, latestBotMessage?.content, showDefaultGreeting]);

  return (
    <div className="fixed top-[15%] right-[5%] z-50 cursor-pointer" onClick={onClick}>
      <div className="relative max-w-[180px] sm:max-w-[200px]">
        <div className="relative bg-white/15 backdrop-blur-xl rounded-2xl rounded-br-none border border-white/25 shadow-lg p-3 hover:shadow-xl hover:scale-[1.02] transition-transform duration-200">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0">
              <Sparkles className="w-4 h-4 text-yellow-400 animate-glow-pulse" />
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
          <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-yellow-400/20 rounded-full blur-lg pointer-events-none" />
        </div>
        <div
          className="absolute -bottom-1 right-0 w-3 h-3 bg-white/15 backdrop-blur-xl border-r border-b border-white/25 transform rotate-45 origin-top-left pointer-events-none"
          style={{ clipPath: 'polygon(100% 0, 0 100%, 100% 100%)' }}
        />
      </div>
    </div>
  );
};

export default HomeBotBubble;
