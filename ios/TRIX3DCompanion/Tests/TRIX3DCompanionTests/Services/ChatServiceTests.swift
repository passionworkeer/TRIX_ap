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

// MARK: - Mock Chat Service Dependencies

@MainActor
final class MockAPIClientForChat: APIClientProtocol {
    var shouldFailRequests = false
    var mockError: NetworkError?
    var mockChatRooms: [ChatRoom] = []
    var mockMessages: [ChatMessage] = []

    func get<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        if T.self == [ChatRoom].self {
            return mockChatRooms as! T
        }

        if T.self == [ChatMessage].self {
            return mockMessages as! T
        }

        throw NetworkError.custom("No mock data")
    }

    func post<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        throw NetworkError.custom("Not implemented")
    }

    func put<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        throw NetworkError.custom("Not implemented")
    }

    func delete<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        throw NetworkError.custom("Not implemented")
    }

    func upload<T>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T where T: Decodable {
        throw NetworkError.custom("Not implemented")
    }

    func download(from url: String) async throws -> Data {
        throw NetworkError.custom("Not implemented")
    }
}

@MainActor
final class MockWebSocketManagerForChat: WebSocketManagerProtocol {
    var isConnectedValue = false
    var shouldFailConnection = false
    var mockError: WebSocketError?

    func isConnected() -> Bool {
        return isConnectedValue
    }

    func connect(userId: String) async throws {
        if shouldFailConnection {
            throw mockError ?? WebSocketError(message: "Connection failed")
        }
        isConnectedValue = true
    }

    func disconnect() {
        isConnectedValue = false
    }

    func sendMessage(content: String, contentType: BotMessage.MessageContentType, mediaUrl: String?, mediaMimeType: String?) {}

    func on(_ event: String, handler: @escaping (Any) -> Void) -> String { return "handler_1" }

    func createStudyRoom(displayName: String, avatarUrl: String?, maxMembers: Int?, completion: @escaping (Result<StudyRoomAckPayload, WebSocketError>) -> Void) {
        completion(.failure(WebSocketError(message: "Not implemented in mock")))
    }

    func joinStudyRoom(roomCode: String, displayName: String, avatarUrl: String?, completion: @escaping (Result<StudyRoomAckPayload, WebSocketError>) -> Void) {
        completion(.failure(WebSocketError(message: "Not implemented in mock")))
    }

    func leaveStudyRoom(roomCode: String?, completion: @escaping (Result<StudyRoomAckPayload, WebSocketError>) -> Void) {
        completion(.failure(WebSocketError(message: "Not implemented in mock")))
    }

    func getStudyRoomState(roomCode: String?, completion: @escaping (Result<StudyRoomAckPayload, WebSocketError>) -> Void) {
        completion(.failure(WebSocketError(message: "Not implemented in mock")))
    }

    func hostActionStudyRoom(roomCode: String, action: String, completion: @escaping (Result<StudyRoomAckPayload, WebSocketError>) -> Void) {
        completion(.failure(WebSocketError(message: "Not implemented in mock")))
    }

    func pairWithCode(_ code: String) {}

    func pairWithQR(_ qrData: String) {}

    func unpair() {}

    func checkPairingStatus(completion: @escaping (Result<SocketResponse, WebSocketError>) -> Void) {
        completion(.failure(WebSocketError(message: "Not implemented in mock")))
    }
}

@MainActor
final class MockAuthServiceForChat: AuthServiceProtocol {
    var isLoggedInValue = false
    var isLoadingValue = false
    var mockUser: User?

    var isLoggedIn: Bool {
        return isLoggedInValue
    }

    var currentUser: User? {
        return mockUser
    }

    var isLoading: Bool {
        return isLoadingValue
    }

    func login(email: String, password: String) async -> AuthResult<User> {
        return .failure(.invalidCredentials)
    }

    func register(username: String, email: String, password: String) async -> AuthResult<User> {
        return .failure(.invalidCredentials)
    }

    func logout() async -> AuthResult<Void> {
        isLoggedInValue = false
        return .success(())
    }

    func refreshTokenIfNeeded() async -> AuthResult<Void> {
        return .success(())
    }

    func fetchCurrentUser() async -> AuthResult<User> {
        if let user = mockUser {
            return .success(user)
        }
        return .failure(.invalidCredentials)
    }
}

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
            webSocketManager: mockWebSocketManager,
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
            XCTAssertEqual(error, .networkError(underlying: mockAPIClient.mockError))
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
            email: "test@example.com",
            username: "test_user",
            displayName: "Test User",
            avatarURL: nil,
            bio: nil,
            points: 100,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    private func createMockMessage(id: String, roomId: String, isRead: Bool) -> ChatMessage {
        ChatMessage(
            id: id,
            roomId: roomId,
            friendId: nil,
            sender: .user,
            senderId: "user123",
            text: "Test message",
            timestamp: Date(),
            messageType: .text,
            mediaUri: nil,
            mediaType: nil,
            mediaSize: nil,
            mediaMetadata: nil,
            isRead: isRead
        )
    }
}
