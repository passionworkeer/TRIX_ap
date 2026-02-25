//
//  ChatService.swift
//  TRIX3DCompanion
//
//  Chat service for managing conversations and messages
//

import Foundation
import Combine

// MARK: - Chat Error

/// Chat service error types
enum ChatError: Error, LocalizedError {
    case notConnected
    case messageSendFailed(reason: String)
    case loadFailed(reason: String)
    case invalidConversation
    case networkError(underlying: Error)

    var errorDescription: String? {
        switch self {
        case .notConnected:
            return "Not connected to chat server"
        case .messageSendFailed(let reason):
            return "Failed to send message: \(reason)"
        case .loadFailed(let reason):
            return "Failed to load messages: \(reason)"
        case .invalidConversation:
            return "Invalid conversation"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}

// MARK: - Chat Service

/// Main chat service handling conversations and messages
@MainActor
final class ChatService: ObservableObject {

    // MARK: - Singleton

    static let shared = ChatService()

    // MARK: - Published Properties

    /// Current conversation being viewed
    @Published private(set) var currentConversation: ChatConversation?

    /// Messages in current conversation
    @Published private(set) var messages: [ChatMessage] = []

    /// Whether chat is connected
    @Published private(set) var isConnected: Bool = false

    /// Whether messages are loading
    @Published private(set) var isLoading: Bool = false

    /// Whether more history messages are available
    @Published private(set) var hasMoreHistory: Bool = true

    /// Connection status message
    @Published private(set) var connectionStatus: String = "Disconnected"

    // MARK: - Dependencies

    private let webSocketManager: WebSocketManager
    private let apiClient: APIClient

    // MARK: - Private Properties

    private var cancellables = Set<AnyCancellable>()
    private var messagePageSize: Int = 20

    // MARK: - Initialization

    init(
        webSocketManager: WebSocketManager = .shared,
        apiClient: APIClient = .shared
    ) {
        self.webSocketManager = webSocketManager
        self.apiClient = apiClient

        setupWebSocketObservers()
    }

    // MARK: - Public Methods - Connection

    /// Connect to chat service
    /// - Parameter userId: User ID for connection
    func connect(userId: String) async {
        do {
            try await webSocketManager.connect(userId: userId)
            isConnected = true
            connectionStatus = "Connected"
        } catch {
            isConnected = false
            connectionStatus = "Connection failed"
            print("Chat connection failed: \(error.localizedDescription)")
        }
    }

    /// Disconnect from chat service
    func disconnect() {
        webSocketManager.disconnect()
        isConnected = false
        connectionStatus = "Disconnected"
        currentConversation = nil
        messages = []
    }

    // MARK: - Public Methods - Conversation

    /// Open a conversation
    /// - Parameter conversation: Conversation to open
    func openConversation(_ conversation: ChatConversation) async {
        currentConversation = conversation
        messages = []
        hasMoreHistory = true

        // Load initial messages
        await loadMessages()
    }

    /// Close current conversation
    func closeConversation() {
        currentConversation = nil
        messages = []
    }

    // MARK: - Public Methods - Messages

    /// Load messages for current conversation
    /// - Parameter older: Whether to load older messages (for pagination)
    func loadMessages(older: Bool = false) async {
        guard let conversation = currentConversation else { return }

        if older && !hasMoreHistory { return }

        isLoading = true

        do {
            // Simulate API call delay
            try await Task.sleep(nanoseconds: 500_000_000)

            // Load sample messages
            let newMessages = generateSampleMessages(
                for: conversation,
                count: messagePageSize,
                before: older ? messages.first?.timestamp : nil
            )

            if older {
                messages.insert(contentsOf: newMessages, at: 0)
            } else {
                messages = newMessages
            }

            // Simulate end of history after 3 pages
            if older && messages.count >= messagePageSize * 3 {
                hasMoreHistory = false
            }

            isLoading = false

        } catch {
            isLoading = false
            print("Failed to load messages: \(error.localizedDescription)")
        }
    }

    /// Send a text message
    /// - Parameter text: Message text
    func sendTextMessage(_ text: String) async {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        guard let conversation = currentConversation else { return }

        // Create optimistic message
        let optimisticMessage = ChatMessage(
            id: UUID().uuidString,
            roomId: conversation.id,
            friendId: nil,
            sender: .user,
            senderId: nil,
            text: text,
            timestamp: Date(),
            messageType: .text,
            mediaUri: nil,
            mediaType: nil,
            mediaSize: nil,
            mediaMetadata: nil,
            isRead: true
        )

        // Add optimistically
        messages.append(optimisticMessage)

        // Send via WebSocket
        webSocketManager.sendMessage(content: text)

        // Simulate receiving a response for bot conversations
        if conversation.id == "bot" {
            try? await Task.sleep(nanoseconds: 1_000_000_000)

            let botResponse = ChatMessage(
                id: UUID().uuidString,
                roomId: conversation.id,
                friendId: nil,
                sender: .bot,
                senderId: nil,
                text: generateBotResponse(for: text),
                timestamp: Date(),
                messageType: .text,
                mediaUri: nil,
                mediaType: nil,
                mediaSize: nil,
                mediaMetadata: nil,
                isRead: true
            )

            messages.append(botResponse)
        }
    }

    /// Send an image message
    /// - Parameter imageURL: Image URL
    func sendImageMessage(_ imageURL: String) async {
        guard let conversation = currentConversation else { return }

        let message = ChatMessage(
            id: UUID().uuidString,
            roomId: conversation.id,
            friendId: nil,
            sender: .user,
            senderId: nil,
            text: "",
            timestamp: Date(),
            messageType: .image,
            mediaUri: imageURL,
            mediaType: "image/jpeg",
            mediaSize: nil,
            mediaMetadata: nil,
            isRead: true
        )

        messages.append(message)

        // Send via WebSocket
        webSocketManager.sendMessage(
            content: "",
            contentType: .image,
            mediaUrl: imageURL,
            mediaMimeType: "image/jpeg"
        )
    }

    /// Mark messages as read
    func markAsRead() {
        // TODO: Implement mark as read API call
    }

    // MARK: - Private Methods

    /// Setup WebSocket event observers
    private func setupWebSocketObservers() {
        // Observe connection status
        webSocketManager.on(.connected) { [weak self] event in
            if case .connected = event {
                self?.isConnected = true
                self?.connectionStatus = "Connected"
            }
        }

        webSocketManager.on(.disconnected) { [weak self] event in
            if case .disconnected(let reason) = event {
                self?.isConnected = false
                self?.connectionStatus = "Disconnected: \(reason)"
            }
        }

        // Observe incoming messages
        webSocketManager.on(.botMessage) { [weak self] event in
            if case .botMessage(let botMessage) = event {
                self?.handleIncomingBotMessage(botMessage)
            }
        }

        // Observe message sent confirmation
        webSocketManager.on(.messageSent) { [weak self] event in
            if case .messageSent(let response) = event {
                self?.handleMessageSentResponse(response)
            }
        }
    }

    /// Handle incoming bot message
    private func handleIncomingBotMessage(_ botMessage: BotMessage) {
        guard currentConversation?.id == "bot" else { return }

        let message = ChatMessage(
            id: botMessage.messageId ?? UUID().uuidString,
            roomId: "bot",
            friendId: nil,
            sender: .bot,
            senderId: nil,
            text: botMessage.content,
            timestamp: Date(timeIntervalSince1970: TimeInterval(botMessage.timestamp) / 1000),
            messageType: mapContentType(botMessage.contentType),
            mediaUri: botMessage.mediaUrl,
            mediaType: botMessage.mediaMimeType,
            mediaSize: nil,
            mediaMetadata: nil,
            isRead: true
        )

        messages.append(message)
    }

    /// Handle message sent response
    private func handleMessageSentResponse(_ response: MessageSentResponse) {
        if !response.success {
            // Remove optimistic message or mark as failed
            if let messageId = response.messageId {
                messages.removeAll { $0.id == messageId }
            }
        }
    }

    /// Map bot message content type to message content type
    private func mapContentType(_ contentType: BotMessage.MessageContentType?) -> MessageContentType? {
        guard let contentType = contentType else { return nil }
        switch contentType {
        case .text: return .text
        case .image: return .image
        case .video: return .video
        case .file: return .mixed
        case .mixed: return .mixed
        }
    }

    /// Generate sample messages for preview/testing
    private func generateSampleMessages(
        for conversation: ChatConversation,
        count: Int,
        before: Date?
    ) -> [ChatMessage] {
        var sampleMessages: [ChatMessage] = []

        let baseTime = before ?? Date()
        let interval: TimeInterval = -300 // 5 minutes between messages

        for i in 0..<count {
            let timestamp = baseTime.addingTimeInterval(interval * Double(count - i))

            let isUser = i % 3 == 0 // Every third message is from user

            let message = ChatMessage(
                id: "msg-\(conversation.id)-\(i)",
                roomId: conversation.id,
                friendId: nil,
                sender: isUser ? .user : .friend,
                senderId: isUser ? nil : "friend-1",
                text: isUser ? "This is my message #\(i)" : "This is a reply message #\(i)",
                timestamp: timestamp,
                messageType: .text,
                mediaUri: nil,
                mediaType: nil,
                mediaSize: nil,
                mediaMetadata: nil,
                isRead: true
            )

            sampleMessages.append(message)
        }

        return sampleMessages
    }

    /// Generate bot response for testing
    private func generateBotResponse(for text: String) -> String {
        let responses = [
            "That's interesting! Tell me more.",
            "I understand. How can I help you with that?",
            "Great question! Let me think about it.",
            "Thanks for sharing. Here's what I think...",
            "That's a good point!",
            "I'm here to help. What would you like to know?",
            "Interesting perspective! Have you considered...",
            "Let me help you with that."
        ]

        return responses.randomElement() ?? "I received your message!"
    }
}
