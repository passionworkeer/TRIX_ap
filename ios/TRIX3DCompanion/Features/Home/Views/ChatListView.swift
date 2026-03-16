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
        ZStack {
            chatBackground

            ScrollView(showsIndicators: false) {
                VStack(spacing: 18) {
                    VStack(spacing: 16) {
                        searchBar
                        trixBotEntry
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 8)

                    if isLoading {
                        loadingView
                    } else if filteredConversations.isEmpty && recommendedUsers.isEmpty {
                        emptyState
                    } else {
                        contentView
                    }

                    Color.clear
                        .frame(height: 24)
                }
                .padding(.bottom, 20)
            }
        }
        .navigationTitle("聊天")
        .navigationBarTitleDisplayMode(.large)
        .accessibilityIdentifier(ChatAccessibilityIdentifiers.screen)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: createNewChat) {
                    Image(systemName: "square.and.pencil")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.brandPurple)
                        .frame(width: 36, height: 36)
                        .background(.regularMaterial, in: Circle())
                        .overlay(
                            Circle()
                                .stroke(Color.white.opacity(0.7), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
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

    private var chatBackground: some View {
        Color(.systemGroupedBackground)
            .overlay(alignment: .top) {
                LinearGradient(
                    colors: [
                        Color.brandPurple.opacity(0.08),
                        Color.brandPink.opacity(0.04),
                        .clear
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .frame(height: 260)
                .allowsHitTesting(false)
            }
            .ignoresSafeArea()
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack(spacing: 12) {
            SwiftUI.ProgressView()
                .controlSize(.large)
                .tint(Color.brandPurple)

            Text("正在载入会话")
                .font(.headline)

            Text("同步 TRIX Bot 与好友消息")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 240)
        .padding(.horizontal, 20)
        .trixSurfaceCard(cornerRadius: 28, borderOpacity: 0.18, shadowOpacity: 0.04, shadowRadius: 10)
        .padding(.horizontal, 20)
    }

    // MARK: - Content View

    @ViewBuilder
    private var contentView: some View {
        VStack(spacing: 18) {
            if showQuickAdd && !recommendedUsers.isEmpty {
                quickAddSection
            }

            if filteredConversations.isEmpty {
                conversationEmptyState
            } else {
                conversationList
            }
        }
        .padding(.horizontal, 20)
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
        .padding(.vertical, 12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.white.opacity(0.7), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.04), radius: 10, x: 0, y: 6)
        .accessibilityIdentifier(ChatAccessibilityIdentifiers.searchField)
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
                        .frame(width: 56, height: 56)
                        .clipShape(Circle())
                        .overlay(
                            Circle()
                                .stroke(Color.white.opacity(0.7), lineWidth: 2)
                        )

                    Circle()
                        .fill(clawbotChannel.isPaired ? .green : .orange)
                        .frame(width: 14, height: 14)
                        .overlay(Circle().stroke(.white, lineWidth: 2.5))
                }

                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Text("TRIX Bot")
                            .font(.headline)
                            .fontWeight(.bold)

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

                    Text(clawbotChannel.isPaired ? "对话已准备好，随时继续" : "先完成设备配对，再进入实时聊天")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }

                Spacer()

                Image(systemName: "arrow.up.right.circle.fill")
                    .font(.title3)
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color.brandPurple, Color.brandPink],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            }
            .padding(18)
            .background(
                LinearGradient(
                    colors: [
                        Color(.secondarySystemGroupedBackground),
                        Color(.systemBackground).opacity(0.96)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                in: RoundedRectangle(cornerRadius: 24, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(Color.white.opacity(0.8), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.05), radius: 12, x: 0, y: 8)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(ChatAccessibilityIdentifiers.trixBotCard)
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
            .padding(.bottom, 12)

            // Horizontal scrolling cards - matching list style
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(recommendedUsers) { user in
                        QuickAddUserCard(user: user) {
                            Task { await addUser(user) }
                        }
                    }
                }
            }
        }
        .padding(18)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(Color.white.opacity(0.75), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.04), radius: 10, x: 0, y: 6)
    }

    // MARK: - Conversation List

    private var filteredConversations: [ChatConversation] {
        if searchText.isEmpty { return conversations }
        return conversations.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    private var conversationList: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("最近会话")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 18)
                .padding(.top, 16)
                .padding(.bottom, 8)

            ForEach(Array(filteredConversations.enumerated()), id: \.element.id) { index, conversation in
                Button {
                    onNavigateToChat?(conversation)
                } label: {
                    ConversationRow(conversation: conversation)
                }
                .buttonStyle(.plain)

                if index < filteredConversations.count - 1 {
                    Divider()
                        .padding(.leading, 84)
                }
            }
        }
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .stroke(Color.white.opacity(0.75), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.04), radius: 12, x: 0, y: 8)
    }

    // MARK: - Conversation Empty State

    private var conversationEmptyState: some View {
        VStack(spacing: 16) {
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
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 36)
        .padding(.horizontal, 24)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .stroke(Color.white.opacity(0.75), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.04), radius: 12, x: 0, y: 8)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "bubble.left.and.bubble.right.fill")
                .font(.system(size: 34))
                .foregroundStyle(Color.brandPurple.opacity(0.78))

            Text("暂无对话")
                .font(.title3)
                .fontWeight(.bold)

            Text("开始一个新的对话或配对 TRIX Bot")
                .font(.subheadline)
                .foregroundStyle(.secondary)

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
        .frame(maxWidth: .infinity, minHeight: 260)
        .padding(.horizontal, 24)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(Color.white.opacity(0.75), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.04), radius: 12, x: 0, y: 8)
        .padding(.horizontal, 20)
        .accessibilityIdentifier(ChatAccessibilityIdentifiers.emptyState)
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
        VStack(spacing: 8) {
            // Avatar with shadow
            ZStack {
                Circle()
                    .fill(user.avatarColor.gradient)
                    .frame(width: 56, height: 56)

                Text(String(user.name.prefix(1)))
                    .font(.headline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.white)
            }

            Text(user.name)
                .font(.caption)
                .lineLimit(1)
                .frame(width: 72)

            Button(action: onAdd) {
                Text("添加")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(Color(.systemBlue))
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .frame(width: 88)
        .padding(.vertical, 12)
        .padding(.horizontal, 8)
        .background(Color(.systemBackground).opacity(0.92), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.white.opacity(0.8), lineWidth: 1)
        )
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
                        .overlay(Circle().stroke(Color(.systemBackground), lineWidth: 2))
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
            .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 10) {
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

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
    }
}

// MARK: - Preview

#Preview("Chat List") {
    ChatListView()
        .environmentObject(AppState.shared)
        .environmentObject(ChatService.shared)
}
