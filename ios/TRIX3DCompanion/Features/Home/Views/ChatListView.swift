//
//  ChatListView.swift
//  TRIX3DCompanion
//
//  Chat tab with friends list, quick add, and TRIX Bot
//  Optimized for native iOS look and feel
//

import SwiftUI

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

enum ChatAccessibilityIdentifiers {
    static let screen = "chat.screen"
    static let searchField = "chat.search.field"
    static let trixBotCard = "chat.trixbot.card"
    static let emptyState = "chat.empty.state"
    static let reloadButton = "chat.reload.button"
}

private enum ChatSheetRoute: String, Identifiable {
    case createChat

    var id: String { rawValue }
}

// MARK: - Chat List View

/// Main chat screen showing all conversations with native iOS design
struct ChatListView: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var clawbotChannel: ClawbotChannelViewModel

    // MARK: - Callbacks

    var onNavigateToChat: ((ChatConversation) -> Void)?

    // MARK: - State

    init(
        onNavigateToChat: ((ChatConversation) -> Void)? = nil
    ) {
        self.onNavigateToChat = onNavigateToChat
    }

    @StateObject private var friendService = FriendService.shared
    @State private var searchText = ""
    @State private var selectedConversation: ChatConversation?
    @State private var activeSheet: ChatSheetRoute?
    @State private var activeCompanionRoute: PendingCompanionRoute?
    @State private var isShowingTrixBotChat = false
    @State private var newChatName = ""
    @State private var isCreatingChat = false
    @State private var conversations: [ChatConversation] = []
    @State private var recommendedUsers: [RecommendedUser] = []
    @State private var showQuickAdd = true
    @State private var showPairingAlert = false
    @State private var friendActionError: String?
    @State private var friendLoadNote: String?
    @State private var isLoading = true
    @State private var didAutoOpenTrixBotForUITest = false

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
        .navigationTitle(L("chat.title"))
        .navigationBarTitleDisplayMode(.large)
        .accessibilityIdentifier(ChatAccessibilityIdentifiers.screen)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    activeSheet = .createChat
                } label: {
                    Image(systemName: "square.and.pencil")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.brandPurple)
                        .frame(width: 36, height: 36)
                        .background(.regularMaterial, in: Circle())
                        .overlay(
                            Circle()
                                .stroke(Color.textPrimary.opacity(0.7), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .sheet(item: $activeSheet) { route in
            switch route {
            case .createChat:
                createChatSheet
            }
        }
        .navigationDestination(isPresented: $isShowingTrixBotChat) {
            TrixBotChatView()
                .environmentObject(ClawbotChannelViewModel.shared)
                .environmentObject(ChatService.shared)
        }
        .fullScreenCover(item: $activeCompanionRoute) { route in
            NavigationStack {
                switch route {
                case .trixBot:
                    TrixBotChatView()
                        .environmentObject(ClawbotChannelViewModel.shared)
                        .environmentObject(ChatService.shared)
                case .pairing:
                    PairingView()
                        .environmentObject(ClawbotChannelViewModel.shared)
                }
            }
        }
        .onChange(of: appState.pendingCompanionRoute) { route in
            guard let route else { return }
            switch route {
            case .trixBot:
                isShowingTrixBotChat = true
            case .pairing:
                activeCompanionRoute = .pairing
            }
            appState.clearPendingCompanionRoute()
        }
        .onAppear {
            if !didAutoOpenTrixBotForUITest,
               ProcessInfo.processInfo.arguments.contains("--ui-open-trixbot") {
                didAutoOpenTrixBotForUITest = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                    isShowingTrixBotChat = true
                }
            }
            Task {
                await loadFriends()
            }
        }
        .alert(L("error.operation.failed"), isPresented: Binding(
            get: { friendActionError != nil },
            set: { newValue in
                if !newValue {
                    friendActionError = nil
                }
            }
        )) {
            Button(L("action.confirm"), role: .cancel) {
                friendActionError = nil
            }
        } message: {
            Text(friendActionError ?? L("error.unknown"))
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
        VStack(spacing: 24) {
            // Skeleton for search bar placeholder
            RoundedRectangle(cornerRadius: 18)
                .fill(Color(.secondarySystemGroupedBackground))
                .frame(height: 48)
                .shimmer(cornerRadius: 18)

            // Skeleton for TRIX Bot card
            VStack(spacing: 12) {
                HStack(spacing: 12) {
                    SkeletonAvatar(size: 56)

                    VStack(alignment: .leading, spacing: 8) {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(Color.tertiaryBackground.opacity(0.2))
                            .frame(width: 120, height: 16)
                            .shimmer(cornerRadius: 6)

                        RoundedRectangle(cornerRadius: 6)
                            .fill(Color.tertiaryBackground.opacity(0.2))
                            .frame(width: 180, height: 14)
                            .shimmer(cornerRadius: 6)

                        RoundedRectangle(cornerRadius: 6)
                            .fill(Color.tertiaryBackground.opacity(0.2))
                            .frame(width: 140, height: 12)
                            .shimmer(cornerRadius: 6)
                    }

                    Spacer()
                }
                .padding(18)
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            }

            // Skeleton for conversation list
            VStack(spacing: 0) {
                ForEach(0..<5, id: \.self) { _ in
                    HStack(spacing: 12) {
                        SkeletonAvatar(size: 48)

                        VStack(alignment: .leading, spacing: 8) {
                            RoundedRectangle(cornerRadius: 6)
                                .fill(Color.tertiaryBackground.opacity(0.2))
                                .frame(width: 140, height: 14)
                                .shimmer(cornerRadius: 6)

                            RoundedRectangle(cornerRadius: 6)
                                .fill(Color.tertiaryBackground.opacity(0.2))
                                .frame(width: 200, height: 12)
                                .shimmer(cornerRadius: 6)
                        }

                        Spacer()
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 14)

                    Divider()
                        .padding(.leading, 84)
                }
            }
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        }
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

            TextField(L("chat.search.placeholder"), text: $searchText)
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
                .stroke(Color.textPrimary.opacity(0.7), lineWidth: 1)
        )
        .shadow(color: .overlay.opacity(0.04), radius: 10, x: 0, y: 6)
        .accessibilityIdentifier(ChatAccessibilityIdentifiers.searchField)
    }

    // MARK: - TRIX Bot Entry

    private var trixBotEntry: some View {
        trixBotCardContent
        .contentShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .onTapGesture {
            isShowingTrixBotChat = true
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier(ChatAccessibilityIdentifiers.trixBotCard)
    }

    private var trixBotCardContent: some View {
        HStack(spacing: 12) {
            ZStack(alignment: .bottomTrailing) {
                Image("AvatarHead")
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: 56, height: 56)
                    .clipShape(Circle())
                    .overlay(
                        Circle()
                            .stroke(Color.textPrimary.opacity(0.7), lineWidth: 2)
                    )

                Circle()
                    .fill(clawbotChannel.isPaired ? .success : .warning)
                    .frame(width: 14, height: 14)
                    .overlay(Circle().stroke(.white, lineWidth: 2.5))
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Text(L("chat.trixbot.name"))
                        .font(.headline)
                        .fontWeight(.bold)

                    if clawbotChannel.isPaired {
                        Text(L("pairing.online"))
                            .font(.caption2)
                            .fontWeight(.medium)
                            .foregroundStyle(.success)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.success.opacity(0.15))
                            .clipShape(Capsule())
                    }
                }

                Text(clawbotChannel.isPaired ? L("chat.trixbot.action.ready") : L("chat.trixbot.action.pair.first"))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                Text(clawbotChannel.isPaired ? L("chat.trixbot.status.ready") : L("chat.trixbot.instruction.pair.first"))
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
        .frame(maxWidth: .infinity, alignment: .leading)
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
                .stroke(Color.textPrimary.opacity(0.8), lineWidth: 1)
        )
        .shadow(color: .overlay.opacity(0.05), radius: 12, x: 0, y: 8)
    }

    // MARK: - Quick Add Section - Redesigned to match list style

    private var quickAddSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Section header
            HStack {
                Text(L("chat.recommendations.title"))
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)

                Spacer()

                Button(action: {
                    withAnimation { showQuickAdd = false }
                }) {
                    Text(L("action.hide"))
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
                .stroke(Color.textPrimary.opacity(0.75), lineWidth: 1)
        )
        .shadow(color: .overlay.opacity(0.04), radius: 10, x: 0, y: 6)
    }

    // MARK: - Conversation List

    private var filteredConversations: [ChatConversation] {
        if searchText.isEmpty { return conversations }
        return conversations.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    private var conversationList: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(L("chat.recent.conversations"))
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 18)
                .padding(.top, 16)
                .padding(.bottom, 8)

            ForEach(Array(filteredConversations.enumerated()), id: \.element.id) { index, conversation in
                Button {
                    SecureLogger.shared.debug("ChatListView: Tapped conversation \(conversation.name)")
                    onNavigateToChat?(conversation)
                } label: {
                    ConversationRow(conversation: conversation)
                        .contentShape(Rectangle())
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
                .stroke(Color.textPrimary.opacity(0.75), lineWidth: 1)
        )
        .shadow(color: .overlay.opacity(0.04), radius: 12, x: 0, y: 8)
    }

    // MARK: - Conversation Empty State

    private var conversationEmptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 50))
                .foregroundStyle(.secondary)

            Text(L("chat.empty.title"))
                .font(.headline)
                .foregroundStyle(.secondary)

            Text(L("chat.empty.start"))
                .font(.subheadline)
                .foregroundStyle(.tertiary)

            Button(L("chat.create.conversation")) {
                activeSheet = .createChat
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 36)
        .padding(.horizontal, 24)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .stroke(Color.textPrimary.opacity(0.75), lineWidth: 1)
        )
        .shadow(color: .overlay.opacity(0.04), radius: 12, x: 0, y: 8)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "bubble.left.and.bubble.right.fill")
                .font(.system(size: 34))
                .foregroundStyle(Color.brandPurple.opacity(0.78))

            Text(L("chat.empty.title"))
                .font(.title3)
                .fontWeight(.bold)

            Text(L("chat.empty.connect.trixbot"))
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Button {
                isShowingTrixBotChat = true
            } label: {
                Text(clawbotChannel.isPaired ? L("chat.trixbot.action.start") : L("chat.trixbot.action.pair"))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)

            if friendLoadNote != nil {
                Button(L("action.retry")) {
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
                .stroke(Color.textPrimary.opacity(0.75), lineWidth: 1)
        )
        .shadow(color: .overlay.opacity(0.04), radius: 12, x: 0, y: 8)
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
                    lastMessage: friend.bio ?? L("profile.bio.empty"),
                    time: formatTimeAgo(from: friend.updatedAt),
                    unreadCount: 0,
                    avatarColor: .info,
                    isOnline: friend.status == .online
                )
            }
        } catch {
            conversations = []
            friendLoadNote = L("chat.friends.load.failed")
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

    private func addUser(_ user: RecommendedUser) async {
        do {
            try await friendService.addFriend(friendId: user.id)
            withAnimation { recommendedUsers.removeAll { $0.id == user.id } }
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
        } catch {
            friendActionError = L("chat.friend.add.failed")
        }
    }

    private var createChatSheet: some View {
        NavigationStack {
            Form {
                Section(L("chat.conversation.name")) {
                    TextField(L("chat.conversation.name.placeholder"), text: $newChatName)
                }
                Section {
                    Button(L("action.create")) {
                        createNewChat()
                    }
                    .disabled(newChatName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isCreatingChat)
                }
            }
            .navigationTitle(L("chat.create.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L("action.cancel")) {
                        newChatName = ""
                        activeSheet = nil
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

                let colors: [Color] = [.info, .brandPurple, .success, .warning, .brandPink]
                let newConversation = ChatConversation(
                    id: createdRoom.id,
                    name: createdRoom.name,
                    avatarUrl: nil,
                    lastMessage: L("chat.conversation.new"),
                    time: L("chat.time.justnow"),
                    unreadCount: 0,
                    avatarColor: colors.randomElement() ?? .purple,
                    isOnline: false
                )

                await MainActor.run {
                    conversations.insert(newConversation, at: 0)
                    newChatName = ""
                    activeSheet = nil
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
                Text(L("action.add"))
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
                .stroke(Color.textPrimary.opacity(0.8), lineWidth: 1)
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
