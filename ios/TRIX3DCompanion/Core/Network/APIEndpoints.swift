//
//  APIEndpoints.swift
//  TRIX3DCompanion
//
//  API endpoint definitions
//

import Foundation

/// Base URL for the API
enum APIBaseURL {
    static let development = "http://47.243.55.130:8765"
    static let production = "https://api.trix3d.com" // To be configured

    /// Current base URL based on build configuration
    static var current: String {
        #if DEBUG
        return development
        #else
        return production
        #endif
    }
}

/// WebSocket URL
enum WebSocketURL {
    static let development = "ws://47.243.55.130:8765"
    static let production = "wss://api.trix3d.com" // To be configured

    static var current: String {
        #if DEBUG
        return development
        #else
        return production
        #endif
    }
}

/// All API endpoints
enum APIEndpoint {
    // MARK: - Auth
    case authLogin
    case authRegister
    case authLogout
    case authRefresh
    case authMe

    // MARK: - User
    case userProfile
    case userUpdateProfile
    case userAvatar
    case userStats
    case userSettings

    // MARK: - Chat
    case chatRooms
    case chatRoom(id: String)
    case chatRoomMessages(roomId: String)
    case chatRoomMessagesSend(roomId: String)

    // MARK: - Study
    case studySessions
    case studySession(id: String)
    case studyStats

    // MARK: - Study Room
    case studyRoomCreate
    case studyRoomJoin
    case studyRoomLeave
    case studyRoomState(roomCode: String?)

    // MARK: - Pairing
    case pairingRequest
    case pairingStatus(requestId: String)
    case pairingConfirm
    case pairingDevices
    case pairingDevice(id: String)

    // MARK: - Points
    case points
    case pointsHistory

    // MARK: - Upload
    case upload
    case uploadBase64

    // MARK: - Locations
    case locations
    case location(id: String)
    case snapshots
    case snapshot(id: String)

    // MARK: - Path
    var path: String {
        switch self {
        // Auth
        case .authLogin: return "/auth/login"
        case .authRegister: return "/auth/register"
        case .authLogout: return "/auth/logout"
        case .authRefresh: return "/auth/refresh"
        case .authMe: return "/auth/me"

        // User
        case .userProfile: return "/user/profile"
        case .userUpdateProfile: return "/user/profile"
        case .userAvatar: return "/user/avatar"
        case .userStats: return "/user/stats"
        case .userSettings: return "/user/settings"

        // Chat
        case .chatRooms: return "/chat/rooms"
        case .chatRoom(let id): return "/chat/rooms/\(id)"
        case .chatRoomMessages(let roomId): return "/chat/rooms/\(roomId)/messages"
        case .chatRoomMessagesSend(let roomId): return "/chat/rooms/\(roomId)/messages"

        // Study
        case .studySessions: return "/study/sessions"
        case .studySession(let id): return "/study/sessions/\(id)"
        case .studyStats: return "/study/stats"

        // Study Room
        case .studyRoomCreate: return "/study/room/create"
        case .studyRoomJoin: return "/study/room/join"
        case .studyRoomLeave: return "/study/room/leave"
        case .studyRoomState(let roomCode):
            if let code = roomCode {
                return "/study/room/state?roomCode=\(code)"
            }
            return "/study/room/state"

        // Pairing
        case .pairingRequest: return "/pairing/request"
        case .pairingStatus(let requestId): return "/pairing/status/\(requestId)"
        case .pairingConfirm: return "/pairing/confirm"
        case .pairingDevices: return "/pairing/devices"
        case .pairingDevice(let id): return "/pairing/devices/\(id)"

        // Points
        case .points: return "/points"
        case .pointsHistory: return "/points/history"

        // Upload
        case .upload: return "/upload"
        case .uploadBase64: return "/upload/base64"

        // Locations
        case .locations: return "/locations"
        case .location(let id): return "/locations/\(id)"
        case .snapshots: return "/snapshots"
        case .snapshot(let id): return "/snapshots/\(id)"
        }
    }

    // MARK: - HTTP Method
    var method: HTTPMethod {
        switch self {
        case .authLogin, .authRegister, .authLogout, .authRefresh,
             .userAvatar, .pairingRequest, .pairingConfirm,
             .studyRoomCreate, .studyRoomJoin, .studyRoomLeave,
             .upload, .uploadBase64, .chatRoomMessagesSend:
            return .post

        case .userUpdateProfile, .studySession(let id), .pairingDevice:
            // For update operations
            return .put

        case .userProfile, .authMe, .userStats, .userSettings,
             .chatRooms, .chatRoom, .chatRoomMessages,
             .studySessions, .studyStats, .studyRoomState,
             .pairingStatus, .pairingDevices,
             .points, .pointsHistory,
             .locations, .location, .snapshots, .snapshot:
            return .get

        case .studySession(_):
            // For delete operations
            return .delete
        }
    }

    // MARK: - Requires Auth
    var requiresAuth: Bool {
        switch self {
        case .authLogin, .authRegister:
            return false
        default:
            return true
        }
    }
}

/// HTTP methods
enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case delete = "DELETE"
    case patch = "PATCH"
}

// MARK: - API Request/Response Types

// MARK: - Auth
struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct RegisterRequest: Codable {
    let username: String
    let email: String
    let password: String
}

struct AuthResponse: Codable {
    let user: User
    let session: UserSession
}

struct UserSession: Codable {
    let id: String
    let userId: String
    let accessToken: String
    let refreshToken: String
    let expiresAt: Date
}

// MARK: - User
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
}

struct UserStats: Codable {
    let totalStudyTime: Int
    let sessionCount: Int
    let averageDuration: Int
    let streakDays: Int
    let todayDuration: Int
    let weekDuration: Int
}

struct ProfileUpdate: Codable {
    let username: String?
    let fullName: String?
    let displayName: String?
    let bio: String?
}

// MARK: - Chat
struct ChatRoom: Codable, Identifiable {
    let id: String
    let name: String
    let type: ChatRoomType
    let participants: [User]
    let lastMessage: ChatMessage?
    let unreadCount: Int
    let createdAt: Date
    let updatedAt: Date
}

enum ChatRoomType: String, Codable {
    case ai
    case group
    case privateChat = "private"
}

struct ChatMessage: Codable, Identifiable {
    let id: String
    let roomId: String
    let senderId: String
    let sender: MessageSender
    let content: String
    let type: MessageType
    let mediaUrl: String?
    let mediaMimeType: String?
    let mediaDuration: Int?
    let isRead: Bool
    let createdAt: Date
}

enum MessageSender: String, Codable {
    case user
    case bot
    case friend
}

enum MessageType: String, Codable {
    case text
    case image
    case voice
    case video
    case file
}

struct SendMessageRequest: Codable {
    let content: String
    let contentType: MessageType
    let mediaUrl: String?
    let mediaMimeType: String?
}

// MARK: - Study
struct StudySession: Codable, Identifiable {
    let id: String
    let userId: String
    let durationMinutes: Int
    let startedAt: Date
    let completedAt: Date?
    let earnedPoints: Int?
    let isCompleted: Bool
}

struct CreateStudySessionRequest: Codable {
    let durationMinutes: Int
}

struct StudyStats: Codable {
    let totalDuration: Int
    let sessionCount: Int
    let averageDuration: Int
    let streakDays: Int
    let todayDuration: Int
    let weekDuration: Int
}

// MARK: - Pairing
struct PairingRequest: Codable {
    let userId: String
}

struct PairingResponse: Codable {
    let requestId: String
    let code: String?
    let token: String?
    let expiresIn: Int
    let qrUrl: String?
}

struct PairingStatusResponse: Codable {
    let success: Bool
    let paired: Bool
    let deviceId: String?
    let deviceName: String?
    let botOnline: Bool?
    let pairedAt: String?
}

struct PairedDevice: Codable, Identifiable {
    let id: String
    let deviceId: String
    let deviceName: String
    let deviceType: DeviceType
    let pairedAt: Date
    let isOnline: Bool
}

enum DeviceType: String, Codable {
    case mobile
    case desktop
    case tablet
    case web
}

struct PairWithCodeRequest: Codable {
    let code: String
    let userId: String
}

struct PairWithTokenRequest: Codable {
    let token: String
    let userId: String
}

// MARK: - Points
struct PointsResponse: Codable {
    let totalPoints: Int
    let level: Int
    let todayEarned: Int
    let weekEarned: Int
    let totalTransactions: Int
}

struct PointsTransaction: Codable, Identifiable {
    let id: String
    let pointsChange: Int
    let type: TransactionType
    let description: String
    let balanceAfter: Int
    let createdAt: Date
}

enum TransactionType: String, Codable {
    case studyComplete = "study_complete"
    case studyStreak = "study_streak"
    case dailyLogin = "daily_login"
    case achievement = "achievement"
    case socialShare = "social_share"
    case redeem = "redeem"
    case adminAdjust = "admin_adjust"
}

// MARK: - Upload
struct UploadResponse: Codable {
    let url: String
    let key: String
}

// MARK: - Generic API Response
struct APIResponse<T: Codable>: Codable {
    let success: Bool
    let data: T?
    let error: String?
    let message: String?
}

struct PaginatedResponse<T: Codable>: Codable {
    let data: [T]
    let total: Int
    let page: Int
    let limit: Int
}
