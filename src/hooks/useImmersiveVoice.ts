import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';
import { useVoiceSettings } from '../contexts/VoiceSettingsContext';
import { synthesizeSpeech } from '../services/ttsService';
import { playFromBlob, stopCurrent } from '../services/voicePlaybackService';

const WELCOME_SESSION_KEY_PREFIX = 'trix_voice_welcome_session';

function resolveMessageId(messageId: string | undefined, timestamp: number): string {
  if (messageId && messageId.length > 0) {
    return messageId;
  }
  return `bot-${timestamp}`;
}

function buildWelcomeText(username?: string): string {
  if (username) {
    return `Hello ${username}, I am TRIX. What would you like to learn today?`;
  }
  return 'Hello, I am TRIX. What would you like to learn today?';
}

export function useImmersiveVoice(): void {
  const location = useLocation();
  const { user, profile } = useAuth();
  const {
    latestBotMessage,
    isPaired,
    botState,
    notifyVoicePlaybackStarted,
    notifyVoicePlaybackEnded,
    notifyVoicePlaybackError,
  } = useClawbotChannel();
  const { voiceEnabled } = useVoiceSettings();

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSpokenBotMessageIdRef = useRef<string | null>(null);
  const activePlaybackMessageIdRef = useRef<string | null>(null);
  const previousPairedRef = useRef<boolean | null>(null);

  const stopCurrentPlayback = useCallback((notifyError: boolean) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    stopCurrent('interrupt');

    if (notifyError && activePlaybackMessageIdRef.current) {
      notifyVoicePlaybackError(activePlaybackMessageIdRef.current);
    }
    activePlaybackMessageIdRef.current = null;
  }, [notifyVoicePlaybackError]);

  const playSceneVoice = useCallback(async (
    text: string,
    scene: 'welcome' | 'status'
  ) => {
    stopCurrentPlayback(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const blob = await synthesizeSpeech(text, scene, undefined, controller.signal);
      if (controller.signal.aborted) {
        return;
      }
      await playFromBlob(blob);
    } catch {
      // Silent fail for welcome/status announcements.
    }
  }, [stopCurrentPlayback]);

  useEffect(() => {
    return () => {
      stopCurrentPlayback(false);
    };
  }, [stopCurrentPlayback]);

  useEffect(() => {
    if (voiceEnabled) {
      return;
    }
    stopCurrentPlayback(true);
  }, [voiceEnabled, stopCurrentPlayback]);

  useEffect(() => {
    if (!voiceEnabled || !user?.id) {
      return;
    }

    const isAuthRoute = location.pathname === '/login' || location.pathname === '/register';
    if (isAuthRoute) {
      return;
    }

    const sessionKey = `${WELCOME_SESSION_KEY_PREFIX}:${user.id}`;
    if (sessionStorage.getItem(sessionKey) === '1') {
      return;
    }

    sessionStorage.setItem(sessionKey, '1');
    void playSceneVoice(buildWelcomeText(profile?.username), 'welcome');
  }, [location.pathname, playSceneVoice, profile?.username, user?.id, voiceEnabled]);

  useEffect(() => {
    if (!user?.id) {
      previousPairedRef.current = null;
      return;
    }

    if (!voiceEnabled) {
      previousPairedRef.current = isPaired;
      return;
    }

    const previous = previousPairedRef.current;
    if (previous === null) {
      previousPairedRef.current = isPaired;
      return;
    }

    if (previous !== isPaired) {
      const statusText = isPaired
        ? 'TRIX Bot is connected.'
        : 'TRIX Bot is disconnected.';
      void playSceneVoice(statusText, 'status');
    }

    previousPairedRef.current = isPaired;
  }, [isPaired, playSceneVoice, user?.id, voiceEnabled]);

  useEffect(() => {
    if (!voiceEnabled || !latestBotMessage || latestBotMessage.sender !== 'bot') {
      return;
    }

    if (botState === 'IDLE') {
      return;
    }

    const messageId = resolveMessageId(latestBotMessage.id, latestBotMessage.timestamp);
    if (lastSpokenBotMessageIdRef.current === messageId) {
      return;
    }
    lastSpokenBotMessageIdRef.current = messageId;

    stopCurrentPlayback(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    activePlaybackMessageIdRef.current = messageId;

    void synthesizeSpeech(latestBotMessage.content, 'bot_reply', messageId, controller.signal)
      .then(async (blob) => {
        if (controller.signal.aborted) {
          return;
        }

        await playFromBlob(blob, {
          onStart: () => {
            notifyVoicePlaybackStarted(messageId);
          },
          onEnded: () => {
            notifyVoicePlaybackEnded(messageId);
            activePlaybackMessageIdRef.current = null;
          },
          onError: () => {
            notifyVoicePlaybackError(messageId);
            activePlaybackMessageIdRef.current = null;
          },
        });
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }
        notifyVoicePlaybackError(messageId);
        activePlaybackMessageIdRef.current = null;
      });
  }, [
    botState,
    latestBotMessage,
    notifyVoicePlaybackEnded,
    notifyVoicePlaybackError,
    notifyVoicePlaybackStarted,
    stopCurrentPlayback,
    voiceEnabled,
  ]);
}
