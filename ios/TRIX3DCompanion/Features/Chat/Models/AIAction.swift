//
//  AIAction.swift
//  TRIX3DCompanion
//
//  AI Action types and prefixes matching Web functionality
//

import Foundation

/// AI Action types matching the Web implementation
enum AIActionType: String, CaseIterable, Identifiable {
    case chat = "chat"
    case doc = "doc"
    case slide = "slide"
    case table = "table"
    case image = "image"
    case video = "video"

    var id: String { rawValue }

    /// Display label for the action
    var label: String {
        switch self {
        case .chat: return NSLocalizedString("ai.action.chat", comment: "AI Chat")
        case .doc: return NSLocalizedString("ai.action.doc", comment: "AI Doc")
        case .slide: return NSLocalizedString("ai.action.slide", comment: "AI Slides")
        case .table: return NSLocalizedString("ai.action.table", comment: "AI Table")
        case .image: return NSLocalizedString("ai.action.image", comment: "AI Image")
        case .video: return NSLocalizedString("ai.action.video", comment: "AI Video")
        }
    }

    /// SF Symbol icon name
    var iconName: String {
        switch self {
        case .chat: return "sparkles"
        case .doc: return "doc.text"
        case .slide: return "rectangle.split.3x1"
        case .table: return "tablecells"
        case .image: return "photo"
        case .video: return "video"
        }
    }

    /// Gradient colors for the icon background
    var iconGradientColors: [String] {
        switch self {
        case .chat: return ["#3B82F6", "#6366F1"]      // Blue to Indigo
        case .doc: return ["#06B6D4", "#2563EB"]        // Cyan to Blue
        case .slide: return ["#8B5CF6", "#A855F7"]      // Violet to Purple
        case .table: return ["#10B981", "#059669"]      // Emerald to Green
        case .image: return ["#D946EF", "#EC4899"]      // Fuchsia to Pink
        case .video: return ["#F97316", "#F59E0B"]      // Orange to Amber
        }
    }

    /// Prefix to prepend when this action is selected
    var prefix: String {
        switch self {
        case .chat: return ""
        case .doc: return "@AI_DOC 请帮我创建文档："
        case .slide: return "@AI_SLIDE 请帮我创建幻灯片："
        case .table: return "@AI_TABLE 请帮我创建表格："
        case .image: return "@AI_IMAGE 请帮我生成图片："
        case .video: return "@AI_VIDEO 请帮我生成视频："
        }
    }
}

/// Helper to apply AI action prefix to text
func applyAIActionPrefix(_ text: String, action: AIActionType) -> String {
    let prefix = action.prefix
    let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)

    if prefix.isEmpty {
        return trimmedText
    }

    if trimmedText.isEmpty {
        return prefix
    }

    return "\(prefix)\n\(trimmedText)"
}

/// Helper to detect AI action from input text
func detectAIActionFromInput(_ text: String) -> AIActionType {
    let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)

    for action in AIActionType.allCases {
        if action == .chat { continue } // Skip chat as default
        if trimmedText.hasPrefix(action.prefix) {
            return action
        }
    }

    return .chat
}
