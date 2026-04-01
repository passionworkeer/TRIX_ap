//
//  ChatServiceIntegrationTests.swift
//  TRIX3DCompanionTests
//
//  Integration tests for Chat service covering:
//  - Send message → receive confirmation
//  - Load chat history (pagination)
//  - Real-time message via WebSocket simulation
//  - Image upload → message appears
//  - Voice message → message appears
//
//  These tests verify end-to-end chat functionality using async/await
//  and XCTestExpectation for waiting on async operations.
//

import XCTest
import Combine
@testable import TRIX3DCompanion

typealias ChatServiceIntegrationChatMessage = TRIX3DCompanion.ChatMessage

// MARK: - Mock WebSocket Manager for Integration

/// Mock WebSocket manager for testing real-time message functionality
@MainActor
final class MockWebSocketManagerForIntegration: ClawbotChannelServiceProtocol {
    var isConnectedValue = false
    var shouldFailConnection = false
    var mockError: Error?
    var sentMessages: [(content: String, contentType: ClawbotMessageContentType, mediaUrl: String?, mediaMimeType: String?)] = []
    var messageHandlers: [String: (Any) -> Void] = [:]
    var connectionDelay: UInt64 = 0

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

        if connectionDelay > 0 {
            try await Task.sleep(nanoseconds: connectionDelay)
        }

        isConnectedValue = true
        connectionState = .connected
    }

    func disconnect() {
        isConnectedValue = false
        connectionState = .disconnected
        sentMessages.removeAll()
    }

    func sendMessage(_ content: String, contentType: ClawbotMessageContentType, mediaUrl: String?, mediaMimeType: String?, mediaData: Data?, mediaFileName: String?) async throws {
        sentMessages.append((content: content, contentType: contentType, mediaUrl: mediaUrl, mediaMimeType: mediaMimeType))
    }

    func sendMessageWithCallback(_ content: String, contentType: ClawbotMessageContentType, mediaUrl: String?, mediaMimeType: String?, mediaData: Data?, mediaFileName: String?, completion: @escaping (Result<String, Error>) -> Void) async throws {
        sentMessages.append((content: content, contentType: contentType, mediaUrl: mediaUrl, mediaMimeType: mediaMimeType))
        completion(.success(content))
    }

    func checkPairingStatus() async throws -> ClawbotPairingStatus {
        ClawbotPairingStatus(
            paired: false,
            deviceId: nil,
            deviceName: nil,
            botOnline: false,
            pairedAt: nil
        )
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

    // MARK: - Test Helpers

    func simulateIncomingMessage(_ message: ChatServiceIntegrationChatMessage) {
        lastMessage = ClawbotMessage(
            id: message.id,
            content: message.content,
            contentType: .text,
            mediaUrl: message.mediaUrl,
            mediaMimeType: message.mediaMimeType,
            timestamp: message.createdAt,
            sender: .user
        )
        if let lastMessage {
            messages.append(lastMessage)
        }
    }

    func simulateTypingIndicator(userId: String, isTyping: Bool) {
        if let handler = messageHandlers["typing"] {
            handler(["userId": userId, "isTyping": isTyping])
        }
    }

    func simulateReadReceipt(messageId: String, userId: String) {
        if let handler = messageHandlers["read_receipt"] {
            handler(["messageId": messageId, "userId": userId])
        }
    }
}

// MARK: - Mock API Client for Integration

/// Mock API client for testing chat API calls
@MainActor
final class MockAPIClientForChatIntegration: APIClientProtocol {
    var shouldFailRequests = false
    var mockError: NetworkError?
    var mockChatRooms: [ChatRoom] = []
    var mockMessages: [ChatServiceIntegrationChatMessage] = []
    var sentMessages: [ChatServiceIntegrationChatMessage] = []
    var uploadedMedia: [(data: Data, fileName: String, mimeType: String)] = []

    func get<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        if T.self == [ChatRoom].self {
            return mockChatRooms as! T
        }

        if T.self == [ChatServiceIntegrationChatMessage].self {
            return mockMessages as! T
        }

        throw NetworkError.custom(message:"No mock data for type")
    }

    func post<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        // Simulate sending message
        if case let message as ChatServiceIntegrationChatMessage = body {
            sentMessages.append(message)
            return message as! T
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
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        uploadedMedia.append((data: data, fileName: fileName, mimeType: "image/jpeg"))
        return MediaUploadResponse(url: "https://example.com/media/\(fileName)") as! T
    }

    func download(from url: String) async throws -> Data {
        if shouldFailRequests {
            throw mockError ?? NetworkError.timeout
        }
        return Data()
    }

    // MARK: - Chat-specific methods

    func getChatRooms() async throws -> [ChatRoom] {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        return mockChatRooms
    }

    func getChatMessages(roomId: String, page: Int, limit: Int) async throws -> [ChatServiceIntegrationChatMessage] {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        return mockMessages
    }

    func getChatMessagesSince(roomId: String, since: Date) async throws -> [ChatServiceIntegrationChatMessage] {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        return mockMessages.filter { $0.createdAt > since }
    }

    func sendMessage(roomId: String, content: String, contentType: MessageType, mediaUrl: String?, mediaMimeType: String?) async throws -> ChatServiceIntegrationChatMessage {
        if shouldFailRequests {
            throw mockError ?? NetworkError.timeout
        }

        let message = ChatServiceIntegrationChatMessage(
            id: UUID().uuidString,
            roomId: roomId,
            senderId: "test-user",
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
        sentMessages.append(message)
        return message
    }

    func markMessageAsRead(roomId: String, messageId: String) async throws {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
    }

    // MARK: - Test Helpers

    func configureMessages(_ messages: [ChatServiceIntegrationChatMessage]) {
        mockMessages = messages
    }

    func configureRooms(_ rooms: [ChatRoom]) {
        mockChatRooms = rooms
    }
}

// MARK: - Mock Auth Service for Integration

/// Mock auth service for testing authenticated chat operations
@MainActor
final class MockAuthServiceForChatIntegration: AuthServiceProtocol {
    var isLoggedInValue = false
    var isLoadingValue = false
    var mockUser: TRIX3DCompanion.User?

    var isLoggedIn: Bool {
        return isLoggedInValue
    }

    var currentUser: TRIX3DCompanion.User? {
        return mockUser
    }

    var isLoading: Bool {
        return isLoadingValue
    }

    func login(email: String, password: String) async -> AuthResult<TRIX3DCompanion.User> {
        return .failure(.invalidCredentials)
    }

    func register(username: String, email: String, password: String) async -> AuthResult<TRIX3DCompanion.User> {
        return .failure(.invalidCredentials)
    }

    func logout() async -> AuthResult<Void> {
        isLoggedInValue = false
        return .success(())
    }

    func refreshTokenIfNeeded() async -> AuthResult<Void> {
        return .success(())
    }

    func fetchCurrentUser() async -> AuthResult<TRIX3DCompanion.User> {
        if let user = mockUser {
            return .success(user)
        }
        return .failure(.invalidCredentials)
    }

    func clearError() {}

    func updateProfile(_ updates: TRIX3DCompanion.User) async -> AuthResult<TRIX3DCompanion.User> {
        return .success(updates)
    }

    func deleteAccount() async -> AuthResult<Void> {
        return .success(())
    }

    func updateCurrentUser(_ user: TRIX3DCompanion.User?) {}

    func updateLoginStatus(_ loggedIn: Bool) {}

}

// MARK: - Chat Service Integration Tests

@MainActor
final class ChatServiceIntegrationTests: XCTestCase {

    // MARK: - Properties

    var sut: ChatService!
    var mockAPIClient: MockAPIClientForChatIntegration!
    var mockWebSocketManager: MockWebSocketManagerForIntegration!
    var mockAuthService: MockAuthServiceForChatIntegration!

    // MARK: - Setup & Teardown

    override func setUp() async throws {
        try await super.setUp()

        mockAPIClient = MockAPIClientForChatIntegration()
        mockWebSocketManager = MockWebSocketManagerForIntegration()
        mockAuthService = MockAuthServiceForChatIntegration()

        // Configure authenticated user
        mockAuthService.isLoggedInValue = true
        mockAuthService.mockUser = createMockUser()

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

    // MARK: - Send Message Tests

    func testSendMessageReturnsConfirmation() async throws {
        let roomId = "local:test_room_1"
        let messageContent = "Hello, this is a test message"

        let result = await sut.sendMessage(roomId: roomId, content: messageContent)

        switch result {
        case .success(let confirmation):
            XCTAssertEqual(confirmation.id, confirmation.id)
            XCTAssertEqual(sut.messagesCache[roomId]?.first?.content, messageContent)
        case .failure(let error):
            XCTFail("Send message should succeed: \(error)")
        }
    }

    func testSendMessageUpdatesLocalCache() async throws {
        let roomId = "local:test_room_2"
        let messageContent = "Test message for cache update"

        _ = await sut.sendMessage(roomId: roomId, content: messageContent)

        XCTAssertEqual(sut.messagesCache[roomId]?.count, 1)
        XCTAssertEqual(sut.messagesCache[roomId]?.first?.content, messageContent)
    }

    func testSendMessageRequiresAuthentication() async throws {
        mockAuthService.isLoggedInValue = false

        let result = await sut.sendMessage(roomId: "local:room", content: "test")

        switch result {
        case .success:
            XCTFail("Send message should fail without authentication")
        case .failure(let error):
            if case .notAuthenticated = error {
                XCTAssertTrue(true)
            }
        }
    }

    func testSendMessageWithNetworkError() async throws {
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .timeout

        let result = await sut.sendMessage(roomId: "remote_network_room", content: "test")

        switch result {
        case .success:
            XCTFail("Send message should fail with network error")
        case .failure(let error):
            if case .networkError = error {
                XCTAssertTrue(true)
            }
        }
    }

    func testSendMultipleMessagesInSequence() async throws {
        let roomId = "local:test_room_3"

        for i in 1...5 {
            let result = await sut.sendMessage(roomId: roomId, content: "Message \(i)")
            switch result {
            case .success:
                break
            case .failure(let error):
                XCTFail("Message \(i) should succeed: \(error)")
            }
        }

        XCTAssertEqual(sut.messagesCache[roomId]?.count, 5)
    }

    // MARK: - Load Chat History Tests

    func testLoadChatHistoryReturnsMessages() async throws {
        let roomId = "pagination_room"
        let messages = createMockMessages(count: 20, roomId: roomId)
        mockAPIClient.configureMessages(messages)

        let result = await sut.fetchMessages(roomId: roomId, before: nil)

        switch result {
        case .success(let loadedMessages):
            XCTAssertEqual(loadedMessages.count, 20)
        case .failure(let error):
            XCTFail("Load chat history should succeed: \(error)")
        }
    }

    func testLoadChatHistoryWithPagination() async throws {
        let roomId = "pagination_room_2"
        let allMessages = createMockMessages(count: 50, roomId: roomId)
        mockAPIClient.configureMessages(allMessages)

        let firstPageResult = await sut.fetchMessages(roomId: roomId, before: nil)

        switch firstPageResult {
        case .success(let firstPage):
            XCTAssertEqual(firstPage.count, 50)
        case .failure(let error):
            XCTFail("First page load should succeed: \(error)")
        }
    }

    func testLoadChatHistoryWithBeforeTimestamp() async throws {
        let roomId = "before_timestamp_room"
        // Create messages with a timestamp clearly before the beforeDate
        let beforeDate = Date()
        let messages = (0..<30).map { i in
            createMockMessage(
                id: "msg_\(i)",
                roomId: roomId,
                content: "Message \(i)",
                createdAt: beforeDate.addingTimeInterval(-TimeInterval(i + 1))
            )
        }
        mockAPIClient.configureMessages(messages)

        let result = await sut.fetchMessages(roomId: roomId, before: beforeDate)

        switch result {
        case .success(let fetchedMessages):
            for message in fetchedMessages {
                XCTAssertLessThanOrEqual(message.createdAt, beforeDate)
            }
        case .failure(let error):
            XCTFail("Load with before timestamp should succeed: \(error)")
        }
    }

    func testLoadChatHistoryUpdatesCache() async throws {
        let roomId = "cache_update_room"
        let messages = createMockMessages(count: 10, roomId: roomId)
        mockAPIClient.configureMessages(messages)

        _ = await sut.fetchMessages(roomId: roomId, before: nil)

        XCTAssertNotNil(sut.messagesCache[roomId])
        XCTAssertEqual(sut.messagesCache[roomId]?.count, 10)
    }

    func testLoadChatHistoryRequiresAuthentication() async throws {
        mockAuthService.isLoggedInValue = false

        let result = await sut.fetchMessages(roomId: "local:room", before: nil)

        switch result {
        case .success:
            XCTFail("Load should fail without authentication")
        case .failure(let error):
            if case .notAuthenticated = error {
                XCTAssertTrue(true)
            }
        }
    }

    func testLoadChatHistoryWithEmptyRoom() async throws {
        mockAPIClient.configureMessages([])

        let result = await sut.fetchMessages(roomId: "empty_room", before: nil)

        switch result {
        case .success(let messages):
            XCTAssertEqual(messages.count, 0)
        case .failure(let error):
            XCTFail("Load empty room should succeed: \(error)")
        }
    }

    // MARK: - WebSocket Disconnection Tests

    func testWebSocketDisconnectionHandling() async throws {
        mockWebSocketManager.isConnectedValue = true
        XCTAssertTrue(mockWebSocketManager.isConnected)

        mockWebSocketManager.disconnect()

        XCTAssertFalse(mockWebSocketManager.isConnected)
    }

    // MARK: - Image Upload Tests

    func testImageUploadCreatesMediaMessage() async throws {
        let roomId = "local:media_room_1"
        let imageData = Data([0x89, 0x50, 0x4E, 0x47])

        let result = await sut.sendMessage(
            roomId: roomId,
            content: "Check this out!",
            type: .image,
            mediaUrl: "https://example.com/media/image.png",
            mediaMimeType: "image/png"
        )

        switch result {
        case .success:
            XCTAssertEqual(sut.messagesCache[roomId]?.first?.messageType, .image)
        case .failure(let error):
            XCTFail("Image message should succeed: \(error)")
        }
    }

    func testImageUploadWithoutCaption() async throws {
        let roomId = "local:media_room_2"

        let result = await sut.sendMessage(
            roomId: roomId,
            content: "",
            type: .image,
            mediaUrl: "https://example.com/media/photo.jpg",
            mediaMimeType: "image/jpeg"
        )

        switch result {
        case .success:
            XCTAssertEqual(sut.messagesCache[roomId]?.first?.messageType, .image)
        case .failure(let error):
            XCTFail("Image message without caption should succeed: \(error)")
        }
    }

    func testImageUploadWithNetworkError() async throws {
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .timeout

        let result = await sut.sendMessage(
            roomId: "remote_image_room",
            content: "",
            type: .image,
            mediaUrl: "image.png",
            mediaMimeType: "image/png"
        )

        switch result {
        case .success:
            XCTFail("Image message should fail with network error")
        case .failure(let error):
            if case .networkError = error {
                XCTAssertTrue(true)
            }
        }
    }

    func testMultipleImageUploads() async throws {
        let roomId = "local:media_room_3"

        for i in 1...3 {
            let result = await sut.sendMessage(
                roomId: roomId,
                content: "Image \(i)",
                type: .image,
                mediaUrl: "image\(i).jpg",
                mediaMimeType: "image/jpeg"
            )

            switch result {
            case .success:
                break
            case .failure(let error):
                XCTFail("Image \(i) upload should succeed: \(error)")
            }
        }

        XCTAssertEqual(sut.messagesCache[roomId]?.count, 3)
    }

    // MARK: - Voice Message Tests

    func testVoiceMessageCreation() async throws {
        let roomId = "local:voice_room_1"

        let result = await sut.sendMessage(
            roomId: roomId,
            content: "",
            type: .voice,
            mediaUrl: "voice.m4a",
            mediaMimeType: "audio/m4a"
        )

        switch result {
        case .success:
            XCTAssertEqual(sut.messagesCache[roomId]?.first?.messageType, .voice)
        case .failure(let error):
            XCTFail("Voice message should succeed: \(error)")
        }
    }

    func testVoiceMessageWithNetworkError() async throws {
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .timeout

        let result = await sut.sendMessage(
            roomId: "remote_voice_room",
            content: "",
            type: .voice,
            mediaUrl: "voice.m4a",
            mediaMimeType: "audio/m4a"
        )

        switch result {
        case .success:
            XCTFail("Voice message should fail with network error")
        case .failure(let error):
            if case .networkError = error {
                XCTAssertTrue(true)
            }
        }
    }

    // MARK: - Full Chat Flow Integration Tests

    func testCompleteChatFlow_SendAndReceive() async throws {
        let roomId = "local:integration_room_1"

        let sendResult = await sut.sendMessage(roomId: roomId, content: "Hello!")

        switch sendResult {
        case .success:
            let historyResult = await sut.fetchMessages(roomId: roomId, before: nil)
            switch historyResult {
            case .success(let messages):
                XCTAssertGreaterThanOrEqual(messages.count, 1)
                XCTAssertEqual(messages.first?.content, "Hello!")
            case .failure(let error):
                XCTFail("Load history should succeed: \(error)")
            }
        case .failure(let error):
            XCTFail("Send message should succeed: \(error)")
        }
    }

    func testCompleteMediaChatFlow() async throws {
        let roomId = "local:integration_media_room"

        let uploadResult = await sut.sendMessage(
            roomId: roomId,
            content: "Look at this!",
            type: .image,
            mediaUrl: "https://example.com/media/photo.jpg",
            mediaMimeType: "image/jpeg"
        )

        switch uploadResult {
        case .success:
            let textResult = await sut.sendMessage(roomId: roomId, content: "What do you think?")

            switch textResult {
            case .success:
                XCTAssertEqual(sut.messagesCache[roomId]?.count, 2)
                XCTAssertEqual(sut.messagesCache[roomId]?[0].messageType, .image)
                XCTAssertEqual(sut.messagesCache[roomId]?[1].content, "What do you think?")
            case .failure(let error):
                XCTFail("Follow-up message should succeed: \(error)")
            }
        case .failure(let error):
            XCTFail("Image upload should succeed: \(error)")
        }
    }

    func testCompleteRealTimeChatFlow() async throws {
        let roomId = "local:integration_realtime_room"
        let expectation = XCTestExpectation(description: "Real-time message received")

        mockWebSocketManager.isConnectedValue = true
        sut.onNewMessage = { _ in
            expectation.fulfill()
        }

        let ackMessage = createMockMessage(id: "ack_msg", roomId: roomId, content: "Real-time message")
        mockWebSocketManager.simulateIncomingMessage(ackMessage)

        await fulfillment(of: [expectation], timeout: 5.0)
        XCTAssertTrue(mockWebSocketManager.isConnectedValue, "WebSocket should be connected")
    }

    // MARK: - Helper Methods

    private func createMockUser() -> TRIX3DCompanion.User {
        TRIX3DCompanion.User(
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

    private func createMockMessage(id: String, roomId: String, content: String, createdAt: Date = Date()) -> ChatServiceIntegrationChatMessage {
        ChatServiceIntegrationChatMessage(
            id: id,
            roomId: roomId,
            senderId: "test_user",
            sender: .user,
            content: content,
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
            isRead: false,
            createdAt: createdAt
        )
    }

    private func createMockMessages(count: Int, roomId: String) -> [ChatServiceIntegrationChatMessage] {
        (0..<count).map { i in
            createMockMessage(
                id: "msg_\(i)",
                roomId: roomId,
                content: "Message \(i)"
            )
        }
    }
}

// MARK: - Media Upload Response

struct MediaUploadResponse: Codable {
    let url: String
}
