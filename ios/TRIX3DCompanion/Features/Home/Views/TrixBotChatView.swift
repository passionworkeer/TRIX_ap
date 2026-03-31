//
//  TrixBotChatView.swift
//  TRIX3DCompanion
//
//  TRIX Bot native chat view
//

import SwiftUI
import UIKit
import ActivityIndicatorView

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Trix Bot Chat View

struct TrixBotChatView: View {

    // MARK: - Environment Objects

    @EnvironmentObject private var clawbotChannel: ClawbotChannelViewModel
    @Environment(\.dismiss) private var dismiss

    // MARK: - State

    @State private var messageText: String
    @State private var attachedImage: UIImage?
    @State private var attachedImageURL: String?
    @State private var isUploadingAttachment = false
    @State private var isSendingMessage = false
    @State private var localErrorMessage: String?
    @State private var scrollToBottom = false
    @State private var didApplyUITestPrefill = false
    @State private var didApplyUITestAttachment = false
    @State private var didAutoSendUITestMessage = false
    @FocusState private var isInputFocused: Bool

    // MARK: - Dependencies

    // MARK: - Constants

    private let defaultImagePrompt = L("chat.trixbot.default.prompt")

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
            messagesList
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            inputArea
        }
        .accessibilityElement(children: .contain)
        .uiTestMarker(TrixBotAccessibilityIdentifiers.screen)
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
        .navigationTitle(L("chat.trixbot.name"))
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
                .accessibilityLabel(L("chat.trixbot.close"))
                .accessibilityIdentifier(TrixBotAccessibilityIdentifiers.closeButton)
            }

            ToolbarItem(placement: .navigationBarTrailing) {
                EmptyView()
            }
        }
        .task {
            await initializeChatContextIfNeeded()
        }
        .onAppear {
            UITestEventLogger.log("TrixBotChatView onAppear")
            NSLog("[TRIX-UI] TrixBotChatView onAppear")
            print("[TRIX-UI] TrixBotChatView onAppear")
            applyUITestPrefillIfNeeded()
            applyUITestAttachmentIfNeeded()
            scheduleUITestAutoSendIfNeeded()
        }
        .onChange(of: displayMessages.count) { _, _ in
            scrollToBottom = true
        }
        .onChange(of: clawbotChannel.isPaired) { _, _ in
            scheduleUITestFocusIfNeeded()
            scheduleUITestAutoSendIfNeeded()
        }
        .alert(L("chat.trixbot.send.failed"), isPresented: localErrorPresented) {
            Button(L("chat.trixbot.ok")) {
                localErrorMessage = nil
            }
        } message: {
            Text(localErrorMessage ?? "")
        }
    }

    // MARK: - Messages

    private var messagesList: some View {
        ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 12) {
                    statusBanner

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
                .padding(.bottom, 20)
            }
            .scrollDismissesKeyboard(.interactively)
            .onAppear {
                scrollToBottom = true
                scheduleUITestFocusIfNeeded()
            }
            .onChange(of: scrollToBottom) { _, shouldScroll in
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
            Image(systemName: clawbotChannel.isPaired ? "message.badge" : "link.badge.plus")
                .font(.system(size: 30))
                .foregroundColor(.brandPurple.opacity(0.7))

            Text(clawbotChannel.isPaired ? L("chat.trixbot.empty.hint") : L("chat.trixbot.action.pair.first"))
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

    private var statusBanner: some View {
        HStack(spacing: 10) {
            Image(systemName: clawbotChannel.isPaired ? "checkmark.seal.fill" : "link.badge.plus")
                .foregroundStyle(clawbotChannel.isPaired ? .green : .orange)

            Text(clawbotChannel.isPaired ? L("chat.trixbot.banner.paired") : L("chat.trixbot.banner.unpaired"))
                .font(.footnote)
                .foregroundStyle(.secondary)

            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.textPrimary.opacity(0.08), lineWidth: 1)
        )
        .uiTestMarker(clawbotChannel.isPaired ? TrixBotAccessibilityIdentifiers.pairedBanner : TrixBotAccessibilityIdentifiers.unpairedBanner)
    }

    // MARK: - Input

    private var inputArea: some View {
        VStack(spacing: 10) {
            if attachedImage != nil || attachedImageURL != nil {
                attachmentPreview
            }

            HStack(alignment: .bottom, spacing: 10) {
                HStack(spacing: 8) {
                    TextField(L("chat.trixbot.input.placeholder"), text: $messageText, axis: .vertical)
                        .textFieldStyle(.plain)
                        .lineLimit(1...6)
                        .submitLabel(.send)
                        .focused($isInputFocused)
                        .disabled(!clawbotChannel.isPaired || isUploadingAttachment || isSendingMessage)
                        .accessibilityIdentifier(TrixBotAccessibilityIdentifiers.inputField)

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
                .padding(.vertical, 12)
                .contentShape(Rectangle())
                .onTapGesture {
                    guard clawbotChannel.isPaired, !isUploadingAttachment, !isSendingMessage else { return }
                    isInputFocused = true
                }
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .stroke(Color.textPrimary.opacity(0.76), lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.05), radius: 10, x: 0, y: 6)

                Button(action: sendMessage) {
                    ZStack {
                        Circle()
                            .fill(
                                canSend
                                ? AnyShapeStyle(
                                    LinearGradient(
                                        colors: [Color.brandPurple, Color.brandPink],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                : AnyShapeStyle(Color(.systemGray4))
                            )
                            .frame(width: 48, height: 48)
                            .shadow(color: canSend ? Color.brandPurple.opacity(0.24) : .clear, radius: 12, x: 0, y: 6)

                        if isSendingMessage || isUploadingAttachment {
                            ButtonLoadingView()
                        } else {
                            Image(systemName: "arrow.up")
                                .font(.headline)
                                .foregroundColor(.white)
                        }
                    }
                }
                .frame(width: 48, height: 48)
                .contentShape(Circle())
                .buttonStyle(.plain)
                .disabled(!canSend)
                .accessibilityLabel(L("chat.trixbot.send"))
                .accessibilityIdentifier(TrixBotAccessibilityIdentifiers.sendButton)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 10)
        .accessibilityElement(children: .contain)
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

    private var uiTestPrefillMessage: String? {
        let info = ProcessInfo.processInfo

        if let inlineArgument = info.arguments.first(where: { $0.hasPrefix("--ui-trixbot-prefill=") }) {
            let value = String(inlineArgument.dropFirst("--ui-trixbot-prefill=".count))
            if !value.isEmpty {
                return value
            }
        }

        if let environmentValue = info.environment["TRIX_TEST_TRIXBOT_MESSAGE"],
           !environmentValue.isEmpty {
            return environmentValue
        }

        return nil
    }

    private var shouldAutoSendUITestMessage: Bool {
        let info = ProcessInfo.processInfo
        return info.arguments.contains("--ui-trixbot-auto-send")
            || info.environment["TRIX_TEST_TRIXBOT_AUTO_SEND"] == "1"
    }

    private var uiTestAutoSendDelayNanoseconds: UInt64 {
        let info = ProcessInfo.processInfo

        if let inlineArgument = info.arguments.first(where: { $0.hasPrefix("--ui-trixbot-auto-send-delay-ms=") }) {
            let value = String(inlineArgument.dropFirst("--ui-trixbot-auto-send-delay-ms=".count))
            if let delayMs = UInt64(value), delayMs > 0 {
                return delayMs * 1_000_000
            }
        }

        if let environmentValue = info.environment["TRIX_TEST_TRIXBOT_AUTO_SEND_DELAY_MS"],
           let delayMs = UInt64(environmentValue),
           delayMs > 0 {
            return delayMs * 1_000_000
        }

        return 600_000_000
    }

    private var shouldAttachUITestImage: Bool {
        let info = ProcessInfo.processInfo
        return info.arguments.contains("--ui-trixbot-attach-image")
            || info.environment["TRIX_TEST_TRIXBOT_ATTACH_IMAGE"] == "1"
    }

    private var isRunningUITests: Bool {
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
    }

    private func applyUITestPrefillIfNeeded() {
        guard !didApplyUITestPrefill,
              let prefill = uiTestPrefillMessage,
              messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return
        }

        didApplyUITestPrefill = true
        messageText = prefill
        NSLog("[TRIX-UI] applied prefill text=%{public}@", prefill)
    }

    private func applyUITestAttachmentIfNeeded() {
        guard shouldAttachUITestImage,
              !didApplyUITestAttachment,
              attachedImage == nil,
              attachedImageURL == nil else {
            return
        }

        didApplyUITestAttachment = true
        attachedImage = makeUITestImage()
        NSLog("[TRIX-UI] applied ui-test attachment")
    }

    private func scheduleUITestAutoSendIfNeeded() {
        guard shouldAutoSendUITestMessage,
              !didAutoSendUITestMessage,
              clawbotChannel.isPaired,
              canSend else {
            return
        }

        didAutoSendUITestMessage = true
        NSLog("[TRIX-UI] scheduling auto-send text=%{public}@", messageText)

        Task { @MainActor in
            try? await Task.sleep(nanoseconds: uiTestAutoSendDelayNanoseconds)
            guard canSend, clawbotChannel.isPaired else { return }
            await sendCurrentComposerMessage(source: "ui-test-auto")
        }
    }

    private func scheduleUITestFocusIfNeeded() {
        guard isRunningUITests,
              clawbotChannel.isPaired,
              !isUploadingAttachment,
              !isSendingMessage else {
            return
        }

        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard clawbotChannel.isPaired, !isUploadingAttachment, !isSendingMessage else { return }
            isInputFocused = true
        }
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
                        ImageLoadingPlaceholder(size: 56)
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
                Text(L("chat.trixbot.image.attached"))
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Text(attachedImageURL == nil ? L("chat.trixbot.upload.on.send") : L("chat.trixbot.uploaded.pending"))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            if isUploadingAttachment {
                TrixLoadingIndicator.uploading()
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
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(TrixBotAccessibilityIdentifiers.attachmentPreview)
    }

    // MARK: - Derived State

    private var canSend: Bool {
        let trimmedText = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        return clawbotChannel.isPaired && (!trimmedText.isEmpty || attachedImage != nil || attachedImageURL != nil) && !isUploadingAttachment && !isSendingMessage
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

    // MARK: - Actions

    private func initializeChatContextIfNeeded() async {
        if !clawbotChannel.isConnected {
            await clawbotChannel.connect()
        }

        scrollToBottom = true
    }

    private func sendMessage() {
        guard canSend else { return }
        Task { @MainActor in
            await sendCurrentComposerMessage(source: "tap")
        }
    }

    @MainActor
    private func sendCurrentComposerMessage(source: String) async {
        guard canSend else { return }
        guard clawbotChannel.isPaired else {
            localErrorMessage = L("chat.trixbot.action.pair.first")
            return
        }

        let trimmedText = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        NSLog("[TRIX-UI] send tapped paired=%{public}@ canSend=%{public}@ text=%{public}@ attachedImage=%{public}@ attachedURL=%{public}@",
              clawbotChannel.isPaired.description,
              canSend.description,
              trimmedText,
              String(attachedImage != nil),
              String(attachedImageURL != nil))
        isInputFocused = false

        isSendingMessage = true
        defer {
            isSendingMessage = false
            scrollToBottom = true
        }

        let mediaURLToSend = attachedImageURL
        var nativeMediaData: Data?
        var nativeMediaFileName: String?
        var nativeMediaMimeType: String?

        if let image = attachedImage {
            nativeMediaData = image.jpegData(compressionQuality: 0.88)
            nativeMediaMimeType = "image/jpeg"
            nativeMediaFileName = "trix-image-\(Int(Date().timeIntervalSince1970)).jpg"
        }

        let contentToSend = trimmedText.isEmpty ? defaultImagePrompt : trimmedText
        let hasMedia = mediaURLToSend != nil || nativeMediaData != nil

        NSLog("[TRIX-UI] native send source=%{public}@ text=%{public}@", source, contentToSend)
        let success = await clawbotChannel.sendMessage(
            contentToSend,
            contentType: hasMedia ? .image : .text,
            mediaUrl: mediaURLToSend,
            mediaMimeType: nativeMediaMimeType ?? (hasMedia ? "image/jpeg" : nil),
            mediaData: nativeMediaData,
            mediaFileName: nativeMediaFileName
        )

        if success {
            NSLog("[TRIX-UI] native send success text=%{public}@", contentToSend)
            clearComposer()
        } else {
            NSLog("[TRIX-UI] native send failed text=%{public}@ error=%{public}@",
                  contentToSend,
                  clawbotChannel.lastError ?? "")
            localErrorMessage = clawbotChannel.lastError ?? L("chat.trixbot.send.failed.message")
        }
    }

    private func clearComposer() {
        messageText = ""
        attachedImage = nil
        attachedImageURL = nil
    }

    private func makeUITestImage() -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 144, height: 144))
        return renderer.image { context in
            let cg = context.cgContext
            let colors = [
                UIColor.systemPurple.cgColor,
                UIColor.systemPink.cgColor,
                UIColor.systemCyan.cgColor
            ] as CFArray
            let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 0.55, 1])!
            cg.drawLinearGradient(
                gradient,
                start: CGPoint(x: 0, y: 0),
                end: CGPoint(x: 144, y: 144),
                options: []
            )

            let insetRect = CGRect(x: 18, y: 18, width: 108, height: 108)
            cg.setFillColor(UIColor.white.withAlphaComponent(0.22).cgColor)
            cg.fillEllipse(in: insetRect)
        }
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
        HStack(alignment: .top, spacing: 8) {
            // 左侧头像 - Bot 消息显示在左边
            if !message.isFromUser {
                avatarView(isBot: true)
            }

            // 消息内容
            VStack(alignment: message.isFromUser ? .trailing : .leading, spacing: 4) {
                // 发送者名称
                Text(message.isFromUser ? "" : L("chat.trixbot.name"))
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.leading, message.isFromUser ? 0 : 4)
                    .padding(.trailing, message.isFromUser ? 4 : 0)

                // 消息气泡
                messageBubble

                // 时间
                HStack(spacing: 4) {
                    Text(formatTime(message.timestamp))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                .padding(.leading, message.isFromUser ? 0 : 4)
                .padding(.trailing, message.isFromUser ? 4 : 0)
            }

            // 右侧头像 - 用户消息显示在右边
            if message.isFromUser {
                avatarView(isBot: false)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 4)
        .accessibilityIdentifier(
            "\(message.isFromUser ? TrixBotAccessibilityIdentifiers.userMessagePrefix : TrixBotAccessibilityIdentifiers.botMessagePrefix).\(message.id)"
        )
    }

    // MARK: - Avatar View
    private func avatarView(isBot: Bool) -> some View {
        ZStack {
            Circle()
                .fill(isBot ? Color.brandPurple.opacity(0.2) : Color.info.opacity(0.2))

            Image(systemName: isBot ? "sparkles" : "person.fill")
                .font(.system(size: 16))
                .foregroundColor(isBot ? .brandPurple : .info)
        }
        .frame(width: 36, height: 36)
    }

    // MARK: - Message Bubble
    @ViewBuilder
    private var messageBubble: some View {
        if let mediaURL = message.mediaURL, let url = URL(string: mediaURL) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .empty:
                    ImageLoadingPlaceholder(size: 180)
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
            .frame(maxWidth: .infinity, alignment: message.isFromUser ? .trailing : .leading)
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
                        : AnyView(Color(.systemGray6))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(message.isFromUser ? Color.white.opacity(0.3) : Color.tertiaryBackground.opacity(0.2), lineWidth: 0.5)
                )
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .shadow(
                    color: message.isFromUser
                        ? Color.brandPurple.opacity(0.25)
                        : Color.black.opacity(0.08),
                    radius: 4,
                    x: 0,
                    y: 2
                )
                .frame(maxWidth: .infinity, alignment: message.isFromUser ? .trailing : .leading)
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
