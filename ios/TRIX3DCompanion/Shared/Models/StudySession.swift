import Foundation

/// 学习会话模型
struct StudySession: Codable, Identifiable {
    let id: String
    let userId: String
    let subject: String?
    let duration: Int
    let startedAt: Date
    let endedAt: Date?
    let notes: String?
    let earnedPoints: Int?
    let isCompleted: Bool
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case subject
        case duration
        case startedAt = "started_at"
        case endedAt = "ended_at"
        case notes
        case earnedPoints = "earned_points"
        case isCompleted = "is_completed"
        case createdAt = "created_at"
    }
}

/// 学习统计模型
struct StudyStats: Codable {
    let totalDuration: Int       // 总学习时长(分钟)
    let sessionCount: Int        // 学习次数
    let averageDuration: Int    // 平均时长
    let streakDays: Int          // 连续学习天数
    let todayDuration: Int       // 今日时长
    let weekDuration: Int        // 本周时长

    enum CodingKeys: String, CodingKey {
        case totalDuration = "total_duration"
        case sessionCount = "session_count"
        case averageDuration = "average_duration"
        case streakDays = "streak_days"
        case todayDuration = "today_duration"
        case weekDuration = "week_duration"
    }
}

/// 计时器状态
enum TimerState: String, Codable {
    case idle
    case focusing
    case resting
    case paused
}

/// 录音状态
enum RecordingState: String, Codable {
    case idle
    case recording
    case playing
}
