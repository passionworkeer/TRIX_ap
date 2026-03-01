import Foundation

// Re-export StudyRoomMember from APIEndpoints for consistency
// Using APIEndpoints.StudyRoomMember as the canonical definition
typealias StudyRoomMember = APIEndpoints.StudyRoomMember

/// 学习房间会话状态
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

/// 学习房间计时器状态
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

/// 学习房间状态
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
