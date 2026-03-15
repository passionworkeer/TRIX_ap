//
//  ChatDetailViewModel.swift
//  TRIX3DCompanion
//
//  Modern ViewModel for ChatDetail using @Observable pattern
//

import SwiftUI
import Combine

// MARK: - Chat Input State

/// Represents the current input state of the chat
enum ChatInputState: Equatable {
    case empty
    case hasText(String)
    case hasMedia(MediaAttachment)
    case both(text: String, media: MediaAttachment)
    case voiceRecording

    var canSend: Bool {
        switch self {
        case .empty, .voiceRecording:
            return false
        case .hasText, .hasMedia, .both:
            return true
        }
    }

    var isRecording: Bool {
        if case .voiceRecording = self { return true }
        return false
    }
}

// MARK: - Media Attachment

/// Represents a media attachment being composed
struct MediaAttachment: Identifiable, Equatable {
    let id = UUID()
    let type: MediaType
    let url: URL
    let thumbnail: UIImage?
    let fileSize: Int?
    let duration: TimeInterval?

    enum MediaType: Equatable {
        case image
        case video
        case audio
        case file(mimeType: String)
    }
}

// MARK: - Chat UI State

/// Represents the UI state of the chat detail view
struct ChatUIState {
    var inputText: String = ""
    var pendingMedia: MediaAttachment?
    var isLoading: Bool = false
    var isLoadingMore: Bool = false
    var error: ChatError?
    var showAttachmentMenu: Bool = false
    var showCamera: Bool = false
    var showImagePicker: Bool = false
    var isVoiceRecording: Bool = false
    var shouldScrollToBottom: Bool = false
    var previousMessageCount: Int = 0

    var inputState: ChatInputState {
        if isVoiceRecording {
            return .voiceRecording
        }
        let hasText = !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasMedia = pendingMedia != nil

        switch (hasText, hasMedia) {
        case (false, false): return .empty
        case (true, false): return .hasText(inputText)
        case (false, true): return .hasMedia(pendingMedia!)
        case (true, true): return .both(text: inputText, media: pendingMedia!)
        }
    }
}

// MARK: - Chat Detail View Model

/// Modern ViewModel for Chat Detail using @Observable pattern
/// Follows Apple's recommended State-as-Bridge pattern for SwiftUI
@Observable
@MainActor
final class ChatDetailViewModel {

    // MARK: - Properties

    let conversation: ChatConversation
    private let chatService: ChatService
    private let authService: AuthService

    // UI State
    var uiState = ChatUIState()

    // MARK: - Computed Properties (View-specific)

    var messages: [ChatMessage] {
        chatService.currentMessages
    }

    var isConnected: Bool {
        chatService.isConnected
    }

    var hasMoreMessages: Bool {
        chatService.hasMoreMessages
    }

    var currentUserId: String? {
        authService.currentUser?.id
    }

    var isCurrentUserMessage: (ChatMessage) -> Bool {
        { [weak self] message in
            message.sender == .user || message.senderId == self?.currentUserId
        }
    }

    // MARK: - Initialization

    init(
        conversation: ChatConversation,
        chatService: ChatService = .shared,
        authService: AuthService = .shared
    ) {
        self.conversation = conversation
        self.chatService = chatService
        self.authService = authService
    }

    // MARK: - Public Methods - Lifecycle

    /// Called when the view appears
    func onAppear() {
        Task {
            await loadConversation()
        }
    }

    /// Called when the view disappears
    func onDisappear() {
        chatService.disconnectWebSocket()
    }

    // MARK: - Public Methods - Actions

    /// Sends the current message
    func sendMessage() async {
        guard uiState.inputState.canSend else { return }

        let text = uiState.inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        let media = uiState.pendingMedia

        // Clear input immediately for better UX
        uiState.inputText = ""
        uiState.pendingMedia = nil

        // Send via service
        let result = await chatService.sendMessage(
            roomId: conversation.id,
            content: text,
            type: media != nil ? .image : .text,
            mediaUrl: media?.url.absoluteString,
            mediaMimeType: media?.type == .image ? "image/jpeg" : nil
        )

        if case .failure(let error) = result {
            uiState.error = error
        }
    }

    /// Loads more messages (pagination)
    func loadMoreMessages() async {
        guard !uiState.isLoadingMore, let oldestMessage = messages.first else { return }

        uiState.isLoadingMore = true
        defer { uiState.isLoadingMore = false }

        _ = await chatService.fetchMessages(
            roomId: conversation.id,
            before: oldestMessage.createdAt
        )
    }

    /// Reconnects the WebSocket
    func reconnect() async {
        if let userId = authService.currentUser?.id {
            _ = await chatService.connectWebSocket(userId: userId)
        }
    }

    /// Handles attachment button tap
    func showAttachmentMenu() {
        uiState.showAttachmentMenu = true
    }

    /// Shows the camera
    func showCamera() {
        uiState.showCamera = true
    }

    /// Shows the image picker
    func showImagePicker() {
        uiState.showImagePicker = true
    }

    /// Handles media selection
    func selectMedia(_ media: MediaAttachment) {
        uiState.pendingMedia = media
    }

    /// Removes pending media
    func removePendingMedia() {
        uiState.pendingMedia = nil
    }

    /// Dismisses keyboard
    func dismissKeyboard() {
        // This is handled by the view via FocusState
    }

    /// Tracks message count for scroll behavior
    func trackMessageCount() {
        uiState.previousMessageCount = messages.count
    }

    /// Checks if should scroll to bottom
    var shouldScrollToBottom: Bool {
        messages.count > uiState.previousMessageCount
    }

    // MARK: - Private Methods

    private func loadConversation() async {
        chatService.selectRoom(roomId: conversation.id)
        _ = await chatService.fetchMessages(roomId: conversation.id, before: nil)
        trackMessageCount()
    }
}

// MARK: - Preview Support

extension ChatDetailViewModel {
    /// Creates a preview instance for SwiftUI previews
    static func preview() -> ChatDetailViewModel {
        let viewModel = ChatDetailViewModel(
            conversation: ChatConversation(
                id: "preview",
                name: "Test Chat",
                avatarUrl: nil,
                lastMessage: "Hello",
                time: "Now",
                unreadCount: 0,
                avatarColor: .blue,
                isOnline: true
            )
        )
        return viewModel
    }
}
