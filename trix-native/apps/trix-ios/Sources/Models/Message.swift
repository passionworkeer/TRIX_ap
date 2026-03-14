//
//  Message.swift
//  TRIX Native
//

import Foundation

struct ChatMessage: Codable, Identifiable, Equatable {
    let id: String
    let conversationId: String
    let from: MessageSender
    let timestamp: Date
    var text: String?
    var attachments: [Attachment]?

    enum MessageSender: String, Codable {
        case phone
        case agent
    }

    static func == (lhs: ChatMessage, rhs: ChatMessage) -> Bool {
        return lhs.id == rhs.id
    }
}

struct Attachment: Codable, Identifiable {
    var id: String { url }
    let type: AttachmentType
    let url: String
    var mimeType: String?
    var fileName: String?
    var size: Int?
    var width: Int?
    var height: Int?
    var duration: Double?

    enum AttachmentType: String, Codable {
        case image
        case audio
        case video
        case file
    }
}

// MARK: - API Request/Response

struct PairingResponse: Codable {
    let success: Bool
    let code: String?
    let qrDataUrl: String?
    let expiresIn: Int?
    let error: String?
}

struct PairingStatusResponse: Codable {
    let success: Bool
    let code: String
    let status: PairingStatus
    let deviceId: String?

    enum PairingStatus: String, Codable {
        case waiting
        case phoneConnected = "phone_connected"
        case paired
        case expired
    }
}

struct ClaimPairingRequest: Codable {
    let deviceId: String
    let deviceName: String
}

struct ClaimPairingResponse: Codable {
    let success: Bool
    let deviceId: String
    let pluginToken: String
    let refreshToken: String
    let serverUrl: String
    let expiresIn: Int
    let error: String?
}

struct SendMessageRequest: Codable {
    let text: String?
    let attachments: [Attachment]?
}

struct SendMessageResponse: Codable {
    let success: Bool
    let messageId: String?
    let error: String?
}

struct MessagesResponse: Codable {
    let success: Bool
    let messages: [ChatMessage]
    let hasMore: Bool
}

struct UploadResponse: Codable {
    let success: Bool
    let url: String?
    let mimeType: String?
    let size: Int?
    let width: Int?
    let height: Int?
    let error: String?
}
