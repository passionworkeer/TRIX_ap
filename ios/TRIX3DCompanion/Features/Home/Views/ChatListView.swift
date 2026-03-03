//
//  ChatListView.swift
//  TRIX3DCompanion
//
//  Chat tab with friends list, quick add, and TRIX Bot
//

import SwiftUI

// MARK: - Chat List View

/// Main chat screen showing all conversations
struct ChatListView: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var chatService: ChatService

    // MARK: - State

    @State private var searchText = ""
    @State private var selectedConversation: ChatConversation?
    @State private var showingCreateChat = false
    @State private var newChatName = ""
    @State private var conversations: [ChatConversation] = []
    @State private var recommendedUsers: [RecommendedUser] = []
    @State private var showQuickAdd = true

    // Sample recommended users
    private let sampleRecommendedUsers: [RecommendedUser] = [
        RecommendedUser(id: "1", name: "Sarah Chen", avatar: "SC", mutualFriends: 5, avatarColor: .pink),
        RecommendedUser(id: "2", name: "Mike Johnson", avatar: "MJ", mutualFriends: 3, avatarColor: .blue),
        RecommendedUser(id: "3", name: "Emma Wilson", avatar: "EW", mutualFriends: 8, avatarColor: .purple),
        RecommendedUser(id: "4", name: "David Lee", avatar: "DL", mutualFriends: 2, avatarColor: .green),
        RecommendedUser(id: "5", name: "Lisa Park", avatar: "LP", mutualFriends: 6, avatarColor: .orange),
        RecommendedUser(id: "6", name: "Tom Wang", avatar: "TW", mutualFriends: 4, avatarColor: .cyan),
        RecommendedUser(id: "7", name: "Amy Liu", avatar: "AL", mutualFriends: 7, avatarColor: .mint),
        RecommendedUser(id: "8", name: "John Smith", avatar: "JS", mutualFriends: 1, avatarColor: .indigo)
    ]

    // Sample Data
    private let sampleConversations = [
        ChatConversation(id: "1", name: "Math Study Group", avatarUrl: nil, lastMessage: "Let's meet at 3pm", time: "2m ago", unreadCount: 3, avatarColor: .blue, isOnline: true),
        ChatConversation(id: "2", name: "Physics Discussion", avatarUrl: nil, lastMessage: "Check out this formula", time: "1h ago", unreadCount: 0, avatarColor: .purple, isOnline: false),
        ChatConversation(id: "3", name: "Study Buddy - Alex", avatarUrl: nil, lastMessage: "Great session today!", time: "3h ago", unreadCount: 1, avatarColor: .green, isOnline: true),
        ChatConversation(id: "4", name: "Chemistry Lab", avatarUrl: nil, lastMessage: "Don't forget the report", time: "1d ago", unreadCount: 0, avatarColor: .orange, isOnline: false),
        ChatConversation(id: "5", name: "English Club", avatarUrl: nil, lastMessage: "See you tomorrow!", time: "5h ago", unreadCount: 2, avatarColor: .yellow, isOnline: true),
        ChatConversation(id: "6", name: "History Study", avatarUrl: nil, lastMessage: "The exam is next week", time: "1d ago", unreadCount: 0, avatarColor: .red, isOnline: false),
        ChatConversation(id: "7", name: "Biology Group", avatarUrl: nil, lastMessage: "Lab report submitted", time: "2d ago", unreadCount: 0, avatarColor: .teal, isOnline: true),
        ChatConversation(id: "8", name: "Art Workshop", avatarUrl: nil, lastMessage: "Great work everyone!", time: "3d ago", unreadCount: 0, avatarColor: .pink, isOnline: false)
    ]

    init() {
        _conversations = State(initialValue: sampleConversations)
        _recommendedUsers = State(initialValue: sampleRecommendedUsers)
    }

    // MARK: - Body

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                searchBar.padding()
                trixBotEntry.padding(.horizontal).padding(.bottom, 12)

                if showQuickAdd && !recommendedUsers.isEmpty {
                    quickAddSection.padding(.bottom, 12)
                }

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
                        Image(systemName: "square.and.pencil").foregroundColor(.purple)
                    }
                }
            }
            .sheet(isPresented: $showingCreateChat) { createChatSheet }
        }
    }

    // MARK: - Search Bar

    private var searchBar: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass").foregroundColor(.secondary)
            TextField("搜索对话...", text: $searchText).textFieldStyle(.plain)
            if !searchText.isEmpty {
                Button(action: { searchText = "" }) {
                    Image(systemName: "xmark.circle.fill").foregroundColor(.secondary)
                }
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(.ultraThinMaterial).clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - TRIX Bot Entry

    private var trixBotEntry: some View {
        Button {
            openTrixBotChat()
        } label: {
            HStack(spacing: 12) {
                // Avatar with status indicator
                ZStack(alignment: .bottomTrailing) {
                    Circle().fill(RadialGradient(colors: [Color.purple.opacity(0.4), .clear], center: .center, startRadius: 0, endRadius: 25)).frame(width: 48, height: 48)
                    Circle().fill(LinearGradient(colors: [Color.purple, .pink], startPoint: .topLeading, endPoint: .bottomTrailing)).frame(width: 48, height: 48)
                        .overlay {
                            Image(systemName: "sparkles").font(.title3).foregroundColor(.white)
                        }
                        .overlay(
                            Circle().stroke(.white.opacity(0.1), lineWidth: 1)
                        )
                    // Online status
                    Circle().fill(.green).frame(width: 14, height: 14).overlay(Circle().stroke(.black.opacity(0.3), lineWidth: 2)).offset(x: 2, y: 2).shadow(color: .green.opacity(0.5), radius: 4)
                }

                // Name and status
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text("TRIX").font(.headline).foregroundColor(.white)
                    }
                    HStack(spacing: 4) {
                        Image(systemName: "message.square.fill").font(.system(size: 14)).foregroundColor(.green)
                        Text("AI 学习助手").font(.subheadline).foregroundColor(.gray.opacity(0.6))
                    }
                }

                Spacer()

                // Camera icon (Web style)
                Circle()
                    .fill(.green.opacity(0.2))
                    .frame(width: 40, height: 40)
                    .overlay {
                        Image(systemName: "camera.fill")
                            .font(.system(size: 16))
                            .foregroundColor(.green)
                    }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(.white.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Quick Add Section

    private var quickAddSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Quick Add").font(.subheadline).fontWeight(.semibold).foregroundColor(.white.opacity(0.8)).textCase(.uppercase)
                Spacer()
                Button("隐藏") { withAnimation { showQuickAdd = false } }.font(.caption).foregroundColor(.white.opacity(0.6))
            }.padding(.horizontal, 20)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(recommendedUsers) { user in
                        QuickAddUserCard(user: user) { addUser(user) }
                    }
                }.padding(.horizontal, 20)
            }
        }
    }

    // MARK: - Conversation List

    private var filteredConversations: [ChatConversation] {
        if searchText.isEmpty { return conversations }
        return conversations.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    private var conversationList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(filteredConversations) { conversation in
                    NavigationLink(destination: ChatDetailView(conversation: conversation)) {
                        ConversationRow(conversation: conversation)
                    }.buttonStyle(.plain)
                    if conversation.id != filteredConversations.last?.id {
                        Divider().padding(.leading, 72)
                    }
                }
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "message.circle").font(.system(size: 60)).foregroundColor(.purple.opacity(0.3))
            Text("没有找到对话").font(.headline).foregroundColor(.secondary)
            Text("开始新对话一起学习吧").font(.subheadline).foregroundColor(.secondary).multilineTextAlignment(.center)
        }.frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Background Gradient

    private var backgroundGradient: some View {
        LinearGradient(colors: [Color.purple.opacity(0.05), Color.pink.opacity(0.03), .clear], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
    }

    // MARK: - Actions

    private func openTrixBotChat() {
        let botConversation = ChatConversation(id: "trixbot", name: "TRIX", avatarUrl: "AvatarHead", lastMessage: "有什么可以帮你的吗？", time: "在线", unreadCount: 0, avatarColor: .purple, isOnline: true)
        selectedConversation = botConversation
    }

    private func addUser(_ user: RecommendedUser) {
        withAnimation { recommendedUsers.removeAll { $0.id == user.id } }
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
    }

    private func createNewChat() {
        showingCreateChat = true
    }

    private var createChatSheet: some View {
        NavigationView {
            Form {
                Section(header: Text("Chat Details")) {
                    TextField("Chat name", text: $newChatName).textContentType(.name).autocapitalization(.words)
                    Text("Enter a name for your new chat conversation.").font(.caption).foregroundColor(.secondary)
                }
                Section {
                    Button(action: {
                        let trimmedName = newChatName.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !trimmedName.isEmpty else { return }
                        let colors: [Color] = [.blue, .purple, .green, .orange, .pink]
                        let newConversation = ChatConversation(id: UUID().uuidString, name: trimmedName, avatarUrl: nil, lastMessage: "New conversation", time: "Just now", unreadCount: 0, avatarColor: colors.randomElement() ?? .purple, isOnline: false)
                        conversations.insert(newConversation, at: 0)
                        newChatName = ""
                        showingCreateChat = false
                    }) {
                        HStack { Spacer(); Text("Create Chat").fontWeight(.semibold); Spacer() }
                    }.disabled(newChatName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .navigationTitle("New Chat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { newChatName = ""; showingCreateChat = false }
                }
            }
        }.presentationDetents([.medium])
    }
}

// MARK: - Quick Add User Card

struct QuickAddUserCard: View {
    let user: RecommendedUser
    let onAdd: () -> Void
    @State private var isAdded = false

    var body: some View {
        VStack(spacing: 4) {
            ZStack(alignment: .topTrailing) {
                // Snapchat-style card background - smaller size
                RoundedRectangle(cornerRadius: 12)
                    .fill(.white.opacity(0.05))
                    .frame(width: 80, height: 100)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(.white.opacity(0.1), lineWidth: 1)
                    )

                VStack(spacing: 4) {
                    // Avatar - smaller
                    Circle()
                        .fill(LinearGradient(colors: [user.avatarColor, user.avatarColor.opacity(0.7)], startPoint: .topLeading, endPoint: .bottomTrailing))
                        .frame(width: 44, height: 44)
                        .overlay {
                            Text(user.avatar).font(.caption).fontWeight(.semibold).foregroundColor(.white)
                        }
                        .padding(.top, 8)

                    // Name
                    Text(user.name)
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .frame(width: 70)

                    if !isAdded {
                        // Smaller add button
                        Button(action: {
                            withAnimation(.spring(response: 0.3)) {
                                isAdded = true
                            }
                            onAdd()
                        }) {
                            Text("+ 添加")
                                .font(.caption2)
                                .fontWeight(.bold)
                                .foregroundColor(.black)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 4)
                                .background(.yellow)
                                .clipShape(Capsule())
                                .shadow(color: .yellow.opacity(0.5), radius: 4)
                        }
                    } else {
                        Text("已添加")
                            .font(.caption2)
                            .foregroundColor(.white.opacity(0.6))
                    }
                }
            }
        }
        .frame(width: 80)
    }
}

// MARK: - Conversation Row

struct ConversationRow: View {
    let conversation: ChatConversation

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            ZStack(alignment: .bottomTrailing) {
                Circle().fill(LinearGradient(colors: [conversation.avatarColor, conversation.avatarColor.opacity(0.7)], startPoint: .topLeading, endPoint: .bottomTrailing)).frame(width: 48, height: 48)
                    .overlay {
                        Text(String(conversation.name.prefix(1))).font(.title3).fontWeight(.semibold).foregroundColor(.white)
                    }
                    .overlay(
                        Circle().stroke(.white.opacity(0.1), lineWidth: 1)
                    )
                if conversation.isOnline {
                    Circle().fill(.green).frame(width: 14, height: 14).overlay(Circle().stroke(.black.opacity(0.3), lineWidth: 2)).offset(x: 2, y: 2).shadow(color: .green.opacity(0.5), radius: 4)
                }
            }

            // Name and message
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(conversation.name).font(.headline).foregroundColor(.white)
                    Spacer()
                }
                HStack(spacing: 4) {
                    Image(systemName: "message.square.fill").font(.system(size: 14)).foregroundColor(conversation.unreadCount > 0 ? .yellow : .gray.opacity(0.5))
                    Text(conversation.lastMessage).font(.subheadline).foregroundColor(conversation.unreadCount > 0 ? .white.opacity(0.9) : .gray.opacity(0.6)).lineLimit(1)
                    Spacer()
                }
            }

            // Right side - camera icon or unread badge
            if conversation.unreadCount > 0 {
                // Amber unread badge (Web style)
                Text("\(conversation.unreadCount > 9 ? "9+" : "\(conversation.unreadCount)")")
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(.black)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(.yellow)
                    .clipShape(Circle())
                    .shadow(color: .yellow.opacity(0.3), radius: 4)
            } else {
                // Camera icon (Web style)
                Circle()
                    .fill(.white.opacity(0.1))
                    .frame(width: 40, height: 40)
                    .overlay {
                        Image(systemName: "camera.fill")
                            .font(.system(size: 16))
                            .foregroundColor(.gray.opacity(0.5))
                    }
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
        .background(.white.opacity(0.05))
        .contentShape(Rectangle())
    }
}

// MARK: - Preview

#Preview("Chat List") {
    ChatListView()
        .environmentObject(AppState.shared)
        .environmentObject(ChatService.shared)
}
