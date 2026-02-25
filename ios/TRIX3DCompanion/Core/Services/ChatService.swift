//
//  ChatService.swift
//  TRIX3DCompanion
//
//  Chat service for managing chat rooms, messages, and WebSocket connections
//

import Foundation
import Combine

// MARK: - Chat Error

/// Chat service error types
enum ChatError: Error, LocalizedError {
    case notAuthenticated
    case roomNotFound
    case messageNotFound
    case networkError(underlying: Error)
    case webSocketNotConnected
    case invalidMessageContent
    case paginationExhausted
    case unknown(underlying: Error?)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "You must be logged in to access chat"
        case .roomNotFound:
            return "Chat room not found"
        case .messageNotFound:
            return "Message not found"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .webSocketNotConnected:
            return "WebSocket connection not established"
        case .invalidMessageContent:
            return "Invalid message content"
        case .paginationExhausted:
            return "No more messages to load"
        case .unknown(let error):
            return error?.localizedDescription ?? "An unknown error occurred"
        }
    }
}

// MARK: - Chat Result

/// Result type for chat operations
typealias ChatResult<T> = Result<T, ChatError>

// MARK: - Chat Service Protocol

/// Protocol defining chat service interface
protocol ChatServiceProtocol {
    var chatRooms: [ChatRoom] { get }
    var currentMessages: [ChatMessage] { get }
    var isLoadingRooms: Bool { get }
    var isLoadingMessages: Bool { get }
    var isConnected: Bool { get }
    var currentRoomId: String? { get }

    func fetchChatRooms() async -> ChatResult<[ChatRoom]>
    func fetchMessages(roomId: String, before: Date?) async -> ChatResult<[ChatMessage]>
    func sendMessage(roomId: String, content: String, type: MessageType) async -> ChatResult<ChatMessage>
    func connectWebSocket(userId: String) async -> ChatResult<Void>
    func disconnectWebSocket()
    func markAsRead(roomId: String, messageId: String) async -> ChatResult<Void>
    func selectRoom(roomId: String)
}

// MARK: - Chat Service

/// Main chat service handling chat rooms, messages, and real-time updates
@MainActor
final class ChatService: ObservableObject, ChatServiceProtocol {

    // MARK: - Singleton

    static let shared = ChatService()

    // MARK: - Published Properties

    /// List of all chat rooms
    @Published private(set) var chatRooms: [ChatRoom] = []

    /// Messages for the currently selected room
    @Published private(set) var currentMessages: [ChatMessage] = []

    /// Whether currently loading chat rooms
    @Published private(set) var isLoadingRooms: Bool = false

    /// Whether currently loading messages
    @Published private(set) var isLoadingMessages: Bool = false

    /// WebSocket connection status
    @Published private(set) var isConnected: Bool = false

    /// Currently selected room ID
    @Published private(set) var currentRoomId: String?

    /// Last chat error if any
    @Published private(set) var lastError: ChatError?

    /// Whether has more messages to load (pagination)
    @Published private(set) var hasMoreMessages: Bool = true

    // MARK: - Dependencies

    private let apiClient: APIClient
    private let webSocketManager: WebSocketManager
    private let authService: AuthService

    // MARK: - Private Properties

    /// Local cache of messages per room
    private var messagesCache: [String: [ChatMessage]] = [:]

    /// Pagination tracking per room
    private var paginationTracker: [String: PaginationState] = [:]

    /// Message buffer for incoming WebSocket messages
    private var messageBuffer: [ChatMessage] = []

    /// Cancellables for Combine subscriptions
    private var cancellables = Set<AnyCancellable>()

    /// Default page size for message pagination
    private let defaultPageSize: Int = 50

    // MARK: - Initialization

    /// Initialize with dependencies
    /// - Parameters:
    ///   - apiClient: API client instance (defaults to shared)
    ///   - webSocketManager: WebSocket manager instance (defaults to shared)
    ///   - authService: Auth service instance (defaults to shared)
    init(
        apiClient: APIClient = .shared,
        webSocketManager: WebSocketManager = .shared,
        authService: AuthService = .shared
    ) {
        self.apiClient = apiClient
        self.webSocketManager = webSocketManager
        self.authService = authService

        setupWebSocketListeners()
    }

    // MARK: - Public Methods - Chat Rooms

    /// Fetch all chat rooms for the current user
    /// - Returns: ChatResult containing the list of chat rooms
    func fetchChatRooms() async -> ChatResult<[ChatRoom]> {
        // Verify authentication
        guard authService.isLoggedIn else {
            let error = ChatError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        isLoadingRooms = true
        lastError = nil

        do {
            let rooms = try await apiClient.getChatRooms()

            // Sort rooms by updated date (most recent first)
            let sortedRooms = rooms.sorted { $0.updatedAt > $1.updatedAt }

            chatRooms = sortedRooms
            isLoadingRooms = false

            return .success(sortedRooms)

        } catch let error as NetworkError {
            isLoadingRooms = false
            let chatError = mapNetworkError(error)
            lastError = chatError
            return .failure(chatError)
        } catch {
            isLoadingRooms = false
            let chatError = ChatError.unknown(underlying: error)
            lastError = chatError
            return .failure(chatError)
        }
    }

    // MARK: - Public Methods - Messages

    /// Fetch messages for a specific room with pagination support
    /// - Parameters:
    ///   - roomId: The room ID to fetch messages for
    ///   - before: Optional date to fetch messages before (for pagination)
    /// - Returns: ChatResult containing the list of messages
    func fetchMessages(roomId: String, before: Date? = nil) async -> ChatResult<[ChatMessage]> {
        // Verify authentication
        guard authService.isLoggedIn else {
            let error = ChatError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        isLoadingMessages = true
        lastError = nil

        do {
            // Determine page based on pagination state
            var page = 1
            if let state = paginationTracker[roomId], before == nil {
                page = state.currentPage + 1
            }

            let messages = try await apiClient.getChatMessages(roomId: roomId, page: page, limit: defaultPageSize)

            // Check if we've reached the end
            let hasMore = messages.count == defaultPageSize

            // Update pagination state
            if var state = paginationTracker[roomId] {
                state.currentPage = page
                state.hasMore = hasMore
                paginationTracker[roomId] = state
            } else {
                paginationTracker[roomId] = PaginationState(currentPage: page, hasMore: hasMore)
            }

            hasMoreMessages = hasMore

            // Cache messages
            if messagesCache[roomId] == nil {
                messagesCache[roomId] = []
            }

            // If loading more (pagination), append to cache
            // Otherwise, replace cache with fresh data
            if before != nil || page > 1 {
                // Append new messages and deduplicate
                var existing = messagesCache[roomId] ?? []
                let newMessages = messages.filter { msg in
                    !existing.contains { $0.id == msg.id }
                }
                messagesCache[roomId] = existing + newMessages
            } else {
                messagesCache[roomId] = messages
            }

            // Update current messages if this is the active room
            if currentRoomId == roomId {
                updateCurrentMessages()
            }

            isLoadingMessages = false

            return .success(messages)

        } catch let error as NetworkError {
            isLoadingMessages = false
            let chatError = mapNetworkError(error)
            lastError = chatError
            return .failure(chatError)
        } catch {
            isLoadingMessages = false
            let chatError = ChatError.unknown(underlying: error)
            lastError = chatError
            return .failure(chatError)
        }
    }

    /// Send a message to a chat room
    /// - Parameters:
    ///   - roomId: The room ID to send the message to
    ///   - content: The message content
    ///   - type: The message type (text, image, etc.)
    /// - Returns: ChatResult containing the sent message
    func sendMessage(roomId: String, content: String, type: MessageType = .text) async -> ChatResult<ChatMessage> {
        // Verify authentication
        guard authService.isLoggedIn else {
            let error = ChatError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        // Validate content
        guard !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            let error = ChatError.invalidMessageContent
            lastError = error
            return .failure(error)
        }

        // If WebSocket is connected, send via WebSocket for real-time delivery
        if webSocketManager.isConnected() {
            sendViaWebSocket(roomId: roomId, content: content, type: type)
        }

        // Also send via API for persistence
        do {
            let message = try await apiClient.sendMessage(
                roomId: roomId,
                content: content,
                contentType: type
            )

            // Add to cache if this is the current room
            if currentRoomId == roomId {
                addMessageToCache(message, for: roomId)
                updateCurrentMessages()
            }

            return .success(message)

        } catch let error as NetworkError {
            let chatError = mapNetworkError(error)
            lastError = chatError
            return .failure(chatError)
        } catch {
            let chatError = ChatError.unknown(underlying: error)
            lastError = chatError
            return .failure(chatError)
        }
    }

    // MARK: - Public Methods - Room Selection

    /// Select a chat room as the active room
    /// - Parameter roomId: The room ID to select
    func selectRoom(roomId: String) {
        currentRoomId = roomId

        // Load messages for this room if not already cached
        if messagesCache[roomId] == nil || messagesCache[roomId]?.isEmpty == true {
            Task {
                _ = await fetchMessages(roomId: roomId, before: nil)
            }
        } else {
            // Use cached messages
            updateCurrentMessages()
        }

        // Update pagination state
        hasMoreMessages = paginationTracker[roomId]?.hasMore ?? true
    }

    /// Deselect the current room
    func deselectRoom() {
        currentRoomId = nil
        currentMessages = []
    }

    // MARK: - Public Methods - WebSocket

    /// Connect to WebSocket for real-time updates
    /// - Parameter userId: The user ID to connect with
    /// - Returns: ChatResult indicating success or failure
    func connectWebSocket(userId: String) async -> ChatResult<Void> {
        // Verify authentication
        guard authService.isLoggedIn else {
            let error = ChatError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        do {
            try await webSocketManager.connect(userId: userId)
            isConnected = true
            return .success(())

        } catch let error as NetworkError {
            isConnected = false
            let chatError = mapNetworkError(error)
            lastError = chatError
            return .failure(chatError)
        } catch {
            isConnected = false
            let chatError = ChatError.unknown(underlying: error)
            lastError = chatError
            return .failure(chatError)
        }
    }

    /// Disconnect from WebSocket
    func disconnectWebSocket() {
        webSocketManager.disconnect()
        isConnected = false
    }

    // MARK: - Public Methods - Read Status

    /// Mark a message as read
    /// - Parameters:
    ///   - roomId: The room ID
    ///   - messageId: The message ID to mark as read
    /// - Returns: ChatResult indicating success or failure
    func markAsRead(roomId: String, messageId: String) async -> ChatResult<Void> {
        // Verify authentication
        guard authService.isLoggedIn else {
            let error = ChatError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        // Update local cache
        if var messages = messagesCache[roomId] {
            if let index = messages.firstIndex(where: { $0.id == messageId }) {
                messages[index] = messages[index].withReadStatus(true)
                messagesCache[roomId] = messages

                if currentRoomId == roomId {
                    updateCurrentMessages()
                }
            }
        }

        // TODO: Implement API call to mark as read on server
        // This would require adding an API endpoint for read status

        return .success(())
    }

    /// Mark all messages in a room as read
    /// - Parameter roomId: The room ID
    /// - Returns: ChatResult indicating success or failure
    func markAllAsRead(roomId: String) async -> ChatResult<Void> {
        guard authService.isLoggedIn else {
            let error = ChatError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        // Update local cache
        if var messages = messagesCache[roomId] {
            messages = messages.map { $0.withReadStatus(true) }
            messagesCache[roomId] = messages

            if currentRoomId == roomId {
                updateCurrentMessages()
            }
        }

        // Update unread count in rooms list
        if let index = chatRooms.firstIndex(where: { $0.id == roomId }) {
            var room = chatRooms[index]
            // Note: ChatRoom is a struct, so we can't directly modify unreadCount
            // This would require updating the model or fetching from server
        }

        return .success(())
    }

    // MARK: - Private Methods - WebSocket

    /// Set up WebSocket event listeners
    private func setupWebSocketListeners() {
        // Listen for connection events
        webSocketManager.on(.connected) { [weak self] _ in
            Task { @MainActor in
                self?.isConnected = true
            }
        }

        webSocketManager.on(.disconnected) { [weak self] event in
            Task { @MainActor in
                self?.isConnected = false
            }
        }

        // Listen for incoming messages
        webSocketManager.on(.botMessage) { [weak self] result in
            Task { @MainActor in
                self?.handleBotMessage(result)
            }
        }

        webSocketManager.on(.messageSent) { [weak self] result in
            Task { @MainActor in
                self?.handleMessageSent(result)
            }
        }

        webSocketManager.on(.messageError) { [weak self] result in
            Task { @MainActor in
                self?.handleMessageError(result)
            }
        }
    }

    /// Handle incoming bot message from WebSocket
    private func handleBotMessage(_ result: Any) {
        guard let botMessage = result as? BotMessage else { return }

        // Convert bot message to chat message
        let chatMessage = ChatMessage(
            id: UUID().uuidString,
            roomId: currentRoomId,
            senderId: nil,
            sender: .bot,
            text: botMessage.content,
            timestamp: Date(timeIntervalSince1970: TimeInterval(botMessage.timestamp)),
            messageType: botMessage.contentType.map { convertMessageType($0) },
            mediaUri: botMessage.mediaUrl,
            mediaType: botMessage.mediaMimeType,
            mediaSize: nil,
            mediaMetadata: nil,
            isRead: false
        )

        // Add to current room if active
        if let roomId = currentRoomId {
            addMessageToCache(chatMessage, for: roomId)
            updateCurrentMessages()
        }
    }

    /// Handle message sent confirmation from WebSocket
    private func handleMessageSent(_ result: Any) {
        guard let response = result as? MessageSentResponse,
              response.success else {
            return
        }

        // Message was successfully sent via WebSocket
        // The API response will handle updating the cache
    }

    /// Handle message error from WebSocket
    private func handleMessageError(_ result: Any) {
        guard let error = result as? WebSocketError else { return }

        // Log or handle the error
        print("WebSocket message error: \(error.message)")

        lastError = .networkError(underlying: error)
    }

    /// Send message via WebSocket
    private func sendViaWebSocket(roomId: String, content: String, type: MessageType) {
        let contentType: BotMessage.MessageContentType
        switch type {
        case .text:
            contentType = .text
        case .image:
            contentType = .image
        case .video:
            contentType = .video
        case .voice:
            contentType = .file
        case .file:
            contentType = .file
        }

        webSocketManager.sendMessage(
            content: content,
            contentType: contentType,
            mediaUrl: nil,
            mediaMimeType: nil
        )
    }

    /// Convert WebSocket message type to chat message type
    private func convertMessageType(_ type: BotMessage.MessageContentType) -> MessageContentType {
        switch type {
        case .text:
            return .text
        case .image:
            return .image
        case .video:
            return .video
        case .file, .mixed:
            return .mixed
        }
    }

    // MARK: - Private Methods - Cache Management

    /// Add a message to the cache for a specific room
    private func addMessageToCache(_ message: ChatMessage, for roomId: String) {
        if messagesCache[roomId] == nil {
            messagesCache[roomId] = []
        }

        // Check if message already exists
        if !messagesCache[roomId]!.contains(where: { $0.id == message.id }) {
            messagesCache[roomId]?.append(message)

            // Sort by timestamp
            messagesCache[roomId]?.sort { $0.timestamp < $1.timestamp }
        }
    }

    /// Update current messages from cache based on selected room
    private func updateCurrentMessages() {
        guard let roomId = currentRoomId else {
            currentMessages = []
            return
        }

        currentMessages = messagesCache[roomId] ?? []
    }

    /// Clear message cache for a specific room
    func clearMessagesCache(for roomId: String) {
        messagesCache.removeValue(forKey: roomId)
        paginationTracker.removeValue(forKey: roomId)

        if currentRoomId == roomId {
            currentMessages = []
            hasMoreMessages = true
        }
    }

    /// Clear all message caches
    func clearAllMessagesCache() {
        messagesCache.removeAll()
        paginationTracker.removeAll()
        currentMessages = []
        currentRoomId = nil
        hasMoreMessages = true
    }

    // MARK: - Private Methods - Error Mapping

    /// Map network errors to chat errors
    private func mapNetworkError(_ error: NetworkError) -> ChatError {
        switch error {
        case .noConnection, .timeout:
            return .networkError(underlying: error)
        case .unauthorized:
            return .notAuthenticated
        case .notFound:
            return .roomNotFound
        case .custom(let message):
            return .unknown(underlying: ChatError.custom(message: message))
        default:
            return .unknown(underlying: error)
        }
    }
}

// MARK: - Pagination State

/// State for message pagination
private struct PaginationState {
    var currentPage: Int
    var hasMore: Bool
}

// MARK: - ChatMessage Extension

/// Extension to create a copy of ChatMessage with updated read status
private extension ChatMessage {
    func withReadStatus(_ isRead: Bool) -> ChatMessage {
        ChatMessage(
            id: id,
            roomId: roomId,
            friendId: friendId,
            sender: sender,
            senderId: senderId,
            text: text,
            timestamp: timestamp,
            messageType: messageType,
            mediaUri: mediaUri,
            mediaType: mediaType,
            mediaSize: mediaSize,
            mediaMetadata: mediaMetadata,
            isRead: isRead
        )
    }
}

// MARK: - Convenience Extensions

extension ChatService {

    /// Get the current chat room
    var currentRoom: ChatRoom? {
        guard let roomId = currentRoomId else { return nil }
        return chatRooms.first { $0.id == roomId }
    }

    /// Get unread message count across all rooms
    var totalUnreadCount: Int {
        chatRooms.reduce(0) { $0 + $1.unreadCount }
    }

    /// Clear error state
    func clearError() {
        lastError = nil
    }

    /// Refresh the current room's messages
    func refreshCurrentMessages() async -> ChatResult<[ChatMessage]> {
        guard let roomId = currentRoomId else {
            return .failure(.roomNotFound)
        }

        // Clear cache and fetch fresh data
        clearMessagesCache(for: roomId)
        return await fetchMessages(roomId: roomId, before: nil)
    }

    /// Load more messages for the current room (pagination)
    func loadMoreMessages() async -> ChatResult<[ChatMessage]> {
        guard let roomId = currentRoomId else {
            return .failure(.roomNotFound)
        }

        guard hasMoreMessages else {
            return .failure(.paginationExhausted)
        }

        guard let lastMessage = currentMessages.first else {
            return await fetchMessages(roomId: roomId, before: nil)
        }

        return await fetchMessages(roomId: roomId, before: lastMessage.timestamp)
    }

    /// Search messages in current room
    func searchMessages(query: String) -> [ChatMessage] {
        guard !query.isEmpty else { return currentMessages }

        return currentMessages.filter { message in
            message.text.localizedCaseInsensitiveContains(query)
        }
    }
}

// MARK: - AsyncStream Support (iOS 16+)

#if swift(>=5.9)
extension ChatService {

    /// Observe message updates as AsyncStream
    var messageStream: AsyncStream<[ChatMessage]> {
        AsyncStream { continuation in
            // Emit initial state
            continuation.yield(currentMessages)

            // Observe changes
            $currentMessages
                .dropFirst()
                .sink { messages in
                    continuation.yield(messages)
                }
                .store(in: &cancellables)

            continuation.onTermination = { _ in
                // Cleanup handled by cancellables
            }
        }
    }

    /// Observe room list updates as AsyncStream
    var roomListStream: AsyncStream<[ChatRoom]> {
        AsyncStream { continuation in
            // Emit initial state
            continuation.yield(chatRooms)

            // Observe changes
            $chatRooms
                .dropFirst()
                .sink { rooms in
                    continuation.yield(rooms)
                }
                .store(in: &cancellables)

            continuation.onTermination = { _ in
                // Cleanup handled by cancellables
            }
        }
    }

    /// Observe connection status as AsyncStream
    var connectionStatusStream: AsyncStream<Bool> {
        AsyncStream { continuation in
            // Emit initial state
            continuation.yield(isConnected)

            // Observe changes
            $isConnected
                .dropFirst()
                .sink { connected in
                    continuation.yield(connected)
                }
                .store(in: &cancellables)

            continuation.onTermination = { _ in
                // Cleanup handled by cancellables
            }
        }
    }
}
#endif
