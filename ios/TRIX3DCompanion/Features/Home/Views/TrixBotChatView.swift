//
//  TrixBotChatView.swift
//  TRIX3DCompanion
//
//  TRIX Bot chat view - supports paired device mode and cloud chat mode
//

import SwiftUI
import UIKit

// MARK: - Trix Bot Chat View

struct TrixBotChatView: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var clawbotChannel: ClawbotChannelViewModel
    @EnvironmentObject private var chatService: ChatService
    @Environment(\.dismiss) private var dismiss

    // MARK: - State

    @State private var messageText: String
    @State private var attachedImage: UIImage?
    @State private var attachedImageURL: String?
    @State private var isUploadingAttachment = false
    @State private var isSendingMessage = false
    @State private var localErrorMessage: String?
    @State private var cloudRoomId: String = Self.defaultCloudRoomFallbackId
    @State private var hasInitializedCloudRoom = false
    @State private var scrollToBottom = false
    @FocusState private var isInputFocused: Bool

    // MARK: - Dependencies

    private let imageUploadService: ImageUploadService = .shared

    // MARK: - Constants

    private static let cloudRoomStorageKey = "trixbot.cloud.room.id"
    private static let defaultCloudRoomFallbackId = "trixbot"
    private let defaultImagePrompt = "请帮我分析这张图片，并给我可执行建议。"

    // MARK: - Initialization

    init(
        initialMessage: String = "",
        initialAttachedImage: UIImage? = nil,
        initialAttachedImageURL: String? = nil
    ) {
        _messageText = State(initialValue: initialMessage)
        _attachedImage = State(initialValue: initialAttachedImage)
        _attachedImageURL = State(initialValue: initialAttachedImageURL)
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            modeBanner
                .padding(.horizontal, 12)
                .padding(.top, 8)
            messagesList
            inputArea
        }
        .background(
            Color.clear.trixPageBackground(
                colors: [
                    Color.brandPurple.opacity(0.14),
                    Color.brandPink.opacity(0.1),
                    Color.cyan.opacity(0.05),
                    Color.clear
                ]
            )
        )
        .navigationTitle("TRIX Bot")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.headline)
                        .foregroundColor(.primary)
                        .frame(width: 32, height: 32)
                        .background(Color(.systemGray6))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("关闭")
            }

            ToolbarItem(placement: .navigationBarTrailing) {
                Text(clawbotChannel.isPaired ? "设备模式" : "云端模式")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .task {
            await initializeChatContextIfNeeded()
        }
        .onChange(of: displayMessages.count) { _ in
            scrollToBottom = true
        }
        .alert("发送失败", isPresented: localErrorPresented) {
            Button("确定") {
                localErrorMessage = nil
            }
        } message: {
            Text(localErrorMessage ?? "")
        }
    }

    // MARK: - Top Banner

    private var modeBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: clawbotChannel.isPaired ? "bolt.horizontal.circle.fill" : "icloud")
                .foregroundColor(clawbotChannel.isPaired ? .green : .orange)

            Text(clawbotChannel.isPaired ? "已配对设备，消息将实时发送到 TRIX" : "未配对设备，当前使用 Trixbook 云端聊天")
                .font(.caption)
                .foregroundColor(.secondary)

            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .trixSurfaceCard(cornerRadius: 14, borderOpacity: 0.2, shadowOpacity: 0.05, shadowRadius: 8)
    }

    // MARK: - Messages

    private var messagesList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 12) {
                    if displayMessages.isEmpty {
                        emptyState
                    } else {
                        ForEach(displayMessages) { message in
                            TrixDisplayMessageBubble(message: message)
                        }
                    }

                    Color.clear
                        .frame(height: 1)
                        .id("bottom-anchor")
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 8)
            }
            .onAppear {
                scrollToBottom = true
            }
            .onChange(of: scrollToBottom) { shouldScroll in
                guard shouldScroll else { return }

                withAnimation(.easeOut(duration: 0.2)) {
                    proxy.scrollTo("bottom-anchor", anchor: .bottom)
                }
                scrollToBottom = false
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "message.badge")
                .font(.system(size: 30))
                .foregroundColor(.brandPurple.opacity(0.7))

            Text("上传图片并输入提示词，TRIX 会给你处理建议")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 20)
        }
        .padding(.vertical, 18)
        .padding(.horizontal, 12)
        .trixSurfaceCard(cornerRadius: 16, borderOpacity: 0.18, shadowOpacity: 0.04, shadowRadius: 6)
        .frame(maxWidth: .infinity)
        .padding(.top, 48)
    }

    // MARK: - Input

    private var inputArea: some View {
        VStack(spacing: 10) {
            if attachedImage != nil || attachedImageURL != nil {
                attachmentPreview
            }

            HStack(alignment: .bottom, spacing: 10) {
                HStack(spacing: 8) {
                    TextField("输入提示词...", text: $messageText, axis: .vertical)
                        .textFieldStyle(.plain)
                        .lineLimit(1...6)
                        .focused($isInputFocused)
                        .disabled(isUploadingAttachment || isSendingMessage)

                    if !messageText.isEmpty {
                        Button {
                            messageText = ""
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .trixSurfaceCard(cornerRadius: 14, borderOpacity: 0.16, shadowOpacity: 0.03, shadowRadius: 4)

                Button(action: sendMessage) {
                    ZStack {
                        Circle()
                            .fill(canSend ? Color.brandPurple : Color.gray)
                            .frame(width: 42, height: 42)

                        if isSendingMessage || isUploadingAttachment {
                            ProgressView()
                                .tint(.white)
                                .scaleEffect(0.85)
                        } else {
                            Image(systemName: "arrow.up")
                                .font(.headline)
                                .foregroundColor(.white)
                        }
                    }
                }
                .buttonStyle(.plain)
                .disabled(!canSend)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
        .overlay(
            Rectangle()
                .fill(Color.white.opacity(0.15))
                .frame(height: 1),
            alignment: .top
        )
    }

    private var attachmentPreview: some View {
        HStack(spacing: 10) {
            if let image = attachedImage {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: 56, height: 56)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            } else if let attachedImageURL, let url = URL(string: attachedImageURL) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .empty:
                        ProgressView()
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    case .failure:
                        Image(systemName: "photo")
                            .foregroundColor(.secondary)
                    @unknown default:
                        Image(systemName: "photo")
                            .foregroundColor(.secondary)
                    }
                }
                .frame(width: 56, height: 56)
                .background(Color(.systemGray5))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("已附加图片")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Text(attachedImageURL == nil ? "发送时上传" : "已上传，待发送")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            if isUploadingAttachment {
                ProgressView()
            } else {
                Button {
                    attachedImage = nil
                    attachedImageURL = nil
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title3)
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .trixSurfaceCard(cornerRadius: 12, borderOpacity: 0.18, shadowOpacity: 0.03, shadowRadius: 4)
    }

    // MARK: - Derived State

    private var canSend: Bool {
        let trimmedText = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        return (!trimmedText.isEmpty || attachedImage != nil || attachedImageURL != nil) && !isUploadingAttachment && !isSendingMessage
    }

    private var localErrorPresented: Binding<Bool> {
        Binding(
            get: { localErrorMessage != nil },
            set: { isPresented in
                if !isPresented {
                    localErrorMessage = nil
                }
            }
        )
    }

    private var displayMessages: [TrixDisplayMessage] {
        if clawbotChannel.isPaired {
            return clawbotChannel.messages
                .sorted { $0.timestamp < $1.timestamp }
                .map {
                    TrixDisplayMessage(
                        id: $0.id,
                        content: $0.content,
                        mediaURL: $0.mediaUrl,
                        timestamp: $0.timestamp,
                        sender: $0.sender == .user ? .user : .bot
                    )
                }
        }

        return chatService.currentMessages
            .sorted { $0.createdAt < $1.createdAt }
            .map {
                TrixDisplayMessage(
                    id: $0.id,
                    content: $0.content,
                    mediaURL: $0.mediaUrl,
                    timestamp: $0.createdAt,
                    sender: $0.sender == .user ? .user : .bot
                )
            }
    }

    // MARK: - Actions

    private func initializeChatContextIfNeeded() async {
        if !clawbotChannel.isConnected {
            await clawbotChannel.connect()
        }

        guard !clawbotChannel.isPaired else {
            scrollToBottom = true
            return
        }

        await ensureCloudRoomReady()
        chatService.selectRoom(roomId: cloudRoomId)
        _ = await chatService.fetchMessages(roomId: cloudRoomId, before: nil)
        scrollToBottom = true
    }

    private func ensureCloudRoomReady() async {
        if hasInitializedCloudRoom {
            return
        }

        if let cachedRoomId = UserDefaults.standard.string(forKey: Self.cloudRoomStorageKey), !cachedRoomId.isEmpty {
            cloudRoomId = cachedRoomId
            hasInitializedCloudRoom = true
            return
        }

        if chatService.chatRooms.isEmpty {
            _ = await chatService.fetchChatRooms()
        }

        if let existingRoom = chatService.chatRooms.first(where: { room in
            room.type == .ai || room.name.localizedCaseInsensitiveContains("trix")
        }) {
            cloudRoomId = existingRoom.id
            UserDefaults.standard.set(existingRoom.id, forKey: Self.cloudRoomStorageKey)
            hasInitializedCloudRoom = true
            return
        }

        let createResult = await chatService.createChatRoom(name: "TRIX Bot", type: .ai)
        if case .success(let createdRoom) = createResult {
            cloudRoomId = createdRoom.id
            UserDefaults.standard.set(createdRoom.id, forKey: Self.cloudRoomStorageKey)
        }

        hasInitializedCloudRoom = true
    }

    private func sendMessage() {
        guard canSend else { return }

        let trimmedText = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        isInputFocused = false

        Task {
            isSendingMessage = true
            var mediaURLToSend = attachedImageURL

            if mediaURLToSend == nil, let image = attachedImage {
                isUploadingAttachment = true
                let uploadResult = await imageUploadService.uploadImage(image)

                switch uploadResult {
                case .success(let url):
                    mediaURLToSend = url
                    attachedImageURL = url
                case .failure(let error):
                    localErrorMessage = error.localizedDescription
                    isUploadingAttachment = false
                    isSendingMessage = false
                    return
                }

                isUploadingAttachment = false
            }

            let contentToSend = trimmedText.isEmpty ? defaultImagePrompt : trimmedText
            let hasMedia = mediaURLToSend != nil

            if clawbotChannel.isPaired {
                let success = await clawbotChannel.sendMessage(
                    contentToSend,
                    contentType: hasMedia ? .image : .text,
                    mediaUrl: mediaURLToSend,
                    mediaMimeType: hasMedia ? "image/jpeg" : nil
                )

                if success {
                    clearComposer()
                } else {
                    localErrorMessage = clawbotChannel.lastError ?? "消息发送失败，请稍后重试。"
                }
            } else {
                await ensureCloudRoomReady()

                let result = await chatService.sendMessage(
                    roomId: cloudRoomId,
                    content: contentToSend,
                    type: hasMedia ? .image : .text,
                    mediaUrl: mediaURLToSend,
                    mediaMimeType: hasMedia ? "image/jpeg" : nil
                )

                switch result {
                case .success:
                    clearComposer()
                case .failure(let error):
                    localErrorMessage = error.localizedDescription
                }
            }

            isSendingMessage = false
            scrollToBottom = true
        }
    }

    private func clearComposer() {
        messageText = ""
        attachedImage = nil
        attachedImageURL = nil
    }
}

// MARK: - Display Message Model

private struct TrixDisplayMessage: Identifiable {
    enum Sender {
        case user
        case bot
    }

    let id: String
    let content: String
    let mediaURL: String?
    let timestamp: Date
    let sender: Sender

    var isFromUser: Bool {
        sender == .user
    }
}

// MARK: - Message Bubble

private struct TrixDisplayMessageBubble: View {
    let message: TrixDisplayMessage

    var body: some View {
        HStack {
            if message.isFromUser {
                Spacer(minLength: 48)
            }

            VStack(alignment: message.isFromUser ? .trailing : .leading, spacing: 5) {
                Text(message.isFromUser ? "你" : "TRIX Bot")
                    .font(.caption)
                    .foregroundColor(.secondary)

                if let mediaURL = message.mediaURL, let url = URL(string: mediaURL) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .empty:
                            ProgressView()
                                .frame(width: 180, height: 180)
                                .background(Color(.systemGray6))
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 180, height: 180)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        case .failure:
                            Image(systemName: "photo")
                                .frame(width: 180, height: 180)
                                .background(Color(.systemGray6))
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        @unknown default:
                            EmptyView()
                        }
                    }
                }

                if !message.content.isEmpty {
                    Text(message.content)
                        .font(.body)
                        .foregroundColor(message.isFromUser ? .white : .primary)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(
                            message.isFromUser
                                ? AnyView(
                                    LinearGradient(
                                        colors: [.brandPurple, .brandPink],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                : AnyView(Color.white.opacity(0.14))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(Color.white.opacity(message.isFromUser ? 0.16 : 0.22), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .shadow(
                            color: message.isFromUser
                                ? Color.brandPurple.opacity(0.18)
                                : Color.black.opacity(0.06),
                            radius: 6,
                            x: 0,
                            y: 3
                        )
                }

                Text(formatTime(message.timestamp))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            if !message.isFromUser {
                Spacer(minLength: 48)
            }
        }
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Preview

#Preview("TRIX Bot Chat") {
    NavigationStack {
        TrixBotChatView()
            .environmentObject(ClawbotChannelViewModel.shared)
            .environmentObject(ChatService.shared)
    }
}
