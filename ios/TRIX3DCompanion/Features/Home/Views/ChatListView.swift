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
        RecommendedUser(id: "5", name: "Lisa Park", avatar: "LP", mutualFriends: 6, avatarColor: .orange)
    ]

    // Sample Data
    private let sampleConversations = [
        ChatConversation(id: "1", name: "Math Study Group", lastMessage: "Let's meet at 3pm", time: "2m ago", unreadCount: 3, avatarColor: .blue, isOnline: true),
        ChatConversation(id: "2", name: "Physics Discussion", lastMessage: "Check out this formula", time: "1h ago", unreadCount: 0, avatarColor: .purple, isOnline: false),
        ChatConversation(id: "3", name: "Study Buddy - Alex", lastMessage: "Great session today!", time: "3h ago", unreadCount: 1, avatarColor: .green, isOnline: true),
        ChatConversation(id: "4", name: "Chemistry Lab", lastMessage: "Don't forget the report", time: "1d ago", unreadCount: 0, avatarColor: .orange, isOnline: false)
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
                ZStack {
                    Circle().fill(RadialGradient(colors: [Color.purple.opacity(0.4), .clear], center: .center, startRadius: 0, endRadius: 25)).frame(width: 54, height: 54)
                    Circle().fill(LinearGradient(colors: [Color.purple, .pink], startPoint: .topLeading, endPoint: .bottomTrailing)).frame(width: 50, height: 50)
                        .overlay { Image(systemName: "sparkles").font(.title3).foregroundColor(.white) }
                    Circle().fill(.green).frame(width: 14, height: 14).overlay(Circle().stroke(.white, lineWidth: 2)).offset(x: 20, y: 20)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("TRIX Bot").font(.headline).foregroundColor(.primary)
                    HStack(spacing: 6) {
                        Circle().fill(.green).frame(width: 6, height: 6)
                        Text("AI 学习助手").font(.caption).foregroundColor(.secondary)
                    }
                }
                Spacer()
                Image(systemName: "chevron.right").font(.caption).foregroundColor(.secondary)
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .background(.ultraThinMaterial).clipShape(RoundedRectangle(cornerRadius: 16))
        }.buttonStyle(.plain)
    }

    // MARK: - Quick Add Section

    private var quickAddSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("推荐添加").font(.subheadline).fontWeight(.semibold).foregroundColor(.secondary)
                Spacer()
                Button("隐藏") { withAnimation { showQuickAdd = false } }.font(.caption).foregroundColor(.purple)
            }.padding(.horizontal, 20)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
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
            }.padding(.bottom, 100)
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "message.circle").font(.system(size: 60)).foregroundColor(.purple.opacity(0.3))
            Text("没有找到对话").font(.headline).foregroundColor(.secondary)
            Text("开始新对话一起学习吧").font(.subheadline).foregroundColor(.secondary).multilineTextAlignment(.center)
        }.frame(maxWidth: .infinity, maxHeight: .infinity).padding(.bottom, 100)
    }

    // MARK: - Background Gradient

    private var backgroundGradient: some View {
        LinearGradient(colors: [Color.purple.opacity(0.05), Color.pink.opacity(0.03), .clear], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
    }

    // MARK: - Actions

    private func openTrixBotChat() {
        let botConversation = ChatConversation(id: "trixbot", name: "TRIX Bot", lastMessage: "有什么可以帮你的吗？", time: "在线", unreadCount: 0, avatarColor: .purple, isOnline: true)
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
                        let newConversation = ChatConversation(id: UUID().uuidString, name: trimmedName, lastMessage: "New conversation", time: "Just now", unreadCount: 0, avatarColor: colors.randomElement() ?? .purple, isOnline: false)
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
        VStack(spacing: 8) {
            ZStack(alignment: .bottomTrailing) {
                Circle().fill(LinearGradient(colors: [user.avatarColor, user.avatarColor.opacity(0.7)], startPoint: .topLeading, endPoint: .bottomTrailing)).frame(width: 60, height: 60)
                    .overlay { Text(user.avatar).font(.title2).fontWeight(.semibold).foregroundColor(.white) }
                if !isAdded {
                    Circle().fill(Color.purple).frame(width: 24, height: 24).overlay { Image(systemName: "plus").font(.system(size: 12, weight: .bold)).foregroundColor(.white) }.offset(x: 5, y: 5)
                }
            }
            Text(user.name).font(.caption).fontWeight(.medium).foregroundColor(.primary).lineLimit(1).frame(width: 70)
        }
        .contentShape(Rectangle())
        .onTapGesture {
            if !isAdded { withAnimation(.spring(response: 0.3)) { isAdded = true }; onAdd() }
        }
    }
}

// MARK: - Conversation Row

struct ConversationRow: View {
    let conversation: ChatConversation

    var body: some View {
        HStack(spacing: 12) {
            ZStack(alignment: .bottomTrailing) {
                Circle().fill(LinearGradient(colors: [conversation.avatarColor, conversation.avatarColor.opacity(0.7)], startPoint: .topLeading, endPoint: .bottomTrailing)).frame(width: 50, height: 50)
                    .overlay { Text(String(conversation.name.prefix(1))).font(.title3).fontWeight(.semibold).foregroundColor(.white) }
                if conversation.isOnline {
                    Circle().fill(.green).frame(width: 14, height: 14).overlay(Circle().stroke(.white, lineWidth: 2)).offset(x: 2, y: 2)
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(conversation.name).font(.headline).foregroundColor(.primary)
                    Spacer()
                    Text(conversation.time).font(.caption2).foregroundColor(.secondary)
                }
                HStack {
                    Text(conversation.lastMessage).font(.subheadline).foregroundColor(.secondary).lineLimit(1)
                    Spacer()
                    if conversation.unreadCount > 0 {
                        Text("\(conversation.unreadCount)").font(.caption2).fontWeight(.bold).foregroundColor(.white).padding(.horizontal, 8).padding(.vertical, 4).background(.purple).clipShape(Capsule())
                    }
                }
            }
            Spacer()
        }.padding(.horizontal).padding(.vertical, 12).background(.ultraThinMaterial.opacity(0.3)).contentShape(Rectangle())
    }
}

// MARK: - Preview

#Preview("Chat List") {
    ChatListView()
        .environmentObject(AppState.shared)
        .environmentObject(ChatService.shared)
}
