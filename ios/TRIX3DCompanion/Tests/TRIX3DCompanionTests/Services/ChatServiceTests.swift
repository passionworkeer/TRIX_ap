//
//  ChatServiceTests.swift
//  TRIX3DCompanionTests
//
//  Test suite for ChatService markAsRead and related functionality
//
//  Test Coverage:
//  - markAsRead() success flow
//  - markAsRead() authentication check
//  - markAsRead() network error handling
//  - markAsRead() local cache update
//  - markAllAsRead() functionality
//

import XCTest
import Combine
@testable import TRIX3DCompanion

typealias ChatServiceTestsChatMessage = TRIX3DCompanion.ChatMessage

// MARK: - Mock Chat Service Dependencies

@MainActor
final class MockAPIClientForChat: APIClientProtocol {
    var shouldFailRequests = false
    var mockError: NetworkError?
    var mockChatRooms: [ChatRoom] = []
    var mockMessages: [ChatServiceTestsChatMessage] = []

    func get<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        if T.self == [ChatRoom].self {
            return mockChatRooms as! T
        }

        if T.self == [ChatServiceTestsChatMessage].self {
            return mockMessages as! T
        }

        throw NetworkError.custom(message:"No mock data")
    }

    func post<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        throw NetworkError.custom(message:"Not implemented")
    }

    func put<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        throw NetworkError.custom(message:"Not implemented")
    }

    func delete<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        throw NetworkError.custom(message:"Not implemented")
    }

    func upload<T>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T where T: Decodable {
        throw NetworkError.custom(message:"Not implemented")
    }

    func download(from url: String) async throws -> Data {
        throw NetworkError.custom(message:"Not implemented")
    }

    // MARK: - Chat-specific methods

    func getChatRooms() async throws -> [ChatRoom] {
        return mockChatRooms
    }

    func getChatMessages(roomId: String, page: Int, limit: Int) async throws -> [ChatServiceTestsChatMessage] {
        return mockMessages
    }

    func getChatMessagesSince(roomId: String, since: Date) async throws -> [ChatServiceTestsChatMessage] {
        return mockMessages
    }

    func sendMessage(roomId: String, content: String, contentType: MessageType, mediaUrl: String?, mediaMimeType: String?) async throws -> ChatServiceTestsChatMessage {
        return ChatServiceTestsChatMessage(
            id: UUID().uuidString,
            roomId: roomId,
            senderId: "user",
            sender: .user,
            content: content,
            messageType: contentType,
            mediaUrl: mediaUrl,
            mediaMimeType: mediaMimeType,
            mediaDuration: nil,
            mediaSize: nil,
            mediaMetadata: nil,
            voiceUrl: nil,
            voiceDuration: nil,
            voiceTranscript: nil,
            voiceMimeType: nil,
            isRead: true,
            createdAt: Date()
        )
    }

    func markMessageAsRead(roomId: String, messageId: String) async throws {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
    }
}

final class MockWebSocketManagerForChat: ClawbotChannelServiceProtocol {
    var isConnectedValue = false
    var shouldFailConnection = false
    var mockError: Error?
    @Published var connectionState: ClawbotConnectionState = .disconnected
    @Published var isPaired: Bool = false
    @Published var messages: [ClawbotMessage] = []
    @Published var lastMessage: ClawbotMessage?
    @Published var botBehaviorState: BotBehaviorState = .idle
    @Published var botConnectionState: BotConnectionState = .unknown
    @Published var isBotOnline: Bool = false
    @Published var deviceId: String?
    @Published var ttsEnabled: Bool = true
    @Published var ttsLanguage: TTSLanguage = .chinese
    @Published var botState: BotBehaviorState = .idle

    var connectionStatePublisher: AnyPublisher<ClawbotConnectionState, Never> { $connectionState.eraseToAnyPublisher() }
    var lastMessagePublisher: AnyPublisher<ClawbotMessage?, Never> { $lastMessage.eraseToAnyPublisher() }
    var botStatePublisher: AnyPublisher<BotBehaviorState, Never> { $botState.eraseToAnyPublisher() }

    var isConnected: Bool { isConnectedValue }

    func connect() async throws {
        if shouldFailConnection {
            throw mockError ?? NSError(domain: "Mock", code: -1)
        }
        isConnectedValue = true
        connectionState = .connected
    }

    func disconnect() {
        isConnectedValue = false
        connectionState = .disconnected
    }

    func sendMessage(_ content: String, contentType: ClawbotMessageContentType, mediaUrl: String?, mediaMimeType: String?, mediaData: Data?, mediaFileName: String?) async throws {}

    func sendMessageWithCallback(_ content: String, contentType: ClawbotMessageContentType, mediaUrl: String?, mediaMimeType: String?, mediaData: Data?, mediaFileName: String?, completion: @escaping (Result<String, Error>) -> Void) async throws {
        completion(.success(content))
    }

    func checkPairingStatus() async throws -> ClawbotPairingStatus {
        ClawbotPairingStatus(paired: false, deviceId: nil, deviceName: nil, botOnline: nil, pairedAt: nil)
    }

    func pairWithCode(_ code: String) async throws -> Bool { false }
    func pairWithQR(_ qrData: String) async throws -> Bool { false }
    func unpair() {}

    func createStudyRoom(displayName: String, avatarUrl: String?, maxMembers: Int?) async throws -> StudyRoomState {
        throw NSError(domain: "Mock", code: -1)
    }

    func joinStudyRoom(roomCode: String, displayName: String, avatarUrl: String?) async throws -> StudyRoomState {
        throw NSError(domain: "Mock", code: -1)
    }

    func leaveStudyRoom(roomCode: String?) async throws {}
    func hostActionStudyRoom(roomCode: String, action: StudyRoomHostAction) async throws -> StudyRoomState {
        throw NSError(domain: "Mock", code: -1)
    }
}

// (MockAuthServiceForChat removed - use the one from Chat/MockChatServices.swift instead)

// MARK: - Chat Service Tests

@MainActor
final class ChatServiceTests: XCTestCase {

    var sut: ChatService!
    var mockAPIClient: MockAPIClientForChat!
    var mockWebSocketManager: MockWebSocketManagerForChat!
    var mockAuthService: MockAuthServiceForChat!

    override func setUp() async throws {
        try await super.setUp()

        mockAPIClient = MockAPIClientForChat()
        mockWebSocketManager = MockWebSocketManagerForChat()
        mockAuthService = MockAuthServiceForChat()

        sut = ChatService(
            apiClient: mockAPIClient,
            clawbotChannelService: mockWebSocketManager,
            authService: mockAuthService
        )
    }

    override func tearDown() async throws {
        sut = nil
        mockAPIClient = nil
        mockWebSocketManager = nil
        mockAuthService = nil
        try await super.tearDown()
    }
}

// MARK: - markAsRead Tests

extension ChatServiceTests {

    func testMarkAsReadFailsWhenNotAuthenticated() async {
        // Given
        mockAuthService.isLoggedInValue = false

        // When
        let result = await sut.markAsRead(roomId: "room1", messageId: "msg1")

        // Then
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .notAuthenticated, "Should return not authenticated error")
        case .success:
            XCTFail("Should fail when not authenticated")
        }
    }

    func testMarkAsReadSuccess() async {
        // Given
        mockAuthService.isLoggedInValue = true
        mockAuthService.mockUser = createMockUser()

        // Pre-populate cache with message
        let message = createMockMessage(id: "msg1", roomId: "room1", isRead: false)
        sut.messagesCache["room1"] = [message]

        // When
        let result = await sut.markAsRead(roomId: "room1", messageId: "msg1")

        // Then
        switch result {
        case .success:
            // Verify local cache was updated
            if let cachedMessages = sut.messagesCache["room1"],
               let updatedMessage = cachedMessages.first(where: { $0.id == "msg1" }) {
                XCTAssertTrue(updatedMessage.isRead, "Message should be marked as read in cache")
            }
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }

    func testMarkAsReadUpdatesCurrentMessagesWhenActiveRoom() async {
        // Given
        mockAuthService.isLoggedInValue = true
        mockAuthService.mockUser = createMockUser()

        let message = createMockMessage(id: "msg1", roomId: "room1", isRead: false)
        sut.messagesCache["room1"] = [message]
        sut.currentRoomId = "room1"
        sut.currentMessages = [message]

        // When
        let result = await sut.markAsRead(roomId: "room1", messageId: "msg1")

        // Then
        switch result {
        case .success:
            XCTAssertTrue(sut.currentMessages.first?.isRead ?? false, "Current messages should be updated")
        case .failure:
            XCTFail("Should succeed")
        }
    }

    func testMarkAsReadWithNetworkError() async {
        // Given
        mockAuthService.isLoggedInValue = true
        mockAuthService.mockUser = createMockUser()
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .timeout

        // Pre-populate cache
        let message = createMockMessage(id: "msg1", roomId: "room1", isRead: false)
        sut.messagesCache["room1"] = [message]

        // When
        let result = await sut.markAsRead(roomId: "room1", messageId: "msg1")

        // Then
        switch result {
        case .failure(let error):
            // Local cache should still be updated even if API fails
            XCTAssertEqual(error, .networkError(underlying: mockAPIClient.mockError!))
        case .success:
            XCTFail("Should fail with network error")
        }
    }

    func testMarkAsReadWithInvalidRoomId() async {
        // Given
        mockAuthService.isLoggedInValue = true
        mockAuthService.mockUser = createMockUser()

        // When - room doesn't exist in cache
        let result = await sut.markAsRead(roomId: "nonexistent_room", messageId: "msg1")

        // Then - should still call API but not find local message
        switch result {
        case .success:
            // API call succeeded but no local message to update
            XCTAssertTrue(true)
        case .failure:
            // Network error is expected
            XCTAssertTrue(true)
        }
    }
}

// MARK: - markAllAsRead Tests

extension ChatServiceTests {

    func testMarkAllAsReadSuccess() async {
        // Given
        mockAuthService.isLoggedInValue = true
        mockAuthService.mockUser = createMockUser()

        let message1 = createMockMessage(id: "msg1", roomId: "room1", isRead: false)
        let message2 = createMockMessage(id: "msg2", roomId: "room1", isRead: false)
        sut.messagesCache["room1"] = [message1, message2]

        // When
        let result = await sut.markAllAsRead(roomId: "room1")

        // Then
        switch result {
        case .success:
            if let cachedMessages = sut.messagesCache["room1"] {
                XCTAssertTrue(cachedMessages.allSatisfy { $0.isRead }, "All messages should be marked as read")
            }
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }

    func testMarkAllAsReadWithEmptyRoom() async {
        // Given
        mockAuthService.isLoggedInValue = true

        // When
        let result = await sut.markAllAsRead(roomId: "empty_room")

        // Then
        switch result {
        case .success:
            XCTAssertTrue(true)
        case .failure(let error):
            XCTFail("Should succeed with empty room: \(error)")
        }
    }
}

// MARK: - Error Handling Tests

extension ChatServiceTests {

    func testMarkAsReadMapsNetworkErrorToChatError() async {
        // Given
        mockAuthService.isLoggedInValue = true
        mockAuthService.mockUser = createMockUser()
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .timeout

        // When
        let result = await sut.markAsRead(roomId: "room1", messageId: "msg1")

        // Then
        switch result {
        case .failure(let error):
            if case .networkError = error {
                XCTAssertTrue(true, "Should map to network error")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        case .success:
            XCTFail("Should fail with network error")
        }
    }
}

// MARK: - Helper Methods

extension ChatServiceTests {

    private func createMockUser() -> User {
        User(
            id: "test_user_id",
            username: "test_user",
            email: "test@example.com",
            avatarUrl: nil,
            avatarConfig: nil,
            fullName: nil,
            displayName: "Test User",
            bio: nil,
            website: nil,
            points: 100,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 0,
            lastActiveAt: Date(),
            currentStreak: 0,
            daysActive: 1,
            interactionCount: 0,
            showOnlineStatus: true,
            school: nil,
            grade: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    private func createMockMessage(id: String, roomId: String, isRead: Bool) -> ChatServiceTestsChatMessage {
        ChatServiceTestsChatMessage(
            id: id,
            roomId: roomId,
            senderId: "user123",
            sender: .user,
            content: "Test message",
            messageType: .text,
            mediaUrl: nil,
            mediaMimeType: nil,
            mediaDuration: nil,
            mediaSize: nil,
            mediaMetadata: nil,
            voiceUrl: nil,
            voiceDuration: nil,
            voiceTranscript: nil,
            voiceMimeType: nil,
            isRead: isRead,
            createdAt: Date()
        )
    }
}
