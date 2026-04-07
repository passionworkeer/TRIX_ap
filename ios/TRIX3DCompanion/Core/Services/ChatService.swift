//
//  ChatService.swift
//  TRIX3DCompanion
//
//  Chat service for managing chat rooms, messages, and WebSocket connections
//

import Foundation
import Combine
import Supabase

// MARK: - Chat Error

/// Chat service error types
enum ChatError: Error, LocalizedError, Equatable {
    case notAuthenticated
    case roomNotFound
    case messageNotFound
    case networkError(underlying: Error)
    case webSocketNotConnected
    case invalidMessageContent
    case paginationExhausted
    case unknown(underlying: Error?)

    static func == (lhs: ChatError, rhs: ChatError) -> Bool {
        switch (lhs, rhs) {
        case (.notAuthenticated, .notAuthenticated),
             (.roomNotFound, .roomNotFound),
             (.messageNotFound, .messageNotFound),
             (.webSocketNotConnected, .webSocketNotConnected),
             (.invalidMessageContent, .invalidMessageContent),
             (.paginationExhausted, .paginationExhausted):
            return true
        case let (.networkError(e1), .networkError(e2)):
            return (e1 as NSError?) == (e2 as NSError?)
        case let (.unknown(e1), .unknown(e2)):
            switch (e1, e2) {
            case (nil, nil): return true
            case let (a?, b?): return (a as NSError) == (b as NSError)
            case (nil, _), (_, nil): return false
            }
        default:
            return false
        }
    }

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
@MainActor
protocol ChatServiceProtocol {
    var chatRooms: [ChatRoom] { get }
    var currentMessages: [ChatMessage] { get }
    var isLoadingRooms: Bool { get }
    var isLoadingMessages: Bool { get }
    var isConnected: Bool { get }
    /// Whether the device is paired with a TRIX companion (required for WebSocket real-time features)
    var isPaired: Bool { get }
    var currentRoomId: String? { get }
    var lastError: ChatError? { get }
    /// Test-accessible message cache (exposed for unit testing)
    var messagesCache: [String: [ChatMessage]] { get }
    var hasMoreMessages: Bool { get }

    func fetchChatRooms() async -> ChatResult<[ChatRoom]>
    func fetchMessages(roomId: String, before: Date?) async -> ChatResult<[ChatMessage]>
    func sendMessage(
        roomId: String,
        content: String,
        type: MessageType,
        mediaUrl: String?,
        mediaMimeType: String?
    ) async -> ChatResult<ChatMessage>
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

    deinit {
        messagePollingTimer?.invalidate()
        messagePollingTimer = nil
    }

    // MARK: - Constants

    private static let localRoomPrefix = "local:"

    // MARK: - Helpers

    /// Check if a room ID represents a local-only room
    static func isLocalRoom(_ roomId: String) -> Bool {
        roomId.hasPrefix(localRoomPrefix)
    }

    // MARK: - Published Properties

    /// List of all chat rooms
    @Published private(set) var chatRooms: [ChatRoom] = []

    /// Messages for the currently selected room
    @Published var currentMessages: [ChatMessage] = []

    /// Whether currently loading chat rooms
    @Published private(set) var isLoadingRooms: Bool = false

    /// Whether currently loading messages
    @Published private(set) var isLoadingMessages: Bool = false

    /// WebSocket connection status
    @Published private(set) var isConnected: Bool = false

    /// Whether the device is paired with a TRIX companion (required for WebSocket real-time features)
    var isPaired: Bool {
        clawbotChannelServiceImpl.isPaired
    }

    /// Currently selected room ID
    @Published var currentRoomId: String?

    /// Last chat error if any
    @Published private(set) var lastError: ChatError?

    /// Whether has more messages to load (pagination)
    @Published private(set) var hasMoreMessages: Bool = true

    // MARK: - Integration Test Callbacks

    /// Callback for new incoming messages (integration test stub)
    var onNewMessage: ((ChatMessage) -> Void)?
    /// Callback for typing indicators (integration test stub)
    var onTypingIndicator: ((String, Bool) -> Void)?
    /// Callback for read receipts (integration test stub)
    var onReadReceipt: ((String, String) -> Void)?

    // MARK: - Dependencies

    private let apiClientImpl: APIClientProtocol
    private let clawbotChannelServiceImpl: any ClawbotChannelServiceProtocol
    private let authServiceImpl: AuthServiceProtocol

    // MARK: - Private Properties

    /// Local cache of messages per room
    var messagesCache: [String: [ChatMessage]] = [:]

    /// Pagination tracking per room
    private var paginationTracker: [String: PaginationState] = [:]

    /// Message buffer for incoming WebSocket messages
    private var messageBuffer: [ChatMessage] = []

    /// Cancellables for Combine subscriptions
    private var cancellables = Set<AnyCancellable>()

    /// Timer for polling new messages
    private var messagePollingTimer: Timer?

    /// Default page size for message pagination
    private let defaultPageSize: Int = 50

    // MARK: - Initialization

    /// Initialize with dependencies
    /// - Parameters:
    ///   - apiClientImpl: API client instance (defaults to shared)
    ///   - clawbotChannelService: Clawbot Channel service (defaults to shared)
    ///   - authService: Auth service instance (defaults to shared)
    /// Convenience init accepting protocol types (for testing)
    init(
        apiClient: APIClientProtocol,
        clawbotChannelService: any ClawbotChannelServiceProtocol,
        authService: AuthServiceProtocol
    ) {
        self.apiClientImpl = apiClient
        self.clawbotChannelServiceImpl = clawbotChannelService
        self.authServiceImpl = authService
        setupClawbotChannelListeners()
    }

    /// Production init accepting concrete types
    init(
        apiClient: APIClient? = nil,
        clawbotChannelService: ClawbotChannelService? = nil,
        authService: AuthService? = nil
    ) {
        self.apiClientImpl = apiClient ?? .shared
        self.clawbotChannelServiceImpl = clawbotChannelService ?? ClawbotChannelService.shared
        self.authServiceImpl = authService ?? .shared

        setupClawbotChannelListeners()
    }

    // MARK: - Public Methods - Chat Rooms

    /// Fetch all chat rooms for the current user
    /// - Returns: ChatResult containing the list of chat rooms
    func fetchChatRooms() async -> ChatResult<[ChatRoom]> {
        // Verify authentication
        guard authServiceImpl.isLoggedIn else {
            let error = ChatError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        isLoadingRooms = true
        lastError = nil

        do {
            let rooms = try await apiClientImpl.getChatRooms()

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

    /// Create a new chat room
    /// - Parameters:
    ///   - name: The name of the chat room
    ///   - type: The type of room (ai, group, or private)
    /// - Returns: ChatResult containing the created chat room
    func createChatRoom(name: String, type: ChatRoomType) async -> ChatResult<ChatRoom> {
        // Verify authentication
        guard authServiceImpl.isLoggedIn else {
            let error = ChatError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        // Validate input
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            let error = ChatError.invalidMessageContent
            lastError = error
            return .failure(error)
        }

        isLoadingRooms = true
        lastError = nil

        do {
            let room: ChatRoom
            if type == .ai {
                room = ChatRoom(
                    id: "trixbot",
                    name: trimmedName,
                    type: .ai,
                    participants: [],
                    lastMessage: nil,
                    unreadCount: 0,
                    createdAt: Date(),
                    updatedAt: Date()
                )
            } else {
                room = ChatRoom(
                    id: "\(Self.localRoomPrefix)\(UUID().uuidString.lowercased())",
                    name: trimmedName,
                    type: type,
                    participants: [],
                    lastMessage: nil,
                    unreadCount: 0,
                    createdAt: Date(),
                    updatedAt: Date()
                )
            }

            // Add to local cache
            chatRooms.removeAll { $0.id == room.id }
            chatRooms.insert(room, at: 0)
            isLoadingRooms = false

            SecureLogger.shared.info("Created chat room: \(room.id)")
            return .success(room)

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
        guard authServiceImpl.isLoggedIn else {
            let error = ChatError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        if Self.isLocalRoom(roomId) {
            if messagesCache[roomId] == nil {
                messagesCache[roomId] = []
            }
            currentRoomId = roomId
            updateCurrentMessages()
            return .success(messagesCache[roomId] ?? [])
        }

        isLoadingMessages = true
        lastError = nil

        do {
            // Determine page based on pagination state
            var page = 1
            if let state = paginationTracker[roomId], before == nil {
                page = state.currentPage + 1
            }

            let messages = try await apiClientImpl.getChatMessages(roomId: roomId, page: page, limit: defaultPageSize)

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

            // API返回的是降序（最新的在前），转换为升序（最旧的在前 -> 最新在后）
            let sortedMessages = messages.sorted { $0.createdAt < $1.createdAt }

            // If loading more (pagination), prepend to cache
            // Otherwise, replace cache with fresh data
            if before != nil || page > 1 {
                // Prepend new messages (older messages go at the beginning)
                var existing = messagesCache[roomId] ?? []
                let newMessages = sortedMessages.filter { msg in
                    !existing.contains { $0.id == msg.id }
                }
                messagesCache[roomId] = newMessages + existing
            } else {
                // 替换缓存，保持升序
                messagesCache[roomId] = sortedMessages
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
    func sendMessage(
        roomId: String,
        content: String,
        type: MessageType = .text,
        mediaUrl: String? = nil,
        mediaMimeType: String? = nil
    ) async -> ChatResult<ChatMessage> {
        // Verify authentication
        guard authServiceImpl.isLoggedIn else {
            let error = ChatError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        let trimmedContent = content.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolvedMediaUrl = mediaUrl ?? ((type == .image || type == .video || type == .voice || type == .file) ? trimmedContent : nil)
        let hasMediaPayload = !(resolvedMediaUrl?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)

        // Allow media-only messages without a text caption.
        guard !trimmedContent.isEmpty || (type != .text && hasMediaPayload) else {
            let error = ChatError.invalidMessageContent
            lastError = error
            return .failure(error)
        }

        if Self.isLocalRoom(roomId) {
            let message = ChatMessage(
                id: UUID().uuidString.lowercased(),
                roomId: roomId,
                senderId: authServiceImpl.currentUser?.id ?? "local-user",
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

            addMessageToCache(message, for: roomId)
            if currentRoomId == roomId {
                updateCurrentMessages()
            }
            return .success(message)
        }

        // Determine message content type
        let contentType: ClawbotMessageContentType
        switch type {
        case .text:
            contentType = .text
        case .image:
            contentType = .image
        case .video:
            contentType = .video
        case .voice, .file:
            contentType = .file
        }

        let resolvedMediaMimeType = mediaMimeType ?? ((type == .image) ? "image/jpeg" : nil)

        // Send via ClawbotChannelService for bot messages (if paired)
        if clawbotChannelServiceImpl.isPaired {
            do {
                try await clawbotChannelServiceImpl.sendMessage(
                    content,
                    contentType: contentType,
                    mediaUrl: resolvedMediaUrl,
                    mediaMimeType: resolvedMediaMimeType,
                    mediaData: nil,
                    mediaFileName: nil
                )
            } catch {
                // Log error but don't fail - API will handle persistence
                SecureLogger.shared.error("Failed to send via ClawbotChannel: \(error.localizedDescription)")
            }
        }

        // Also send via API for persistence
        do {
            let message = try await apiClientImpl.sendMessage(
                roomId: roomId,
                content: content,
                contentType: type,
                mediaUrl: resolvedMediaUrl,
                mediaMimeType: resolvedMediaMimeType
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

        // Subscribe to realtime messages (using Supabase Realtime)
        subscribeToRealtime(roomId: roomId)
    }

    /// Subscribe to realtime messages using Supabase Realtime
    private func subscribeToRealtime(roomId: String) {
        // Stop polling if running
        stopMessagePolling()

        // Get conversation ID for realtime subscription
        let conversationId = getConversationId(for: roomId)

        // Get user ID
        guard let userId = authServiceImpl.currentUser?.id else {
            SecureLogger.shared.warning("ChatService: Cannot subscribe - userId is nil")
            return
        }

        // Initialize realtime subscription with user info
        Task { @MainActor in
            if let supabaseClient = authServiceImpl.supabase {
                RealtimeMessageSubscription.shared.initialize(
                    supabase: supabaseClient,
                    userId: userId
                )
            }

            // Subscribe to realtime channel
            await RealtimeMessageSubscription.shared.subscribe(conversationId: conversationId) { [weak self] newMessage in
                guard let self = self else { return }

                // Add message to cache if it doesn't exist (same logic as web)
                if !(self.messagesCache[roomId]?.contains(where: { $0.id == newMessage.id }) ?? false) {
                    self.messagesCache[roomId]?.append(newMessage)
                    // Sort by timestamp (oldest first)
                    self.messagesCache[roomId]?.sort { $0.createdAt < $1.createdAt }

                    // Update current messages if this is the active room
                    if self.currentRoomId == roomId {
                        self.updateCurrentMessages()
                    }

                    SecureLogger.shared.debug("ChatService: Received realtime message \(newMessage.id)")
                }
            }
        }
    }

    /// Get conversation ID for a room ID
    private func getConversationId(for roomId: String) -> String {
        // For bot rooms, use bot conversation ID format
        if Self.isLocalRoom(roomId) {
            return "bot_\(authServiceImpl.currentUser?.id ?? "")"
        }
        // For friend rooms, use the friend ID directly as conversation ID
        return roomId
    }

    /// Start polling for new messages (fallback if realtime fails)
    private func startMessagePolling(roomId: String) {
        // Stop any existing timer
        stopMessagePolling()

        // Start new timer to poll for new messages every 2 seconds (near real-time)
        messagePollingTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self = self, !self.isLoadingMessages else { return }
                await self.fetchNewMessages(roomId: roomId)
            }
        }
    }

    /// Stop polling for new messages
    private func stopMessagePolling() {
        messagePollingTimer?.invalidate()
        messagePollingTimer = nil
    }

    /// Fetch new messages since last fetch
    private func fetchNewMessages(roomId: String) async {
        guard let lastMessage = messagesCache[roomId]?.last else { return }

        do {
            // 获取最新消息之后的消息
            let newMessages = try await apiClientImpl.getChatMessagesSince(roomId: roomId, since: lastMessage.createdAt)
            if !newMessages.isEmpty {
                // 使用addMessageToCache来避免重复
                for message in newMessages {
                    addMessageToCache(message, for: roomId)
                }
                updateCurrentMessages()
            }
        } catch {
            // Silently fail for polling
        }
    }

    /// Deselect the current room
    func deselectRoom() {
        currentRoomId = nil
        currentMessages = []

        // Stop polling for new messages
        stopMessagePolling()

        // Unsubscribe from realtime
        Task { @MainActor in
            await RealtimeMessageSubscription.shared.unsubscribe()
        }
    }

    // MARK: - Public Methods - WebSocket

    /// Connect to ClawbotChannel for real-time updates
    /// - Parameter userId: The user ID for authentication
    /// - Returns: ChatResult indicating success or failure
    func connectWebSocket(userId: String) async -> ChatResult<Void> {
        // Verify authentication
        guard authServiceImpl.isLoggedIn else {
            let error = ChatError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        do {
            try await clawbotChannelServiceImpl.connect()
            isConnected = true
            return .success(())

        } catch {
            isConnected = false
            let chatError = ChatError.unknown(underlying: error)
            lastError = chatError
            return .failure(chatError)
        }
    }

    /// Disconnect from ClawbotChannel
    func disconnectWebSocket() {
        clawbotChannelServiceImpl.disconnect()
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
        guard authServiceImpl.isLoggedIn else {
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

        // Call API to mark as read on server
        do {
            try await apiClientImpl.markMessageAsRead(roomId: roomId, messageId: messageId)
            return .success(())
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

    /// Mark all messages in a room as read
    /// - Parameter roomId: The room ID
    /// - Returns: ChatResult indicating success or failure
    func markAllAsRead(roomId: String) async -> ChatResult<Void> {
        guard authServiceImpl.isLoggedIn else {
            let error = ChatError.notAuthenticated
            lastError = error
            return .failure(error)
        }

        // Update local cache
        messagesCache[roomId] = messagesCache[roomId]?.map { $0.withReadStatus(true) }

        if currentRoomId == roomId {
            updateCurrentMessages()
        }

        // Update unread count in rooms list
        if let index = chatRooms.firstIndex(where: { $0.id == roomId }) {
            var room = chatRooms[index]
            // Note: ChatRoom is a struct, so we can't directly modify unreadCount
            // This would require updating the model or fetching from server
        }

        return .success(())
    }

    // MARK: - Private Methods - ClawbotChannel

    /// Set up ClawbotChannel event listeners
    private func setupClawbotChannelListeners() {
        // Subscribe to connection state changes
        clawbotChannelServiceImpl.connectionStatePublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                guard let self = self else { return }
                switch state {
                case .connected:
                    self.isConnected = true
                case .disconnected, .error:
                    self.isConnected = false
                default:
                    break
                }
            }
            .store(in: &cancellables)

        // Subscribe to incoming bot messages
        clawbotChannelServiceImpl.lastMessagePublisher
            .receive(on: DispatchQueue.main)
            .compactMap { $0 }
            .sink { [weak self] clawbotMessage in
                guard let self = self else { return }
                self.handleBotMessage(clawbotMessage)
            }
            .store(in: &cancellables)

        // Subscribe to bot state changes
        clawbotChannelServiceImpl.botStatePublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] botState in
                guard let self = self else { return }
                // Update current messages based on bot state
                if self.currentRoomId != nil {
                    self.updateCurrentMessages()
                }
            }
            .store(in: &cancellables)
    }

    /// Handle incoming bot message from ClawbotChannel
    private func handleBotMessage(_ clawbotMessage: ClawbotMessage) {
        // Convert ClawbotMessage to ChatMessage
        let messageType: MessageType
        switch clawbotMessage.contentType {
        case .text:
            messageType = .text
        case .image:
            messageType = .image
        case .video:
            messageType = .video
        case .file, .mixed:
            messageType = .file
        }

        let chatMessage = ChatMessage(
            id: clawbotMessage.id,
            roomId: currentRoomId ?? "",
            senderId: "bot",
            sender: .bot,
            content: clawbotMessage.content,
            messageType: messageType,
            mediaUrl: clawbotMessage.mediaUrl,
            mediaMimeType: clawbotMessage.mediaMimeType,
            mediaDuration: nil,
            mediaSize: nil,
            mediaMetadata: nil,
            voiceUrl: nil,
            voiceDuration: nil,
            voiceTranscript: nil,
            voiceMimeType: nil,
            isRead: false,
            createdAt: clawbotMessage.timestamp
        )

        // Add to current room if active
        if let roomId = currentRoomId {
            addMessageToCache(chatMessage, for: roomId)
            updateCurrentMessages()
        }

        // Fire integration-test callback
        onNewMessage?(chatMessage)
    }

    /// Convert WebSocket message type to chat message type
    private func convertMessageType(_ type: ClawbotMessageContentType) -> ClawbotMessageContentType {
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
        if let messages = messagesCache[roomId], !messages.contains(where: { $0.id == message.id }) {
            messagesCache[roomId]?.append(message)
            // 新消息时间戳通常是最新的，直接追加即可，不需要每次都排序
            // 只有在需要时（如加载历史消息时才排序）
        }
    }

    /// Update current messages from cache based on selected room
    private func updateCurrentMessages() {
        guard let roomId = currentRoomId else {
            currentMessages = []
            return
        }

        // 直接引用缓存，避免不必要的数组拷贝
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
            senderId: senderId,
            sender: sender,
            content: content,
            messageType: messageType,
            mediaUrl: mediaUrl,
            mediaMimeType: mediaMimeType,
            mediaDuration: mediaDuration,
            mediaSize: mediaSize,
            mediaMetadata: mediaMetadata,
            voiceUrl: voiceUrl,
            voiceDuration: voiceDuration,
            voiceTranscript: voiceTranscript,
            voiceMimeType: voiceMimeType,
            isRead: isRead,
            createdAt: createdAt
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

        return await fetchMessages(roomId: roomId, before: lastMessage.createdAt)
    }

    /// Search messages in current room
    func searchMessages(query: String) -> [ChatMessage] {
        guard !query.isEmpty else { return currentMessages }

        return currentMessages.filter { message in
            message.content.localizedCaseInsensitiveContains(query)
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

// MARK: - Test Stub Extensions
// Required by integration tests; delegates to existing functionality.

extension ChatService {

    // MARK: - Convenience API aliases (delegates to existing methods)

    /// Alias for fetchMessages — loadChatHistory wraps fetchMessages with defaults
    func loadChatHistory(roomId: String, before: Date? = nil, limit: Int = 50) async -> ChatResult<[ChatMessage]> {
        await fetchMessages(roomId: roomId, before: before)
    }

    /// Send a media message (image/video) — delegates to sendMessage
    func sendMediaMessage(
        roomId: String,
        mediaData: Data,
        fileName: String,
        mimeType: String,
        caption: String?
    ) async -> ChatResult<ChatMessage> {
        await sendMessage(
            roomId: roomId,
            content: caption ?? "",
            type: .image,
            mediaUrl: fileName,
            mediaMimeType: mimeType
        )
    }

    /// Send a voice message — delegates to sendMessage
    func sendVoiceMessage(
        roomId: String,
        voiceData: Data,
        fileName: String,
        duration: Int,
        transcript: String? = nil
    ) async -> ChatResult<ChatMessage> {
        await sendMessage(
            roomId: roomId,
            content: transcript ?? "",
            type: .voice,
            mediaUrl: fileName,
            mediaMimeType: "audio/m4a"
        )
    }
}

// MARK: - Test Helpers

/// Internal helpers for unit testing (compiled into app target, accessible via @testable import)
extension ChatService {
    /// Expose messages cache for unit testing
    var _testMessagesCache: [String: [ChatMessage]] {
        get { messagesCache }
        set { messagesCache = newValue }
    }

    /// Direct cache manipulation for testing
    func _testAddMessage(_ message: ChatMessage, forRoom roomId: String) {
        addMessageToCache(message, for: roomId)
    }
}

#endif
