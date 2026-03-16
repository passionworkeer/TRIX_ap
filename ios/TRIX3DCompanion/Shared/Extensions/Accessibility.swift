//
//  Accessibility.swift
//  TRIX3DCompanion
//
//  Accessibility helpers and extensions
//

import SwiftUI

// MARK: - Accessibility Labels

/// Standard accessibility labels used throughout the app
enum AccessibilityLabel {
    // Navigation
    static let home = NSLocalizedString("accessibility.home", comment: "Home nav")
    static let chat = NSLocalizedString("accessibility.chat", comment: "Chat nav")
    static let study = NSLocalizedString("accessibility.study", comment: "Study nav")
    static let profile = NSLocalizedString("accessibility.profile", comment: "Profile nav")
    static let settings = NSLocalizedString("accessibility.settings", comment: "Settings nav")

    // Actions
    static let send = NSLocalizedString("accessibility.send", comment: "Send action")
    static let cancel = NSLocalizedString("accessibility.cancel", comment: "Cancel action")
    static let confirm = NSLocalizedString("accessibility.confirm", comment: "Confirm action")
    static let delete = NSLocalizedString("accessibility.delete", comment: "Delete action")
    static let edit = NSLocalizedString("accessibility.edit", comment: "Edit action")
    static let back = NSLocalizedString("accessibility.back", comment: "Back action")
    static let close = NSLocalizedString("accessibility.close", comment: "Close action")
    static let retry = NSLocalizedString("accessibility.retry", comment: "Retry action")
    static let refresh = NSLocalizedString("accessibility.refresh", comment: "Refresh action")

    // Media
    static let takePhoto = NSLocalizedString("accessibility.take.photo", comment: "Take photo")
    static let selectPhoto = NSLocalizedString("accessibility.select.photo", comment: "Select photo")
    static let recordVideo = NSLocalizedString("accessibility.record.video", comment: "Record video")
    static let voiceMessage = NSLocalizedString("accessibility.voice.message", comment: "Voice message")

    // Status
    static let loading = NSLocalizedString("accessibility.loading", comment: "Loading status")
    static let sending = NSLocalizedString("accessibility.sending", comment: "Sending status")
    static let connecting = NSLocalizedString("accessibility.connecting", comment: "Connecting status")
    static let offline = NSLocalizedString("accessibility.offline", comment: "Offline status")
    static let online = NSLocalizedString("accessibility.online", comment: "Online status")

    // Empty states
    static let noMessages = NSLocalizedString("accessibility.no.messages", comment: "No messages")
    static let noFriends = NSLocalizedString("accessibility.no.friends", comment: "No friends")
    static let noStudySessions = NSLocalizedString("accessibility.no.study.sessions", comment: "No study sessions")
    static let noNotifications = NSLocalizedString("accessibility.no.notifications", comment: "No notifications")
    static let noPoints = NSLocalizedString("accessibility.no.points", comment: "No points")

    // Errors
    static let networkError = NSLocalizedString("accessibility.network.error", comment: "Network error")
    static let serverError = NSLocalizedString("accessibility.server.error", comment: "Server error")
    static let permissionDenied = NSLocalizedString("accessibility.permission.denied", comment: "Permission denied")
}

// MARK: - Accessibility Traits

extension View {

    /// Add accessibility label and traits
    /// - Parameters:
    ///   - label: Accessibility label
    ///   - traits: Accessibility traits
    /// - Returns: Modified view
    func accessible(
        _ label: String,
        traits: AccessibilityTraits = [],
        hint: String? = nil
    ) -> some View {
        self.accessibilityElement()
            .accessibilityLabel(label)
            .accessibilityAddTraits(traits)
            .accessibilityHint(hint ?? "")
    }

    /// Add heading accessibility
    @ViewBuilder
    func accessibleHeading(_ level: HeadingLevel = .level2) -> some View {
        if #available(iOS 17.0, *) {
            self.accessibilityAddTraits(.isHeader)
                .accessibilityHeading(AccessibilityHeadingLevel(level))
        } else {
            self.accessibilityAddTraits(.isHeader)
        }
    }

    /// Remove accessibility from element
    func inaccessible() -> some View {
        self.accessibilityHidden(true)
    }
}

// MARK: - Heading Level

enum HeadingLevel {
    case level1
    case level2
    case level3
    case level4
    case level5
    case level6
}

// MARK: - AccessibilityHeadingLevel Conversion

@available(iOS 17.0, *)
extension AccessibilityHeadingLevel {
    init(_ level: HeadingLevel) {
        switch level {
        case .level1:
            self = .h1
        case .level2:
            self = .h2
        case .level3:
            self = .h3
        case .level4:
            self = .h4
        case .level5:
            self = .h5
        case .level6:
            self = .h6
        }
    }
}

// MARK: - Dynamic Type Support

/// Typography that scales with Dynamic Type
enum ScaledTypography {
    static let largeTitle = Font.largeTitle
    static let title = Font.title
    static let title2 = Font.title2
    static let title3 = Font.title3
    static let headline = Font.headline
    static let body = Font.body
    static let callout = Font.callout
    static let subheadline = Font.subheadline
    static let footnote = Font.footnote
    static let caption = Font.caption
    static let caption2 = Font.caption2

    /// Text style for scalable text
    enum TextStyle {
        case largeTitle
        case title
        case title2
        case title3
        case headline
        case body
        case callout
        case subheadline
        case footnote
        case caption
    }
}

/// View modifier for Dynamic Type support
struct ScalableText: ViewModifier {
    var style: ScaledTypography.TextStyle

    func body(content: Content) -> some View {
        switch style {
        case .largeTitle:
            content.font(.largeTitle)
        case .title:
            content.font(.title)
        case .title2:
            content.font(.title2)
        case .title3:
            content.font(.title3)
        case .headline:
            content.font(.headline)
        case .body:
            content.font(.body)
        case .callout:
            content.font(.callout)
        case .subheadline:
            content.font(.subheadline)
        case .footnote:
            content.font(.footnote)
        case .caption:
            content.font(.caption)
        }
    }
}

extension View {

    /// Apply scalable text style
    func scalable(_ style: ScaledTypography.TextStyle) -> some View {
        self.modifier(ScalableText(style: style))
    }
}

// MARK: - Accessibility Notifications Helper

enum AccessibilityHelper {
    /// Announce important changes to VoiceOver
    static func announce(_ message: String) {
        UIAccessibility.post(notification: .announcement, argument: message)
    }

    /// Announce loading state
    static func announceLoading() {
        announce(AccessibilityLabel.loading)
    }

    /// Announce success
    static func announceSuccess(_ message: String = "成功") {
        announce(message)
    }

    /// Announce error
    static func announceError(_ message: String = "错误") {
        announce(message)
    }
}

// MARK: - Focus Management

extension View {

    /// Move focus to this element
    func focusOnAppear() -> some View {
        self.onAppear {
            #if os(iOS)
            UIAccessibility.post(notification: .layoutChanged, argument: nil)
            #endif
        }
    }
}

// MARK: - Previews

#Preview("Accessibility") {
    VStack(spacing: 20) {
        Text("标题")
            .font(.largeTitle)
            .accessibleHeading(.level1)

        Text("副标题")
            .font(.title2)
            .accessibleHeading(.level2)

        Button(action: {}) {
            Label("发送消息", systemImage: "paperplane.fill")
        }
        .accessible(AccessibilityLabel.send, traits: .isButton)

        Text("这是正文内容")
            .font(.body)
            .scalable(.body)
    }
    .padding()
}
