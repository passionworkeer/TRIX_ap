//
//  UnreadBadge.swift
//  TRIX3DCompanion
//
//  Unread message badge component
//  Shows count with different visual styles
//

import SwiftUI

// MARK: - Unread Badge

/// Badge showing unread message count
struct UnreadBadge: View {

    // MARK: - Properties

    let count: Int
    let style: BadgeStyle

    /// Maximum count to display (shows "99+" for larger)
    var maxDisplay: Int {
        switch style {
        case .compact:
            return 9
        case .standard:
            return 99
        case .large:
            return 999
        }
    }

    // MARK: - Computed Properties

    private var displayText: String {
        if count > maxDisplay {
            return "\(maxDisplay)+"
        }
        return "\(count)"
    }

    private var shouldShow: Bool {
        count > 0
    }

    private var badgeColor: Color {
        switch style {
        case .compact, .standard:
            return .red
        case .large:
            return .purple
        }
    }

    // MARK: - Body

    @ViewBuilder
    var body: some View {
        if shouldShow {
            Text(displayText)
                .font(fontForStyle)
                .fontWeight(.bold)
                .foregroundColor(.white)
                .padding(.horizontal, horizontalPadding)
                .padding(.vertical, verticalPadding)
                .background(badgeColor)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(style == .large ? Color.white.opacity(0.3) : Color.clear, lineWidth: 1)
                )
        }
    }

    // MARK: - Style Properties

    private var fontForStyle: Font {
        switch style {
        case .compact:
            return .caption2
        case .standard:
            return .caption
        case .large:
            return .subheadline
        }
    }

    private var horizontalPadding: CGFloat {
        switch style {
        case .compact:
            return 4
        case .standard:
            return 6
        case .large:
            return 8
        }
    }

    private var verticalPadding: CGFloat {
        switch style {
        case .compact:
            return 2
        case .standard:
            return 3
        case .large:
            return 4
        }
    }

    // MARK: - Badge Style

    enum BadgeStyle {
        case compact
        case standard
        case large
    }
}

// MARK: - Convenience Initializers

extension UnreadBadge {

    /// Create a compact unread badge
    static func compact(_ count: Int) -> UnreadBadge {
        UnreadBadge(count: count, style: .compact)
    }

    /// Create a standard unread badge
    static func standard(_ count: Int) -> UnreadBadge {
        UnreadBadge(count: count, style: .standard)
    }

    /// Create a large unread badge
    static func large(_ count: Int) -> UnreadBadge {
        UnreadBadge(count: count, style: .large)
    }
}

// MARK: - Icon with Badge

/// View combining an icon with an unread badge overlay
struct IconWithBadge: View {
    let icon: String
    let badgeCount: Int
    let iconColor: Color

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(iconColor)

            if badgeCount > 0 {
                UnreadBadge.compact(badgeCount)
                    .offset(x: 8, y: -8)
            }
        }
    }
}

// MARK: - Tab Bar Item with Badge

/// Tab bar item with unread badge
struct TabItemWithBadge: View {
    let title: String
    let icon: String
    let badgeCount: Int

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                Image(systemName: icon)
                    .font(.system(size: 20))

                if badgeCount > 0 {
                    UnreadBadge.compact(badgeCount)
                        .offset(x: 12, y: -8)
                }
            }

            Text(title)
                .font(.caption2)
        }
    }
}

// MARK: - Preview

#Preview("Unread Badges") {
    VStack(spacing: 30) {
        // Compact style
        HStack(spacing: 20) {
            UnreadBadge.compact(1)
            UnreadBadge.compact(5)
            UnreadBadge.compact(9)
            UnreadBadge.compact(15)
        }

        // Standard style
        HStack(spacing: 20) {
            UnreadBadge.standard(1)
            UnreadBadge.standard(10)
            UnreadBadge.standard(50)
            UnreadBadge.standard(99)
            UnreadBadge.standard(150)
        }

        // Large style
        HStack(spacing: 20) {
            UnreadBadge.large(1)
            UnreadBadge.large(100)
            UnreadBadge.large(500)
            UnreadBadge.large(999)
            UnreadBadge.large(1500)
        }

        // Zero count (hidden)
        HStack(spacing: 20) {
            UnreadBadge.compact(0)
            UnreadBadge.standard(0)
            UnreadBadge.large(0)
        }
    }
    .padding()
    .background(Color.tertiaryBackground.opacity(0.1))
}

#Preview("Icon with Badge") {
    HStack(spacing: 30) {
        IconWithBadge(icon: "message.fill", badgeCount: 3, iconColor: .info)
        IconWithBadge(icon: "bell.fill", badgeCount: 12, iconColor: .red)
        IconWithBadge(icon: "heart.fill", badgeCount: 0, iconColor: .pink)
        IconWithBadge(icon: "mail.fill", badgeCount: 99, iconColor: .purple)
    }
    .padding()
    .background(Color.tertiaryBackground.opacity(0.1))
}

#Preview("Tab Items with Badges") {
    HStack(spacing: 40) {
        TabItemWithBadge(title: "聊天", icon: "message.fill", badgeCount: 5)
        TabItemWithBadge(title: "通知", icon: "bell.fill", badgeCount: 12)
        TabItemWithBadge(title: "我的", icon: "person.fill", badgeCount: 0)
    }
    .padding()
    .background(Color.tertiaryBackground.opacity(0.1))
}

#Preview("Chat List Row with Badge") {
    VStack(spacing: 0) {
        HStack(spacing: 12) {
            // Avatar
            Circle()
                .fill(.info)
                .frame(width: 50, height: 50)
                .overlay {
                    Text("M")
                        .foregroundColor(.white)
                        .font(.title3)
                }
                .accessibilityLabel("Math Study Group 头像")

            // Content
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Math Study Group")
                        .font(.headline)
                    Spacer()
                    Text("2m ago")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                HStack {
                    Text("Let's meet at 3pm")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(1)

                    Spacer()

                    UnreadBadge.standard(3)
                }
            }
        }
        .padding()

        Divider()
            .padding(.leading, 72)

        HStack(spacing: 12) {
            Circle()
                .fill(.purple)
                .frame(width: 50, height: 50)
                .overlay {
                    Text("P")
                        .foregroundColor(.white)
                        .font(.title3)
                }
                .accessibilityLabel("Physics Discussion 头像")

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Physics Discussion")
                        .font(.headline)
                    Spacer()
                    Text("1h ago")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                HStack {
                    Text("Check out this formula")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(1)

                    Spacer()

                    EmptyView()
                }
            }
        }
        .padding()

        Divider()
            .padding(.leading, 72)
    }
    .background(.ultraThinMaterial)
}
