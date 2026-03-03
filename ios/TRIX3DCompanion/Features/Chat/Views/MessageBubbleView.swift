//
//  MessageBubbleView.swift
//  TRIX3DCompanion
//
//  Message bubble component for chat
//  Supports text, image, video, file, and voice message types
//

import SwiftUI

// MARK: - Message Bubble View

/// Chat message bubble with different styles for sent/received messages
struct MessageBubbleView: View {

    // MARK: - Properties

    let message: ChatMessage
    let isFromCurrentUser: Bool
    let showAvatar: Bool
    let showTimestamp: Bool

    // MARK: - Environment

    @Environment(\.colorScheme) private var colorScheme

    // MARK: - Body

    var body: some View {
        HStack(alignment: .bottom, spacing: 4) {
            if !isFromCurrentUser && showAvatar {
                avatarView
            }

            VStack(alignment: isFromCurrentUser ? .trailing : .leading, spacing: 4) {
                messageContent
                    .applyMessageBubbleStyle(
                        isFromCurrentUser: isFromCurrentUser,
                        colorScheme: colorScheme
                    )

                if showTimestamp {
                    timestampView
                }
            }

            if isFromCurrentUser && showAvatar {
                avatarView
            }
        }
    }

    // MARK: - Message Content

    @ViewBuilder
    private var messageContent: some View {
        switch message.type {
        case .text:
            textMessageView
        case .image:
            imageMessageView
        case .video:
            videoMessageView
        case .voice:
            voiceMessageView
        case .file:
            fileMessageView
        }
    }

    // MARK: - Text Message

    private var textMessageView: some View {
        Text(message.content)
            .font(.body)
            .foregroundColor(isFromCurrentUser ? .white : .primary)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
    }

    // MARK: - Image Message

    private var imageMessageView: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let mediaUrl = message.mediaUrl {
                AsyncImage(url: URL(string: mediaUrl)) { phase in
                    switch phase {
                    case .empty:
                        placeholderView
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(maxWidth: 250)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    case .failure:
                        failureView
                    @unknown default:
                        placeholderView
                    }
                }
            } else {
                placeholderView
            }

            if !message.content.isEmpty {
                Text(message.content)
                    .font(.caption)
                    .foregroundColor(isFromCurrentUser ? .white.opacity(0.9) : .secondary)
                    .padding(.horizontal, 12)
                    .padding(.bottom, 8)
            }
        }
        .background(messageBackgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Video Message

    private var videoMessageView: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let mediaUrl = message.mediaUrl {
                VideoThumbnailView(url: mediaUrl, duration: message.mediaDuration.map { Double($0) })
                    .frame(maxWidth: 250)
            } else {
                placeholderView
            }

            if !message.content.isEmpty {
                Text(message.content)
                    .font(.caption)
                    .foregroundColor(isFromCurrentUser ? .white.opacity(0.9) : .secondary)
                    .padding(.horizontal, 12)
                    .padding(.bottom, 8)
            }
        }
        .background(messageBackgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Voice Message

    private var voiceMessageView: some View {
        HStack(spacing: 12) {
            Image(systemName: "waveform")
                .font(.title3)
                .foregroundColor(isFromCurrentUser ? .white.opacity(0.8) : .purple)

            // Waveform visualization
            HStack(spacing: 2) {
                ForEach(0..<20) { index in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(isFromCurrentUser ? .white.opacity(0.6) : .purple.opacity(0.6))
                        .frame(width: 3, height: CGFloat.random(in: 8...20))
                }
            }

            if let duration = message.mediaDuration {
                Text(formatDuration(Double(duration)))
                    .font(.caption)
                    .foregroundColor(isFromCurrentUser ? .white.opacity(0.8) : .secondary)
            }

            Image(systemName: "play.fill")
                .font(.caption)
                .foregroundColor(isFromCurrentUser ? .white : .purple)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(messageBackgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - File Message

    private var fileMessageView: some View {
        HStack(spacing: 12) {
            fileIconView

            VStack(alignment: .leading, spacing: 2) {
                Text(fileName)
                    .font(.subheadline)
                    .foregroundColor(isFromCurrentUser ? .white : .primary)
                    .lineLimit(1)

                if let fileSize = fileSize {
                    Text(formatFileSize(fileSize))
                        .font(.caption2)
                        .foregroundColor(isFromCurrentUser ? .white.opacity(0.7) : .secondary)
                }
            }

            Spacer()

            Image(systemName: "doc.fill")
                .font(.title3)
                .foregroundColor(isFromCurrentUser ? .white.opacity(0.7) : .purple)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(messageBackgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Supporting Views

    private var avatarView: some View {
        Circle()
            .fill(isFromCurrentUser ? Color.blue : Color.purple)
            .frame(width: 32, height: 32)
            .overlay {
                Text(String(message.senderId.prefix(1)))
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
            }
    }

    private var timestampView: some View {
        Text(formatTimestamp(message.createdAt))
            .font(.caption2)
            .foregroundColor(.secondary)
            .padding(.horizontal, 4)
    }

    private var messageBackgroundColor: Color {
        isFromCurrentUser ? bubbleColorSent : bubbleColorReceived
    }

    private var bubbleColorSent: Color {
        Color(
            red: 0.3,
            green: 0.2,
            blue: 0.8
        )
    }

    private var bubbleColorReceived: Color {
        colorScheme == .dark ? Color(white: 0.15) : Color.white
    }

    // MARK: - File Properties

    private var fileName: String {
        message.content.isEmpty ? "File" : message.content
    }

    private var fileSize: Int? {
        // Extract from message if available
        return nil
    }

    private var fileIconView: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(isFromCurrentUser ? Color.white.opacity(0.2) : Color.purple.opacity(0.1))
                .frame(width: 40, height: 40)

            Image(systemName: "doc.fill")
                .font(.title3)
                .foregroundColor(isFromCurrentUser ? .white : .purple)
        }
    }

    // MARK: - Placeholder Views

    private var placeholderView: some View {
        RoundedRectangle(cornerRadius: 12)
            .fill(Color.gray.opacity(0.3))
            .frame(width: 200, height: 150)
            .overlay {
                ProgressView()
            }
    }

    private var failureView: some View {
        RoundedRectangle(cornerRadius: 12)
            .fill(Color.gray.opacity(0.3))
            .frame(width: 200, height: 150)
            .overlay {
                VStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                    Text("Failed to load")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
    }

    // MARK: - Formatting

    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private func formatDuration(_ seconds: Double) -> String {
        let minutes = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", minutes, secs)
    }

    private func formatFileSize(_ bytes: Int) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB]
        return formatter.string(fromByteCount: Int64(bytes))
    }
}

// MARK: - Video Thumbnail View

/// Thumbnail view for video messages
struct VideoThumbnailView: View {
    let url: String
    let duration: Double?

    var body: some View {
        ZStack {
            AsyncImage(url: URL(string: url)) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                default:
                    Rectangle()
                        .fill(Color.gray.opacity(0.3))
                }
            }

            // Play button overlay
            Circle()
                .fill(.black.opacity(0.5))
                .frame(width: 50, height: 50)
                .overlay {
                    Image(systemName: "play.fill")
                        .font(.title2)
                        .foregroundColor(.white)
                }

            // Duration badge
            if let duration = duration {
                HStack {
                    Spacer()
                    VStack {
                        Spacer()
                        Text(formatDuration(duration))
                            .font(.caption2)
                            .foregroundColor(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(.black.opacity(0.7))
                            .clipShape(Capsule())
                            .padding(8)
                    }
                }
            }
        }
        .aspectRatio(16/9, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func formatDuration(_ seconds: Double) -> String {
        let minutes = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", minutes, secs)
    }
}

// MARK: - View Modifier for Bubble Style

extension View {
    func applyMessageBubbleStyle(isFromCurrentUser: Bool, colorScheme: ColorScheme) -> some View {
        self
            .background(
                Group {
                    if isFromCurrentUser {
                        LinearGradient(
                            colors: [Color.purple, Color.blue],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    } else {
                        colorScheme == .dark ? Color(white: 0.15) : Color.white
                    }
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: 18))
            .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
    }
}

// MARK: - Preview

#Preview("Message Bubbles") {
    VStack(spacing: 16) {
        MessageBubbleView(
            message: ChatMessage(
                id: "1",
                roomId: "room1",
                senderId: "user1",
                sender: .user,
                content: "Hey, how are you?",
                type: .text,
                mediaUrl: nil,
                mediaMimeType: nil,
                mediaDuration: nil,
                isRead: true,
                createdAt: Date()
            ),
            isFromCurrentUser: false,
            showAvatar: true,
            showTimestamp: false
        )

        MessageBubbleView(
            message: ChatMessage(
                id: "2",
                roomId: "room1",
                senderId: "user2",
                sender: .user,
                content: "I'm doing great! Check out this photo",
                type: .text,
                mediaUrl: nil,
                mediaMimeType: nil,
                mediaDuration: nil,
                isRead: true,
                createdAt: Date()
            ),
            isFromCurrentUser: true,
            showAvatar: true,
            showTimestamp: false
        )

        MessageBubbleView(
            message: ChatMessage(
                id: "3",
                roomId: "room1",
                senderId: "user1",
                sender: .user,
                content: "",
                type: .voice,
                mediaUrl: nil,
                mediaMimeType: nil,
                mediaDuration: 32,
                isRead: true,
                createdAt: Date()
            ),
            isFromCurrentUser: false,
            showAvatar: true,
            showTimestamp: false
        )

        MessageBubbleView(
            message: ChatMessage(
                id: "4",
                roomId: "room1",
                senderId: "user2",
                sender: .user,
                content: "Report.pdf",
                type: .file,
                mediaUrl: nil,
                mediaMimeType: "application/pdf",
                mediaDuration: nil,
                isRead: true,
                createdAt: Date()
            ),
            isFromCurrentUser: true,
            showAvatar: true,
            showTimestamp: false
        )
    }
    .padding()
    .background(Color.gray.opacity(0.1))
}
