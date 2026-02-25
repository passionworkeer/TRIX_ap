import Foundation

/// 用户模型
struct User: Codable, Identifiable {
    let id: String
    let username: String
    let email: String?
    let avatarUrl: String?
    let fullName: String?
    let displayName: String?
    let bio: String?
    let points: Int
    let isStudying: Bool
    let companionId: String?
    let totalStudyTime: Int
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case username
        case email
        case avatarUrl = "avatar_url"
        case fullName = "full_name"
        case displayName = "display_name"
        case bio
        case points
        case isStudying = "is_studying"
        case companionId = "companion_id"
        case totalStudyTime = "total_study_time"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// 用户会话模型
struct UserSession: Codable, Identifiable {
    let id: String
    let userId: String
    let sessionToken: String
    let accessToken: String
    let refreshToken: String
    let expiresAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case sessionToken = "session_token"
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresAt = "expires_at"
    }
}

/// 用户资料更新请求
struct ProfileUpdate: Codable {
    let username: String?
    let fullName: String?
    let bio: String?
    let avatarUrl: String?

    enum CodingKeys: String, CodingKey {
        case username
        case fullName = "full_name"
        case bio
        case avatarUrl = "avatar_url"
    }
}

/// 用户积分统计
struct UserPointsStats: Codable {
    let totalPoints: Int
    let level: Int
    let todayEarned: Int
    let weekEarned: Int
    let totalTransactions: Int

    enum CodingKeys: String, CodingKey {
        case totalPoints = "total_points"
        case level
        case todayEarned = "today_earned"
        case weekEarned = "week_earned"
        case totalTransactions = "total_transactions"
    }
}

/// 用户状态枚举
enum UserStatus: String, Codable {
    case online
    case offline
    case busy
    case away
}
