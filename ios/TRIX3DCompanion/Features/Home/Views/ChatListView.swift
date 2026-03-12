//
//  ChatListView.swift
//  TRIX3DCompanion
//
//  Chat tab with friends list, quick add, and TRIX Bot
//

import SwiftUI

enum ChatAccessibilityIdentifiers {
    static let screen = "chat.screen"
    static let searchField = "chat.search.field"
    static let trixBotCard = "chat.trixbot.card"
    static let emptyState = "chat.empty.state"
    static let reloadButton = "chat.reload.button"
}

enum FriendErrorPresentation {
    static func inlineLoadMessage(for error: Error) -> String? {
        switch networkError(from: error) {
        case .notFound:
            return "chat.friends.unavailable".localized
        case .noConnection, .timeout:
            return "chat.friends.network.issue".localized
        case .none:
            return "chat.friends.load.failed".localized
        default:
            return "chat.friends.load.failed".localized
        }
    }

    static func alertMessage(for error: Error) -> String {
        switch networkError(from: error) {
        case .notFound:
            return "chat.friend.action.not.available".localized
        case .noConnection:
            return "chat.friend.action.network".localized
        case .timeout:
            return "chat.friend.action.timeout".localized
        case .none:
            return sanitize(error.localizedDescription)
        default:
            return sanitize(error.localizedDescription)
        }
    }

    private static func sanitize(_ message: String) -> String {
        let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty || trimmed == "Unknown error" {
            return "chat.friend.action.failed".localized
        }
        return trimmed
    }

    private static func networkError(from error: Error) -> NetworkError? {
        if let networkError = error as? NetworkError {
            return networkError
        }

        if let friendError = error as? FriendServiceError {
            switch friendError {
            case .fetchFailed(let underlying),
                    .addFailed(let underlying),
                    .removeFailed(let underlying),
                    .acceptFailed(let underlying),
                    .declineFailed(let underlying):
                return networkError(from: underlying)
            case .unknown(let underlying):
                guard let underlying else { return nil }
                return networkError(from: underlying)
            default:
                return nil
            }
        }

        return nil
    }
}

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
    @State private var isCreatingChat = false
    @State private var conversations: [ChatConversation] = []
    @State private var recommendedUsers: [RecommendedUser] = []
    @State private var showQuickAdd = true
    @State private var showPairingAlert = false
    @State private var friendActionError: String?
    @State private var friendLoadNote: String?

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
        .uiTestMarker(ChatAccessibilityIdentifiers.screen)
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

    // MARK: - Search Bar

    private var searchBar: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(.brandPurple.opacity(0.82))

                TextField("chat.search.placeholder".localized, text: $searchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 16, weight: .medium, design: .rounded))
                    .foregroundColor(.textPrimary)
                    .accessibilityIdentifier(ChatAccessibilityIdentifiers.searchField)

                if !searchText.isEmpty {
                    Button(action: { searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.textSecondary.opacity(0.8))
                    }
                    .buttonStyle(.plain)
                }
            }

            HStack(spacing: 8) {
                searchOverviewPill(
                    icon: "person.2.fill",
                    text: friendLoadNote != nil
                        ? "chat.friends.status.unavailable".localized
                        : (recommendedUsers.isEmpty
                            ? "chat.recommendations.empty".localized
                            : "chat.recommendations.count".localized(recommendedUsers.count))
                )

                searchOverviewPill(
                    icon: clawbotChannel.isPaired ? "link.circle.fill" : "bolt.slash.circle.fill",
                    text: clawbotChannel.isPaired
                        ? "chat.bot.connected".localized
                        : "chat.bot.waiting".localized
                )
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 15)
        .background(
            LinearGradient(
                colors: [
                    Color.white.opacity(0.92),
                    Color(hex: "F7EEFF").opacity(0.9)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(Color.white.opacity(0.88), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: Color.black.opacity(0.07), radius: 14, x: 0, y: 10)
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
            HStack(spacing: 14) {
                ZStack(alignment: .bottomTrailing) {
                    Image("AvatarHead")
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 56, height: 56)
                        .clipShape(Circle())
                        .overlay(
                            Circle().stroke(.white.opacity(0.14), lineWidth: 1)
                        )
                        .accessibilityLabel("TRIX Bot 头像")

                    Circle()
                        .fill(clawbotChannel.isPaired ? .green : .orange)
                        .frame(width: 14, height: 14)
                        .overlay(Circle().stroke(.black.opacity(0.3), lineWidth: 2))
                        .offset(x: 2, y: 2)
                        .shadow(color: clawbotChannel.isPaired ? .green.opacity(0.5) : .orange.opacity(0.5), radius: 4)
                }

                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        Text("TRIX Bot")
                            .font(.system(size: 22, weight: .bold, design: .rounded))
                            .foregroundColor(.textPrimary)

                        Text(clawbotChannel.isPaired ? "LIVE" : "PAIR")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundColor(clawbotChannel.isPaired ? .green : .orange)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background((clawbotChannel.isPaired ? Color.green : Color.orange).opacity(0.12))
                            .overlay(
                                Capsule()
                                    .stroke((clawbotChannel.isPaired ? Color.green : Color.orange).opacity(0.35), lineWidth: 1)
                            )
                            .clipShape(Capsule())
                    }

                    Text(
                        clawbotChannel.isPaired
                            ? "chat.bot.card.connected".localized
                            : "chat.bot.card.unpaired".localized
                    )
                    .font(.system(size: 14, weight: .medium, design: .rounded))
                    .foregroundColor(.textSecondary)

                    HStack(spacing: 6) {
                        Image(systemName: clawbotChannel.isPaired ? "waveform.and.mic" : "key.viewfinder")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(clawbotChannel.isPaired ? .green : .orange)
                        Text(clawbotChannel.isPaired ? "chat.bot.connected".localized : "chat.bot.waiting".localized)
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .foregroundColor(clawbotChannel.isPaired ? .green : .orange.opacity(0.9))
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 10) {
                    Text(clawbotChannel.isPaired ? "chat.bot.tag.chat".localized : "chat.bot.tag.pair".localized)
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundColor(.textSecondary)

                    HStack(spacing: 8) {
                        Text(clawbotChannel.isPaired ? "chat.bot.action.open".localized : "chat.bot.action.pair".localized)
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                        Image(systemName: "arrow.right")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .foregroundColor(.brandPurple)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color.white.opacity(0.88))
                    .overlay(
                        Capsule()
                            .stroke(Color.white.opacity(0.94), lineWidth: 1)
                    )
                    .clipShape(Capsule())
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 16)
            .background(
                LinearGradient(
                    colors: [
                        Color(hex: "E8D9FF").opacity(0.96),
                        Color(hex: "FDE1ED").opacity(0.94),
                        Color.white.opacity(0.92)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Color.white.opacity(0.94), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .shadow(color: Color.brandPurple.opacity(0.12), radius: 16, x: 0, y: 10)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(ChatAccessibilityIdentifiers.trixBotCard)
    }

    // MARK: - Quick Add Section

    private var quickAddSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("推荐好友")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.textSecondary)
                Spacer()
                // 删除整个推荐区域按钮
                Button(action: {
                    withAnimation { showQuickAdd = false }
                }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundColor(.textSecondary.opacity(0.7))
                }
            }
            .padding(.horizontal, 16)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(recommendedUsers) { user in
                        QuickAddUserCard(
                            user: user,
                            onAdd: {
                                Task {
                                    await addUser(user)
                                }
                            }
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
        ScrollView(showsIndicators: false) {
            VStack(spacing: 18) {
                VStack(alignment: .leading, spacing: 18) {
                    HStack(spacing: 14) {
                        ZStack {
                            Circle()
                                .fill(Color.brandPurple.opacity(0.16))
                                .frame(width: 66, height: 66)
                            Circle()
                                .stroke(Color.white.opacity(0.14), lineWidth: 1)
                                .frame(width: 66, height: 66)
                            Image(systemName: "bubble.left.and.bubble.right.fill")
                                .font(.system(size: 28, weight: .bold))
                                .foregroundColor(.white)
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            Text(searchText.isEmpty ? "chat.empty.title".localized : "没有找到匹配的对话")
                                .font(.system(size: 24, weight: .bold, design: .rounded))
                                .foregroundColor(.textPrimary)

                            Text(searchText.isEmpty ? "chat.empty.subtitle".localized : "试试其他关键词，或直接发起一段新的对话")
                                .font(.system(size: 14, weight: .medium, design: .rounded))
                                .foregroundColor(.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    if let friendLoadNote {
                        Text(friendLoadNote)
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundColor(.textPrimary)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .background(Color.brandPurple.opacity(0.08))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .stroke(Color.white.opacity(0.92), lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }

                    VStack(spacing: 10) {
                        Button {
                            if clawbotChannel.isPaired {
                                onNavigateToTrixBot?()
                            } else {
                                onNavigateToPairing?()
                            }
                        } label: {
                            HStack {
                                Image(systemName: clawbotChannel.isPaired ? "message.fill" : "link.badge.plus")
                                    .font(.system(size: 16, weight: .bold))
                                Text(clawbotChannel.isPaired ? "chat.bot.action.open".localized : "chat.bot.action.pair".localized)
                                    .font(.system(size: 16, weight: .bold, design: .rounded))
                                Spacer()
                                Image(systemName: "arrow.right")
                                    .font(.system(size: 13, weight: .bold))
                            }
                            .foregroundColor(.white)
                            .padding(.horizontal, 18)
                            .padding(.vertical, 15)
                            .background(
                                LinearGradient(
                                    colors: [Color.brandPurple, Color.brandPink],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                            .shadow(color: .brandPurple.opacity(0.24), radius: 10, x: 0, y: 4)
                        }
                        .buttonStyle(.plain)

                        if friendLoadNote != nil {
                            Button {
                                Task {
                                    await loadFriends()
                                }
                            } label: {
                                HStack {
                                    Image(systemName: "arrow.clockwise")
                                    Text("chat.friends.retry".localized)
                                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                                }
                                .foregroundColor(.textPrimary)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 13)
                                .background(Color.white.opacity(0.84))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                                        .stroke(Color.white.opacity(0.94), lineWidth: 1)
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier(ChatAccessibilityIdentifiers.reloadButton)
                        }
                    }
                }
                .padding(22)
                .background(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.92),
                            Color(hex: "F9EDFF").opacity(0.88)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .stroke(Color.white.opacity(0.94), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                .shadow(color: Color.black.opacity(0.08), radius: 16, x: 0, y: 10)
                .accessibilityIdentifier(ChatAccessibilityIdentifiers.emptyState)
            }
            .padding(.horizontal, 16)
            .padding(.top, 28)
            .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
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

    private func searchOverviewPill(icon: String, text: String) -> some View {
                HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .bold))
            Text(text)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .lineLimit(1)
                .minimumScaleFactor(0.92)
        }
        .foregroundColor(.textSecondary)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Color.white.opacity(0.84))
        .overlay(
            Capsule()
                .stroke(Color.white.opacity(0.9), lineWidth: 1)
        )
        .clipShape(Capsule())
    }

    // MARK: - Actions

    /// Load friends from FriendService and convert to conversations
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
            SecureLogger.shared.error("Failed to load friends: \(error.localizedDescription)")
            conversations = []
            friendLoadNote = FriendErrorPresentation.inlineLoadMessage(for: error)
        }

        do {
            let recommendations = try await APIClient.shared.getFriendRecommendations(limit: 8)
            recommendedUsers = recommendations.map(RecommendedUser.init(api:))
            showQuickAdd = !recommendedUsers.isEmpty
        } catch {
            recommendedUsers = []
            SecureLogger.shared.warning("Failed to load recommendations: \(error.localizedDescription)")
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

    private func addUser(_ user: RecommendedUser) async {
        do {
            try await friendService.addFriend(friendId: user.id)
            withAnimation { recommendedUsers.removeAll { $0.id == user.id } }
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
        } catch {
            friendActionError = FriendErrorPresentation.alertMessage(for: error)
        }
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
                        createNewChat()
                    }) {
                        HStack { Spacer(); Text("Create Chat").fontWeight(.semibold); Spacer() }
                    }.disabled(newChatName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isCreatingChat)
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

    private func createNewChat() {
        let trimmedName = newChatName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }

        isCreatingChat = true

        Task {
            do {
                // Call backend API to create chat room
                let request = CreateChatRoomRequest(name: trimmedName, type: .privateChat)
                let createdRoom: ChatRoom = try await APIClient.shared.post(.chatRoomCreate, body: request)

                // Create local conversation from response
                let colors: [Color] = [.blue, .purple, .green, .orange, .pink]
                let newConversation = ChatConversation(
                    id: createdRoom.id,
                    name: createdRoom.name,
                    avatarUrl: nil,
                    lastMessage: "New conversation",
                    time: "Just now",
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
                // API failed - still allow local creation for offline scenario
                await MainActor.run {
                    let colors: [Color] = [.blue, .purple, .green, .orange, .pink]
                    let newConversation = ChatConversation(id: UUID().uuidString, name: trimmedName, avatarUrl: nil, lastMessage: "New conversation", time: "Just now", unreadCount: 0, avatarColor: colors.randomElement() ?? .purple, isOnline: false)
                    conversations.insert(newConversation, at: 0)
                    newChatName = ""
                    showingCreateChat = false
                    isCreatingChat = false
                }
            }
        }
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
                .frame(width: 44, height: 44)
                .overlay {
                    Text(user.avatar).font(.caption2).fontWeight(.semibold).foregroundColor(.white)
                }
                .accessibilityLabel("\(user.name) 的头像")

            // Name
            Text(user.name)
                .font(.caption2)
                .fontWeight(.medium)
                .foregroundColor(.textPrimary)
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
                    .foregroundColor(.textSecondary)
            }
        }
        .frame(width: 58)
        .padding(.vertical, 8)
        .padding(.horizontal, 6)
        .background(Color.white.opacity(0.86))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color.white.opacity(0.94), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
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
                    Text(conversation.name).font(.headline).foregroundColor(.textPrimary)
                    Spacer()
                }
                HStack(spacing: 4) {
                    Image(systemName: "message.fill").font(.system(size: 14)).foregroundColor(conversation.unreadCount > 0 ? .yellow : .gray.opacity(0.5))
                    Text(conversation.lastMessage).font(.subheadline).foregroundColor(conversation.unreadCount > 0 ? .textPrimary : .textSecondary).lineLimit(1)
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
                        .foregroundColor(.textSecondary)
                    Circle()
                        .fill(Color(hex: "F3E8FF"))
                        .frame(width: 34, height: 34)
                        .overlay {
                            Image(systemName: "camera.fill")
                                .font(.system(size: 14))
                                .foregroundColor(.brandPurple.opacity(0.8))
                        }
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(
            LinearGradient(
                colors: [
                    Color.white.opacity(0.9),
                    Color(hex: "FBF4FF").opacity(0.86)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.white.opacity(0.94), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 5)
        .contentShape(Rectangle())
    }
}

// MARK: - Preview

#Preview("Chat List") {
    ChatListView()
        .environmentObject(AppState.shared)
        .environmentObject(ChatService.shared)
}
