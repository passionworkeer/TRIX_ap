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
    @EnvironmentObject private var clawbotChannel: ClawbotChannelViewModel

    // MARK: - Callbacks

    var onNavigateToChat: ((ChatConversation) -> Void)?
    var onNavigateToPairing: (() -> Void)?
    var onNavigateToTrixBot: (() -> Void)?

    // MARK: - State

    init(
        onNavigateToChat: ((ChatConversation) -> Void)? = nil,
        onNavigateToPairing: (() -> Void)? = nil,
        onNavigateToTrixBot: (() -> Void)? = nil
    ) {
        self.onNavigateToChat = onNavigateToChat
        self.onNavigateToPairing = onNavigateToPairing
        self.onNavigateToTrixBot = onNavigateToTrixBot
    }

    @StateObject private var friendService = FriendService.shared
    @State private var searchText = ""
    @State private var selectedConversation: ChatConversation?
    @State private var showingCreateChat = false
    @State private var showingPairing = false
    @State private var showingTrixBotChat = false
    @State private var newChatName = ""
    @State private var conversations: [ChatConversation] = []
    @State private var recommendedUsers: [RecommendedUser] = []
    @State private var showQuickAdd = true
    @State private var showPairingAlert = false

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            searchBar
                .padding(.horizontal)
                .padding(.top, 8)
            trixBotEntry
                .padding(.horizontal)
                .padding(.top, 4)
                .padding(.bottom, 10)

            if showQuickAdd && !recommendedUsers.isEmpty {
                quickAddSection
                    .padding(.bottom, 10)
            }

            if filteredConversations.isEmpty {
                emptyState
            } else {
                conversationList
            }
        }
        .background(backgroundGradient)
        .navigationTitle("nav.chat".localized)
        .navigationBarTitleDisplayMode(.large)
        .safeAreaInset(edge: .bottom) {
            Color.clear
                .frame(height: 100)
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: createNewChat) {
                    Image(systemName: "square.and.pencil")
                        .foregroundColor(.brandPurple)
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
        }
        .sheet(isPresented: $showingTrixBotChat) {
            NavigationStack {
                TrixBotChatView()
                    .environmentObject(clawbotChannel)
            }
        }
    }

    // MARK: - Search Bar

    private var searchBar: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.secondary)
            TextField("搜索对话...", text: $searchText)
                .textFieldStyle(.plain)
            if !searchText.isEmpty {
                Button(action: { searchText = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .trixSurfaceCard(cornerRadius: 14, borderOpacity: 0.2, shadowOpacity: 0.04, shadowRadius: 6)
    }

    // MARK: - TRIX Bot Entry

    private var trixBotEntry: some View {
        Button {
            if clawbotChannel.isPaired {
                // If already paired, go to chat via callback
                onNavigateToTrixBot?()
            } else {
                // If not paired, use callback to navigate to pairing
                onNavigateToPairing?()
            }
        } label: {
            HStack(spacing: 12) {
                // Avatar with status indicator
                ZStack(alignment: .bottomTrailing) {
                    Image("AvatarHead")
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 48, height: 48)
                        .clipShape(Circle())
                        .overlay(
                            Circle().stroke(.white.opacity(0.1), lineWidth: 1)
                        )
                    // Online status - show based on pairing
                    Circle()
                        .fill(clawbotChannel.isPaired ? .green : .orange)
                        .frame(width: 14, height: 14)
                        .overlay(Circle().stroke(.black.opacity(0.3), lineWidth: 2))
                        .offset(x: 2, y: 2)
                        .shadow(color: clawbotChannel.isPaired ? .green.opacity(0.5) : .orange.opacity(0.5), radius: 4)
                }

                // Name and status
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text("TRIX Bot").font(.headline).foregroundColor(.white)
                    }
                    HStack(spacing: 4) {
                        Image(systemName: clawbotChannel.isPaired ? "message.fill" : "link.badge.plus")
                            .font(.system(size: 14))
                            .foregroundColor(clawbotChannel.isPaired ? .green : .orange)
                        Text(clawbotChannel.isPaired ? "已配对" : "未配对")
                            .font(.subheadline)
                            .foregroundColor(clawbotChannel.isPaired ? .green : .orange.opacity(0.8))
                    }
                }

                Spacer()

                // Camera icon (Web style)
                Circle()
                    .fill(clawbotChannel.isPaired ? .green.opacity(0.2) : .gray.opacity(0.2))
                    .frame(width: 40, height: 40)
                    .overlay {
                        Image(systemName: clawbotChannel.isPaired ? "camera.fill" : "link")
                            .font(.system(size: 16))
                            .foregroundColor(clawbotChannel.isPaired ? .green : .gray)
                    }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(
                LinearGradient(
                    colors: [
                        Color.brandPurple.opacity(0.28),
                        Color.brandPink.opacity(0.2),
                        Color.white.opacity(0.08)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.white.opacity(0.22), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .alert("TRIX Bot 未配对", isPresented: $showPairingAlert) {
            Button("去配对") {
                showingPairing = true
            }
            Button("取消", role: .cancel) {}
        } message: {
            Text("请先配对 OpenClaw 设备，然后才能与 TRIX Bot 聊天。\n\n在 OpenClaw 端生成配对码，然后在配对页面输入。")
        }
    }

    // MARK: - Quick Add Section

    private var quickAddSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("推荐好友")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.white.opacity(0.72))
                Spacer()
                // 删除整个推荐区域按钮
                Button(action: {
                    withAnimation { showQuickAdd = false }
                }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundColor(.white.opacity(0.5))
                }
            }
            .padding(.horizontal, 16)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(recommendedUsers) { user in
                        QuickAddUserCard(
                            user: user,
                            onAdd: { addUser(user) }
                        )
                    }
                }
                .padding(.horizontal, 16)
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
            LazyVStack(spacing: 10) {
                ForEach(filteredConversations) { conversation in
                    Button {
                        onNavigateToChat?(conversation)
                    } label: {
                        ConversationRow(conversation: conversation)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 12)
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "message.circle")
                .font(.system(size: 58))
                .foregroundColor(.purple.opacity(0.35))
            Text("没有找到对话")
                .font(.headline)
                .foregroundColor(.secondary)
            Text("开始新对话一起学习吧")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Background Gradient

    private var backgroundGradient: some View {
        Color.clear.trixPageBackground(
            colors: [
                Color.brandPurple.opacity(0.24),
                Color.brandPink.opacity(0.14),
                Color.black.opacity(0.22)
            ]
        )
    }

    // MARK: - Actions

    /// Load friends from FriendService and convert to conversations
    private func loadFriends() async {
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

            // 加载推荐用户（需要单独实现或使用空数组）
            recommendedUsers = []
        } catch {
            SecureLogger.shared.error("Failed to load friends: \(error.localizedDescription)")
        }
    }

    /// Format time similar to Web relative time
    private func formatTimeAgo(from date: Date) -> String {
        let now = Date()
        let interval = now.timeIntervalSince(date)

        if interval < 60 { return "刚刚" }
        if interval < 3600 { return "\(Int(interval/60))分钟前" }
        if interval < 86400 { return "\(Int(interval/3600))小时前" }
        if interval < 604800 { return "\(Int(interval/86400))天前" }

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "MM/dd"
        return dateFormatter.string(from: date)
    }

    private func openTrixBotChat() {
        // Create TRIX Bot conversation
        let botConversation = ChatConversation(id: "trixbot", name: "TRIX Bot", avatarUrl: "AvatarHead", lastMessage: "有什么可以帮你的吗？", time: "在线", unreadCount: 0, avatarColor: .purple, isOnline: true)
        selectedConversation = botConversation
        // Navigate to TRIX Bot chat
        showingTrixBotChat = true
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
            // Avatar
            Circle()
                .fill(LinearGradient(colors: [user.avatarColor, user.avatarColor.opacity(0.7)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: 40, height: 40)
                .overlay {
                    Text(user.avatar).font(.caption2).fontWeight(.semibold).foregroundColor(.white)
                }

            // Name
            Text(user.name)
                .font(.caption2)
                .fontWeight(.medium)
                .foregroundColor(.white)
                .lineLimit(1)
                .frame(width: 50)

            if !isAdded {
                Button(action: {
                    withAnimation(.spring(response: 0.3)) {
                        isAdded = true
                    }
                    onAdd()
                }) {
                    Text("+ 添加")
                        .font(.system(size: 9))
                        .fontWeight(.bold)
                        .foregroundColor(.black)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(.yellow)
                        .clipShape(Capsule())
                }
            } else {
                Text("已添加")
                    .font(.system(size: 8))
                    .foregroundColor(.white.opacity(0.6))
            }
        }
        .frame(width: 58)
        .padding(.vertical, 8)
        .padding(.horizontal, 6)
        .trixSurfaceCard(cornerRadius: 10, borderOpacity: 0.15, shadowOpacity: 0.04, shadowRadius: 4)
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
                    Image(systemName: "message.fill").font(.system(size: 14)).foregroundColor(conversation.unreadCount > 0 ? .yellow : .gray.opacity(0.5))
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
                VStack(spacing: 8) {
                    Text(conversation.time)
                        .font(.caption2)
                        .foregroundColor(.gray.opacity(0.7))
                    Circle()
                        .fill(.white.opacity(0.1))
                        .frame(width: 34, height: 34)
                        .overlay {
                            Image(systemName: "camera.fill")
                                .font(.system(size: 14))
                                .foregroundColor(.gray.opacity(0.5))
                        }
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .trixSurfaceCard(cornerRadius: 14, borderOpacity: 0.14, shadowOpacity: 0.05, shadowRadius: 6)
        .contentShape(Rectangle())
    }
}

// MARK: - Preview

#Preview("Chat List") {
    ChatListView()
        .environmentObject(AppState.shared)
        .environmentObject(ChatService.shared)
}
