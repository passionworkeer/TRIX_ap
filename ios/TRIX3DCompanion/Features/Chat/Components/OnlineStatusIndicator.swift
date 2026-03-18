//
//  OnlineStatusIndicator.swift
//  TRIX3DCompanion
//
//  Online status indicator component for chat
//  Shows online/offline/away/busy status with visual indicators
//

import SwiftUI

// MARK: - FriendStatus Extension

extension FriendStatus {
    /// Color for the status indicator
    var color: Color {
        switch self {
        case .online:
            return .success
        case .offline:
            return .gray
        case .away:
            return .warning
        case .busy:
            return .error
        }
    }

    /// Whether the indicator should be filled
    var isFilled: Bool {
        switch self {
        case .online, .away, .busy:
            return true
        case .offline:
            return false
        }
    }

    /// Display name for the status
    var displayName: String {
        switch self {
        case .online:
            return NSLocalizedString("chat.status.online", comment: "Online status")
        case .offline:
            return NSLocalizedString("chat.status.offline", comment: "Offline status")
        case .away:
            return NSLocalizedString("chat.status.away", comment: "Away status")
        case .busy:
            return NSLocalizedString("chat.status.busy", comment: "Busy status")
        }
    }
}

// MARK: - Online Status Indicator

/// Visual indicator showing online/offline status
struct OnlineStatusIndicator: View {

    // MARK: - Properties

    let status: FriendStatus
    let size: CGFloat

    /// Border width for the indicator
    var borderWidth: CGFloat {
        max(1.5, size / 10)
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            // Outer glow for online users
            if status == .online {
                Circle()
                    .fill(Color.success.opacity(0.3))
                    .frame(width: size + 6, height: size + 6)
                    .blur(radius: 2)
            }

            // Main indicator circle
            Circle()
                .fill(status.isFilled ? status.color : Color.clear)
                .frame(width: size, height: size)
                .overlay(statusBorder)
                .animation(.easeInOut(duration: 0.2), value: status)
        }
    }

    // MARK: - Border

    private var statusBorder: some View {
        Circle()
            .stroke(Color.white, lineWidth: borderWidth)
    }
}

// MARK: - Convenience Factory Methods

extension OnlineStatusIndicator {

    /// Create a standard size indicator
    static func standard(status: FriendStatus) -> OnlineStatusIndicator {
        OnlineStatusIndicator(status: status, size: 14)
    }

    /// Create a small indicator
    static func small(status: FriendStatus) -> OnlineStatusIndicator {
        OnlineStatusIndicator(status: status, size: 10)
    }

    /// Create a large indicator
    static func large(status: FriendStatus) -> OnlineStatusIndicator {
        OnlineStatusIndicator(status: status, size: 18)
    }
}

// MARK: - Status Badge View

/// A view showing status with text label
struct StatusBadgeView: View {
    let status: FriendStatus

    var body: some View {
        HStack(spacing: 6) {
            OnlineStatusIndicator(status: status, size: 10)
            Text(status.displayName)
                .font(.caption)
                .foregroundColor(status.color)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(status.color.opacity(0.15))
        .clipShape(Capsule())
    }
}

// MARK: - Avatar with Status Indicator

/// Avatar view with online status indicator
struct AvatarWithStatusView: View {
    let avatarText: String
    let avatarColor: Color
    let status: FriendStatus
    let size: CGFloat

    init(
        avatarText: String,
        avatarColor: Color,
        status: FriendStatus,
        size: CGFloat = 50
    ) {
        self.avatarText = avatarText
        self.avatarColor = avatarColor
        self.status = status
        self.size = size
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            // Avatar
            Circle()
                .fill(
                    LinearGradient(
                        colors: [avatarColor, avatarColor.opacity(0.7)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: size, height: size)
                .overlay {
                    Text(avatarText)
                        .font(.system(size: size * 0.4))
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                }

            // Status indicator
            OnlineStatusIndicator(status: status, size: size * 0.28)
                .offset(x: size * 0.05, y: size * 0.05)
        }
    }
}

// MARK: - Preview

#Preview("Online Status Indicators") {
    VStack(spacing: 20) {
        HStack(spacing: 20) {
            OnlineStatusIndicator(status: .online, size: 14)
            OnlineStatusIndicator(status: .offline, size: 14)
            OnlineStatusIndicator(status: .away, size: 14)
            OnlineStatusIndicator(status: .busy, size: 14)
        }

        HStack(spacing: 20) {
            OnlineStatusIndicator.small(status: .online)
            OnlineStatusIndicator.small(status: .offline)
            OnlineStatusIndicator.small(status: .away)
            OnlineStatusIndicator.small(status: .busy)
        }

        HStack(spacing: 20) {
            StatusBadgeView(status: .online)
            StatusBadgeView(status: .offline)
            StatusBadgeView(status: .away)
            StatusBadgeView(status: .busy)
        }

        HStack(spacing: 20) {
            AvatarWithStatusView(
                avatarText: "JD",
                avatarColor: .info,
                status: .online
            )

            AvatarWithStatusView(
                avatarText: "SC",
                avatarColor: .purple,
                status: .away
            )

            AvatarWithStatusView(
                avatarText: "MJ",
                avatarColor: .green,
                status: .offline
            )
        }
    }
    .padding()
    .background(Color.tertiaryBackground.opacity(0.1))
}

#Preview("Avatar with Status") {
    VStack(spacing: 20) {
        AvatarWithStatusView(
            avatarText: "TR",
            avatarColor: .purple,
            status: .online,
            size: 60
        )

        AvatarWithStatusView(
            avatarText: "AL",
            avatarColor: .info,
            status: .busy,
            size: 50
        )

        AvatarWithStatusView(
            avatarText: "KW",
            avatarColor: .pink,
            status: .away,
            size: 40
        )
    }
    .padding()
    .background(Color.tertiaryBackground.opacity(0.1))
}
