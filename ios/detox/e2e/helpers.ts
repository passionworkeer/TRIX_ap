/**
 * Test Helpers
 *
 * Shared helper functions for Detox E2E tests.
 * These wrap Detox APIs with retry logic and SwiftUI-specific
 * wait strategies (SwiftUI elements take time to render).
 */

import {
  expect,
  element,
  by,
  device,
  waitFor,
  GeneralWaitForMatcher,
} from 'detox';

import testConfig from './config';

// ---------------------------------------------------------------------------
// AppUIIdentifiers - mirrors RealAppTestSupport.swift
// Keep in sync with Swift source of truth:
// TRIX3DUITests/RealAppTestSupport.swift
// ---------------------------------------------------------------------------
export const AppUI = {
  // Auth screens
  loginScene: 'auth.login.scene',
  registerScene: 'auth.register.scene',
  loginEmailField: 'auth.login.email',
  loginPasswordField: 'auth.login.password',
  loginSubmitButton: 'auth.login.submit',
  loginSwitchToRegisterButton: 'auth.login.switch.register',
  registerUsernameField: 'auth.register.username',
  registerEmailField: 'auth.register.email',
  registerPasswordField: 'auth.register.password',
  registerConfirmPasswordField: 'auth.register.confirmPassword',
  registerSubmitButton: 'auth.register.submit',
  registerSwitchToLoginButton: 'auth.register.switch.login',

  // Navigation
  mainTabView: 'main.tab.view',
  homeTab: 'nav.tab.home',
  mapTab: 'nav.tab.map',
  studyTab: 'nav.tab.study',
  chatTab: 'nav.tab.chat',
  profileTab: 'nav.tab.profile',
  selectedHomeTab: 'nav.selected.home',
  selectedMapTab: 'nav.selected.map',
  selectedStudyTab: 'nav.selected.study',
  selectedChatTab: 'nav.selected.chat',
  selectedProfileTab: 'nav.selected.profile',

  // Home screen
  homeScreen: 'home.screen',
  homeBotBubble: 'home.bot.bubble',
  workbenchOverlay: 'home.workbench.overlay',
  workbenchSnapshotCard: 'home.workbench.snapshot.card',
  workbenchLocationCard: 'home.workbench.location.card',
  workbenchScheduleCard: 'home.workbench.schedule.card',
  workbenchTodoCard: 'home.workbench.todo.card',

  // Chat
  chatScreen: 'chat.screen',
  chatSearchField: 'chat.search.field',
  chatTrixBotCard: 'chat.trixbot.card',

  // Map
  mapScreen: 'map.screen',
  mapSearchField: 'map.search.field',

  // Study
  studyScreen: 'study.screen',

  // Profile & Settings
  profileScreen: 'profile.screen',
  profileDarkModeToggle: 'profile.darkmode.toggle',
  profileNotificationsToggle: 'profile.notifications.toggle',
  profileMoreSettingsButton: 'profile.settings.more.button',
  profileAboutButton: 'profile.about.button',
  profileLogoutButton: 'profile.logout.button',
  profileSettingsSheet: 'profile.settings.sheet',
  profileAboutSheet: 'profile.about.sheet',
  profileSettingsSyncButton: 'profile.settings.sync.button',
  profileSettingsSyncMessage: 'profile.settings.sync.message',
  profileSettingsDoneButton: 'profile.settings.done.button',
  profileAboutDoneButton: 'profile.about.done.button',

  // Pairing
  pairingScreen: 'pairing.screen',
  pairingCameraButton: 'pairing.camera.button',
  pairingManualButton: 'pairing.manual.button',
  pairingCodeField: 'pairing.code.field',
  pairingVerifyButton: 'pairing.verify.button',

  // TRIX Bot
  trixBotScreen: 'trixbot.screen',
  trixBotPairedBanner: 'trixbot.banner.paired',
  trixBotUnpairedBanner: 'trixbot.banner.unpaired',
  trixBotInputField: 'trixbot.input.field',
  trixBotSendButton: 'trixbot.send.button',
  trixBotCloseButton: 'trixbot.close.button',
  trixBotAttachmentPreview: 'trixbot.attachment.preview',
};

// ---------------------------------------------------------------------------
// Generic element helpers
// ---------------------------------------------------------------------------

/**
 * Wait for an element to exist (be present in the hierarchy).
 * SwiftUI renders elements asynchronously, so we use a generous timeout.
 */
export async function waitForElement(
  id: string,
  timeout: number = testConfig.timeout.elementWait
): Promise<Detox.IndexableNativeElement> {
  const el = element(by.id(id));
  await expect(el).toExist(timeout);
  return el;
}

/**
 * Wait for an element to be visible and hittable.
 */
export async function waitForElementVisible(
  id: string,
  timeout: number = testConfig.timeout.elementWait
): Promise<Detox.IndexableNativeElement> {
  const el = element(by.id(id));
  await expect(el).toBeVisible(timeout);
  return el;
}

/**
 * Wait for an element to NOT exist.
 */
export async function waitForElementGone(
  id: string,
  timeout: number = testConfig.timeout.elementWait
): Promise<void> {
  const el = element(by.id(id));
  await expect(el).toNotExist(timeout);
}

/**
 * Retry an interaction up to `attempts` times with a delay between retries.
 * Useful for flaky SwiftUI animations where elements appear after a delay.
 */
export async function retryInteraction<T>(
  fn: () => Promise<T>,
  attempts: number = testConfig.retry.interactionAttempts,
  delayMs: number = testConfig.retry.retryDelayMs
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Tap an element with retry. SwiftUI buttons sometimes need a moment
 * before becoming tappable after state changes.
 */
export async function tapElement(id: string, timeout?: number): Promise<void> {
  const el = await waitForElementVisible(id, timeout);
  await retryInteraction(() => el.tap());
}

/**
 * Type text into a text field, clearing existing text first.
 */
export async function typeIntoElement(id: string, text: string): Promise<void> {
  const el = element(by.id(id));
  await expect(el).toExist();
  await el.clearText();
  await el.typeText(text);
}

/**
 * Take a screenshot with an optional name suffix.
 */
export async function takeScreenshot(name: string): Promise<void> {
  await device.takeScreenshot(name);
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Perform full login flow using test credentials.
 * Assumes the app is on the login screen.
 */
export async function login(): Promise<void> {
  const { email, password } = testConfig.testCredentials;

  if (!email || !password) {
    throw new Error(
      'Test credentials not set. Set TRIX_TEST_EMAIL and TRIX_TEST_PASSWORD environment variables.'
    );
  }

  await typeIntoElement(AppUI.loginEmailField, email);
  await typeIntoElement(AppUI.loginPasswordField, password);
  await tapElement(AppUI.loginSubmitButton, testConfig.timeout.loginWait);
}

/**
 * Launch app logged out (force-logged-out launch argument).
 * Use this at the start of auth-related tests.
 */
export async function launchLoggedOut(): Promise<void> {
  await device.launchApp({
    newInstance: true,
    launchArgs: {
      '--skip-onboarding': true,
      '--force-logged-out': true,
      '-AppleLanguages': '(zh-Hans)',
      '-AppleLocale': 'zh-Hans_CN',
    },
  });

  // Wait for login screen to appear
  await waitForElementVisible(AppUI.loginScene, testConfig.timeout.screenWait);
}

/**
 * Launch app pre-authenticated on a specific tab.
 * Falls back to login if not already authenticated.
 */
export async function launchAuthenticated(initialTab: string = 'home'): Promise<void> {
  await device.launchApp({
    newInstance: true,
    launchArgs: {
      '--skip-onboarding': true,
      '--force-logged-out': true,
      '--initial-tab': initialTab,
      '-AppleLanguages': '(zh-Hans)',
      '-AppleLocale': 'zh-Hans_CN',
    },
  });

  // Check if we're already on the authenticated screen
  try {
    await waitForElementVisible(AppUI.mainTabView, 5000);
    return;
  } catch {
    // Not yet authenticated - proceed to login
  }

  // Perform login if auth screen appears
  try {
    await waitForElementVisible(AppUI.loginScene, 5000);
    await login();
  } catch {
    // Already authenticated, continue
  }

  await waitForElementVisible(AppUI.mainTabView, testConfig.timeout.screenWait);
}

/**
 * Perform logout flow from the profile screen.
 * Assumes the app is on the profile tab.
 */
export async function logout(): Promise<void> {
  await tapElement(AppUI.profileLogoutButton);
  // After logout the app should return to login screen
  await waitForElementVisible(AppUI.loginScene, testConfig.timeout.logoutWait);
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to a specific tab and wait for it to be selected.
 */
export async function navigateToTab(
  tabId: string,
  selectedId: string,
  screenId?: string
): Promise<void> {
  await tapElement(tabId);

  // Wait for tab selection indicator
  await waitForElementVisible(selectedId, testConfig.timeout.screenWait);

  // If a screen ID is provided, also wait for the screen content
  if (screenId) {
    await waitForElementVisible(screenId, testConfig.timeout.screenWait);
  }
}

// ---------------------------------------------------------------------------
// Sleep utility
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
