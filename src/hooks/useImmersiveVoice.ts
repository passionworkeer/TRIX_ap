import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';
import { useVoiceSettings } from '../contexts/VoiceSettingsContext';
import { synthesizeSpeech } from '../services/ttsService';
import {
  isAudioUnlocked,
  playFromBlob,
  stopCurrent,
  subscribeAudioUnlocked,
} from '../services/voicePlaybackService';

const WELCOME_SESSION_KEY_PREFIX = 'trix_voice_welcome_session';
const THINKING_TIMEOUT_MS = 25000;

type SceneTask = {
  scene: 'welcome' | 'status';
  text: string;
  sessionKey?: string;
};

type BotReplyTask = {
  messageId: string;
  content: string;
};

type ActiveBotTask = {
  messageId: string;
  controller: AbortController;
  watchdogTimer: ReturnType<typeof setTimeout> | null;
};

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
    hasSessionConversationStarted,
    notifyVoicePlaybackStarted,
    notifyVoicePlaybackEnded,
    notifyVoicePlaybackError,
  } = useClawbotChannel();
  const { voiceEnabled } = useVoiceSettings();

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSpokenBotMessageIdRef = useRef<string | null>(null);
  const activePlaybackMessageIdRef = useRef<string | null>(null);
  const activeBotTaskRef = useRef<ActiveBotTask | null>(null);
  const previousPairedRef = useRef<boolean | null>(null);
  const previousUserIdRef = useRef<string | null>(user?.id ?? null);
  const sceneQueueRef = useRef<SceneTask[]>([]);
  const latestBotReplyTaskRef = useRef<BotReplyTask | null>(null);
  const isDrainingRef = useRef(false);
  const drainScheduledRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const voiceEnabledRef = useRef(voiceEnabled);
  const userIdRef = useRef<string | null>(user?.id ?? null);
  const hasSessionConversationStartedRef = useRef(hasSessionConversationStarted);

  // Keep critical gate flags in sync during render to avoid unlock/send race windows.
  voiceEnabledRef.current = voiceEnabled;
  userIdRef.current = user?.id ?? null;
  hasSessionConversationStartedRef.current = hasSessionConversationStarted;

  const stopCurrentPlayback = useCallback((notifyError: boolean) => {
    const activeBotTask = activeBotTaskRef.current;
    const activeMessageId = activePlaybackMessageIdRef.current || activeBotTask?.messageId || null;

    if (activeBotTask?.watchdogTimer) {
      clearTimeout(activeBotTask.watchdogTimer);
      activeBotTask.watchdogTimer = null;
    }
    activeBotTask?.controller.abort();

    if (abortControllerRef.current && abortControllerRef.current !== activeBotTask?.controller) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = null;
    activeBotTaskRef.current = null;
    stopCurrent('interrupt');

    if (notifyError && activeMessageId) {
      notifyVoicePlaybackError(activeMessageId);
    }
    activePlaybackMessageIdRef.current = null;
  }, [notifyVoicePlaybackError]);

  const executeSceneTask = useCallback(async (task: SceneTask): Promise<void> => {
    if (!voiceEnabledRef.current || !userIdRef.current) {
      return;
    }
    if (task.scene === 'welcome' && hasSessionConversationStartedRef.current) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const blob = await synthesizeSpeech(task.text, task.scene, undefined, controller.signal);
      if (controller.signal.aborted || isUnmountedRef.current) {
        return;
      }
      await playFromBlob(blob, {
        onStart: () => {
          if (task.scene === 'welcome' && task.sessionKey) {
            sessionStorage.setItem(task.sessionKey, '1');
          }
        },
      });
    } catch {
      // Silent fail for welcome/status announcements.
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, []);

  const clearBotWatchdog = useCallback((messageId: string): void => {
    const activeBotTask = activeBotTaskRef.current;
    if (!activeBotTask || activeBotTask.messageId !== messageId || !activeBotTask.watchdogTimer) {
      return;
    }

    clearTimeout(activeBotTask.watchdogTimer);
    activeBotTask.watchdogTimer = null;
  }, []);

  const handleBotReplyTimeout = useCallback((messageId: string): void => {
    const activeBotTask = activeBotTaskRef.current;
    if (!activeBotTask || activeBotTask.messageId !== messageId) {
      return;
    }

    clearBotWatchdog(messageId);
    activeBotTask.controller.abort();

    if (abortControllerRef.current === activeBotTask.controller) {
      abortControllerRef.current = null;
    }
    activeBotTaskRef.current = null;

    if (latestBotReplyTaskRef.current?.messageId === messageId) {
      latestBotReplyTaskRef.current = null;
    }

    stopCurrent('interrupt');
    activePlaybackMessageIdRef.current = null;
    notifyVoicePlaybackError(messageId);
  }, [clearBotWatchdog, notifyVoicePlaybackError]);

  const executeBotReplyTask = useCallback(async (task: BotReplyTask): Promise<void> => {
    if (!voiceEnabledRef.current || !userIdRef.current) {
      return;
    }

    const controller = new AbortController();
    const watchdogTimer = setTimeout(() => {
      handleBotReplyTimeout(task.messageId);
    }, THINKING_TIMEOUT_MS);

    activeBotTaskRef.current = {
      messageId: task.messageId,
      controller,
      watchdogTimer,
    };
    abortControllerRef.current = controller;

    const isActiveTask = () => activeBotTaskRef.current?.messageId === task.messageId;

    try {
      const blob = await synthesizeSpeech(task.content, 'bot_reply', task.messageId, controller.signal);
      if (controller.signal.aborted || !isActiveTask() || isUnmountedRef.current) {
        return;
      }

      await playFromBlob(blob, {
        onStart: () => {
          if (!isActiveTask()) {
            return;
          }
          clearBotWatchdog(task.messageId);
          activePlaybackMessageIdRef.current = task.messageId;
          notifyVoicePlaybackStarted(task.messageId);
        },
        onEnded: () => {
          const wasPlayingTask = activePlaybackMessageIdRef.current === task.messageId;
          if (!isActiveTask() && !wasPlayingTask) {
            return;
          }

          clearBotWatchdog(task.messageId);
          activePlaybackMessageIdRef.current = null;
          if (isActiveTask()) {
            if (abortControllerRef.current === controller) {
              abortControllerRef.current = null;
            }
            activeBotTaskRef.current = null;
          }
          notifyVoicePlaybackEnded(task.messageId);
        },
        onError: () => {
          const wasPlayingTask = activePlaybackMessageIdRef.current === task.messageId;
          if (!isActiveTask() && !wasPlayingTask) {
            return;
          }

          clearBotWatchdog(task.messageId);
          activePlaybackMessageIdRef.current = null;
          if (isActiveTask()) {
            if (abortControllerRef.current === controller) {
              abortControllerRef.current = null;
            }
            activeBotTaskRef.current = null;
          }
          notifyVoicePlaybackError(task.messageId);
        },
      });
    } catch {
      if (controller.signal.aborted || !isActiveTask()) {
        return;
      }

      clearBotWatchdog(task.messageId);
      activePlaybackMessageIdRef.current = null;
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      activeBotTaskRef.current = null;
      notifyVoicePlaybackError(task.messageId);
    } finally {
      clearBotWatchdog(task.messageId);
      if (activeBotTaskRef.current?.messageId === task.messageId) {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        activeBotTaskRef.current = null;
      }
    }
  }, [
    clearBotWatchdog,
    handleBotReplyTimeout,
    notifyVoicePlaybackEnded,
    notifyVoicePlaybackError,
    notifyVoicePlaybackStarted,
  ]);

  const drainQueue = useCallback(async (): Promise<void> => {
    if (isDrainingRef.current) {
      return;
    }
    if (!voiceEnabledRef.current || !userIdRef.current || !isAudioUnlocked()) {
      return;
    }

    isDrainingRef.current = true;
    try {
      while (!isUnmountedRef.current) {
        if (!voiceEnabledRef.current || !userIdRef.current || !isAudioUnlocked()) {
          break;
        }

        const nextSceneTask = sceneQueueRef.current.shift();
        if (nextSceneTask) {
          await executeSceneTask(nextSceneTask);
          continue;
        }

        const nextBotReplyTask = latestBotReplyTaskRef.current;
        if (nextBotReplyTask) {
          latestBotReplyTaskRef.current = null;
          await executeBotReplyTask(nextBotReplyTask);
          continue;
        }

        break;
      }
    } finally {
      isDrainingRef.current = false;

      if (
        !isUnmountedRef.current &&
        voiceEnabledRef.current &&
        userIdRef.current &&
        isAudioUnlocked() &&
        (sceneQueueRef.current.length > 0 || latestBotReplyTaskRef.current)
      ) {
        setTimeout(() => {
          void drainQueue();
        }, 0);
      }
    }
  }, [executeBotReplyTask, executeSceneTask]);

  const requestDrain = useCallback(() => {
    if (drainScheduledRef.current) {
      return;
    }

    drainScheduledRef.current = true;
    setTimeout(() => {
      drainScheduledRef.current = false;
      void drainQueue();
    }, 0);
  }, [drainQueue]);

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      sceneQueueRef.current = [];
      latestBotReplyTaskRef.current = null;
      stopCurrentPlayback(false);
    };
  }, [stopCurrentPlayback]);

  useEffect(() => {
    if (voiceEnabled) {
      return;
    }
    sceneQueueRef.current = [];
    latestBotReplyTaskRef.current = null;
    stopCurrentPlayback(true);
  }, [voiceEnabled, stopCurrentPlayback]);

  useEffect(() => {
    if (!hasSessionConversationStarted) {
      return;
    }
    sceneQueueRef.current = sceneQueueRef.current.filter((task) => task.scene !== 'welcome');
  }, [hasSessionConversationStarted]);

  useEffect(() => {
    if (!voiceEnabled) {
      return;
    }

    const unsubscribe = subscribeAudioUnlocked(() => {
      requestDrain();
    });

    if (isAudioUnlocked()) {
      requestDrain();
    }

    return () => {
      unsubscribe();
    };
  }, [requestDrain, voiceEnabled]);

  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (currentUserId === previousUserIdRef.current) {
      return;
    }

    sceneQueueRef.current = [];
    latestBotReplyTaskRef.current = null;
    lastSpokenBotMessageIdRef.current = null;
    previousPairedRef.current = null;
    stopCurrentPlayback(false);
    previousUserIdRef.current = currentUserId;
  }, [stopCurrentPlayback, user?.id]);

  useEffect(() => {
    if (!voiceEnabled || !user?.id || hasSessionConversationStarted) {
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

    const hasQueuedWelcome = sceneQueueRef.current.some(
      (task) => task.scene === 'welcome' && task.sessionKey === sessionKey
    );
    if (hasQueuedWelcome) {
      return;
    }

    sceneQueueRef.current.push({
      scene: 'welcome',
      text: buildWelcomeText(profile?.username),
      sessionKey,
    });
    requestDrain();
  }, [
    hasSessionConversationStarted,
    location.pathname,
    profile?.username,
    requestDrain,
    user?.id,
    voiceEnabled,
  ]);

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
      sceneQueueRef.current.push({
        scene: 'status',
        text: statusText,
      });
      requestDrain();
    }

    previousPairedRef.current = isPaired;
  }, [isPaired, requestDrain, user?.id, voiceEnabled]);

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

    latestBotReplyTaskRef.current = {
      messageId,
      content: latestBotMessage.content,
    };
    requestDrain();
  }, [
    botState,
    latestBotMessage,
    requestDrain,
    voiceEnabled,
  ]);
}
