import Foundation

/// 聊天房间类型
enum ChatRoomType: String, Codable {
    case ai       // Clawbot AI 对话
    case group    // 群聊
    case privateChat = "private"  // 私聊
}

/// 聊天房间模型
struct ChatRoom: Codable, Identifiable {
    let id: String
    let name: String
    let type: ChatRoomType
    let participants: [User]?
    let lastMessage: ChatMessage?
    let unreadCount: Int
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case type
        case participants
        case lastMessage = "last_message"
        case unreadCount = "unread_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// 好友模型
struct Friend: Codable, Identifiable {
    let id: String
    let userId: String
    let friendId: String
    let name: String
    let avatarUrl: String?
    let status: FriendStatus
    let bio: String?
    let studyTime: Int
    let isStudying: Bool
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case friendId = "friend_id"
        case name
        case avatarUrl = "avatar_url"
        case status
        case bio
        case studyTime = "study_time"
        case isStudying = "is_studying"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// 好友状态
enum FriendStatus: String, Codable {
    case online
    case offline
    case busy
    case away
}

/// 好友最新消息
struct FriendLatestMessage: Codable {
    let userId: String
    let friendId: String
    let name: String
    let avatarUrl: String?
    let status: FriendStatus
    let bio: String?
    let studyTime: Int
    let isStudying: Bool
    let unreadCount: Int
    let lastMessage: String?
    let lastMessageTime: Date?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case friendId = "friend_id"
        case name
        case avatarUrl = "avatar_url"
        case status
        case bio
        case studyTime = "study_time"
        case isStudying = "is_studying"
        case unreadCount = "unread_count"
        case lastMessage = "last_message"
        case lastMessageTime = "last_message_time"
    }
}
