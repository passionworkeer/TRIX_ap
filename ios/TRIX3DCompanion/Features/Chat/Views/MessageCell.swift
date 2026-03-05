//
//  MessageCell.swift
//  TRIX3DCompanion
//
//  Message bubble component for chat messages
//

import SwiftUI

// MARK: - Message Cell

/// Message bubble component displaying a single chat message
struct MessageCell: View {

    // MARK: - Properties

    let message: ChatMessage
    let isCurrentUser: Bool

    // MARK: - Body

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            // Avatar for received messages
            if !isCurrentUser {
                avatarView
            }

            // Message content
            VStack(alignment: isCurrentUser ? .trailing : .leading, spacing: 4) {
                // Message bubble
                messageBubble

                // Timestamp
                timestampView
            }

            // Spacer for alignment
            if isCurrentUser {
                Spacer(minLength: 60)
            } else {
                Spacer()
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 4)
    }

    // MARK: - View Components

    /// Avatar view for received messages - using AvatarView component
    private var avatarView: some View {
        AvatarView(
            size: .small,
            username: avatarUsername,
            isOnline: senderIsOnline
        )
    }

    /// Avatar username derived from sender
    private var avatarUsername: String {
        switch message.sender {
        case .bot:
            return "AI"
        case .friend:
            return "Friend"
        case .user:
            return "You"
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
                .stroke(Color.separator.opacity(0.5), lineWidth: 0.5)
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

        if calendar.isDate(date, inSameDayAs: now) {
            // Today: show time
            let formatter = DateFormatter()
            formatter.timeStyle = .short
            return formatter.string(from: date)
        } else if calendar.isDate(date, inSameDayAs: calendar.date(byAdding: .day, value: -1, to: now)!) {
            // Yesterday
            return "Yesterday"
        } else {
            // Older: show date
            let formatter = DateFormatter()
            formatter.dateStyle = .short
            return formatter.string(from: date)
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
                    type: .text,
                    mediaUrl: nil,
                    mediaMimeType: nil,
                    mediaDuration: nil,
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
                    type: .text,
                    mediaUrl: nil,
                    mediaMimeType: nil,
                    mediaDuration: nil,
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
                    type: .text,
                    mediaUrl: nil,
                    mediaMimeType: nil,
                    mediaDuration: nil,
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
                    type: .text,
                    mediaUrl: nil,
                    mediaMimeType: nil,
                    mediaDuration: nil,
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
                    type: .text,
                    mediaUrl: nil,
                    mediaMimeType: nil,
                    mediaDuration: nil,
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
                    type: .text,
                    mediaUrl: nil,
                    mediaMimeType: nil,
                    mediaDuration: nil,
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
