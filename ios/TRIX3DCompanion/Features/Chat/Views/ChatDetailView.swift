//
//  ChatDetailView.swift
//  TRIX3DCompanion
//
//  Main chat detail view showing conversation messages
//

import SwiftUI

// MARK: - Chat Detail View

/// Main chat detail view displaying a conversation
struct ChatDetailView: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var chatService: ChatService

    // MARK: - State

    @State private var messageText: String = ""
    @State private var showingImagePicker = false
    @State private var showingAttachmentOptions = false
    @State private var showingCamera = false
    @State private var scrollToBottom = false

    // MARK: - Focus State

    @FocusState private var isInputFocused: Bool

    // MARK: - Properties

    let conversation: ChatConversation

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            // Connection status bar
            if !chatService.isConnected {
                connectionStatusBar
            }

            // Messages list
            messagesList

            // Input area
            inputArea
        }
        .background(backgroundGradient)
        .gesture(
            TapGesture()
                .onEnded { _ in
                    dismissKeyboard()
                }
        )
        .navigationTitle(conversation.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: showConversationInfo) {
                    Image(systemName: "ellipsis.circle")
                        .foregroundColor(.primary)
                }
            }
        }
        .onAppear {
            Task {
                await loadConversation()
            }
        }
        .onDisappear {
            chatService.closeConversation()
        }
        .sheet(isPresented: $showingImagePicker) {
            ImagePicker { imageURL in
                Task {
                    await chatService.sendImageMessage(imageURL)
                }
            }
        }
        .confirmationDialog("chat.attach.media".localized, isPresented: $showingAttachmentOptions) {
            Button("chat.photo.library".localized) {
                showingImagePicker = true
            }
            Button("camera.take.photo".localized) {
                openCamera()
            }
            Button("action.cancel".localized, role: .cancel) {}
        }
        .sheet(isPresented: $showingCamera) {
            CameraView { image, imageURL in
                if let url = imageURL {
                    Task {
                        await chatService.sendImageMessage(url)
                    }
                }
            }
        }
    }

    // MARK: - View Components

    /// Connection status bar
    private var connectionStatusBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "wifi.slash")
                .font(.caption)

            Text(chatService.connectionStatus)
                .font(.caption)

            Spacer()

            Button("Retry") {
                Task {
                    if let userId = appState.currentUser?.id {
                        await chatService.connect(userId: userId)
                    }
                }
            }
            .font(.caption)
            .buttonStyle(.bordered)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.yellow.opacity(0.2))
    }

    /// Messages list
    private var messagesList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    // Load more button
                    if chatService.hasMoreHistory && !chatService.messages.isEmpty {
                        loadMoreButton
                    }

                    // Messages (with pagination support)
                    ForEach(chatService.messages) { message in
                        MessageCell(
                            message: message,
                            isCurrentUser: message.sender == .user
                        )
                            .id(message.id)
                    }

                    // Bottom anchor for scrolling
                    Color.clear
                        .frame(height: 1)
                        .id("bottom")
                }
                .padding(.top)
                .padding(.bottom, 8)
            }
            .onChange(of: chatService.messages.count) { _ in
                // Auto-scroll to bottom when new message arrives
                withAnimation(.easeOut(duration: 0.3)) {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }
            .onChange(of: scrollToBottom) { _ in
                withAnimation(.easeOut(duration: 0.3)) {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }
        }
    }

    /// Load more button
    private var loadMoreButton: some View {
        Button(action: loadMoreMessages) {
            HStack(spacing: 8) {
                if chatService.isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle())
                } else {
                    Image(systemName: "arrow.up")
                }

                Text("Load Earlier Messages")
                    .font(.subheadline)
            }
            .foregroundColor(.secondary)
            .padding()
        }
        .disabled(chatService.isLoading)
    }

    /// Input area
    private var inputArea: some View {
        HStack(alignment: .bottom, spacing: 12) {
            // Attachment button
            Button(action: { showingAttachmentOptions = true }) {
                Image(systemName: "plus.circle.fill")
                    .font(.title2)
                    .foregroundColor(.purple)
            }
            .disabled(!chatService.isConnected)

            // Text input
            HStack(alignment: .bottom, spacing: 8) {
                TextField("Type a message...", text: $messageText, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.body)
                    .focused($isInputFocused)
                    .lineLimit(1...6)
                    .disabled(!chatService.isConnected)

                // Send button (inline when text is entered)
                if !messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Button(action: sendMessage) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.brandPurple, .brandPink],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                    }
                    .disabled(!chatService.isConnected)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Color.separator.opacity(0.5), lineWidth: 0.5)
            )
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
        .background(
            .ultraThinMaterial,
            in: Rectangle()
        )
    }

    /// Background gradient
    private var backgroundGradient: some View {
        LinearGradient(
            colors: [
                Color.purple.opacity(0.05),
                Color.pink.opacity(0.03),
                Color.clear
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }

    // MARK: - Actions

    /// Load conversation
    private func loadConversation() async {
        await chatService.openConversation(conversation)
    }

    /// Load more messages
    private func loadMoreMessages() {
        Task {
            await chatService.loadMessages(older: true)
        }
    }

    /// Send message
    private func sendMessage() {
        let text = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        messageText = ""
        isInputFocused = false

        Task {
            await chatService.sendTextMessage(text)
        }
    }

    /// Open camera for capturing photo
    private func openCamera() {
        showingCamera = true
    }

    /// Show conversation info
    private func showConversationInfo() {
        // Present conversation info sheet
        // This would show member list, shared media, etc.
        Task {
            await chatService.sendTextMessage("[ℹ️ Conversation info - Settings would open here]")
        }
    }

    /// Dismiss keyboard when tapping outside input area
    private func dismissKeyboard() {
        UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder),
            to: nil,
            from: nil,
            for: nil
        )
    }
}

// MARK: - Image Picker (Placeholder)

/// Simple image picker placeholder
struct ImagePicker: View {
    let onImageSelected: (String) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Image(systemName: "photo.on.rectangle.angled")
                    .font(.system(size: 60))
                    .foregroundColor(.purple)

                Text("camera.placeholder.title".localized)
                    .font(.title2)
                    .fontWeight(.semibold)

                Text("camera.placeholder.description".localized)
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding()

                Button("camera.sample.image".localized) {
                    // Use a sample image URL
                    onImageSelected("https://picsum.photos/400/400?random=\(Int.random(in: 1...1000))")
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()
            .navigationTitle("camera.select.photo".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("action.cancel".localized) {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Preview

#Preview("Chat Detail") {
    NavigationView {
        ChatDetailView(
            conversation: ChatConversation(
                id: "1",
                name: "Math Study Group",
                lastMessage: "Let's meet at 3pm",
                time: "2m ago",
                unreadCount: 3,
                avatarColor: .blue,
                isOnline: true
            )
        )
        .environmentObject(AppState.shared)
        .environmentObject(ChatService.shared)
    }
}

#Preview("Bot Chat") {
    NavigationView {
        ChatDetailView(
            conversation: ChatConversation(
                id: "bot",
                name: "Clawbot AI",
                lastMessage: "How can I help?",
                time: "Now",
                unreadCount: 0,
                avatarColor: .purple,
                isOnline: true
            )
        )
        .environmentObject(AppState.shared)
        .environmentObject(ChatService.shared)
    }
}

#Preview("Dark Mode") {
    NavigationView {
        ChatDetailView(
            conversation: ChatConversation(
                id: "1",
                name: "Study Buddy",
                lastMessage: "Great session!",
                time: "1h ago",
                unreadCount: 1,
                avatarColor: .green,
                isOnline: true
            )
        )
        .environmentObject(AppState.shared)
        .environmentObject(ChatService.shared)
    }
    .preferredColorScheme(.dark)
}
