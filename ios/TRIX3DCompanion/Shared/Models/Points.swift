import Foundation

/// 积分交易类型
enum TransactionType: String, Codable {
    case studyComplete = "study_complete"     // 学习完成
    case studyStreak = "study_streak"         // 学习连续
    case dailyLogin = "daily_login"           // 每日登录
    case achievement = "achievement"           // 成就
    case socialShare = "social_share"         // 社交分享
    case redeem = "redeem"                     // 兑换
    case adminAdjust = "admin_adjust"         // 管理员调整
}

/// 积分交易记录
struct PointsTransaction: Codable, Identifiable {
    let id: String
    let pointsChange: Int
    let type: TransactionType
    let description: String
    let balanceAfter: Int
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case pointsChange = "points_change"
        case type
        case description
        case balanceAfter = "balance_after"
        case createdAt = "created_at"
    }
}

/// 积分历史响应
struct PointsHistoryResponse: Codable {
    let transactions: [PointsTransaction]
    let totalCount: Int
    let page: Int
    let limit: Int

    enum CodingKeys: String, CodingKey {
        case transactions
        case totalCount = "total_count"
        case page
        case limit
    }
}

/// 积分统计响应
struct PointsStatsResponse: Codable {
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

/// 积分兑换请求
struct PointsRedeemRequest: Codable {
    let rewardId: String
    let quantity: Int

    enum CodingKeys: String, CodingKey {
        case rewardId = "reward_id"
        case quantity
    }
}

/// 积分等级配置
struct PointsLevel: Codable {
    let level: Int
    let minPoints: Int
    let maxPoints: Int
    let title: String

    enum CodingKeys: String, CodingKey {
        case level
        case minPoints = "min_points"
        case maxPoints = "max_points"
        case title
    }
}
