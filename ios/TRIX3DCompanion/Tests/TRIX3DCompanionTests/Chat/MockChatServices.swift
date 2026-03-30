//
//  MockChatServices.swift
//  TRIX3DCompanionTests
//
//  Mock implementations for Chat-related services
//  Used for testing ChatDetailViewModel and ChatListViewModel
//

import Foundation
import Combine
@testable import TRIX3DCompanion

// MARK: - Mock ClawbotChannelService

/// Minimal mock for ClawbotChannelService - needed to construct ChatService
@MainActor
final class MockClawbotChannelService: ObservableObject, ClawbotChannelServiceProtocol {

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

    // Call tracking
    private(set) var connectCallCount = 0
    private(set) var disconnectCallCount = 0
    private(set) var sendMessageCallCount = 0
    private(set) var lastSendContent: String?
    private(set) var lastSendContentType: ClawbotMessageContentType?

    // Configuration
    var shouldConnectThrowError = false
    var shouldSendMessageThrowError = false

    // ClawbotChannelServiceProtocol

    var isConnected: Bool { connectionState == .connected }

    func connect() async throws {
        connectCallCount += 1
        if shouldConnectThrowError {
            throw NSError(domain: "Mock", code: -1)
        }
        connectionState = .connected
    }

    func disconnect() {
        disconnectCallCount += 1
        connectionState = .disconnected
    }

    func checkPairingStatus() async throws -> ClawbotPairingStatus {
        ClawbotPairingStatus(paired: false, deviceId: nil, deviceName: nil, botOnline: nil, pairedAt: nil)
    }

    func pairWithCode(_ code: String) async throws -> Bool { false }
    func pairWithQR(_ qrData: String) async throws -> Bool { false }
    func unpair() {}

    func sendMessage(_ content: String, contentType: ClawbotMessageContentType, mediaUrl: String?, mediaMimeType: String?, mediaData: Data?, mediaFileName: String?) async throws {
        sendMessageCallCount += 1
        lastSendContent = content
        lastSendContentType = contentType
        if shouldSendMessageThrowError {
            throw NSError(domain: "Mock", code: -1)
        }
    }

    func sendMessageWithCallback(_ content: String, contentType: ClawbotMessageContentType, mediaUrl: String?, mediaMimeType: String?, mediaData: Data?, mediaFileName: String?, completion: @escaping (Result<String, Error>) -> Void) async throws {
        sendMessageCallCount += 1
        lastSendContent = content
        lastSendContentType = contentType
        if shouldSendMessageThrowError {
            completion(.failure(NSError(domain: "Mock", code: -1)))
        } else {
            completion(.success(content))
        }
    }

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

    func resetTracking() {
        connectCallCount = 0
        disconnectCallCount = 0
        sendMessageCallCount = 0
        lastSendContent = nil
        lastSendContentType = nil
    }
}

// MARK: - MockChatService

/// Mock ChatService that conforms to ChatServiceProtocol for testing.
/// Does NOT extend ChatService (which is final) - implements protocol directly.
@MainActor
final class MockChatService: ObservableObject, ChatServiceProtocol {

    // MARK: - Published Properties (ChatServiceProtocol)

    @Published private(set) var chatRooms: [ChatRoom] = []
    @Published private(set) var currentMessages: [ChatMessage] = []
    @Published private(set) var isLoadingRooms: Bool = false
    @Published private(set) var isLoadingMessages: Bool = false
    @Published var isConnected: Bool = false
    @Published var isPaired: Bool = false
    @Published private(set) var currentRoomId: String?
    @Published private(set) var lastError: ChatError? = nil
    @Published var hasMoreMessages: Bool = true

    // MARK: - Test-Accessible Cache

    var messagesCache: [String: [ChatMessage]] = [:]

    // MARK: - Call Tracking

    private(set) var fetchChatRoomsCallCount = 0
    private(set) var fetchMessagesCallCount = 0
    private(set) var lastFetchMessagesRoomId: String?
    private(set) var lastFetchMessagesBefore: Date?
    private(set) var sendMessageCallCount = 0
    private(set) var lastSendMessageRoomId: String?
    private(set) var lastSendMessageContent: String?
    private(set) var connectWebSocketCallCount = 0
    private(set) var lastConnectWebSocketUserId: String?
    private(set) var disconnectWebSocketCallCount = 0
    private(set) var markAsReadCallCount = 0
    private(set) var selectRoomCallCount = 0
    private(set) var lastSelectRoomId: String?

    // MARK: - Configuration Flags

    var shouldFetchRoomsThrowError = false
    var shouldFetchMessagesThrowError = false
    var shouldSendMessageThrowError = false
    var shouldConnectWebSocketThrowError = false
    var configuredError: ChatError = .networkError(underlying: NSError(domain: "Mock", code: -1))
    var errorToThrow: ChatError = .networkError(underlying: NSError(domain: "Mock", code: -1))

    // MARK: - Mock Dependencies

    var mockAuthService: MockAuthServiceForChat

    // MARK: - Initialization

    init(mockAuth: MockAuthServiceForChat? = nil) {
        self.mockAuthService = mockAuth ?? MockAuthServiceForChat()
    }

    // MARK: - ChatServiceProtocol Methods

    func fetchChatRooms() async -> ChatResult<[ChatRoom]> {
        fetchChatRoomsCallCount += 1
        isLoadingRooms = true
        lastError = nil

        if shouldFetchRoomsThrowError {
            isLoadingRooms = false
            lastError = configuredError
            return .failure(configuredError)
        }

        isLoadingRooms = false
        return .success(chatRooms)
    }

    func fetchMessages(roomId: String, before: Date?) async -> ChatResult<[ChatMessage]> {
        fetchMessagesCallCount += 1
        lastFetchMessagesRoomId = roomId
        lastFetchMessagesBefore = before
        isLoadingMessages = true
        lastError = nil

        if shouldFetchMessagesThrowError {
            isLoadingMessages = false
            lastError = configuredError
            return .failure(configuredError)
        }

        currentMessages = messagesCache[roomId] ?? []
        isLoadingMessages = false
        return .success(currentMessages)
    }

    func sendMessage(
        roomId: String,
        content: String,
        type: MessageType = .text,
        mediaUrl: String? = nil,
        mediaMimeType: String? = nil
    ) async -> ChatResult<ChatMessage> {
        sendMessageCallCount += 1
        lastSendMessageRoomId = roomId
        lastSendMessageContent = content
        lastError = nil

        if shouldSendMessageThrowError {
            lastError = configuredError
            return .failure(configuredError)
        }

        guard mockAuthService.isLoggedIn else {
            let error = ChatError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        let message = ChatMessage(
            id: UUID().uuidString,
            roomId: roomId,
            senderId: mockAuthService.currentUser?.id ?? "local-user",
            sender: .user,
            content: content,
            messageType: type,
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

        // Add to cache
        if messagesCache[roomId] == nil {
            messagesCache[roomId] = []
        }
        messagesCache[roomId]?.append(message)

        // Update current messages if this is the active room
        if currentRoomId == roomId {
            currentMessages = messagesCache[roomId] ?? []
        }

        return .success(message)
    }

    func connectWebSocket(userId: String) async -> ChatResult<Void> {
        connectWebSocketCallCount += 1
        lastConnectWebSocketUserId = userId
        lastError = nil

        if shouldConnectWebSocketThrowError {
            isConnected = false
            lastError = configuredError
            return .failure(configuredError)
        }

        isConnected = true
        return .success(())
    }

    func disconnectWebSocket() {
        disconnectWebSocketCallCount += 1
        isConnected = false
    }

    func markAsRead(roomId: String, messageId: String) async -> ChatResult<Void> {
        markAsReadCallCount += 1

        guard mockAuthService.isLoggedIn else {
            let error = ChatError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        // Update local cache
        if var messages = messagesCache[roomId],
           let index = messages.firstIndex(where: { $0.id == messageId }) {
            let old = messages[index]
            messages[index] = ChatMessage(
                id: old.id, roomId: old.roomId, senderId: old.senderId, sender: old.sender,
                content: old.content, messageType: old.messageType, mediaUrl: old.mediaUrl,
                mediaMimeType: old.mediaMimeType, mediaDuration: old.mediaDuration,
                mediaSize: old.mediaSize, mediaMetadata: old.mediaMetadata,
                voiceUrl: old.voiceUrl, voiceDuration: old.voiceDuration,
                voiceTranscript: old.voiceTranscript, voiceMimeType: old.voiceMimeType,
                isRead: true, createdAt: old.createdAt
            )
            messagesCache[roomId] = messages

            if currentRoomId == roomId {
                currentMessages = messagesCache[roomId] ?? []
            }
        }

        return .success(())
    }

    func selectRoom(roomId: String) {
        selectRoomCallCount += 1
        lastSelectRoomId = roomId
        currentRoomId = roomId
        currentMessages = messagesCache[roomId] ?? []
    }

    // MARK: - Helper Methods

    func resetCallTracking() {
        fetchChatRoomsCallCount = 0
        fetchMessagesCallCount = 0
        lastFetchMessagesRoomId = nil
        lastFetchMessagesBefore = nil
        sendMessageCallCount = 0
        lastSendMessageRoomId = nil
        lastSendMessageContent = nil
        connectWebSocketCallCount = 0
        lastConnectWebSocketUserId = nil
        disconnectWebSocketCallCount = 0
        markAsReadCallCount = 0
        selectRoomCallCount = 0
        lastSelectRoomId = nil
    }

    func setMockRooms(_ rooms: [ChatRoom]) {
        chatRooms = rooms
    }

    func setMockMessages(_ messages: [ChatMessage], forRoom roomId: String) {
        messagesCache[roomId] = messages
        if currentRoomId == roomId {
            currentMessages = messages
        }
    }

    /// Overload that sets messages for the current room
    func setMockMessages(_ messages: [ChatMessage]) {
        guard let roomId = currentRoomId else { return }
        setMockMessages(messages, forRoom: roomId)
    }

    func addMockMessage(_ message: ChatMessage) {
        if messagesCache[message.roomId] == nil {
            messagesCache[message.roomId] = []
        }
        messagesCache[message.roomId]?.append(message)
        if currentRoomId == message.roomId {
            currentMessages = messagesCache[message.roomId] ?? []
        }
    }

    func simulateIncomingMessage(_ content: String, from sender: MessageSender = .bot) {
        guard let roomId = currentRoomId else { return }
        let message = ChatMessage(
            id: UUID().uuidString,
            roomId: roomId,
            senderId: sender == .user ? (mockAuthService.currentUser?.id ?? "user") : "bot",
            sender: sender,
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
            createdAt: Date()
        )
        addMockMessage(message)
    }

    func simulateConnectionLost() {
        isConnected = false
    }

    func simulateConnected() {
        isConnected = true
    }
}

// MARK: - MockAPIClient

/// Mock implementation of APIClientProtocol for Chat tests
@MainActor
final class MockAPIClient: APIClientProtocol {

    // MARK: - Call Tracking

    private(set) var getCallCount = 0
    private(set) var postCallCount = 0
    private(set) var putCallCount = 0
    private(set) var deleteCallCount = 0
    private(set) var uploadCallCount = 0
    private(set) var downloadCallCount = 0

    private(set) var lastGetEndpoint: APIEndpoint?
    private(set) var lastPostEndpoint: APIEndpoint?
    private(set) var lastPutEndpoint: APIEndpoint?
    private(set) var lastDeleteEndpoint: APIEndpoint?

    // MARK: - Configuration

    var shouldFail = false
    var errorToThrow: Error = NetworkError.custom(message: "Mock error")
    var mockChatRooms: [ChatRoom] = []
    var mockMessages: [ChatMessage] = []
    var mockFriendRecommendations: [APIFriendRecommendation] = []

    // MARK: - APIClientProtocol

    func get<T: Codable>(_ endpoint: APIEndpoint) async throws -> T {
        getCallCount += 1
        lastGetEndpoint = endpoint

        if shouldFail { throw errorToThrow }

        if let result = try handleGetEndpoint(endpoint) as? T {
            return result
        }
        throw NetworkError.custom(message: "Type mismatch or unhandled endpoint")
    }

    func post<T: Codable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T {
        postCallCount += 1
        lastPostEndpoint = endpoint

        if shouldFail { throw errorToThrow }

        if let result = try handlePostEndpoint(endpoint) as? T {
            return result
        }
        throw NetworkError.custom(message: "Type mismatch or unhandled endpoint")
    }

    func put<T: Codable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T {
        putCallCount += 1
        lastPutEndpoint = endpoint
        if shouldFail { throw errorToThrow }
        throw NetworkError.custom(message: "Unhandled endpoint")
    }

    func delete<T: Codable>(_ endpoint: APIEndpoint) async throws -> T {
        deleteCallCount += 1
        lastDeleteEndpoint = endpoint
        if shouldFail { throw errorToThrow }
        throw NetworkError.custom(message: "Unhandled endpoint")
    }

    func upload<T: Codable>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T {
        uploadCallCount += 1
        if shouldFail { throw errorToThrow }
        throw NetworkError.custom(message: "Unhandled endpoint")
    }

    func download(from url: String) async throws -> Data {
        downloadCallCount += 1
        if shouldFail { throw errorToThrow }
        return Data()
    }

    // MARK: - Chat-specific Methods

    func getChatRooms() async throws -> [ChatRoom] {
        getCallCount += 1
        return mockChatRooms
    }

    func getChatMessages(roomId: String, page: Int, limit: Int) async throws -> [ChatMessage] {
        getCallCount += 1
        return mockMessages
    }

    func getChatMessagesSince(roomId: String, since: Date) async throws -> [ChatMessage] {
        getCallCount += 1
        return mockMessages.filter { $0.createdAt > since }
    }

    func sendMessage(roomId: String, content: String, contentType: MessageType, mediaUrl: String?, mediaMimeType: String?) async throws -> ChatMessage {
        postCallCount += 1
        return ChatMessage(
            id: UUID().uuidString, roomId: roomId, senderId: "user",
            sender: .user, content: content, messageType: contentType,
            mediaUrl: mediaUrl, mediaMimeType: mediaMimeType,
            mediaDuration: nil, mediaSize: nil, mediaMetadata: nil,
            voiceUrl: nil, voiceDuration: nil, voiceTranscript: nil, voiceMimeType: nil,
            isRead: true, createdAt: Date()
        )
    }

    func markMessageAsRead(roomId: String, messageId: String) async throws { }

    // MARK: - Private Helpers

    private func handleGetEndpoint(_ endpoint: APIEndpoint) throws -> Any {
        switch endpoint {
        case .chatRooms:
            return mockChatRooms as Any
        case .chatRoomMessages:
            return mockMessages as Any
        case .friendRecommendations:
            return mockFriendRecommendations as Any
        default:
            throw NetworkError.custom(message: "Unhandled GET endpoint")
        }
    }

    private func handlePostEndpoint(_ endpoint: APIEndpoint) throws -> Any {
        switch endpoint {
        case .chatRoomCreate:
            guard let room = mockChatRooms.first else {
                throw NetworkError.custom(message: "No mock room")
            }
            return room as Any
        default:
            throw NetworkError.custom(message: "Unhandled POST endpoint")
        }
    }

    // MARK: - Helper Methods

    func resetCallTracking() {
        getCallCount = 0
        postCallCount = 0
        putCallCount = 0
        deleteCallCount = 0
        uploadCallCount = 0
        downloadCallCount = 0
        lastGetEndpoint = nil
        lastPostEndpoint = nil
        lastPutEndpoint = nil
        lastDeleteEndpoint = nil
    }

    func setMockChatRooms(_ rooms: [ChatRoom]) { mockChatRooms = rooms }
    func setMockMessages(_ messages: [ChatMessage]) { mockMessages = messages }
    func setMockFriendRecommendations(_ recommendations: [APIFriendRecommendation]) {
        mockFriendRecommendations = recommendations
    }
}

// MARK: - MockFriendService

/// Mock implementation of FriendServiceProtocol for testing
@MainActor
final class MockFriendService: FriendServiceProtocol {

    // MARK: - Published State

    @Published private(set) var friends: [Friend] = []
    @Published private(set) var friendRequests: [FriendRequest] = []
    @Published private(set) var isLoading: Bool = false

    // MARK: - Call Tracking

    private(set) var fetchFriendsCallCount = 0
    private(set) var fetchFriendRequestsCallCount = 0
    private(set) var addFriendCallCount = 0
    private(set) var lastAddFriendId: String?
    private(set) var removeFriendCallCount = 0
    private(set) var acceptFriendRequestCallCount = 0
    private(set) var declineFriendRequestCallCount = 0

    // MARK: - Configuration

    var shouldFetchFriendsThrowError = false
    var shouldAddFriendThrowError = false
    var errorToThrow: FriendServiceError = .unknown(underlying: nil)
    var mockFriends: [Friend] = []
    var mockFriendRequests: [FriendRequest] = []

    // MARK: - FriendServiceProtocol

    func fetchFriends() async throws -> [Friend] {
        fetchFriendsCallCount += 1
        isLoading = true

        if shouldFetchFriendsThrowError {
            isLoading = false
            throw errorToThrow
        }

        friends = mockFriends
        isLoading = false
        return mockFriends
    }

    func fetchFriendRequests() async throws -> [FriendRequest] {
        fetchFriendRequestsCallCount += 1
        isLoading = true

        if shouldFetchFriendsThrowError {
            isLoading = false
            throw errorToThrow
        }

        friendRequests = mockFriendRequests
        isLoading = false
        return mockFriendRequests
    }

    func addFriend(friendId: String) async throws {
        addFriendCallCount += 1
        lastAddFriendId = friendId
        isLoading = true

        if shouldAddFriendThrowError {
            isLoading = false
            throw errorToThrow
        }

        isLoading = false
    }

    func removeFriend(friendId: String) async throws {
        removeFriendCallCount += 1
        friends.removeAll { $0.friendId == friendId }
    }

    func acceptFriendRequest(requestId: String) async throws {
        acceptFriendRequestCallCount += 1
        friendRequests.removeAll { $0.id == requestId }
    }

    func declineFriendRequest(requestId: String) async throws {
        declineFriendRequestCallCount += 1
        friendRequests.removeAll { $0.id == requestId }
    }

    // MARK: - Helper Methods

    func resetCallTracking() {
        fetchFriendsCallCount = 0
        fetchFriendRequestsCallCount = 0
        addFriendCallCount = 0
        lastAddFriendId = nil
        removeFriendCallCount = 0
        acceptFriendRequestCallCount = 0
        declineFriendRequestCallCount = 0
    }

    func setMockFriends(_ friends: [Friend]) { mockFriends = friends }
    func setMockFriendRequests(_ requests: [FriendRequest]) { mockFriendRequests = requests }
}

// MARK: - MockAuthServiceForChat

/// Mock implementation of AuthServiceProtocol for testing ChatService.
/// Does NOT extend AuthService (which is final) - implements protocol directly.
@MainActor
final class MockAuthServiceForChat: AuthServiceProtocol, ObservableObject {

    // MARK: - Published State

    @Published var isLoggedInValue: Bool = false
    @Published private(set) var isLoading: Bool = false
    @Published var mockUser: User?
    @Published private(set) var lastError: AuthError?

    // MARK: - AuthServiceProtocol

    var isLoggedIn: Bool {
        get { isLoggedInValue }
        set { isLoggedInValue = newValue }
    }

    // MARK: - AuthServiceProtocol

    var currentUser: User? { mockUser }

    // MARK: - Methods

    func login(email: String, password: String) async -> AuthResult<User> {
        isLoading = true
        defer { isLoading = false }

        let user = User(
            id: "mock-user-\(UUID().uuidString.prefix(8))",
            username: email.components(separatedBy: "@").first ?? "user",
            email: email,
            avatarUrl: nil,
            avatarConfig: nil,
            fullName: nil,
            displayName: email.components(separatedBy: "@").first,
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
        mockUser = user
        isLoggedIn = true
        return .success(user)
    }

    func register(username: String, email: String, password: String) async -> AuthResult<User> {
        isLoading = true
        defer { isLoading = false }

        let user = User(
            id: "mock-user-\(UUID().uuidString.prefix(8))",
            username: username,
            email: email,
            avatarUrl: nil,
            avatarConfig: nil,
            fullName: nil,
            displayName: username,
            bio: nil,
            website: nil,
            points: 0,
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
        mockUser = user
        isLoggedIn = true
        return .success(user)
    }

    func logout() async -> AuthResult<Void> {
        mockUser = nil
        isLoggedIn = false
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

    func updateProfile(_ user: User) async -> AuthResult<User> {
        mockUser = user
        return .success(user)
    }

    func deleteAccount() async -> AuthResult<Void> {
        mockUser = nil
        isLoggedIn = false
        return .success(())
    }

    func updateCurrentUser(_ user: User?) {
        mockUser = user
    }

    func updateLoginStatus(_ loggedIn: Bool) {
        isLoggedIn = loggedIn
    }

    func clearError() {
        lastError = nil
    }

    // MARK: - Test Helpers

    func setLoggedIn(_ loggedIn: Bool, userId: String = "test-user-id") {
        isLoggedIn = loggedIn
        if loggedIn {
            mockUser = User(
                id: userId,
                username: "testuser",
                email: "test@example.com",
                avatarUrl: nil,
                avatarConfig: nil,
                fullName: "Test User",
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
        } else {
            mockUser = nil
        }
    }
}

// MARK: - Test Data Factories

extension MockChatService {

    /// Creates a mock chat room for testing
    static func makeMockRoom(
        id: String = "room-1",
        name: String = "Test Room",
        type: ChatRoomType = .privateChat,
        unreadCount: Int = 0
    ) -> ChatRoom {
        ChatRoom(
            id: id,
            name: name,
            type: type,
            participants: [],
            lastMessage: nil,
            unreadCount: unreadCount,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    /// Creates a mock chat message for testing
    static func makeMockMessage(
        id: String = "msg-1",
        roomId: String = "room-1",
        content: String = "Hello",
        sender: MessageSender = .user,
        messageType: MessageType = .text
    ) -> ChatMessage {
        ChatMessage(
            id: id,
            roomId: roomId,
            senderId: sender == .user ? "current-user" : "other-user",
            sender: sender,
            content: content,
            messageType: messageType,
            mediaUrl: nil,
            mediaMimeType: nil,
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

    /// Creates multiple mock messages for pagination testing
    static func makeMockMessages(count: Int, roomId: String = "room-1") -> [ChatMessage] {
        (0..<count).map { index in
            ChatMessage(
                id: "msg-\(index)",
                roomId: roomId,
                senderId: index % 2 == 0 ? "user-1" : "user-2",
                sender: index % 2 == 0 ? .user : .friend,
                content: "Message \(index)",
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
                isRead: true,
                createdAt: Date().addingTimeInterval(TimeInterval(-index * 60))
            )
        }
    }
}

extension MockFriendService {

    /// Creates a mock friend for testing
    static func makeMockFriend(
        id: String = "friend-1",
        name: String = "Friend"
    ) -> Friend {
        Friend(
            id: id,
            userId: "current-user",
            friendId: id,
            name: name,
            avatarUrl: nil,
            status: .online,
            bio: nil,
            studyTime: 100,
            isStudying: false,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    /// Creates a mock friend recommendation for testing
    static func makeMockRecommendation(
        id: String = "rec-1",
        name: String = "Recommended User"
    ) -> APIFriendRecommendation {
        APIFriendRecommendation(
            id: id,
            name: name,
            avatarUrl: nil,
            mutualFriends: 5,
            isOnline: true
        )
    }
}
