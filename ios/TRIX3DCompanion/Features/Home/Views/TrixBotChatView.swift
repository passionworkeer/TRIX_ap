//
//  TrixBotChatView.swift
//  TRIX3DCompanion
//
//  TRIX Bot chat view - connects to Clawbot Channel for AI conversation
//

import SwiftUI
import UIKit

// MARK: - TrixBot Chat View

/// Chat view for TRIX Bot AI conversations
struct TrixBotChatView: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var clawbotChannel: ClawbotChannelViewModel
    @Environment(\.dismiss) private var dismiss

    // MARK: - State

    @State private var messageText: String = ""
    @State private var scrollToBottom = false
    @State private var attachedImage: UIImage?
    @State private var attachedImageURL: String?
    @State private var isUploadingAttachment = false
    @State private var localErrorMessage: String?
    @FocusState private var isInputFocused: Bool

    // MARK: - Dependencies

    private let imageUploadService: ImageUploadService = .shared

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
            // Connection status bar
            connectionStatusBar

            // Messages list
            messagesList

            // Input area
            inputArea
        }
        .background(backgroundGradient)
        .gesture(TapGesture().onEnded { _ in dismissKeyboard() })
        .navigationTitle("TRIX Bot")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                // Pairing status indicator
                HStack(spacing: 4) {
                    Circle()
                        .fill(clawbotChannel.isPaired ? Color.green : Color.orange)
                        .frame(width: 8, height: 8)
                    Text(clawbotChannel.isPaired ? "已配对" : "未配对")
                        .font(.caption)
                        .foregroundColor(clawbotChannel.isPaired ? .green : .orange)
                }
            }

            ToolbarItem(placement: .navigationBarLeading) {
                Button("关闭") {
                    dismiss()
                }
            }
        }
        .onAppear {
            Task {
                await connectToBot()
            }
        }
        .onChange(of: clawbotChannel.messages) { _ in
            scrollToBottom = true
        }
        .alert("Error", isPresented: localErrorPresented) {
            Button("OK") {
                localErrorMessage = nil
            }
        } message: {
            Text(localErrorMessage ?? "")
        }
    }

    // MARK: - Connection Status Bar

    private var connectionStatusBar: some View {
        Group {
            if !clawbotChannel.isConnected {
                HStack(spacing: 8) {
                    Image(systemName: "wifi.slash").font(.caption)
                    Text("正在连接...").font(.caption)
                    Spacer()
                }
                .padding(.horizontal).padding(.vertical, 8)
                .background(.orange.opacity(0.2))
            } else if !clawbotChannel.isPaired {
                HStack(spacing: 8) {
                    Image(systemName: "link.badge.plus").font(.caption)
                    Text("未配对设备，请先配对").font(.caption)
                    Spacer()
                }
                .padding(.horizontal).padding(.vertical, 8)
                .background(.yellow.opacity(0.2))
            }
        }
    }

    // MARK: - Messages List

    private var messagesList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(clawbotChannel.messages) { message in
                        MessageBubble(message: message)
                            .id(message.id)
                    }

                    // Typing indicator
                    if clawbotChannel.botState == .thinking || clawbotChannel.botState == .speaking {
                        HStack {
                            Spacer()
                            VStack(alignment: .trailing, spacing: 4) {
                                Text("TRIX Bot")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                HStack(spacing: 4) {
                                    ForEach(0..<3) { index in
                                        Circle()
                                            .fill(Color.gray.opacity(0.6))
                                            .frame(width: 8, height: 8)
                                            .scaleEffect(clawbotChannel.botState == .speaking ? 1.2 : 1.0)
                                    }
                                }
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Color.gray.opacity(0.2))
                            .cornerRadius(16)
                        }
                        .padding(.horizontal)
                    }
                }
                .padding(.vertical)
            }
            .onChange(of: scrollToBottom) { shouldScroll in
                if shouldScroll, let lastMessage = clawbotChannel.messages.last {
                    withAnimation {
                        proxy.scrollTo(lastMessage.id, anchor: .bottom)
                    }
                    scrollToBottom = false
                }
            }
        }
    }

    // MARK: - Input Area

    private var inputArea: some View {
        VStack(spacing: 10) {
            if attachedImage != nil || attachedImageURL != nil {
                HStack(spacing: 10) {
                    if let image = attachedImage {
                        Image(uiImage: image)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 56, height: 56)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    } else if let remoteImageURL = attachedImageURL, let url = URL(string: remoteImageURL) {
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
                                    .font(.title3)
                                    .foregroundColor(.secondary)
                            @unknown default:
                                Image(systemName: "photo")
                                    .font(.title3)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .frame(width: 56, height: 56)
                        .background(Color(.systemGray5))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text("已附加图片")
                            .font(.subheadline)
                            .fontWeight(.semibold)

                        Text(attachedImageURL == nil ? "发送时上传" : "上传完成")
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
                                .foregroundColor(.gray)
                                .font(.title3)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }

            HStack(alignment: .bottom, spacing: 12) {
                // Text input
                HStack(alignment: .bottom, spacing: 8) {
                    TextField("发送消息...", text: $messageText, axis: .vertical)
                        .textFieldStyle(.plain)
                        .lineLimit(1...6)
                        .disabled(!clawbotChannel.isPaired || isUploadingAttachment)

                    if !messageText.isEmpty {
                        Button(action: { messageText = "" }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.gray)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 20)
                        .fill(Color(.systemGray6))
                )

                // Send button
                if canSend {
                    Button(action: sendMessage) {
                        ZStack {
                            Circle()
                                .fill(clawbotChannel.isPaired ? Color.purple : Color.gray)
                                .frame(width: 40, height: 40)

                            if clawbotChannel.isSending || isUploadingAttachment {
                                ProgressView()
                                    .scaleEffect(0.8)
                            } else {
                                Image(systemName: "arrow.up.fill")
                                    .font(.body)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.white)
                            }
                        }
                    }
                    .disabled(!clawbotChannel.isPaired || clawbotChannel.isSending || isUploadingAttachment)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
    }

    private var canSend: Bool {
        !messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || attachedImage != nil || attachedImageURL != nil
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

    // MARK: - Background Gradient

    private var backgroundGradient: some View {
        LinearGradient(
            colors: [Color.purple.opacity(0.15), Color.pink.opacity(0.1), Color.black.opacity(0.1)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        ).ignoresSafeArea()
    }

    // MARK: - Actions

    private func connectToBot() async {
        if !clawbotChannel.isConnected {
            await clawbotChannel.connect()
        }
    }

    private func sendMessage() {
        let trimmedText = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard clawbotChannel.isPaired else { return }

        Task {
            var mediaURLToSend = attachedImageURL

            if mediaURLToSend == nil, let image = attachedImage {
                await MainActor.run { isUploadingAttachment = true }

                let uploadResult = await imageUploadService.uploadImage(image)
                switch uploadResult {
                case .success(let url):
                    mediaURLToSend = url
                    await MainActor.run {
                        attachedImageURL = url
                        isUploadingAttachment = false
                    }
                case .failure(let error):
                    await MainActor.run {
                        isUploadingAttachment = false
                        localErrorMessage = error.localizedDescription
                    }
                    return
                }
            }

            let contentToSend = trimmedText.isEmpty ? "请帮我分析这张图片，并给我可执行建议。" : trimmedText
            let contentType: ClawbotMessageContentType = (mediaURLToSend == nil) ? .text : .image

            let success = await clawbotChannel.sendMessage(
                contentToSend,
                contentType: contentType,
                mediaUrl: mediaURLToSend,
                mediaMimeType: mediaURLToSend == nil ? nil : "image/jpeg"
            )

            if success {
                await MainActor.run {
                    messageText = ""
                    attachedImage = nil
                    attachedImageURL = nil
                    scrollToBottom = true
                }
            }
        }
    }

    private func dismissKeyboard() {
        isInputFocused = false
    }
}

// MARK: - Message Bubble

struct MessageBubble: View {
    let message: ClawbotMessage

    var body: some View {
        HStack {
            if message.sender == .user {
                Spacer()
            }

            VStack(alignment: message.sender == .user ? .trailing : .leading, spacing: 4) {
                Text(message.sender == .user ? "你" : "TRIX Bot")
                    .font(.caption)
                    .foregroundColor(.secondary)

                if let mediaUrl = message.mediaUrl, let url = URL(string: mediaUrl) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .empty:
                            ProgressView()
                                .frame(width: 180, height: 180)
                                .background(Color(.systemGray5))
                                .clipShape(RoundedRectangle(cornerRadius: 16))
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 180, height: 180)
                                .clipShape(RoundedRectangle(cornerRadius: 16))
                        case .failure:
                            Image(systemName: "photo")
                                .font(.title2)
                                .frame(width: 180, height: 180)
                                .background(Color(.systemGray5))
                                .clipShape(RoundedRectangle(cornerRadius: 16))
                        @unknown default:
                            EmptyView()
                        }
                    }
                }

                Text(message.content)
                    .font(.body)
                    .foregroundColor(message.sender == .user ? .white : .primary)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(
                        message.sender == .user ?
                        AnyView(LinearGradient(colors: [.purple, .pink], startPoint: .topLeading, endPoint: .bottomTrailing)) :
                        AnyView(Color(.systemGray5))
                    )
                    .cornerRadius(16)

                Text(formatTime(message.timestamp))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            if message.sender == .bot {
                Spacer()
            }
        }
        .padding(.horizontal)
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
    }
}
