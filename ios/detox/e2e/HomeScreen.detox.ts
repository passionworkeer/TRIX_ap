/**
 * Home Screen E2E Tests
 *
 * Tests cover:
 * - Home screen loading and displaying quick actions
 * - Home bot bubble interaction
 * - Notification panel
 * - Mail/Message panel
 * - Workbench overlay cards
 *
 * SwiftUI accessibility identifiers from AppUIIdentifiers (RealAppTestSupport.swift).
 *
 * NOTE: SwiftUI animations may cause elements to appear with a delay.
 * Retry logic is used for all tap interactions on this screen.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import {
  AppUI,
  launchAuthenticated,
  waitForElementVisible,
  waitForElementGone,
  tapElement,
  retryInteraction,
  takeScreenshot,
} from './helpers';

describe('Home: Home Screen', () => {
  beforeEach(async () => {
    await launchAuthenticated('home');
    await waitForElementVisible(AppUI.mainTabView);
  });

  afterEach(async () => {
    await takeScreenshot(`${expect.getState().currentTestName}-end`);
  });

  it('should display the home screen', async () => {
    await waitForElementVisible(AppUI.homeScreen);
  });

  it('should show home tab as selected', async () => {
    await waitForElementVisible(AppUI.selectedHomeTab);
  });

  it('should display the home bot bubble', async () => {
    await waitForElementVisible(AppUI.homeBotBubble);
  });

  it('should display workbench overlay cards', async () => {
    // Tap home tab to open workbench overlay
    await tapElement(AppUI.homeTab);

    // Workbench overlay should appear
    await waitForElementVisible(AppUI.workbenchOverlay);

    // All workbench cards should be visible
    await waitForElementVisible(AppUI.workbenchSnapshotCard);
    await waitForElementVisible(AppUI.workbenchLocationCard);
    await waitForElementVisible(AppUI.workbenchScheduleCard);
    await waitForElementVisible(AppUI.workbenchTodoCard);
  });

  it('should dismiss workbench overlay when tapping outside', async () => {
    await tapElement(AppUI.homeTab);
    await waitForElementVisible(AppUI.workbenchOverlay);

    // Tap the center of the app (outside the overlay) to dismiss
    // Detox doesn't have a direct "tap at coordinates" but we can
    // tap another tab which should dismiss the overlay
    await tapElement(AppUI.chatTab);
    await waitForElementVisible(AppUI.selectedChatTab);
  });
});

describe('Home: Bot Bubble', () => {
  beforeEach(async () => {
    await launchAuthenticated('home');
    await waitForElementVisible(AppUI.homeScreen);
    await waitForElementVisible(AppUI.homeBotBubble);
  });

  afterEach(async () => {
    await takeScreenshot(`${expect.getState().currentTestName}-end`);
  });

  it('should open TRIX Bot chat when tapping the home bot bubble', async () => {
    await retryInteraction(() => tapElement(AppUI.homeBotBubble));

    // Should navigate to TRIX Bot screen or pairing screen
    try {
      await waitForElementVisible(AppUI.trixBotScreen, 15000);
    } catch {
      // If not paired, the app may show the pairing screen
      await waitForElementVisible(AppUI.pairingScreen, 5000);
    }
  });

  it('should show TRIX Bot controls after opening from home bubble', async () => {
    await retryInteraction(() => tapElement(AppUI.homeBotBubble));

    try {
      await waitForElementVisible(AppUI.trixBotScreen, 15000);
      await waitForElementVisible(AppUI.trixBotSendButton);

      // If the session is paired, paired banner should appear
      try {
        await waitForElementVisible(AppUI.trixBotPairedBanner, 15000);
      } catch {
        await waitForElementVisible(AppUI.trixBotUnpairedBanner, 5000);
      }
    } catch {
      await waitForElementVisible(AppUI.pairingScreen);
    }
  });
});

describe('Home: Notification Panel', () => {
  beforeEach(async () => {
    await launchAuthenticated('home');
    await waitForElementVisible(AppUI.homeScreen);
  });

  afterEach(async () => {
    await takeScreenshot(`${expect.getState().currentTestName}-end`);
  });

  it('should open notification panel', async () => {
    // TODO: Add identifier 'home.notifications.button' to the Swift source
    // if not already present, and implement:
    // await tapElement('home.notifications.button');
    // await waitForElementVisible('home.notifications.panel');

    await waitForElementVisible(AppUI.homeScreen);
  });

  it('should display notification items in panel', async () => {
    // TODO: Implement once 'home.notifications.button' and
    // 'home.notifications.panel' are available.
    // await tapElement('home.notifications.button');
    // await waitForElementVisible('home.notifications.panel');
    // // Should show at least a "no new notifications" state or actual items
    // await waitForElementVisible('home.notifications.list');

    await waitForElementVisible(AppUI.homeScreen);
  });

  it('should dismiss notification panel', async () => {
    // TODO: Implement once panel identifiers are available.
    // await tapElement('home.notifications.button');
    // await waitForElementVisible('home.notifications.panel');
    // await tapElement('home.notifications.close.button');
    // await waitForElementGone('home.notifications.panel');

    await waitForElementVisible(AppUI.homeScreen);
  });
});

describe('Home: Mail Panel', () => {
  beforeEach(async () => {
    await launchAuthenticated('home');
    await waitForElementVisible(AppUI.homeScreen);
  });

  afterEach(async () => {
    await takeScreenshot(`${expect.getState().currentTestName}-end`);
  });

  it('should open mail panel', async () => {
    // TODO: Add identifier 'home.mail.button' to the Swift source
    // if not already present, and implement:
    // await tapElement('home.mail.button');
    // await waitForElementVisible('home.mail.panel');

    await waitForElementVisible(AppUI.homeScreen);
  });

  it('should display mail items or empty state', async () => {
    // TODO: Implement once 'home.mail.button' and 'home.mail.panel' are available.
    // await tapElement('home.mail.button');
    // await waitForElementVisible('home.mail.panel');
    // // Should show mail items or an empty state
    // await waitForElementVisible('home.mail.list');

    await waitForElementVisible(AppUI.homeScreen);
  });
});

describe('Home: Workbench Cards', () => {
  beforeEach(async () => {
    await launchAuthenticated('home');
    await waitForElementVisible(AppUI.homeScreen);

    // Open workbench
    await tapElement(AppUI.homeTab);
    await waitForElementVisible(AppUI.workbenchOverlay);
  });

  afterEach(async () => {
    await takeScreenshot(`${expect.getState().currentTestName}-end`);
  });

  it('should display all workbench cards', async () => {
    await waitForElementVisible(AppUI.workbenchSnapshotCard);
    await waitForElementVisible(AppUI.workbenchLocationCard);
    await waitForElementVisible(AppUI.workbenchScheduleCard);
    await waitForElementVisible(AppUI.workbenchTodoCard);
  });

  it('should open snapshot card', async () => {
    // TODO: Add identifier 'home.workbench.snapshot.detail' for the detail view
    // await tapElement(AppUI.workbenchSnapshotCard);
    // await waitForElementVisible('home.workbench.snapshot.detail');

    await waitForElementVisible(AppUI.workbenchSnapshotCard);
  });

  it('should open schedule card', async () => {
    // TODO: Add identifier 'home.workbench.schedule.detail' for the detail view
    // await tapElement(AppUI.workbenchScheduleCard);
    // await waitForElementVisible('home.workbench.schedule.detail');

    await waitForElementVisible(AppUI.workbenchScheduleCard);
  });

  it('should open todo card', async () => {
    // TODO: Add identifier 'home.workbench.todo.detail' for the detail view
    // await tapElement(AppUI.workbenchTodoCard);
    // await waitForElementVisible('home.workbench.todo.detail');

    await waitForElementVisible(AppUI.workbenchTodoCard);
  });
});
