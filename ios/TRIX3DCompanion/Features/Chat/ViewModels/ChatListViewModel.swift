//
//  ChatListViewModel.swift
//  TRIX3DCompanion
//
//  ViewModel for chat list with search, filtering, and real-time updates
//

import Foundation
import Combine
import SwiftUI

// MARK: - Chat List ViewModel

/// ViewModel managing chat room list with search, filtering, and real-time updates
@MainActor
final class ChatListViewModel: ObservableObject {

    // MARK: - Published Properties

    /// All loaded chat rooms
    @Published private(set) var chatRooms: [ChatRoom] = []

    /// Filtered chat rooms based on search
    @Published private(set) var filteredRooms: [ChatRoom] = []

    /// Whether currently loading
    @Published private(set) var isLoading = false

    /// Whether there was an error
    @Published private(set) var hasError = false

    /// Error message if any
    @Published private(set) var errorMessage: String?

    /// Recommended users to add
    @Published private(set) var recommendedUsers: [RecommendedUser] = []

    /// Search query text
    @Published var searchText: String = "" {
        didSet {
            applyFilters()
        }
    }

    // MARK: - Dependencies

    private let chatService: ChatService
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    init(chatService: ChatService = .shared) {
        self.chatService = chatService
        setupBindings()
    }

    // MARK: - Setup

    private func setupBindings() {
        // Observe chat rooms from service
        chatService.$chatRooms
            .sink { [weak self] rooms in
                self?.chatRooms = rooms
                self?.applyFilters()
            }
            .store(in: &cancellables)

        // Observe loading state
        chatService.$isLoadingRooms
            .sink { [weak self] isLoading in
                self?.isLoading = isLoading
            }
            .store(in: &cancellables)

        // Observe connection state
        chatService.$isConnected
            .sink { [weak self] isConnected in
                if !isConnected {
                    self?.hasError = true
                    self?.errorMessage = "Connection lost. Reconnecting..."
                }
            }
            .store(in: &cancellables)
    }

    // MARK: - Public Methods - Loading

    /// Load all chat rooms
    func loadChatRooms() async {
        isLoading = true
        hasError = false
        errorMessage = nil

        let result = await chatService.fetchChatRooms()

        switch result {
        case .success(let rooms):
            chatRooms = rooms
            isLoading = false
        case .failure(let error):
            isLoading = false
            hasError = true
            errorMessage = error.localizedDescription
        }
    }

    /// Refresh chat rooms
    func refresh() async {
        await loadChatRooms()
    }

    /// Load recommended users - use real API for 真机测试
    func loadRecommendedUsers() async {
        // TODO: Replace with actual API call when available
        // For now, clear sample data
        recommendedUsers = []
    }

    // MARK: - Public Methods - Filtering

    /// Apply search and filter to chat rooms
    func applyFilters() {
        if searchText.isEmpty {
            filteredRooms = chatRooms
        } else {
            filteredRooms = chatRooms.filter { room in
                room.name.localizedCaseInsensitiveContains(searchText) ||
                (room.lastMessage?.content.localizedCaseInsensitiveContains(searchText) ?? false)
            }
        }
    }

    /// Search rooms by query
    func searchRooms(_ query: String) {
        searchText = query
    }

    /// Clear search
    func clearSearch() {
        searchText = ""
    }

    // MARK: - Public Methods - Room Management

    /// Delete a chat room
    /// - Parameter roomId: The room ID to delete
    func deleteRoom(_ roomId: String) async {
        // Implement deletion via API
        chatRooms.removeAll { $0.id == roomId }
        applyFilters()
    }

    /// Mark room as read
    /// - Parameter roomId: The room ID to mark as read
    func markAsRead(_ roomId: String) async {
        _ = await chatService.markAllAsRead(roomId: roomId)
    }

    /// Archive a chat room
    /// - Parameter roomId: The room ID to archive
    func archiveRoom(_ roomId: String) async {
        // Implement archiving via API
        chatRooms.removeAll { $0.id == roomId }
        applyFilters()
    }

    /// Mute a chat room
    /// - Parameter roomId: The room ID to mute
    func muteRoom(_ roomId: String) async {
        // Implement muting via API
    }

    /// Unmute a chat room
    /// - Parameter roomId: The room ID to unmute
    func unmuteRoom(_ roomId: String) async {
        // Implement unmuting via API
    }

    // MARK: - Public Methods - Friend Management

    /// Add a recommended user as friend
    /// - Parameter user: The user to add
    func addFriend(_ user: RecommendedUser) async {
        withAnimation {
            recommendedUsers.removeAll { $0.id == user.id }
        }

        // Show success feedback
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
    }

    /// Remove a recommended user from suggestions
    /// - Parameter userId: The user ID to remove
    func removeRecommendation(_ userId: String) {
        withAnimation {
            recommendedUsers.removeAll { $0.id == userId }
        }
    }

    /// Ignore a recommended user
    /// - Parameter userId: The user ID to ignore
    func ignoreRecommendation(_ userId: String) async {
        removeRecommendation(userId)

        // Call API to ignore user
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
    }

    // MARK: - Public Methods - Create Chat

    /// Create a new chat room
    /// - Parameters:
    ///   - name: The chat name
    ///   - type: The chat type
    /// - Returns: Result with created room or error
    func createChatRoom(name: String, type: ChatRoomType) async -> Result<ChatRoom, ChatError> {
        let result = await chatService.createChatRoom(name: name, type: type)

        switch result {
        case .success(let room):
            // Prepend to list
            chatRooms.insert(room, at: 0)
            applyFilters()
        case .failure:
            break
        }

        return result
    }

    /// Create a direct message chat with a user
    /// - Parameter userId: The user ID to chat with
    /// - Returns: Result with created room or error
    func createDirectMessage(with userId: String) async -> Result<ChatRoom, ChatError> {
        // Check if DM already exists
        if let existingRoom = chatRooms.first(where: { $0.type == .privateChat && $0.participants.contains(where: { $0.id == userId }) }) {
            return .success(existingRoom)
        }

        // Create new DM
        return await createChatRoom(name: "Direct Message", type: .privateChat)
    }

    // MARK: - Public Methods - Computed Properties

    /// Total unread message count
    var totalUnreadCount: Int {
        chatRooms.reduce(0) { $0 + $1.unreadCount }
    }

    /// Whether there are any unread messages
    var hasUnreadMessages: Bool {
        totalUnreadCount > 0
    }

    /// Chat rooms sorted by updated date
    var sortedRooms: [ChatRoom] {
        chatRooms.sorted { $0.updatedAt > $1.updatedAt }
    }

    /// Online friends count
    var onlineFriendsCount: Int {
        recommendedUsers.filter { $0.isOnline }.count
    }

    // MARK: - Public Methods - Error Handling

    /// Clear error state
    func clearError() {
        hasError = false
        errorMessage = nil
    }

    /// Retry failed operation
    func retry() async {
        clearError()
        await loadChatRooms()
    }
}

// MARK: - ChatRoom Extension for Filtering

extension ChatRoom {

    /// Check if room matches search query
    func matches(_ query: String) -> Bool {
        guard !query.isEmpty else { return true }
        return name.localizedCaseInsensitiveContains(query) ||
               (lastMessage?.content.localizedCaseInsensitiveContains(query) ?? false)
    }

    /// Display time for last message
    var displayTime: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: updatedAt, relativeTo: Date())
    }
}

// MARK: - Preview

#Preview("Chat List ViewModel") {
    ChatListView_Preview()
}

private struct ChatListView_Preview: View {
    @StateObject private var viewModel = ChatListViewModel(chatService: .shared)

    var body: some View {
        List {
            ForEach(viewModel.filteredRooms) { room in
                HStack {
                    Text(room.name)
                    Spacer()
                    Text("\(room.unreadCount)")
                }
            }
        }
        .task {
            await viewModel.loadChatRooms()
        }
    }
}
