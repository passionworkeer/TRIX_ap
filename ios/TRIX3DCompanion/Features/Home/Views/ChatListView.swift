//
//  ChatListView.swift
//  TRIX3DCompanion
//
//  Chat tab with friends list, quick add, and TRIX Bot
//  Optimized for native iOS look and feel
//

import SwiftUI

enum ChatAccessibilityIdentifiers {
    static let screen = "chat.screen"
    static let searchField = "chat.search.field"
    static let trixBotCard = "chat.trixbot.card"
    static let emptyState = "chat.empty.state"
    static let reloadButton = "chat.reload.button"
}

// MARK: - Chat List View

/// Main chat screen showing all conversations with native iOS design
struct ChatListView: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var chatService: ChatService
    @EnvironmentObject private var clawbotChannel: ClawbotChannelViewModel

    // MARK: - Callbacks

    var onNavigateToChat: ((ChatConversation) -> Void)?

    // MARK: - State

    init(onNavigateToChat: ((ChatConversation) -> Void)? = nil) {
        self.onNavigateToChat = onNavigateToChat
    }

    @StateObject private var friendService = FriendService.shared
    @State private var searchText = ""
    @State private var selectedConversation: ChatConversation?
    @State private var showingCreateChat = false
    @State private var showingPairing = false
    @State private var showingTrixBotChat = false
    @State private var newChatName = ""
    @State private var isCreatingChat = false
    @State private var conversations: [ChatConversation] = []
    @State private var recommendedUsers: [RecommendedUser] = []
    @State private var showQuickAdd = true
    @State private var showPairingAlert = false
    @State private var friendActionError: String?
    @State private var friendLoadNote: String?
    @State private var isLoading = true

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                // Native iOS grouped background
                Color(.systemGroupedBackground)
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // Search bar with native iOS style
                    searchBar

                    // TRIX Bot entry card
                    trixBotEntry
                        .padding(.horizontal)
                        .padding(.top, 4)
                        .padding(.bottom, 8)

                    // Main content
                    if isLoading {
                        loadingView
                    } else if filteredConversations.isEmpty && recommendedUsers.isEmpty {
                        emptyState
                    } else {
                        contentView
                    }
                }
            }
            .navigationTitle("聊天")
            .safeAreaInset(edge: .bottom) {
                Color.clear
                    .frame(height: 1)
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: createNewChat) {
                        Image(systemName: "square.and.pencil")
                    }
                }
            }
            .sheet(isPresented: $showingCreateChat) { createChatSheet }
            .sheet(isPresented: $showingPairing) {
                NavigationStack {
                    PairingView()
                        .environmentObject(clawbotChannel)
                }
            }
            .onAppear {
                Task {
                    await loadFriends()
                }
                consumePendingCompanionRouteIfNeeded()
            }
            .sheet(isPresented: $showingTrixBotChat) {
                NavigationStack {
                    TrixBotChatView()
                        .environmentObject(clawbotChannel)
                }
            }
            .onChange(of: appState.pendingCompanionRoute) { _ in
                consumePendingCompanionRouteIfNeeded()
            }
            .alert("操作失败", isPresented: Binding(
                get: { friendActionError != nil },
                set: { newValue in
                    if !newValue {
                        friendActionError = nil
                    }
                }
            )) {
                Button("确定", role: .cancel) {
                    friendActionError = nil
                }
            } message: {
                Text(friendActionError ?? "未知错误")
            }
        }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        ZStack {
            Color(.systemGroupedBackground)
                .ignoresSafeArea()

            ProgressView()
        }
    }

    // MARK: - Content View

    @ViewBuilder
    private var contentView: some View {
        // Quick add section - only show if there are recommendations
        if showQuickAdd && !recommendedUsers.isEmpty {
            quickAddSection
        }

        // Main content
        if filteredConversations.isEmpty {
            conversationEmptyState
        } else {
            conversationList
        }
    }

    // MARK: - Search Bar

    private var searchBar: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)

            TextField("搜索", text: $searchText)
                .textFieldStyle(.plain)

            if !searchText.isEmpty {
                Button(action: { searchText = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
        .padding(.top, 4)
    }

    // MARK: - TRIX Bot Entry

    private var trixBotEntry: some View {
        Button {
            if clawbotChannel.isPaired {
                showingTrixBotChat = true
            } else {
                showingPairing = true
            }
        } label: {
            HStack(spacing: 12) {
                // Avatar with status
                ZStack(alignment: .bottomTrailing) {
                    Image("AvatarHead")
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 44, height: 44)
                        .clipShape(Circle())

                    Circle()
                        .fill(clawbotChannel.isPaired ? .green : .orange)
                        .frame(width: 12, height: 12)
                        .overlay(Circle().stroke(.white, lineWidth: 2))
                }

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text("TRIX Bot")
                            .font(.subheadline)
                            .fontWeight(.semibold)

                        if clawbotChannel.isPaired {
                            Text("在线")
                                .font(.caption2)
                                .fontWeight(.medium)
                                .foregroundStyle(.green)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(.green.opacity(0.15))
                                .clipShape(Capsule())
                        }
                    }

                    Text(clawbotChannel.isPaired ? "点击开始对话" : "配对后即可对话")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(12)
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Quick Add Section - Redesigned to match list style

    private var quickAddSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Section header
            HStack {
                Text("推荐好友")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)

                Spacer()

                Button(action: {
                    withAnimation { showQuickAdd = false }
                }) {
                    Text("隐藏")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 4)

            // Horizontal scrolling cards - matching list style
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(recommendedUsers) { user in
                        QuickAddUserCard(user: user) {
                            Task { await addUser(user) }
                        }
                    }
                }
                .padding(.horizontal, 20)
            }
            .padding(.bottom, 4)

            // Divider
            Rectangle()
                .fill(Color(.separator))
                .frame(height: 0.5)
                .padding(.horizontal, 20)
        }
    }

    // MARK: - Conversation List

    private var filteredConversations: [ChatConversation] {
        if searchText.isEmpty { return conversations }
        return conversations.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    private var conversationList: some View {
        List {
            ForEach(filteredConversations) { conversation in
                ConversationRow(conversation: conversation)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        onNavigateToChat?(conversation)
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button(role: .destructive) {
                            // Delete action
                        } label: {
                            Label("删除", systemImage: "trash")
                        }
                    }
            }
        }
        .listStyle(.plain)
    }

    // MARK: - Conversation Empty State

    private var conversationEmptyState: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 50))
                .foregroundStyle(.secondary)

            Text("暂无对话")
                .font(.headline)
                .foregroundStyle(.secondary)

            Text("开始一个新的对话")
                .font(.subheadline)
                .foregroundStyle(.tertiary)

            Button("创建对话") {
                showingCreateChat = true
            }
            .buttonStyle(.borderedProminent)

            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 40)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        ContentUnavailableView {
            Label("暂无对话", systemImage: "bubble.left.and.bubble.right")
        } description: {
            Text("开始一个新的对话或配对 TRIX Bot")
        } actions: {
            Button(clawbotChannel.isPaired ? "开始对话" : "配对 TRIX Bot") {
                if clawbotChannel.isPaired {
                    showingTrixBotChat = true
                } else {
                    showingPairing = true
                }
            }
            .buttonStyle(.borderedProminent)

            if friendLoadNote != nil {
                Button("重试") {
                    Task { await loadFriends() }
                }
                .buttonStyle(.bordered)
            }
        }
    }

    // MARK: - Actions

    private func loadFriends() async {
        friendLoadNote = nil

        do {
            let friends = try await friendService.fetchFriends()
            conversations = friends.map { friend in
                ChatConversation(
                    id: friend.friendId,
                    name: friend.name,
                    avatarUrl: friend.avatarUrl,
                    lastMessage: friend.bio ?? "暂无简介",
                    time: formatTimeAgo(from: friend.updatedAt),
                    unreadCount: 0,
                    avatarColor: .blue,
                    isOnline: friend.status == .online
                )
            }
        } catch {
            conversations = []
            friendLoadNote = "加载失败，请重试"
        }

        do {
            let recommendations = try await APIClient.shared.getFriendRecommendations(limit: 8)
            recommendedUsers = recommendations.map(RecommendedUser.init(api:))
            showQuickAdd = !recommendedUsers.isEmpty
        } catch {
            recommendedUsers = []
        }

        isLoading = false
    }

    private func formatTimeAgo(from date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    private func consumePendingCompanionRouteIfNeeded() {
        guard let route = appState.pendingCompanionRoute else { return }

        switch route {
        case .trixBot:
            showingTrixBotChat = true
        case .pairing:
            showingPairing = true
        }

        appState.pendingCompanionRoute = nil
    }

    private func addUser(_ user: RecommendedUser) async {
        do {
            try await friendService.addFriend(friendId: user.id)
            withAnimation { recommendedUsers.removeAll { $0.id == user.id } }
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
        } catch {
            friendActionError = "添加失败"
        }
    }

    private var createChatSheet: some View {
        NavigationStack {
            Form {
                Section("对话名称") {
                    TextField("输入名称", text: $newChatName)
                }
                Section {
                    Button("创建") {
                        createNewChat()
                    }
                    .disabled(newChatName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isCreatingChat)
                }
            }
            .navigationTitle("新建对话")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        newChatName = ""
                        showingCreateChat = false
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func createNewChat() {
        let trimmedName = newChatName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }

        isCreatingChat = true

        Task {
            do {
                let request = CreateChatRoomRequest(name: trimmedName, type: .privateChat)
                let createdRoom: ChatRoom = try await APIClient.shared.post(.chatRoomCreate, body: request)

                let colors: [Color] = [.blue, .purple, .green, .orange, .pink]
                let newConversation = ChatConversation(
                    id: createdRoom.id,
                    name: createdRoom.name,
                    avatarUrl: nil,
                    lastMessage: "新对话",
                    time: "刚刚",
                    unreadCount: 0,
                    avatarColor: colors.randomElement() ?? .purple,
                    isOnline: false
                )

                await MainActor.run {
                    conversations.insert(newConversation, at: 0)
                    newChatName = ""
                    showingCreateChat = false
                    isCreatingChat = false
                }
            } catch {
                await MainActor.run {
                    isCreatingChat = false
                }
            }
        }
    }
}

// MARK: - Quick Add User Card - Redesigned

struct QuickAddUserCard: View {
    let user: RecommendedUser
    let onAdd: () -> Void

    var body: some View {
        VStack(spacing: 6) {
            // Avatar with shadow
            ZStack {
                Circle()
                    .fill(user.avatarColor.gradient)
                    .frame(width: 50, height: 50)

                Text(String(user.name.prefix(1)))
                    .font(.headline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.white)
            }

            Text(user.name)
                .font(.caption)
                .lineLimit(1)
                .frame(width: 60)

            Button(action: onAdd) {
                Text("添加")
                    .font(.caption2)
                    .fontWeight(.medium)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(Color(.systemBlue))
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .frame(width: 70)
        .padding(.vertical, 6)
        .padding(.horizontal, 2)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - Conversation Row

struct ConversationRow: View {
    let conversation: ChatConversation

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            ZStack(alignment: .bottomTrailing) {
                Circle()
                    .fill(conversation.avatarColor.gradient)
                    .frame(width: 48, height: 48)
                    .overlay {
                        Text(String(conversation.name.prefix(1)))
                            .font(.headline)
                            .foregroundStyle(.white)
                    }

                if conversation.isOnline {
                    Circle()
                        .fill(.green)
                        .frame(width: 12, height: 12)
                        .overlay(Circle().stroke(.white, lineWidth: 2))
                }
            }

            // Content
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(conversation.name)
                        .font(.headline)
                        .lineLimit(1)

                    Spacer()

                    Text(conversation.time)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                HStack(spacing: 4) {
                    if conversation.unreadCount > 0 {
                        Image(systemName: "message.fill")
                            .font(.caption2)
                            .foregroundStyle(.yellow)
                    }

                    Text(conversation.lastMessage)
                        .font(.subheadline)
                        .foregroundStyle(conversation.unreadCount > 0 ? .primary : .secondary)
                        .lineLimit(1)
                }
            }

            // Unread badge
            if conversation.unreadCount > 0 {
                Text("\(conversation.unreadCount)")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(.yellow)
                    .clipShape(Capsule())
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Preview

#Preview("Chat List") {
    ChatListView()
        .environmentObject(AppState.shared)
        .environmentObject(ChatService.shared)
}
