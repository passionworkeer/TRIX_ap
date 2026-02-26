//
//  MockWebSocketManager.swift
//  TRIX3DCompanionTests
//
//  Mock implementation of WebSocketManager for testing
//

import Foundation
import Combine
@testable import TRIX3DCompanion

/// Mock implementation of WebSocketManager for unit testing
final class MockWebSocketManager {

    // MARK: - Properties

    var mockConnectionResult: Result<Void, Error>?
    var shouldSimulateConnectionError: Bool = false
    var simulatedConnectionError: Error?

    // Connection state
    private(set) var isConnectedState: Bool = false
    private(set) var connectedUserId: String?

    // Event listeners storage
    private var eventListeners: [String: [(Any) -> Void]] = [:]

    // Call tracking
    var connectCallCount: Int = 0
    var disconnectCallCount: Int = 0
    var sendMessageCallCount: Int = 0
    var sendAppRegisterCallCount: Int = 0

    // Pending responses for testing
    var pendingBotMessages: [BotMessage] = []
    var pendingMessageSentResponses: [MessageSentResponse] = []

    // MARK: - Initialization

    init() {}

    // MARK: - Public Methods

    func connect(userId: String) async throws {
        connectCallCount += 1
        connectedUserId = userId

        if shouldSimulateConnectionError {
            let error = simulatedConnectionError ?? WebSocketError(code: nil, message: "Connection failed")
            throw error
        }

        if let result = mockConnectionResult {
            switch result {
            case .success:
                isConnectedState = true
            case .failure(let error):
                throw error
            }
        }

        // Default: succeed
        isConnectedState = true
    }

    func disconnect() {
        disconnectCallCount += 1
        isConnectedState = false
        connectedUserId = nil
    }

    func on(_ event: WebSocketEventType, handler: @escaping (Any) -> Void) {
        let key = event.rawValue
        if eventListeners[key] == nil {
            eventListeners[key] = []
        }
        eventListeners[key]?.append(handler)
    }

    func off(_ event: WebSocketEventType, handler: @escaping (Any) -> Void) {
        let key = event.rawValue
        eventListeners[key]?.removeAll { $0 === handler }
    }

    func removeAllListeners() {
        eventListeners.removeAll()
    }

    func sendMessage(
        content: String,
        contentType: BotMessage.MessageContentType = .text,
        mediaUrl: String? = nil,
        mediaMimeType: String? = nil
    ) {
        sendMessageCallCount += 1

        // Simulate sending message
        if isConnectedState {
            // Simulate message sent response
            let response = MessageSentResponse(
                success: true,
                messageId: "\(Int(Date().timeIntervalSince1970))",
                timestamp: Int(Date().timeIntervalSince1970 * 1000),
                error: nil
            )
            emitMessageSent(response)
        }
    }

    func sendAppRegister() {
        sendAppRegisterCallCount += 1
    }

    func isConnected() -> Bool {
        return isConnectedState
    }

    // MARK: - Mock Control Methods

    func simulateConnected() {
        isConnectedState = true
        emit(.connected)
    }

    func simulateDisconnected(reason: String = "User disconnected") {
        isConnectedState = false
        emit(.disconnected(reason: reason))
    }

    func simulateBotMessage(_ message: BotMessage) {
        emit(.botMessage(message))
    }

    func simulateMessageSent(_ response: MessageSentResponse) {
        emitMessageSent(response)
    }

    func simulateError(_ error: WebSocketError) {
        emit(.error(error))
    }

    func queueBotMessage(_ message: BotMessage) {
        pendingBotMessages.append(message)
    }

    func queueMessageSentResponse(_ response: MessageSentResponse) {
        pendingMessageSentResponses.append(response)
    }

    func setMockConnectionError(_ error: Error) {
        simulatedConnectionError = error
    }

    // MARK: - Private Methods

    private func emit(_ event: WebSocketEvent) {
        let key: String
        switch event {
        case .connected:
            key = WebSocketEventType.connected.rawValue
        case .disconnected:
            key = WebSocketEventType.disconnected.rawValue
        case .reconnecting:
            key = WebSocketEventType.reconnecting.rawValue
        case .pairingSuccess:
            key = WebSocketEventType.pairingSuccess.rawValue
        case .unpaired:
            key = WebSocketEventType.unpaired.rawValue
        case .botMessage:
            key = WebSocketEventType.botMessage.rawValue
        case .messageSent:
            key = WebSocketEventType.messageSent.rawValue
        case .messageError:
            key = WebSocketEventType.messageError.rawValue
        case .botOnline:
            key = WebSocketEventType.botOnline.rawValue
        case .botOffline:
            key = WebSocketEventType.botOffline.rawValue
        case .studyRoomState:
            key = WebSocketEventType.studyRoomState.rawValue
        case .error:
            key = WebSocketEventType.error.rawValue
        }

        let listeners = eventListeners[key] ?? []
        listeners.forEach { callback in
            callback(event)
        }
    }

    private func emitMessageSent(_ response: MessageSentResponse) {
        let key = WebSocketEventType.messageSent.rawValue
        let listeners = eventListeners[key] ?? []
        listeners.forEach { callback in
            callback(response)
        }
    }

    // MARK: - Helper Methods

    func resetCallCounts() {
        connectCallCount = 0
        disconnectCallCount = 0
        sendMessageCallCount = 0
        sendAppRegisterCallCount = 0
    }

    func reset() {
        resetCallCounts()
        isConnectedState = false
        connectedUserId = nil
        eventListeners.removeAll()
        pendingBotMessages = []
        pendingMessageSentResponses = []
        mockConnectionResult = nil
        shouldSimulateConnectionError = false
        simulatedConnectionError = nil
    }

    func createTestBotMessage(
        content: String = "Test message",
        contentType: BotMessage.MessageContentType = .text
    ) -> BotMessage {
        BotMessage(
            content: content,
            contentType: contentType,
            mediaUrl: nil,
            mediaMimeType: nil,
            timestamp: Int(Date().timeIntervalSince1970 * 1000),
            messageId: UUID().uuidString
        )
    }

    func createTestMessageSentResponse(
        success: Bool = true,
        messageId: String? = nil
    ) -> MessageSentResponse {
        MessageSentResponse(
            success: success,
            messageId: messageId ?? UUID().uuidString,
            timestamp: Int(Date().timeIntervalSince1970 * 1000),
            error: success ? nil : "Test error"
        )
    }
}
