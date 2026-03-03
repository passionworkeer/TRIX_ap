//
//  ChatModels.swift
//  TRIX3DCompanion
//
//  Shared chat models
//

import SwiftUI
import Foundation

// MARK: - Chat Conversation

/// Chat conversation model
struct ChatConversation: Identifiable, Equatable {
    let id: String
    let name: String
    let lastMessage: String
    let time: String
    let unreadCount: Int
    let avatarColor: Color
    let isOnline: Bool
}

// MARK: - Recommended User

/// Model for recommended users to add
struct RecommendedUser: Identifiable, Equatable {
    let id: String
    let name: String
    let avatar: String
    let mutualFriends: Int
    let avatarColor: Color
    var isOnline: Bool = false
}

// MARK: - Attachment Type

/// Types of attachments that can be sent
enum AttachmentType {
    case photo
    case camera
    case video
    case file
    case location

    var icon: String {
        switch self {
        case .photo: return "photo.fill"
        case .camera: return "camera.fill"
        case .video: return "video.fill"
        case .file: return "doc.fill"
        case .location: return "location.fill"
        }
    }

    var label: String {
        switch self {
        case .photo: return "Photo Library"
        case .camera: return "Camera"
        case .video: return "Video"
        case .file: return "File"
        case .location: return "Location"
        }
    }
}
