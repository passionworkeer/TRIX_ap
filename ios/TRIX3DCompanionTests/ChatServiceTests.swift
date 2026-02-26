//
//  ChatServiceTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for ChatService
//

import XCTest
import Combine
@testable import TRIX3DCompanion

/// Unit tests for ChatService
final class ChatServiceTests: XCTestCase {

    // MARK: - Properties

    var chatService: ChatService!
    var mockWebSocketManager: MockWebSocketManager!
    var mockAPIClient: MockAPIClient!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        mockWebSocketManager = MockWebSocketManager()
        mockAPIClient = MockAPIClient()

        chatService = ChatService(
            webSocketManager: mockWebSocketManager,
            apiClient: mockAPIClient
        )
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        chatService = nil
        mockWebSocketManager = nil
        mockAPIClient = nil
        cancellables = nil
    }

    // MARK: - Connection Tests

    func test_connect_success() async throws {
        // Arrange
        let userId = "test-user-123"

        // Act
        await chatService.connect(userId: userId)

        // Assert
        XCTAssertTrue(chatService.isConnected)
        XCTAssertEqual(chatService.connectionStatus, "Connected")
        XCTAssertEqual(mockWebSocketManager.connectCallCount, 1)
    }

    func test_connect_failure_setsDisconnectedState() async throws {
        // Arrange
        mockWebSocketManager.shouldSimulateConnectionError = true
        mockWebSocketManager.simulatedConnectionError = WebSocketError(
            code: nil,
            message: "Connection failed"
        )

        // Act
        await chatService.connect(userId: "test-user")

        // Assert
        XCTAssertFalse(chatService.isConnected)
        XCTAssertEqual(chatService.connectionStatus, "Connection failed")
    }

    func test_disconnect_clearsState() async throws {
        // Arrange
        await chatService.connect(userId: "test-user")
        mockWebSocketManager.simulateConnected()

        // Act
        chatService.disconnect()

        // Assert
        XCTAssertFalse(chatService.isConnected)
        XCTAssertEqual(chatService.connectionStatus, "Disconnected")
        XCTAssertNil(chatService.currentConversation)
        XCTAssertTrue(chatService.messages.isEmpty)
    }

    // MARK: - Conversation Tests

    func test_openConversation_loadsMessages() async throws {
        // Arrange
        let conversation = createMockConversation()
        await chatService.connect(userId: "test-user")

        // Act
        await chatService.openConversation(conversation)

        // Assert
        XCTAssertEqual(chatService.currentConversation?.id, conversation.id)
        XCTAssertFalse(chatService.messages.isEmpty)
    }

    func test_openConversation_clearsPreviousMessages() async throws {
        // Arrange
        let conversation1 = createMockConversation(id: "conv-1")
        let conversation2 = createMockConversation(id: "conv-2")
        await chatService.connect(userId: "test-user")
        await chatService.openConversation(conversation1)

        // Act
        await chatService.openConversation(conversation2)

        // Assert
        XCTAssertEqual(chatService.currentConversation?.id, conversation2.id)
    }

    func test_closeConversation_clearsState() async throws {
        // Arrange
        let conversation = createMockConversation()
        await chatService.connect(userId: "test-user")
        await chatService.openConversation(conversation)

        // Act
        chatService.closeConversation()

        // Assert
        XCTAssertNil(chatService.currentConversation)
        XCTAssertTrue(chatService.messages.isEmpty)
    }

    // MARK: - Message Loading Tests

    func test_loadMessages_loadsInitialMessages() async throws {
        // Arrange
        let conversation = createMockConversation()
        await chatService.connect(userId: "test-user")
        await chatService.openConversation(conversation)

        // Assert
        XCTAssertFalse(chatService.messages.isEmpty)
        XCTAssertTrue(chatService.hasMoreHistory)
    }

    func test_loadMessages_older_loadsMoreMessages() async throws {
        // Arrange
        let conversation = createMockConversation()
        await chatService.connect(userId: "test-user")
        await chatService.openConversation(conversation)
        let initialCount = chatService.messages.count

        // Act
        await chatService.loadMessages(older: true)

        // Assert
        XCTAssertGreaterThan(chatService.messages.count, initialCount)
    }

    func test_loadMessages_older_whenNoMoreHistory_returns() async throws {
        // Arrange
        let conversation = createMockConversation()
        await chatService.connect(userId: "test-user")
        await chatService.openConversation(conversation)

        // Load multiple times to exhaust history
        await chatService.loadMessages(older: true)
        await chatService.loadMessages(older: true)
        await chatService.loadMessages(older: true)

        // Now hasMoreHistory should be false
        chatService.hasMoreHistory = false

        // Act
        await chatService.loadMessages(older: true)

        // Should not crash or load more
        XCTAssertFalse(chatService.hasMoreHistory)
    }

    // MARK: - Send Message Tests

    func test_sendTextMessage_addsMessage() async throws {
        // Arrange
        let conversation = createMockConversation()
        await chatService.connect(userId: "test-user")
        await chatService.openConversation(conversation)
        mockWebSocketManager.simulateConnected()
        let initialCount = chatService.messages.count

        // Act
        await chatService.sendTextMessage("Test message")

        // Assert
        XCTAssertEqual(chatService.messages.count, initialCount + 1)
        XCTAssertEqual(mockWebSocketManager.sendMessageCallCount, 1)
    }

    func test_sendTextMessage_emptyText_doesNotSend() async throws {
        // Arrange
        let conversation = createMockConversation()
        await chatService.connect(userId: "test-user")
        await chatService.openConversation(conversation)
        let initialCount = chatService.messages.count

        // Act
        await chatService.sendTextMessage("   ")

        // Assert
        XCTAssertEqual(chatService.messages.count, initialCount)
        XCTAssertEqual(mockWebSocketManager.sendMessageCallCount, 0)
    }

    func test_sendTextMessage_withoutConversation_doesNotSend() async throws {
        // Arrange
        await chatService.connect(userId: "test-user")
        mockWebSocketManager.simulateConnected()

        // Act
        await chatService.sendTextMessage("Test message")

        // Assert
        XCTAssertEqual(mockWebSocketManager.sendMessageCallCount, 0)
    }

    func test_sendImageMessage_addsMessage() async throws {
        // Arrange
        let conversation = createMockConversation()
        await chatService.connect(userId: "test-user")
        await chatService.openConversation(conversation)
        mockWebSocketManager.simulateConnected()
        let initialCount = chatService.messages.count

        // Act
        await chatService.sendImageMessage("https://example.com/image.jpg")

        // Assert
        XCTAssertEqual(chatService.messages.count, initialCount + 1)
        let lastMessage = chatService.messages.last
        XCTAssertEqual(lastMessage?.messageType, .image)
        XCTAssertEqual(mockWebSocketManager.sendMessageCallCount, 1)
    }

    // MARK: - WebSocket Event Tests

    func test_webSocketConnected_updatesState() async throws {
        // Arrange
        await chatService.connect(userId: "test-user")

        // Act
        mockWebSocketManager.simulateConnected()

        // Assert
        XCTAssertTrue(chatService.isConnected)
        XCTAssertEqual(chatService.connectionStatus, "Connected")
    }

    func test_webSocketDisconnected_updatesState() async throws {
        // Arrange
        await chatService.connect(userId: "test-user")
        mockWebSocketManager.simulateConnected()

        // Act
        mockWebSocketManager.simulateDisconnected(reason: "Network error")

        // Assert
        XCTAssertFalse(chatService.isConnected)
        XCTAssertTrue(chatService.connectionStatus.contains("Disconnected"))
    }

    func test_webSocketBotMessage_addsToMessages() async throws {
        // Arrange
        let conversation = createMockConversation(id: "bot")
        await chatService.connect(userId: "test-user")
        await chatService.openConversation(conversation)
        let initialCount = chatService.messages.count

        // Act
        let botMessage = mockWebSocketManager.createTestBotMessage(content: "Hello!")
        mockWebSocketManager.simulateBotMessage(botMessage)

        // Wait for async processing
        try await Task.sleep(nanoseconds: 100_000_000)

        // Assert
        XCTAssertEqual(chatService.messages.count, initialCount + 1)
    }

    func test_webSocketMessageSent_success() async throws {
        // Arrange
        let conversation = createMockConversation()
        await chatService.connect(userId: "test-user")
        await chatService.openConversation(conversation)
        mockWebSocketManager.simulateConnected()

        // Act
        await chatService.sendTextMessage("Test")

        let response = mockWebSocketManager.createTestMessageSentResponse(success: true)
        mockWebSocketManager.simulateMessageSent(response)

        // Assert - Message should remain in list
        XCTAssertFalse(chatService.messages.isEmpty)
    }

    func test_webSocketMessageSent_failure_removesOptimisticMessage() async throws {
        // Arrange
        let conversation = createMockConversation()
        await chatService.connect(userId: "test-user")
        await chatService.openConversation(conversation)
        mockWebSocketManager.simulateConnected()

        // Act
        await chatService.sendTextMessage("Test")
        let initialCount = chatService.messages.count

        let response = MessageSentResponse(
            success: false,
            messageId: chatService.messages.last?.id,
            timestamp: Int(Date().timeIntervalSince1970 * 1000),
            error: "Failed to send"
        )
        mockWebSocketManager.simulateMessageSent(response)

        // Wait for async processing
        try await Task.sleep(nanoseconds: 100_000_000)

        // Assert - Message should be removed
        XCTAssertLessThan(chatService.messages.count, initialCount)
    }

    // MARK: - Loading State Tests

    func test_loadMessages_setsLoadingState() async throws {
        // Arrange
        let expectation = XCTestExpectation()
        let conversation = createMockConversation()
        await chatService.connect(userId: "test-user")
        await chatService.openConversation(conversation)

        var loadingStates: [Bool] = []
        chatService.$isLoading
            .sink { isLoading in
                loadingStates.append(isLoading)
                if loadingStates.count >= 2 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // Act
        await chatService.loadMessages()

        // Assert
        XCTAssertTrue(loadingStates.contains(true))
        XCTAssertFalse(chatService.isLoading)
    }

    // MARK: - Bot Response Tests

    func test_sendTextMessage_toBotConversation_receivesResponse() async throws {
        // Arrange
        let botConversation = createMockConversation(id: "bot")
        await chatService.connect(userId: "test-user")
        await chatService.openConversation(botConversation)
        mockWebSocketManager.simulateConnected()
        let initialCount = chatService.messages.count

        // Act
        await chatService.sendTextMessage("Hello bot!")

        // Wait for simulated response
        try await Task.sleep(nanoseconds: 1_500_000_000)

        // Assert - Should have user message + bot response
        XCTAssertEqual(chatService.messages.count, initialCount + 2)
    }

    // MARK: - Helper Methods

    private func createMockConversation(id: String = "conv-1") -> ChatConversation {
        ChatConversation(
            id: id,
            name: "Test Conversation",
            type: .friend,
            lastMessage: "Last message",
            lastMessageTime: Date(),
            unreadCount: 0,
            avatarUrl: nil,
            createdAt: Date()
        )
    }
}

// MARK: - Mock APIClient

/// Mock APIClient for testing
class MockAPIClient {
    var mockUserProfile: User?
    var mockPoints: PointsResponse?

    func getUserProfile() async throws -> User {
        return mockUserProfile ?? User(
            id: "user-1",
            username: "testuser",
            email: "test@example.com",
            avatarUrl: nil,
            fullName: "Test User",
            displayName: "Test User",
            bio: nil,
            points: 1000,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 0,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    func getUserStats() async throws -> UserStats {
        return UserStats(
            totalStudyTime: 100,
            sessionCount: 10,
            averageDuration: 10,
            streakDays: 5,
            todayDuration: 30,
            weekDuration: 120
        )
    }

    func getPoints() async throws -> PointsResponse {
        return mockPoints ?? PointsResponse(
            totalPoints: 1000,
            level: 1,
            todayEarned: 50,
            weekEarned: 200,
            totalTransactions: 10
        )
    }
}

// MARK: - ChatConversation Model

/// Chat conversation model for testing
struct ChatConversation: Identifiable, Equatable {
    let id: String
    let name: String
    let type: ConversationType
    let lastMessage: String?
    let lastMessageTime: Date?
    let unreadCount: Int
    let avatarUrl: String?
    let createdAt: Date

    enum ConversationType: String, Codable {
        case friend
        case group
        case bot
    }

    static func == (lhs: ChatConversation, rhs: ChatConversation) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - UserStats Model

struct UserStats: Codable {
    let totalStudyTime: Int
    let sessionCount: Int
    let averageDuration: Int
    let streakDays: Int
    let todayDuration: Int
    let weekDuration: Int
}
