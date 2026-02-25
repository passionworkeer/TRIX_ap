//
//  ChatListView.swift
//  TRIX3DCompanion
//
//  Chat tab placeholder view showing conversation list
//

import SwiftUI

// MARK: - Chat List View

/// Main chat screen showing all conversations
struct ChatListView: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var appState: AppState

    // MARK: - State

    @State private var searchText = ""
    @State private var isSearching = false

    // MARK: - Sample Data

    private let sampleConversations = [
        ChatConversation(
            id: "1",
            name: "Math Study Group",
            lastMessage: "Let's meet at 3pm",
            time: "2m ago",
            unreadCount: 3,
            avatarColor: .blue,
            isOnline: true
        ),
        ChatConversation(
            id: "2",
            name: "Physics Discussion",
            lastMessage: "Check out this formula",
            time: "1h ago",
            unreadCount: 0,
            avatarColor: .purple,
            isOnline: false
        ),
        ChatConversation(
            id: "3",
            name: "Study Buddy - Alex",
            lastMessage: "Great session today!",
            time: "3h ago",
            unreadCount: 1,
            avatarColor: .green,
            isOnline: true
        ),
        ChatConversation(
            id: "4",
            name: "Chemistry Lab",
            lastMessage: "Don't forget the report",
            time: "1d ago",
            unreadCount: 0,
            avatarColor: .orange,
            isOnline: false
        )
    ]

    // MARK: - Body

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Search bar
                searchBar
                    .padding()

                // Conversation list
                if filteredConversations.isEmpty {
                    emptyState
                } else {
                    conversationList
                }
            }
            .background(backgroundGradient)
            .navigationTitle("Messages")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: createNewChat) {
                        Image(systemName: "square.and.pencil")
                            .foregroundColor(.purple)
                    }
                }
            }
        }
    }

    // MARK: - View Components

    /// Search bar
    private var searchBar: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.secondary)

            TextField("Search conversations...", text: $searchText)
                .textFieldStyle(.plain)

            if !searchText.isEmpty {
                Button(action: { searchText = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                }
                .transition(.scale)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    /// Filtered conversations based on search
    private var filteredConversations: [ChatConversation] {
        if searchText.isEmpty {
            return sampleConversations
        }
        return sampleConversations.filter { conversation in
            conversation.name.localizedCaseInsensitiveContains(searchText)
        }
    }

    /// Conversation list
    private var conversationList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(filteredConversations) { conversation in
                    ConversationRow(conversation: conversation)
                        .onTapGesture {
                            openConversation(conversation)
                        }
                        .contentShape(Rectangle())

                    if conversation.id != filteredConversations.last?.id {
                        Divider()
                            .padding(.leading, 72)
                    }
                }
            }
            .padding(.bottom, 100) // Extra padding for tab bar
        }
    }

    /// Empty state when no results
    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "message.circle")
                .font(.system(size: 60))
                .foregroundColor(.purple.opacity(0.3))

            Text("No conversations found")
                .font(.headline)
                .foregroundColor(.secondary)

            Text("Start a new chat to begin studying together")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.bottom, 100)
    }

    /// Background gradient
    private var backgroundGradient: some View {
        LinearGradient(
            colors: [
                Color.purple.opacity(0.1),
                Color.pink.opacity(0.05),
                Color.clear
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }

    // MARK: - Actions

    private func createNewChat() {
        // TODO: Implement new chat creation
        print("Create new chat")
    }

    private func openConversation(_ conversation: ChatConversation) {
        // TODO: Implement conversation opening
        print("Open conversation: \(conversation.name)")
    }
}

// MARK: - Conversation Row

/// Single conversation row in the list
struct ConversationRow: View {
    let conversation: ChatConversation

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            ZStack(alignment: .bottomTrailing) {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [conversation.avatarColor, conversation.avatarColor.opacity(0.7)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 50, height: 50)
                    .overlay {
                        Text(String(conversation.name.prefix(1)))
                            .font(.title3)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                    }

                // Online indicator
                if conversation.isOnline {
                    Circle()
                        .fill(.green)
                        .frame(width: 14, height: 14)
                        .overlay {
                            Circle()
                                .stroke(.white, lineWidth: 2)
                        }
                        .offset(x: 2, y: 2)
                }
            }

            // Content
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(conversation.name)
                        .font(.headline)
                        .foregroundColor(.primary)

                    Spacer()

                    Text(conversation.time)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                HStack {
                    Text(conversation.lastMessage)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(1)

                    Spacer()

                    if conversation.unreadCount > 0 {
                        Text("\(conversation.unreadCount)")
                            .font(.caption2)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(.purple)
                            .clipShape(Capsule())
                    }
                }
            }

            Spacer()
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial.opacity(0.3))
        .contentShape(Rectangle())
    }
}

// MARK: - Chat Conversation Model

struct ChatConversation: Identifiable {
    let id: String
    let name: String
    let lastMessage: String
    let time: String
    let unreadCount: Int
    let avatarColor: Color
    let isOnline: Bool
}

// MARK: - Preview

#Preview("Chat List") {
    ChatListView()
        .environmentObject(AppState.shared)
}

#Preview("Conversation Row") {
    VStack(spacing: 0) {
        ConversationRow(conversation: ChatConversation(
            id: "1",
            name: "Math Study Group",
            lastMessage: "Let's meet at 3pm",
            time: "2m ago",
            unreadCount: 3,
            avatarColor: .blue,
            isOnline: true
        ))

        Divider()

        ConversationRow(conversation: ChatConversation(
            id: "2",
            name: "Physics Discussion",
            lastMessage: "Check out this formula",
            time: "1h ago",
            unreadCount: 0,
            avatarColor: .purple,
            isOnline: false
        ))
    }
    .background(Color.gray.opacity(0.1))
}
