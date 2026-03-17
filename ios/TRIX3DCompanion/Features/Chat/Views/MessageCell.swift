//
//  MessageCell.swift
//  TRIX3DCompanion
//
//  Message bubble component for chat messages
//

import SwiftUI

// MARK: - Localizable Helper

private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Message Cell

/// Message bubble component displaying a single chat message
struct MessageCell: View {

    // MARK: - Properties

    let message: ChatMessage
    let isCurrentUser: Bool

    // MARK: - Body

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            // 左侧头像 - 对方消息（靠左）
            if !isCurrentUser {
                avatarView
            } else {
                // 占位，保持对齐
                Color.clear.frame(width: 36, height: 36)
            }

            // 消息内容
            VStack(alignment: isCurrentUser ? .trailing : .leading, spacing: 4) {
                // 发送者名称 (仅对方消息显示)
                if !isCurrentUser {
                    Text(avatarUsername)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.leading, 4)
                }

                // 消息气泡
                messageBubble

                // 时间
                timestampView
            }
            .frame(maxWidth: UIScreen.main.bounds.width * 0.7, alignment: isCurrentUser ? .trailing : .leading)

            // 右侧头像 - 自己消息（靠右）
            if isCurrentUser {
                userAvatarView
            } else {
                // 占位，保持对齐
                Color.clear.frame(width: 36, height: 36)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 4)
    }

    // MARK: - View Components

    /// Avatar view for received messages
    private var avatarView: some View {
        AvatarView(
            size: .small,
            username: avatarUsername,
            isOnline: senderIsOnline
        )
    }

    /// User avatar view (right side)
    private var userAvatarView: some View {
        ZStack {
            Circle()
                .fill(Color.blue.opacity(0.2))

            Image(systemName: "person.fill")
                .font(.system(size: 14))
                .foregroundColor(.blue)
        }
        .frame(width: 36, height: 36)
    }

    /// Avatar username derived from sender
    private var avatarUsername: String {
        switch message.sender {
        case .bot:
            return L("chat.sender.ai")
        case .friend:
            return L("chat.sender.friend")
        case .user:
            return L("chat.sender.you")
        }
    }

    /// Whether sender is online (simplified - always false for messages)
    private var senderIsOnline: Bool {
        message.sender == .bot
    }

    /// Message bubble
    @ViewBuilder
    private var messageBubble: some View {
        switch message.messageType {
        case .image:
            ImageMessageView(
                imageURL: message.mediaUrl ?? "",
                isCurrentUser: isCurrentUser
            )
        default:
            textMessageBubble
        }
    }

    /// Text message bubble
    private var textMessageBubble: some View {
        Text(message.content)
            .font(.body)
            .foregroundColor(isCurrentUser ? .white : .primary)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(
                messageBubbleBackground
            )
            .clipShape(
                RoundedRectangle(
                    cornerRadius: 18,
                    style: .continuous
                )
            )
            .overlay(
                messageBubbleBorder
            )
    }

    /// Message bubble background
    @ViewBuilder
    private var messageBubbleBackground: some View {
        if isCurrentUser {
            LinearGradient(
                colors: [.brandPurple, .brandPink],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        } else {
            Color(.systemGray6)
        }
    }

    /// Message bubble border
    @ViewBuilder
    private var messageBubbleBorder: some View {
        if !isCurrentUser {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.gray.opacity(0.2), lineWidth: 0.5)
        } else {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.white.opacity(0.3), lineWidth: 0.5)
        }
    }

    /// Timestamp view
    private var timestampView: some View {
        HStack(spacing: 4) {
            Text(formatTimestamp(message.createdAt))
                .font(.caption2)
                .foregroundColor(.secondary)

            // Read status for sent messages
            if isCurrentUser {
                readStatusIcon
            }
        }
        .padding(.horizontal, 4)
    }

    /// Read status icon
    @ViewBuilder
    private var readStatusIcon: some View {
        if message.isRead {
            Image(systemName: "checkmark.circle.fill")
                .font(.caption2)
                .foregroundColor(.green)
        } else {
            Image(systemName: "checkmark.circle")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }

    // MARK: - Helper Methods

    /// Format timestamp to readable string
    private func formatTimestamp(_ date: Date) -> String {
        let calendar = Calendar.current
        let now = Date()

        // Cached formatters for performance
        struct CachedFormatters {
            static let timeOnly: DateFormatter = {
                let f = DateFormatter()
                f.timeStyle = .short
                return f
            }()
            static let dateOnly: DateFormatter = {
                let f = DateFormatter()
                f.dateStyle = .short
                return f
            }()
        }

        if calendar.isDate(date, inSameDayAs: now) {
            // Today: show time
            return CachedFormatters.timeOnly.string(from: date)
        } else if calendar.isDate(date, inSameDayAs: calendar.date(byAdding: .day, value: -1, to: now)!) {
            // Yesterday
            return L("chat.yesterday")
        } else {
            // Older: show date
            return CachedFormatters.dateOnly.string(from: date)
        }
    }
}

// MARK: - Preview

#Preview("Message Cells") {
    ScrollView {
        VStack(spacing: 16) {
            // User message
            MessageCell(
                message: ChatMessage(
                    id: "1",
                    roomId: "room-1",
                    senderId: "user-1",
                    sender: .user,
                    content: "Hello! This is a message from me.",
                    messageType: .text,
                    mediaUrl: nil,
                    mediaMimeType: nil,
                    mediaDuration: nil,
                    mediaSize: nil,
                    mediaMetadata: nil,
                    voiceUrl: nil,
                    voiceDuration: nil,
                    voiceTranscript: nil,
                    voiceMimeType: nil,
                    isRead: true,
                    createdAt: Date()
                ),
                isCurrentUser: true
            )

            // Friend message
            MessageCell(
                message: ChatMessage(
                    id: "2",
                    roomId: "room-1",
                    senderId: "friend-1",
                    sender: .friend,
                    content: "Hi there! This is a reply message.",
                    messageType: .text,
                    mediaUrl: nil,
                    mediaMimeType: nil,
                    mediaDuration: nil,
                    mediaSize: nil,
                    mediaMetadata: nil,
                    voiceUrl: nil,
                    voiceDuration: nil,
                    voiceTranscript: nil,
                    voiceMimeType: nil,
                    isRead: true,
                    createdAt: Date().addingTimeInterval(-300)
                ),
                isCurrentUser: false
            )

            // Bot message
            MessageCell(
                message: ChatMessage(
                    id: "3",
                    roomId: "room-1",
                    senderId: "bot-1",
                    sender: .bot,
                    content: "I'm Clawbot, your AI assistant! How can I help you today?",
                    messageType: .text,
                    mediaUrl: nil,
                    mediaMimeType: nil,
                    mediaDuration: nil,
                    mediaSize: nil,
                    mediaMetadata: nil,
                    voiceUrl: nil,
                    voiceDuration: nil,
                    voiceTranscript: nil,
                    voiceMimeType: nil,
                    isRead: true,
                    createdAt: Date().addingTimeInterval(-600)
                ),
                isCurrentUser: false
            )

            // Long message
            MessageCell(
                message: ChatMessage(
                    id: "4",
                    roomId: "room-1",
                    senderId: "user-1",
                    sender: .user,
                    content: "This is a much longer message that should wrap to multiple lines. It demonstrates how the message bubble handles longer text content gracefully.",
                    messageType: .text,
                    mediaUrl: nil,
                    mediaMimeType: nil,
                    mediaDuration: nil,
                    mediaSize: nil,
                    mediaMetadata: nil,
                    voiceUrl: nil,
                    voiceDuration: nil,
                    voiceTranscript: nil,
                    voiceMimeType: nil,
                    isRead: false,
                    createdAt: Date().addingTimeInterval(-900)
                ),
                isCurrentUser: true
            )
        }
        .padding()
    }
    .background(Color(.systemGroupedBackground))
}

#Preview("Dark Mode") {
    ScrollView {
        VStack(spacing: 16) {
            MessageCell(
                message: ChatMessage(
                    id: "1",
                    roomId: "room-1",
                    senderId: "user-1",
                    sender: .user,
                    content: "Dark mode message!",
                    messageType: .text,
                    mediaUrl: nil,
                    mediaMimeType: nil,
                    mediaDuration: nil,
                    mediaSize: nil,
                    mediaMetadata: nil,
                    voiceUrl: nil,
                    voiceDuration: nil,
                    voiceTranscript: nil,
                    voiceMimeType: nil,
                    isRead: true,
                    createdAt: Date()
                ),
                isCurrentUser: true
            )

            MessageCell(
                message: ChatMessage(
                    id: "2",
                    roomId: "room-1",
                    senderId: "friend-1",
                    sender: .friend,
                    content: "Reply in dark mode.",
                    messageType: .text,
                    mediaUrl: nil,
                    mediaMimeType: nil,
                    mediaDuration: nil,
                    mediaSize: nil,
                    mediaMetadata: nil,
                    voiceUrl: nil,
                    voiceDuration: nil,
                    voiceTranscript: nil,
                    voiceMimeType: nil,
                    isRead: true,
                    createdAt: Date().addingTimeInterval(-300)
                ),
                isCurrentUser: false
            )
        }
        .padding()
    }
    .background(Color(.systemGroupedBackground))
    .preferredColorScheme(.dark)
}
