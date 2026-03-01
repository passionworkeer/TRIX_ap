import Foundation

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
