export interface DeferredInstallPromptEvent extends Event {
  readonly platforms?: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

export function isStandaloneMode(windowRef: Window): boolean {
  const navigatorRef = windowRef.navigator as NavigatorWithStandalone;
  return Boolean(
    navigatorRef.standalone || windowRef.matchMedia('(display-mode: standalone)').matches
  );
}

export function isIosDevice(windowRef: Window): boolean {
  const { userAgent, platform, maxTouchPoints } = windowRef.navigator;

  return /iPad|iPhone|iPod/i.test(userAgent)
    || (platform === 'MacIntel' && maxTouchPoints > 1);
}

export function isSafariBrowser(windowRef: Window): boolean {
  const { userAgent } = windowRef.navigator;

  return /Safari/i.test(userAgent)
    && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|YaBrowser|MiuiBrowser/i.test(userAgent);
}

export function shouldShowIosInstallHint(windowRef: Window): boolean {
  return isIosDevice(windowRef)
    && isSafariBrowser(windowRef)
    && !isStandaloneMode(windowRef);
}

export function canPromptInstall(
  deferredPrompt: DeferredInstallPromptEvent | null,
  windowRef: Window,
): boolean {
  return Boolean(deferredPrompt) && !isStandaloneMode(windowRef);
}
