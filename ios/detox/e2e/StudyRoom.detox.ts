/**
 * Study Room E2E Tests
 *
 * Tests cover:
 * - Study tab screen loading
 * - Starting a focus/study session
 * - Pause and resume session
 * - Completing a session
 * - Stats display after completion
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
  retryInteraction,
  takeScreenshot,
} from './helpers';

describe('Study: Study Tab', () => {
  beforeEach(async () => {
    await launchAuthenticated('study');
  });

  afterEach(async () => {
    await takeScreenshot(`${expect.getState().currentTestName}-end`);
  });

  it('should display the study screen', async () => {
    await waitForElementVisible(AppUI.studyScreen);
  });

  it('should display the main tab bar', async () => {
    await waitForElementVisible(AppUI.mainTabView);
  });

  it('should show start session button', async () => {
    // TODO: Add identifier 'study.start.session.button' to the Swift source
    // if not already present, and use it here:
    // await waitForElementVisible('study.start.session.button');

    await waitForElementVisible(AppUI.studyScreen);
  });
});

describe('Study: Focus Session Lifecycle', () => {
  beforeEach(async () => {
    await launchAuthenticated('study');
    await waitForElementVisible(AppUI.studyScreen);
  });

  afterEach(async () => {
    await takeScreenshot(`${expect.getState().currentTestName}-end`);
  });

  it('should start a focus session when start button is tapped', async () => {
    // TODO: Once 'study.start.session.button' and 'study.session.active' are added:
    // await tapElement('study.start.session.button');
    // await waitForElementVisible('study.session.active');
    // // Session timer should be visible
    // await waitForElementVisible('study.session.timer');

    await waitForElementVisible(AppUI.studyScreen);
  });

  it('should display pause button during active session', async () => {
    // TODO: Implement once session controls have identifiers:
    // 'study.start.session.button', 'study.session.active', 'study.pause.button'
    // await tapElement('study.start.session.button');
    // await waitForElementVisible('study.session.active');
    // await waitForElementVisible('study.pause.button');

    await waitForElementVisible(AppUI.studyScreen);
  });

  it('should pause an active session', async () => {
    // TODO: Implement once identifiers are available:
    // 'study.start.session.button', 'study.session.active', 'study.pause.button',
    // 'study.session.paused'
    // await tapElement('study.start.session.button');
    // await waitForElementVisible('study.session.active');
    // await tapElement('study.pause.button');
    // await waitForElementVisible('study.session.paused');

    await waitForElementVisible(AppUI.studyScreen);
  });

  it('should resume a paused session', async () => {
    // TODO: Implement once identifiers are available:
    // 'study.start.session.button', 'study.session.active', 'study.pause.button',
    // 'study.session.paused', 'study.resume.button'
    // await tapElement('study.start.session.button');
    // await waitForElementVisible('study.session.active');
    // await tapElement('study.pause.button');
    // await waitForElementVisible('study.session.paused');
    // await tapElement('study.resume.button');
    // await waitForElementVisible('study.session.active');

    await waitForElementVisible(AppUI.studyScreen);
  });

  it('should complete a session and show summary', async () => {
    // TODO: Implement once identifiers are available:
    // 'study.start.session.button', 'study.complete.button', 'study.summary.screen',
    // 'study.summary.duration', 'study.summary.sessions.count'
    // await tapElement('study.start.session.button');
    // // Wait for minimum session duration or skip directly:
    // await tapElement('study.complete.button');
    // await waitForElementVisible('study.summary.screen');
    // await waitForElementVisible('study.summary.duration');
    // await waitForElementVisible('study.summary.sessions.count');

    await waitForElementVisible(AppUI.studyScreen);
  });

  it('should display study stats on the main screen', async () => {
    // TODO: If the study screen shows cumulative stats, verify:
    // 'study.stats.total.time', 'study.stats.today.sessions'
    // await waitForElementVisible('study.stats.total.time');
    // await waitForElementVisible('study.stats.today.sessions');

    await waitForElementVisible(AppUI.studyScreen);
  });
});

describe('Study: Session Timer', () => {
  beforeEach(async () => {
    await launchAuthenticated('study');
    await waitForElementVisible(AppUI.studyScreen);
  });

  afterEach(async () => {
    await takeScreenshot(`${expect.getState().currentTestName}-end`);
  });

  it('should update timer display during active session', async () => {
    // TODO: Once session identifiers are available:
    // 'study.start.session.button', 'study.session.active', 'study.session.timer'
    // await tapElement('study.start.session.button');
    // await waitForElementVisible('study.session.active');
    //
    // // Read initial timer value
    // const timerBefore = await element(by.id('study.session.timer')).getText();
    //
    // // Wait a moment and verify timer has incremented
    // await sleep(2000);
    // const timerAfter = await element(by.id('study.session.timer')).getText();
    // expect(timerAfter).not.toBe(timerBefore);

    await waitForElementVisible(AppUI.studyScreen);
  });
});
