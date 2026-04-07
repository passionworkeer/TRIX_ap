import React, { useEffect, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import {
  canPromptInstall,
  type DeferredInstallPromptEvent,
  shouldShowIosInstallHint,
  isStandaloneMode,
} from '../utils/pwa';

const DISMISS_KEY = 'trix_pwa_install_prompt_dismissed_v1';

interface PwaInstallPromptProps {
  elevated?: boolean;
}

const PwaInstallPrompt: React.FC<PwaInstallPromptProps> = ({ elevated = false }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [displayModeVersion, setDisplayModeVersion] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      window.localStorage.setItem(DISMISS_KEY, '1');
      setDismissed(true);
      setDeferredPrompt(null);
      setShowPrompt(false);
    };

    const refreshDisplayMode = () => {
      setDisplayModeVersion((value) => value + 1);
    };

    const displayModeQuery = window.matchMedia('(display-mode: standalone)');

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('focus', refreshDisplayMode);
    window.addEventListener('pageshow', refreshDisplayMode);

    if (typeof displayModeQuery.addEventListener === 'function') {
      displayModeQuery.addEventListener('change', refreshDisplayMode);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('focus', refreshDisplayMode);
      window.removeEventListener('pageshow', refreshDisplayMode);

      if (typeof displayModeQuery.removeEventListener === 'function') {
        displayModeQuery.removeEventListener('change', refreshDisplayMode);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const standalone = isStandaloneMode(window);
    const iosHintVisible = shouldShowIosInstallHint(window);

    setShowIosHint(iosHintVisible);
    setShowPrompt(!dismissed && !standalone && (iosHintVisible || canPromptInstall(deferredPrompt, window)));
  }, [deferredPrompt, dismissed, displayModeVersion]);

  const dismissPrompt = () => {
    window.localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
    setShowPrompt(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    try {
      await deferredPrompt.prompt();
      const userChoice = await deferredPrompt.userChoice;

      if (userChoice.outcome === 'accepted') {
        dismissPrompt();
      }
    } catch (error) {
      console.warn('[TRIX] Install prompt failed', error);
    } finally {
      setDeferredPrompt(null);
    }
  };

  if (!showPrompt) {
    return null;
  }

  const bottomOffset = elevated
    ? 'calc(112px + env(safe-area-inset-bottom, 0px))'
    : 'calc(16px + env(safe-area-inset-bottom, 0px))';

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[120] px-4"
      style={{ bottom: bottomOffset }}
    >
      <div className="mx-auto max-w-md pointer-events-auto rounded-3xl border border-white/60 bg-white/92 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg">
            {showIosHint ? <Share2 size={20} /> : <Download size={20} />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              {showIosHint ? '把 TRIX 加到 iPhone 主屏幕' : '安装 TRIX 应用'}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {showIosHint
                ? '请在 Safari 点击底部“分享”，然后选择“添加到主屏幕”，安装后会以全屏应用打开。'
                : '安装后可直接从主屏幕启动 TRIX，打开速度更稳定，也更接近原生应用体验。'}
            </p>

            <div className="mt-3 flex items-center gap-2">
              {!showIosHint && deferredPrompt && (
                <button
                  type="button"
                  onClick={() => void handleInstall()}
                  className="touch-manipulation rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
                >
                  立即安装
                </button>
              )}

              <button
                type="button"
                onClick={dismissPrompt}
                className="touch-manipulation rounded-full bg-slate-900/6 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/10"
              >
                {showIosHint ? '知道了' : '稍后'}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={dismissPrompt}
            className="touch-manipulation rounded-full p-1.5 text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-600"
            aria-label="关闭安装提示"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PwaInstallPrompt;
