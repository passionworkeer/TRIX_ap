//
//  ChatFlowIntegrationTests.swift
//  TRIX3DCompanionE2ETests
//
//  E2E tests for chat messaging flow
//

import XCTest

/// E2E tests for chat messaging
final class ChatFlowIntegrationTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["--mock-server", "--auto-login"]
        app.launch()
    }

    // MARK: - Send Text Message

    func test_sendTextMessage_appearsInChat() throws {
        // Navigate to chat
        let chatTab = app.tabBars.buttons["Chat"]
        if chatTab.waitForExistence(timeout: 5) {
            chatTab.tap()
        }

        // Select a conversation
        let conversation = app.cells.firstMatch
        if conversation.waitForExistence(timeout: 3) {
            conversation.tap()
        }

        // Type and send message
        let inputField = app.textViews["MessageInput"]
        if inputField.waitForExistence(timeout: 3) {
            inputField.tap()
            inputField.typeText("Hello from E2E test")
        }

        let sendButton = app.buttons["Send"]
        if sendButton.waitForExistence(timeout: 3) {
            sendButton.tap()
        }

        // Verify message appears
        let messageBubble = app.staticTexts["Hello from E2E test"]
        XCTAssertTrue(messageBubble.waitForExistence(timeout: 5), "Sent message should appear in chat")
    }

    // MARK: - Bot Conversation

    func test_botConversation_showsThinkingState() throws {
        let chatTab = app.tabBars.buttons["Chat"]
        if chatTab.waitForExistence(timeout: 5) {
            chatTab.tap()
        }

        // Find bot conversation
        let botConversation = app.cells.containing(.staticText, identifier: "TRIX Bot").firstMatch
        if botConversation.waitForExistence(timeout: 3) {
            botConversation.tap()
        }

        // Send message to bot
        let inputField = app.textViews["MessageInput"]
        if inputField.waitForExistence(timeout: 3) {
            inputField.tap()
            inputField.typeText("What time is it?")
        }

        let sendButton = app.buttons["Send"]
        if sendButton.waitForExistence(timeout: 3) {
            sendButton.tap()
        }

        // Should show thinking indicator
        let thinkingIndicator = app.activityIndicators.firstMatch
        XCTAssertTrue(thinkingIndicator.waitForExistence(timeout: 3), "Thinking indicator should appear")
    }

    // MARK: - Message Input Validation

    func test_messageInput_preventsEmptySend() throws {
        let chatTab = app.tabBars.buttons["Chat"]
        if chatTab.waitForExistence(timeout: 5) {
            chatTab.tap()
        }

        let conversation = app.cells.firstMatch
        if conversation.waitForExistence(timeout: 3) {
            conversation.tap()
        }

        // Try to send empty message
        let sendButton = app.buttons["Send"]
        if sendButton.waitForExistence(timeout: 3) {
            // Send button should be disabled when input is empty
            XCTAssertFalse(sendButton.isEnabled, "Send button should be disabled for empty input")
        }
    }
}
