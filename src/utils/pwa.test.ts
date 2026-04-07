import { describe, expect, it } from 'vitest';
import {
  canPromptInstall,
  isIosDevice,
  isSafariBrowser,
  isStandaloneMode,
  shouldShowIosInstallHint,
  type DeferredInstallPromptEvent,
} from './pwa';

function createWindowMock({
  userAgent,
  platform = 'iPhone',
  maxTouchPoints = 5,
  standalone = false,
  displayModeStandalone = false,
}: {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
  displayModeStandalone?: boolean;
}): Window {
  return {
    navigator: {
      userAgent,
      platform,
      maxTouchPoints,
      standalone,
    },
    matchMedia: () => ({
      matches: displayModeStandalone,
    }),
  } as unknown as Window;
}

describe('pwa utils', () => {
  it('detects iOS Safari correctly', () => {
    const windowMock = createWindowMock({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1',
    });

    expect(isIosDevice(windowMock)).toBe(true);
    expect(isSafariBrowser(windowMock)).toBe(true);
    expect(shouldShowIosInstallHint(windowMock)).toBe(true);
  });

  it('does not treat iOS Chrome as Safari', () => {
    const windowMock = createWindowMock({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/135.0.7049.53 Mobile/15E148 Safari/604.1',
    });

    expect(isIosDevice(windowMock)).toBe(true);
    expect(isSafariBrowser(windowMock)).toBe(false);
    expect(shouldShowIosInstallHint(windowMock)).toBe(false);
  });

  it('detects standalone mode from navigator or display mode', () => {
    const navigatorStandaloneWindow = createWindowMock({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1',
      standalone: true,
    });
    const displayModeStandaloneWindow = createWindowMock({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 0,
      displayModeStandalone: true,
    });

    expect(isStandaloneMode(navigatorStandaloneWindow)).toBe(true);
    expect(isStandaloneMode(displayModeStandaloneWindow)).toBe(true);
  });

  it('only allows deferred install prompts outside standalone mode', () => {
    const promptEvent = {
      prompt: async () => undefined,
      userChoice: Promise.resolve({
        outcome: 'accepted' as const,
        platform: 'web',
      }),
    } as DeferredInstallPromptEvent;

    const regularWindow = createWindowMock({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    });
    const standaloneWindow = createWindowMock({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 0,
      displayModeStandalone: true,
    });

    expect(canPromptInstall(promptEvent, regularWindow)).toBe(true);
    expect(canPromptInstall(promptEvent, standaloneWindow)).toBe(false);
  });
});
