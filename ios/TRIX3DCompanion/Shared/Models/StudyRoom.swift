import Foundation

/// 计时器状态
enum TimerState: String, Codable {
    case idle
    case running
    case paused
    case completed
    case focusing
    case resting
}

/// 学习房间成员 - 与 Web 端保持一致
struct StudyRoomMember: Codable, Identifiable {
    var id: String { userId }
    let userId: String
    let displayName: String
    let avatarUrl: String?
    let joinedAt: Date
    let lastActiveAt: Date
    let status: StudyRoomMemberStatus

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case joinedAt = "joined_at"
        case lastActiveAt = "last_active_at"
        case status
    }
}

/// 学习房间会话状态 - 匹配 Web 端定义
enum StudyRoomSessionState: String, Codable {
    case idle
    case focusing
    case resting
}

/// 学习房间成员状态
enum StudyRoomMemberStatus: String, Codable {
    case online
    case focusing
    case resting
}

/// 房间主机操作
enum StudyRoomHostAction: String, Codable {
    case startFocus = "start_focus"
    case pause
    case end
}

/// 学习房间计时器状态 - 与 Web 端保持一致
struct StudyRoomTimerState: Codable {
    let durationSeconds: Int
    let startedAt: Date
    let endsAt: Date
    let remainingSeconds: Int

    enum CodingKeys: String, CodingKey {
        case durationSeconds = "duration_seconds"
        case startedAt = "started_at"
        case endsAt = "ends_at"
        case remainingSeconds = "remaining_seconds"
    }
}

/// 学习房间状态 - 与 Web 端保持一致
struct StudyRoomState: Codable, Identifiable {
    var id: String { roomCode }
    let roomCode: String
    let hostUserId: String
    let sessionState: StudyRoomSessionState
    let members: [StudyRoomMember]
    let maxMembers: Int
    let version: Int
    let createdAt: Date
    let updatedAt: Date
    let timer: StudyRoomTimerState?

    enum CodingKeys: String, CodingKey {
        case roomCode = "room_code"
        case hostUserId = "host_user_id"
        case sessionState = "session_state"
        case members
        case maxMembers = "max_members"
        case version
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case timer
    }
}

/// 学习房间状态事件
struct StudyRoomStateEvent: Codable {
    let roomCode: String
    let reason: String
    let room: StudyRoomState?
    let serverTs: Date

    enum CodingKeys: String, CodingKey {
        case roomCode = "room_code"
        case reason
        case room
        case serverTs = "server_ts"
    }
}

/// 学习房间确认负载
struct StudyRoomAckPayload: Codable {
    let success: Bool
    let code: String?
    let error: String?
    let roomCode: String?
    let room: StudyRoomState?

    enum CodingKeys: String, CodingKey {
        case success
        case code
        case error
        case roomCode = "room_code"
        case room
    }
}

/// 学习房间模型（简化版）
struct StudyRoom: Codable, Identifiable {
    let id: String
    let roomCode: String
    let name: String
    let hostUserId: String
    let maxMembers: Int
    let members: [StudyRoomMember]
    let sessionState: StudyRoomSessionState
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case roomCode = "room_code"
        case name
        case hostUserId = "host_user_id"
        case maxMembers = "max_members"
        case members
        case sessionState = "session_state"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// 每日学习数据
struct DailyStudyData: Codable, Identifiable {
    var id: String { date }
    let date: String
    let totalMinutes: Int
    let sessionCount: Int

    enum CodingKeys: String, CodingKey {
        case date
        case totalMinutes = "total_minutes"
        case sessionCount = "session_count"
    }
}

/// 周学习数据响应
struct WeeklyStudyDataResponse: Codable {
    let success: Bool
    let data: [DailyStudyData]
}
