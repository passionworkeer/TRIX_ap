import Foundation

/// 消息发送者类型
enum MessageSender: String, Codable {
    case user
    case bot
    case friend
}

/// 消息内容类型
enum MessageContentType: String, Codable {
    case text
    case image
    case video
    case audio
    case mixed
    case command
}

/// 聊天消息模型
struct ChatMessage: Codable, Identifiable {
    let id: String
    let roomId: String?
    let friendId: String?
    let sender: MessageSender
    let senderId: String?
    let text: String
    let timestamp: Date
    let messageType: MessageContentType?
    let mediaUri: String?
    let mediaType: String?
    let mediaSize: Int?
    let mediaMetadata: MediaMetadata?
    let isRead: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case roomId = "room_id"
        case friendId = "friend_id"
        case sender
        case senderId = "sender_id"
        case text
        case timestamp
        case messageType = "message_type"
        case mediaUri = "media_uri"
        case mediaType = "media_type"
        case mediaSize = "media_size"
        case mediaMetadata = "media_metadata"
        case isRead = "is_read"
    }
}

/// 媒体元数据
struct MediaMetadata: Codable {
    let width: Int?
    let height: Int?
    let duration: Int?
    let thumbnail: String?

    enum CodingKeys: String, CodingKey {
        case width
        case height
        case duration
        case thumbnail
    }
}

/// 数据库存储的聊天消息格式
struct ChatMessageDB: Codable, Identifiable {
    let id: String
    let conversationId: String
    let senderId: String
    let receiverId: String
    let text: String
    let isRead: Bool
    let createdAt: Date
    let messageType: MessageContentType?
    let mediaUri: String?
    let mediaType: String?
    let mediaSize: Int?
    let mediaMetadata: MediaMetadata?

    enum CodingKeys: String, CodingKey {
        case id
        case conversationId = "conversation_id"
        case senderId = "sender_id"
        case receiverId = "receiver_id"
        case text
        case isRead = "is_read"
        case createdAt = "created_at"
        case messageType = "message_type"
        case mediaUri = "media_uri"
        case mediaType = "media_type"
        case mediaSize = "media_size"
        case mediaMetadata = "media_metadata"
    }
}

/// 未读计数模型
struct UnreadCount: Codable, Identifiable {
    let id: String
    let userId: String
    let friendId: String
    let unreadCount: Int
    let lastMessage: String?
    let lastMessageTime: Date?
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case friendId = "friend_id"
        case unreadCount = "unread_count"
        case lastMessage = "last_message"
        case lastMessageTime = "last_message_time"
        case updatedAt = "updated_at"
    }
}

/// 消息类型枚举（简化版）
enum MessageType: String, Codable {
    case text
    case image
    case voice
    case video
}
