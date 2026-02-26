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
    static let home = "首页"
    static let chat = "聊天"
    static let study = "学习"
    static let profile = "我的"
    static let settings = "设置"

    // Actions
    static let send = "发送"
    static let cancel = "取消"
    static let confirm = "确认"
    static let delete = "删除"
    static let edit = "编辑"
    static let back = "返回"
    static let close = "关闭"
    static let retry = "重试"
    static let refresh = "刷新"

    // Media
    static let takePhoto = "拍照"
    static let selectPhoto = "选择照片"
    static let recordVideo = "录制视频"
    static let voiceMessage = "语音消息"

    // Status
    static let loading = "加载中"
    static let sending = "发送中"
    static let connecting = "连接中"
    static let offline = "离线"
    static let online = "在线"

    // Empty states
    static let noMessages = "暂无消息"
    static let noFriends = "暂无好友"
    static let noStudySessions = "暂无学习记录"
    static let noNotifications = "暂无通知"
    static let noPoints = "暂无积分"

    // Errors
    static let networkError = "网络错误"
    static let serverError = "服务器错误"
    static let permissionDenied = "权限被拒绝"
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
        traits: AccessibilityTraits = .none,
        hint: String? = nil
    ) -> some View {
        self.accessibilityElement()
            .accessibilityLabel(label)
            .accessibilityAddTraits(traits)
            .accessibilityHint(hint ?? "")
    }

    /// Add heading accessibility
    func accessibleHeading(_ level: HeadingLevel = .level2) -> some View {
        self.accessibilityAddTraits(.isHeader)
            .accessibilityHeading(level)
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
}

/// View modifier for Dynamic Type support
struct ScalableText: ViewModifier {
    var style: TextStyle

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
        self.modifier(ScalableText(style: TextStyle(from: style)))
    }
}

private extension ScaledText.TextStyle {
    init(from scaledStyle: ScaledTypography.TextStyle) {
        switch scaledStyle {
        case .largeTitle:
            self = .largeTitle
        case .title:
            self = .title
        case .title2:
            self = .title2
        case .title3:
            self = .title3
        case .headline:
            self = .headline
        case .body:
            self = .body
        case .callout:
            self = .callout
        case .subheadline:
            self = .subheadline
        case .footnote:
            self = .footnote
        case .caption:
            self = .caption
        }
    }
}

// MARK: - Accessibility Notifications

extension AccessibilityNotification {
    /// Announce important changes to VoiceOver
    static func announce(_ message: String) {
        AccessibilityNotification.announcement(message).post()
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
        .accessible(AccessibilityLabel.send, traits: .button)

        Text("这是正文内容")
            .font(.body)
            .scalable(.body)
    }
    .padding()
}
