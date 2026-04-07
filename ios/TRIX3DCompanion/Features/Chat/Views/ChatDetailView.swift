//
//  ChatDetailView.swift
//  TRIX3DCompanion
//
//  Main chat detail view showing conversation messages
//

import SwiftUI
import ActivityIndicatorView
import UIKit

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    key.localized
}

// MARK: - Chat Detail View

/// Main chat detail view displaying a conversation
struct ChatDetailView: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var chatService: ChatService

    // MARK: - State

    @StateObject private var attachmentViewModel = ChatMediaAttachmentViewModel()
    @State private var messageText: String = ""
    @State private var showingImagePicker = false
    @State private var showingAttachmentOptions = false
    @State private var showingCamera = false
    @State private var previousMessageCount: Int = 0
    @State private var shouldScrollToBottom: Bool = false
    @State private var searchText: String = ""
    @State private var isSearching: Bool = false

    @FocusState private var isInputFocused: Bool

    // MARK: - Properties

    let conversation: ChatConversation

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            // WebSocket connection status bar — only relevant when paired with a TRIX companion.
            // Without pairing, messages still work via REST API (no real-time features).
            if chatService.isPaired && !chatService.isConnected {
                connectionStatusBar
            }

            // Search bar
            if isSearching {
                searchBar
            }

            // Messages list
            messagesList
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            inputArea
        }
        .background(backgroundGradient)
        .gesture(TapGesture().onEnded { _ in dismissKeyboard() })
        .navigationTitle(conversation.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { isSearching.toggle() }) {
                    Image(systemName: isSearching ? "xmark" : "magnifyingglass")
                }
            }
        }
        .onAppear {
            Task { await loadConversation() }
        }
        .onDisappear {
            chatService.disconnectWebSocket()
        }
        .sheet(isPresented: $showingImagePicker) {
            SystemPhotoLibraryPicker(
                onImagePicked: { image in
                    showingImagePicker = false
                    Task { await sendPickedImage(image) }
                },
                onCancel: {
                    showingImagePicker = false
                },
                onFailure: { error in
                    showingImagePicker = false
                    attachmentViewModel.errorMessage = error?.localizedDescription ?? L("chat.attach.error.message")
                }
            )
        }
        .confirmationDialog(L("chat.attach.media"), isPresented: $showingAttachmentOptions) {
            Button(L("chat.photo.library")) { showingImagePicker = true }
            Button(L("camera.take.photo")) { openCamera() }
            Button(L("action.cancel"), role: .cancel) {}
        }
        .sheet(isPresented: $showingCamera) {
            CameraView { image, imageURL in
                if let url = imageURL {
                    Task { _ = await chatService.sendMessage(roomId: conversation.id, content: url, type: .image) }
                }
            }
        }
        .alert(L("chat.attach.error.title"), isPresented: Binding(
            get: { attachmentViewModel.errorMessage != nil },
            set: { if !$0 { attachmentViewModel.clearError() } }
        )) {
            Button(L("action.confirm"), role: .cancel) {
                attachmentViewModel.clearError()
            }
        } message: {
            Text(attachmentViewModel.errorMessage ?? L("chat.attach.error.message"))
        }
    }

    // MARK: - Connection Status Bar

    private var connectionStatusBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "wifi.slash").font(.caption)
            Text(L("chat.detail.connection.disconnected"))
            Spacer()
            Button(L("action.retry")) {
                Task {
                    if let userId = appState.currentUser?.id {
                        _ = await chatService.connectWebSocket(userId: userId)
                    }
                }
            }
            .font(.caption)
            .buttonStyle(.borderedProminent)
            .tint(.orange)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.white.opacity(0.76), lineWidth: 1)
        )
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    // MARK: - Search Bar

    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.secondary)

            TextField(L("chat.search.placeholder"), text: $searchText)
                .textFieldStyle(.plain)
                .autocorrectionDisabled()

            if !searchText.isEmpty {
                Button(action: { searchText = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .padding(.horizontal, 12)
        .padding(.vertical, 4)
    }

    // MARK: - Messages List

    private var filteredMessages: [ChatMessage] {
        if searchText.isEmpty {
            return chatService.currentMessages
        }
        return chatService.currentMessages.filter { message in
            message.content.localizedCaseInsensitiveContains(searchText)
        }
    }

    private var messagesList: some View {
        ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 8) {
                    if chatService.hasMoreMessages && !chatService.currentMessages.isEmpty {
                        loadMoreButton
                    }
                    ForEach(filteredMessages) { message in
                        MessageCell(message: message, isCurrentUser: message.sender == .user).id(message.id)
                    }
                }
                .padding(.horizontal, 4)
                .padding(.top, 12)
                .padding(.bottom, 20)
            }
            .scrollDismissesKeyboard(.interactively)
            .onAppear {
                // 记录初始消息数
                previousMessageCount = chatService.currentMessages.count
                // 滚动到底部
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    scrollToBottom(proxy: proxy)
                }
            }
            .onChange(of: chatService.currentMessages.count) { _, newCount in
                // 如果消息数增加了，滚动到底部
                if newCount > previousMessageCount {
                    scrollToBottom(proxy: proxy)
                }
                previousMessageCount = newCount
            }
        }
    }

    private func scrollToBottom(proxy: ScrollViewProxy) {
        if let lastMessage = filteredMessages.last {
            proxy.scrollTo(lastMessage.id, anchor: .bottom)
        }
    }

    private var loadMoreButton: some View {
        Button(action: loadMoreMessages) {
            HStack(spacing: 8) {
                if chatService.isLoadingMessages {
                    TrixLoadingIndicator.chat()
                } else { Image(systemName: "arrow.up") }
                Text(L("chat.load.earlier")).font(.subheadline)
            }.foregroundColor(.secondary).padding()
        }.disabled(chatService.isLoadingMessages)
    }

    // MARK: - Input Area

    private var inputArea: some View {
        HStack(alignment: .bottom, spacing: 12) {
            Button(action: { showingAttachmentOptions = true }) {
                if attachmentViewModel.isUploading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle())
                        .tint(.brandPurple)
                        .frame(width: 24, height: 24)
                } else {
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                        .foregroundColor(.brandPurple)
                }
            }
            .disabled(!chatService.isConnected || attachmentViewModel.isUploading)

            HStack(alignment: .bottom, spacing: 8) {
                TextField(L("chat.placeholder"), text: $messageText, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.body)
                    .focused($isInputFocused)
                    .lineLimit(1...6)
                    .disabled(!chatService.isConnected)

                if !messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Button(action: sendMessage) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                            .foregroundColor(.brandPurple)
                    }
                    .disabled(!chatService.isConnected)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(Color.white.opacity(0.76), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.05), radius: 10, x: 0, y: 6)
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 10)
        .background(
            ZStack {
                LinearGradient(
                    colors: [
                        Color.clear,
                        Color(.systemGroupedBackground).opacity(0.56),
                        Color(.systemGroupedBackground).opacity(0.92)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )

                Rectangle()
                    .fill(.ultraThinMaterial)
                    .opacity(0.88)
            }
            .ignoresSafeArea(edges: .bottom)
        )
    }

    // MARK: - Background Gradient

    private var backgroundGradient: some View {
        LinearGradient(colors: [Color.purple.opacity(0.05), Color.pink.opacity(0.03), .clear], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
    }

    // MARK: - Actions

    private func loadConversation() async {
        chatService.selectRoom(roomId: conversation.id)
        // 延迟获取消息，确保selectRoom完成
        _ = await chatService.fetchMessages(roomId: conversation.id, before: nil)
    }

    private func loadMoreMessages() {
        Task {
            if let oldestMessage = chatService.currentMessages.first {
                _ = await chatService.fetchMessages(roomId: conversation.id, before: oldestMessage.createdAt)
            }
        }
    }

    private func sendMessage() {
        let text = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        messageText = ""
        isInputFocused = false
        Task { _ = await chatService.sendMessage(roomId: conversation.id, content: text, type: .text) }
    }

    private func openCamera() { showingCamera = true }
    private func dismissKeyboard() { isInputFocused = false }

    private func sendPickedImage(_ image: UIImage) async {
        guard let imageURL = await attachmentViewModel.upload(image: image) else { return }

        let result = await chatService.sendMessage(roomId: conversation.id, content: imageURL, type: .image)
        if case .failure(let error) = result {
            attachmentViewModel.errorMessage = error.errorDescription
        }
    }
}

// MARK: - Preview

#Preview("Chat Detail") {
    NavigationStack {
        ChatDetailView(conversation: ChatConversation(id: "1", name: "Math Study Group", avatarUrl: nil, lastMessage: "Let's meet at 3pm", time: "2m ago", unreadCount: 3, avatarColor: .blue, isOnline: true))
            .environmentObject(AppState.shared)
            .environmentObject(ChatService.shared)
    }
}
