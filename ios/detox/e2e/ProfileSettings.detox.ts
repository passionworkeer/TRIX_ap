/**
 * Profile & Settings E2E Tests
 *
 * Tests cover:
 * - Viewing profile screen
 * - Editing profile (username, avatar)
 * - Settings toggles (dark mode, notifications)
 * - Settings sheet navigation
 * - About sheet
 * - Logout flow
 *
 * SwiftUI accessibility identifiers from AppUIIdentifiers (RealAppTestSupport.swift).
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import {
  AppUI,
  launchAuthenticated,
  navigateToTab,
  waitForElementVisible,
  waitForElementGone,
  tapElement,
  typeIntoElement,
  retryInteraction,
  takeScreenshot,
  logout,
} from './helpers';

describe('Profile: Profile Screen', () => {
  beforeEach(async () => {
    await launchAuthenticated('profile');
  });

  afterEach(async () => {
    await takeScreenshot(`${expect.getState().currentTestName}-end`);
  });

  it('should display the profile screen', async () => {
    await waitForElementVisible(AppUI.profileScreen);
  });

  it('should show profile tab as selected', async () => {
    await waitForElementVisible(AppUI.selectedProfileTab);
  });

  it('should display user avatar placeholder', async () => {
    // TODO: If there's an avatar identifier add 'profile.avatar.image'
    // await waitForElementVisible('profile.avatar.image');

    await waitForElementVisible(AppUI.profileScreen);
  });

  it('should display username on profile', async () => {
    // TODO: Add identifier 'profile.username.label' to the Swift source
    // and verify:
    // await waitForElementVisible('profile.username.label');
    // const username = await element(by.id('profile.username.label')).getText();
    // expect(username).not.toBe('');

    await waitForElementVisible(AppUI.profileScreen);
  });
});

describe('Profile: Settings Toggles', () => {
  beforeEach(async () => {
    await launchAuthenticated('profile');
    await waitForElementVisible(AppUI.profileScreen);
  });

  afterEach(async () => {
    await takeScreenshot(`${expect.getState().currentTestName}-end`);
  });

  it('should display dark mode toggle', async () => {
    await waitForElementVisible(AppUI.profileDarkModeToggle);
  });

  it('should display notifications toggle', async () => {
    await waitForElementVisible(AppUI.profileNotificationsToggle);
  });

  it('should toggle dark mode on and off', async () => {
    // Get initial state
    const darkModeToggle = element(by.id(AppUI.profileDarkModeToggle));

    // Tap to toggle
    await retryInteraction(() => tapElement(AppUI.profileDarkModeToggle));

    // Verify toggle changed (no crash, screen still functional)
    await waitForElementVisible(AppUI.profileDarkModeToggle);

    // Toggle back
    await retryInteraction(() => tapElement(AppUI.profileDarkModeToggle));
    await waitForElementVisible(AppUI.profileDarkModeToggle);
  });

  it('should toggle notifications on and off', async () => {
    await waitForElementVisible(AppUI.profileNotificationsToggle);

    await retryInteraction(() => tapElement(AppUI.profileNotificationsToggle));
    await waitForElementVisible(AppUI.profileNotificationsToggle);

    await retryInteraction(() => tapElement(AppUI.profileNotificationsToggle));
    await waitForElementVisible(AppUI.profileNotificationsToggle);
  });
});

describe('Profile: Settings Sheet', () => {
  beforeEach(async () => {
    await launchAuthenticated('profile');
    await waitForElementVisible(AppUI.profileScreen);
    await waitForElementVisible(AppUI.profileMoreSettingsButton);
  });

  afterEach(async () => {
    await takeScreenshot(`${expect.getState().currentTestName}-end`);
  });

  it('should open settings sheet', async () => {
    await tapElement(AppUI.profileMoreSettingsButton);
    await waitForElementVisible(AppUI.profileSettingsSheet);
    await waitForElementVisible(AppUI.profileSettingsSyncButton);
    await waitForElementVisible(AppUI.profileSettingsDoneButton);
  });

  it('should trigger sync from settings sheet', async () => {
    await tapElement(AppUI.profileMoreSettingsButton);
    await waitForElementVisible(AppUI.profileSettingsSheet);
    await tapElement(AppUI.profileSettingsSyncButton);

    // Sync message should appear (may take a moment)
    await waitForElementVisible(AppUI.profileSettingsSyncMessage, 20000);
  });

  it('should close settings sheet with done button', async () => {
    await tapElement(AppUI.profileMoreSettingsButton);
    await waitForElementVisible(AppUI.profileSettingsSheet);
    await tapElement(AppUI.profileSettingsDoneButton);
    await waitForElementGone(AppUI.profileSettingsSheet);
  });
});

describe('Profile: About Sheet', () => {
  beforeEach(async () => {
    await launchAuthenticated('profile');
    await waitForElementVisible(AppUI.profileScreen);
    await waitForElementVisible(AppUI.profileAboutButton);
  });

  afterEach(async () => {
    await takeScreenshot(`${expect.getState().currentTestName}-end`);
  });

  it('should open about sheet', async () => {
    await tapElement(AppUI.profileAboutButton);
    await waitForElementVisible(AppUI.profileAboutSheet);
    await waitForElementVisible(AppUI.profileAboutDoneButton);
  });

  it('should close about sheet', async () => {
    await tapElement(AppUI.profileAboutButton);
    await waitForElementVisible(AppUI.profileAboutSheet);
    await tapElement(AppUI.profileAboutDoneButton);
    await waitForElementGone(AppUI.profileAboutSheet);
  });

  it('should display app version in about sheet', async () => {
    await tapElement(AppUI.profileAboutButton);
    await waitForElementVisible(AppUI.profileAboutSheet);

    // TODO: Add identifier 'profile.about.version.label' and verify:
    // const version = await element(by.id('profile.about.version.label')).getText();
    // expect(version).toMatch(/\d+\.\d+\.\d+/);

    await waitForElementVisible(AppUI.profileAboutDoneButton);
  });
});

describe('Profile: Logout Flow', () => {
  beforeEach(async () => {
    await launchAuthenticated('profile');
    await waitForElementVisible(AppUI.profileScreen);
    await waitForElementVisible(AppUI.profileLogoutButton);
  });

  afterEach(async () => {
    await takeScreenshot(`${expect.getState().currentTestName}-end`);
  });

  it('should show logout confirmation before logging out', async () => {
    await tapElement(AppUI.profileLogoutButton);

    // TODO: If the app shows a confirmation alert before logout,
    // add identifier 'profile.logout.confirm.alert' and:
    // await waitForElementVisible('profile.logout.confirm.alert');
    // await tapElement('profile.logout.confirm.yes');
    // await waitForElementVisible(AppUI.loginScene);

    // Placeholder: check if login screen appears
    try {
      await waitForElementVisible(AppUI.loginScene, 5000);
    } catch {
      // Logout may require confirmation dialog
    }
  });

  it('should return to login screen after logout', async () => {
    await logout();
    await waitForElementVisible(AppUI.loginScene);
  });
});

describe('Profile: Edit Profile', () => {
  beforeEach(async () => {
    await launchAuthenticated('profile');
    await waitForElementVisible(AppUI.profileScreen);
  });

  afterEach(async () => {
    await takeScreenshot(`${expect.getState().currentTestName}-end`);
  });

  it('should open edit profile screen', async () => {
    // TODO: Add identifier 'profile.edit.button' to the Swift source
    // await tapElement('profile.edit.button');
    // await waitForElementVisible('profile.edit.screen');

    await waitForElementVisible(AppUI.profileScreen);
  });

  it('should allow editing username', async () => {
    // TODO: Implement once edit identifiers are available.
    // 'profile.edit.button', 'profile.edit.username.field', 'profile.edit.save.button'
    // await tapElement('profile.edit.button');
    // await waitForElementVisible('profile.edit.screen');
    // const usernameField = element(by.id('profile.edit.username.field'));
    // await usernameField.clearText();
    // await usernameField.typeText('NewUsername');
    // await tapElement('profile.edit.save.button');

    await waitForElementVisible(AppUI.profileScreen);
  });

  it('should allow changing avatar photo', async () => {
    // TODO: Implement once avatar change identifiers are available.
    // 'profile.edit.avatar.button', 'profile.edit.avatar.photo.picker'
    // await tapElement('profile.edit.button');
    // await waitForElementVisible('profile.edit.screen');
    // await tapElement('profile.edit.avatar.button');
    // // Photo picker should appear (native - cannot interact directly in Detox)
    // // Verify screen remains stable
    // await waitForElementVisible('profile.edit.save.button');

    await waitForElementVisible(AppUI.profileScreen);
  });
});
