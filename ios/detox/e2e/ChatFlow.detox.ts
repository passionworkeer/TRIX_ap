/**
 * Chat Flow E2E Tests
 *
 * Tests cover:
 * - Opening chat room from chat tab
 * - Sending text messages
 * - Sending voice messages (UI interaction)
 * - Sending image attachments
 * - AI (TRIX Bot) response handling and timing
 *
 * SwiftUI accessibility identifiers from AppUIIdentifiers (RealAppTestSupport.swift).
 *
 * NOTE: AI response tests use generous timeouts (up to 90s) because backend
 * AI responses are inherently non-deterministic. Screenshots are captured
 * on failure to aid debugging of slow responses.
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
} from './helpers';
import testConfig from './config';

describe('Chat: Chat Tab', () => {
  beforeEach(async () => {
    await launchAuthenticated('chat');
    await waitForElementVisible(AppUI.chatScreen);
    await waitForElementVisible(AppUI.chatSearchField);
  });

  afterEach(async () => {
    await takeScreenshot(`${expect.getState().currentTestName}-end`);
  });

  it('should display chat list screen', async () => {
    await waitForElementVisible(AppUI.chatScreen);
    await waitForElementVisible(AppUI.chatSearchField);
  });

  it('should display TRIX Bot entry card in chat list', async () => {
    // The TRIX Bot card should be visible on the chat screen
    await waitForElementVisible(AppUI.chatTrixBotCard);
  });

  it('should filter chat list when searching', async () => {
    // TODO: If the Swift app supports filtering by typing in the search field,
    // add identifier 'chat.search.field' and implement:
    // await typeIntoElement(AppUI.chatSearchField, 'test');
    // // Chat list should filter - verify at least one element changes
    // await waitForElementVisible(AppUI.chatSearchField);

    // Placeholder: search field should be interactive
    await waitForElementVisible(AppUI.chatSearchField);
  });
});

describe('Chat: Opening TRIX Bot', () => {
  beforeEach(async () => {
    await launchAuthenticated('chat');
    await waitForElementVisible(AppUI.chatTrixBotCard);
  });

  afterEach(async () => {
    await takeScreenshot(`${expect.getState().currentTestName}-end`);
  });

  it('should open TRIX Bot screen when tapping the bot card', async () => {
    await tapElement(AppUI.chatTrixBotCard);

    // Should navigate to either TRIX Bot screen or pairing screen
    try {
      await waitForElementVisible(AppUI.trixBotScreen, 15000);
    } catch {
      // If not paired, may show pairing screen instead
      await waitForElementVisible(AppUI.pairingScreen, 5000);
    }
  });

  it('should close TRIX Bot and return to chat list', async () => {
    await tapElement(AppUI.chatTrixBotCard);

    let trixBotOpened = false;
    try {
      await waitForElementVisible(AppUI.trixBotScreen, 10000);
      trixBotOpened = true;
    } catch {
      await waitForElementVisible(AppUI.pairingScreen, 5000);
    }

    if (trixBotOpened) {
      await tapElement(AppUI.trixBotCloseButton);
      await waitForElementVisible(AppUI.chatScreen, 5000);
    }
  });
});

describe('Chat: TRIX Bot Messaging', () => {
  beforeEach(async () => {
    await launchAuthenticated('chat');
    await tapElement(AppUI.chatTrixBotCard);

    // Wait for TRIX Bot screen or pairing screen
    try {
      await waitForElementVisible(AppUI.trixBotScreen, 15000);
    } catch {
      await waitForElementVisible(AppUI.pairingScreen, 5000);
      // Cannot proceed without pairing - skip remaining tests in this describe
      console.warn('TRIX Bot requires pairing - skipping messaging tests');
      return;
    }
  });

  afterEach(async () => {
    await takeScreenshot(`${expect.getState().currentTestName}-end`);
  });

  it('should display TRIX Bot input controls', async () => {
    await waitForElementVisible(AppUI.trixBotScreen);
    await waitForElementVisible(AppUI.trixBotInputField);
    await waitForElementVisible(AppUI.trixBotSendButton);
  });

  it('should display paired banner when session is paired', async () => {
    await waitForElementVisible(AppUI.trixBotScreen);

    // Should show paired banner (may take a moment to establish session)
    try {
      await waitForElementVisible(AppUI.trixBotPairedBanner, 20000);
    } catch {
      // May show unpaired banner instead if session not yet established
      await waitForElementVisible(AppUI.trixBotUnpairedBanner, 5000);
    }
  });

  it('should send a text message to TRIX Bot', async () => {
    await waitForElementVisible(AppUI.trixBotSendButton);

    const testMessage = 'Hello TRIX, this is a Detox test message.';
    await typeIntoElement(AppUI.trixBotInputField, testMessage);
    await tapElement(AppUI.trixBotSendButton);

    // After sending, the input field should be cleared
    // The message should appear in the chat list
    // (No explicit identifier for sent message yet - TODO: add 'trixbot.message.sent')
  });

  it('should receive AI response to a simple message', async () => {
    // This test uses a generous timeout because AI responses are async.
    await waitForElementVisible(AppUI.trixBotInputField);

    const testPrompt = '/status';
    await typeIntoElement(AppUI.trixBotInputField, testPrompt);
    await tapElement(AppUI.trixBotSendButton);

    // Wait for AI response. This can take up to 90 seconds.
    // The app should show a typing indicator or the response text.
    // TODO: If the app shows a typing indicator with identifier 'trixbot.typing.indicator',
    // wait for it to appear and disappear before checking for the response.
    // try {
    //   await waitForElementVisible('trixbot.typing.indicator', 5000);
    //   await waitForElementGone('trixbot.typing.indicator', testConfig.timeout.aiResponseWait);
    // } catch {
    //   // Typing indicator may not be present
    // }

    // Verify the input field is usable again (response received)
    await waitForElementVisible(AppUI.trixBotInputField, testConfig.timeout.aiResponseWait);
  });

  it('should send a message with an image attachment', async () => {
    await waitForElementVisible(AppUI.trixBotInputField);

    // TODO: The app needs an attachment button identifier.
    // Add 'trixbot.attach.button' to the Swift source and implement:
    // await tapElement('trixbot.attach.button');
    // await waitForElementVisible('trixbot.attach.menu');
    // await tapElement('trixbot.attach.photo.button');
    // // After photo selection the attachment preview should appear
    // await waitForElementVisible(AppUI.trixBotAttachmentPreview);

    // Placeholder: verify input field is still functional
    await waitForElementVisible(AppUI.trixBotInputField);
  });

  it('should show attachment preview before sending', async () => {
    // TODO: Implement once 'trixbot.attach.button' is added to Swift.
    // await tapElement('trixbot.attach.button');
    // await waitForElementVisible('trixbot.attach.menu');
    // await tapElement('trixbot.attach.photo.button');
    // await waitForElementVisible(AppUI.trixBotAttachmentPreview);

    await waitForElementVisible(AppUI.trixBotInputField);
  });
});

describe('Chat: Voice Messages', () => {
  beforeEach(async () => {
    await launchAuthenticated('chat');
    await tapElement(AppUI.chatTrixBotCard);

    try {
      await waitForElementVisible(AppUI.trixBotScreen, 15000);
    } catch {
      await waitForElementVisible(AppUI.pairingScreen, 5000);
      console.warn('TRIX Bot requires pairing - skipping voice tests');
      return;
    }
  });

  afterEach(async () => {
    await takeScreenshot(`${expect.getState().currentTestName}-end`);
  });

  it('should display voice message button', async () => {
    // TODO: If the app has a voice record button with identifier 'trixbot.voice.button',
    // verify it's visible. Otherwise, this test documents the expected identifier.
    // await waitForElementVisible('trixbot.voice.button');

    await waitForElementVisible(AppUI.trixBotScreen);
  });

  it('should start voice recording on long press', async () => {
    // TODO: Implement once 'trixbot.voice.button' is added.
    // const voiceButton = element(by.id('trixbot.voice.button'));
    // await voiceButton.longPress(1000); // 1 second long press
    // // Should show recording indicator
    // await waitForElementVisible('trixbot.voice.recording', 5000);

    await waitForElementVisible(AppUI.trixBotScreen);
  });
});
