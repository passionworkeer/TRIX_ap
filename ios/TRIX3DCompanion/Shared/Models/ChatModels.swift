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
struct ChatConversation: Identifiable, Equatable, Hashable {
    let id: String
    let name: String
    let avatarUrl: String?
    let lastMessage: String
    let time: String
    let unreadCount: Int
    let avatarColor: Color
    let isOnline: Bool

    // Hashable conformance
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
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

extension RecommendedUser {
    init(api model: APIFriendRecommendation) {
        let normalizedName = model.name.trimmingCharacters(in: .whitespacesAndNewlines)
        let fallbackName = normalizedName.isEmpty ? "User" : normalizedName

        self.id = model.id
        self.name = fallbackName
        self.avatar = String(fallbackName.prefix(1)).uppercased()
        self.mutualFriends = model.mutualFriends
        self.avatarColor = RecommendedUser.colorSeeded(by: model.id)
        self.isOnline = model.isOnline
    }

    private static func colorSeeded(by seed: String) -> Color {
        let palette: [Color] = [.blue, .purple, .pink, .orange, .green, .teal, .indigo]
        let index = abs(seed.hashValue) % palette.count
        return palette[index]
    }
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
