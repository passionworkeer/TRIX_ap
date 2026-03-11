//
//  APIEndpoints.swift
//  TRIX3DCompanion
//
//  API endpoint definitions
//  Common types (User, ChatMessage, etc.) are defined here
//

import Foundation

/// Configuration for API security settings
/// IMPORTANT: Production builds MUST use HTTPS/WSS
enum APISecurityConfig {
    /// Force HTTPS in production (always true - security requirement)
    /// Setting this to false in production is a security violation
    static let forceHTTPSInProduction: Bool = true

    /// Allow insecure connections in development only
    /// WARNING: Never set to true in production builds
    #if DEBUG
    static let allowInsecureInDev: Bool = true
    #else
    static let allowInsecureInDev: Bool = false
    #endif
}

/// Base URL for the API
enum APIBaseURL {
    // MARK: - Production (Always HTTPS - Security Requirement)
    /// Production API base URL - MUST use HTTPS
    static let production = "https://api.trix3d.com"

    // MARK: - Development
    /// Development API base URL - uses HTTPS when security is enabled
    /// For local development, use http://localhost:8765 or configure your dev server with HTTPS
    static let development: String = {
        // Use Supabase directly for development to avoid auth issues
        // This is for development/testing only
        return "https://hmbukjvrbyhbuqumqdug.supabase.co"
    }()

    /// Current base URL based on build configuration
    /// Production builds ALWAYS use HTTPS
    static var current: String {
        #if DEBUG
        return development
        #else
        // Production - enforce HTTPS regardless of configuration
        return production
        #endif
    }
}

/// WebSocket URL
enum WebSocketURL {
    // MARK: - Production (Always WSS - Security Requirement)
    /// Production WebSocket URL - MUST use WSS (WebSocket Secure)
    static let production = "wss://api.trix3d.com"

    // MARK: - Development
    /// Development WebSocket URL - uses WSS when security is enabled
    static let development: String = {
        // DEBUG mode: always use IP address to avoid SSL/cert issues with api.trix3d.com
        // This is for development/testing only
        return "ws://47.243.55.130:8765"
    }()

    /// Current WebSocket URL based on build configuration
    /// Production builds ALWAYS use WSS
    static var current: String {
        #if DEBUG
        return development
        #else
        // Production - enforce WSS regardless of configuration
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
    case oauthAccounts
    case oauthLink
    case oauthUnlink

    // MARK: - Chat
    case chatRooms
    case chatRoomCreate
    case chatRoom(id: String)
    case chatRoomDelete(id: String)
    case chatRoomArchive(id: String)
    case chatRoomMute(id: String)
    case chatRoomUnmute(id: String)
    case chatRoomMessages(roomId: String)
    case chatRoomMessagesSend(roomId: String)
    case chatRoomMessagesRead(roomId: String)

    // MARK: - Study
    case studySessions
    /// Update a study session (PUT /study/sessions/:id)
    case updateStudySession(id: String)
    /// Delete a study session (DELETE /study/sessions/:id)
    case deleteStudySession(id: String)
    case studyStats
    /// Get weekly study data (GET /study/stats/weekly)
    case weeklyStudyData

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

    // MARK: - Achievement
    case achievementList
    case achievementUnlock(achievementId: String)
    case achievementCheck

    // MARK: - Friend
    case friendList
    case friendAdd
    case friendRemove(friendId: String)
    case friendRequests
    case friendRecommendations
    case friendAccept(requestId: String)
    case friendDecline(requestId: String)

    // MARK: - Mall
    case mallItems
    case mallItem(id: String)
    case mallPurchase
    case mallPurchaseHistory

    // MARK: - Wardrobe
    case wardrobeOutfits
    case wardrobeEquip(outfitId: String)
    case wardrobeUnequip(outfitId: String)

    // MARK: - Schedule
    case scheduleList
    case scheduleCreate
    case scheduleUpdate(id: String)
    case scheduleDelete(id: String)
    case scheduleByDateRange
    case scheduleUpcoming

    // MARK: - Todo
    case todoList
    case todoCreate
    case todoUpdate(id: String)
    case todoDelete(id: String)
    case todoToggle(id: String)

    // MARK: - Study History
    case studyHistory
    case studyHistoryDaily
    case studyHistoryWeekly
    case studyHistoryMonthly

    // MARK: - Place
    case placeNearby
    case placeSearch
    case placeFavorite
    case placeFavoriteToggle(placeId: String)
    case placeCheckIn(placeId: String)

    // MARK: - Points
    case points
    case pointsHistory
    case pointsAdd
    case pointsDeduct

    // MARK: - Upload
    case upload
    case uploadBase64

    // MARK: - Locations
    case locations
    case location(id: String)
    case locationNearby(radius: Double)
    case locationShare
    case snapshots
    case snapshot(id: String)

    // MARK: - Notifications
    case notificationList
    case notificationMarkRead(id: String)
    case notificationMarkAllRead
    case deviceToken
    case notificationPreferences
    case notificationSettings

    // MARK: - Unread Counts
    case unreadCounts
    case unreadCount(friendId: String)
    case unreadUpdateCount(friendId: String)
    case unreadMarkAllRead

    // MARK: - Clawbot (AI Conversation)
    case clawbotConversations
    case clawbotCreateConversation
    case clawbotConversationMessages(conversationId: String)
    case clawbotSendMessage(conversationId: String)
    case clawbotDeleteConversation(conversationId: String)
    case clawbotHistory(roomId: String)

    // MARK: - Study Goals
    case studyGoals
    case studyGoalCreate
    case studyGoalUpdate(id: String)
    case studyGoalDelete(id: String)

    // MARK: - Payments
    //
    // Payment API endpoints for in-app purchases and subscription management
    // All payment endpoints require authentication
    //
    // Endpoints:
    //   - purchasePoints: Purchase points packages via in-app purchase
    //   - verifyReceipt: Verify App Store receipt with backend
    //   - getOrders: Get user's order history (paginated)
    //   - getOrder: Get specific order details by ID
    //   - cancelOrder: Cancel pending order
    //   - getSubscription: Get current subscription status
    //   - restorePurchases: Restore previous purchases
    //
    case purchasePoints
    case verifyReceipt
    case getOrders
    case getOrder(id: String)
    case cancelOrder(id: String)
    case getSubscription
    case restorePurchases

    // MARK: - Path
    var path: String {
        switch self {
        // Auth (Supabase)
        case .authLogin: return "/auth/v1/token"
        case .authRegister: return "/auth/v1/signup"
        case .authLogout: return "/auth/v1/logout"
        case .authRefresh: return "/auth/v1/token"
        case .authMe: return "/auth/v1/user"

        // User
        case .userProfile: return "/user/profile"
        case .userUpdateProfile: return "/user/profile"
        case .userAvatar: return "/user/avatar"
        case .userStats: return "/user/stats"
        case .userSettings: return "/user/settings"
        case .oauthAccounts: return "/user/oauth/accounts"
        case .oauthLink: return "/user/oauth/link"
        case .oauthUnlink: return "/user/oauth/unlink"

        // Chat
        case .chatRooms: return "/chat/rooms"
        case .chatRoomCreate: return "/chat/rooms"
        case .chatRoom(let id): return "/chat/rooms/\(id)"
        case .chatRoomDelete(let id): return "/chat/rooms/\(id)"
        case .chatRoomArchive(let id): return "/chat/rooms/\(id)/archive"
        case .chatRoomMute(let id): return "/chat/rooms/\(id)/mute"
        case .chatRoomUnmute(let id): return "/chat/rooms/\(id)/unmute"
        case .chatRoomMessages(let roomId): return "/chat/rooms/\(roomId)/messages"
        case .chatRoomMessagesSend(let roomId): return "/chat/rooms/\(roomId)/messages"
        case .chatRoomMessagesRead(let roomId): return "/chat/rooms/\(roomId)/messages/read"

        // Study
        case .studySessions: return "/study/sessions"
        case .updateStudySession(let id): return "/study/sessions/\(id)"
        case .deleteStudySession(let id): return "/study/sessions/\(id)"
        case .studyStats: return "/study/stats"
        case .weeklyStudyData: return "/study/stats/weekly"

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

        // Achievement
        case .achievementList: return "/achievements"
        case .achievementUnlock(let achievementId): return "/achievements/\(achievementId)/unlock"
        case .achievementCheck: return "/achievements/check"

        // Friend
        case .friendList: return "/friends"
        case .friendAdd: return "/friends"
        case .friendRemove(let friendId): return "/friends/\(friendId)"
        case .friendRequests: return "/friends/requests"
        case .friendRecommendations: return "/friends/recommendations"
        case .friendAccept(let requestId): return "/friends/requests/\(requestId)/accept"
        case .friendDecline(let requestId): return "/friends/requests/\(requestId)/decline"

        // Mall
        case .mallItems: return "/mall/items"
        case .mallItem(let id): return "/mall/items/\(id)"
        case .mallPurchase: return "/mall/purchase"
        case .mallPurchaseHistory: return "/mall/purchase/history"

        // Wardrobe
        case .wardrobeOutfits: return "/wardrobe/outfits"
        case .wardrobeEquip(let outfitId): return "/wardrobe/outfits/\(outfitId)/equip"
        case .wardrobeUnequip(let outfitId): return "/wardrobe/outfits/\(outfitId)/unequip"

        // Schedule
        case .scheduleList: return "/schedules"
        case .scheduleCreate: return "/schedules"
        case .scheduleUpdate(let id): return "/schedules/\(id)"
        case .scheduleDelete(let id): return "/schedules/\(id)"
        case .scheduleByDateRange: return "/schedules/range"
        case .scheduleUpcoming: return "/schedules/upcoming"

        // Todo
        case .todoList: return "/todos"
        case .todoCreate: return "/todos"
        case .todoUpdate(let id): return "/todos/\(id)"
        case .todoDelete(let id): return "/todos/\(id)"
        case .todoToggle(let id): return "/todos/\(id)/toggle"

        // Study History
        case .studyHistory: return "/study/history"
        case .studyHistoryDaily: return "/study/history/daily"
        case .studyHistoryWeekly: return "/study/history/weekly"
        case .studyHistoryMonthly: return "/study/history/monthly"

        // Place
        case .placeNearby: return "/places/nearby"
        case .placeSearch: return "/places/search"
        case .placeFavorite: return "/places/favorites"
        case .placeFavoriteToggle(let placeId): return "/places/\(placeId)/favorite"
        case .placeCheckIn(let placeId): return "/places/\(placeId)/check-in"

        // Points
        case .points: return "/points"
        case .pointsHistory: return "/points/history"
        case .pointsAdd: return "/points/add"
        case .pointsDeduct: return "/points/deduct"

        // Upload
        case .upload: return "/upload"
        case .uploadBase64: return "/upload/base64"

        // Locations
        case .locations: return "/locations"
        case .location(let id): return "/locations/\(id)"
        case .locationNearby(let radius): return "/locations/nearby?radius=\(Int(radius))"
        case .locationShare: return "/locations/share"
        case .snapshots: return "/snapshots"
        case .snapshot(let id): return "/snapshots/\(id)"

        // Notifications
        case .deviceToken: return "/notifications/device-token"
        case .notificationPreferences: return "/notifications/preferences"
        case .notificationSettings: return "/notifications/settings"

        // Payments
        // All payment endpoints use /payments prefix for consistency
        case .purchasePoints:
            // POST /payments/purchase-points
            // Purchase points package via in-app purchase
            return "/payments/purchase-points"
        case .verifyReceipt:
            // POST /payments/verify-receipt
            // Verify App Store receipt with backend server
            return "/payments/verify-receipt"
        case .getOrders:
            // GET /payments/orders?page={page}&limit={limit}
            // Get user's order history with pagination
            return "/payments/orders"
        case .getOrder(let id):
            // GET /payments/orders/{id}
            // Get specific order details by order ID
            return "/payments/orders/\(id)"
        case .cancelOrder(let id):
            // PUT /payments/orders/{id}/cancel
            // Cancel a pending order
            return "/payments/orders/\(id)/cancel"
        case .getSubscription:
            // GET /payments/subscription
            // Get current subscription status and details
            return "/payments/subscription"
        case .restorePurchases:
            // POST /payments/restore
            // Restore previous purchases from App Store
            return "/payments/restore"

        // Notifications
        case .notificationList: return "/notifications"
        case .notificationMarkRead(let id): return "/notifications/\(id)/read"
        case .notificationMarkAllRead: return "/notifications/read-all"
        case .deviceToken: return "/notifications/device-token"
        case .notificationPreferences: return "/notifications/preferences"
        case .notificationSettings: return "/notifications/settings"

        // Unread Counts
        case .unreadCounts: return "/unread/counts"
        case .unreadCount(let friendId): return "/unread/counts/\(friendId)"
        case .unreadUpdateCount(let friendId): return "/unread/counts/\(friendId)"
        case .unreadMarkAllRead: return "/unread/read-all"

        // Clawbot (AI Conversation)
        case .clawbotConversations: return "/clawbot/conversations"
        case .clawbotCreateConversation: return "/clawbot/conversations"
        case .clawbotConversationMessages(let conversationId): return "/clawbot/conversations/\(conversationId)/messages"
        case .clawbotSendMessage(let conversationId): return "/clawbot/conversations/\(conversationId)/messages"
        case .clawbotDeleteConversation(let conversationId): return "/clawbot/conversations/\(conversationId)"
        case .clawbotHistory(let roomId): return "/clawbot/history?room_id=\(roomId)"

        // Study Goals
        case .studyGoals: return "/study/goals"
        case .studyGoalCreate: return "/study/goals"
        case .studyGoalUpdate(let id): return "/study/goals/\(id)"
        case .studyGoalDelete(let id): return "/study/goals/\(id)"

        @unknown default:
            // Handle unknown cases for future-proofing
            return "/unknown"
        }
    }

    // MARK: - HTTP Method
    var method: HTTPMethod {
        switch self {
        // Auth - POST methods
        case .authLogin, .authRegister, .authLogout, .authRefresh,
             .userAvatar, .pairingRequest, .pairingConfirm,
             .studyRoomCreate, .studyRoomJoin, .studyRoomLeave,
             .upload, .uploadBase64, .chatRoomMessagesSend, .chatRoomCreate,
             .chatRoomArchive, .chatRoomMute, .chatRoomUnmute,
             .deviceToken, .purchasePoints, .verifyReceipt, .restorePurchases,
             .pointsAdd, .pointsDeduct,
             .oauthLink, .oauthUnlink,
             .achievementUnlock, .achievementCheck,
             .friendAdd, .friendAccept, .friendDecline,
             .mallPurchase,
             .wardrobeEquip, .wardrobeUnequip,
             .scheduleCreate, .scheduleUpdate, .scheduleDelete,
             .todoCreate, .todoUpdate, .todoDelete, .todoToggle,
             .placeFavoriteToggle,
             // New POST endpoints
             .notificationMarkRead, .notificationMarkAllRead,
             .clawbotCreateConversation, .clawbotSendMessage, .clawbotDeleteConversation,
             .studyGoalCreate, .unreadUpdateCount, .unreadMarkAllRead:
            return .post

        // Update operations - PUT methods
        case .userUpdateProfile, .updateStudySession, .pairingDevice, .cancelOrder,
             .scheduleUpdate, .todoUpdate,
             .studyGoalUpdate:
            return .put

        // Read operations - GET methods
        case .userProfile, .authMe, .userStats, .userSettings, .oauthAccounts,
             .chatRooms, .chatRoom, .chatRoomMessages,
             .studySessions, .studyStats, .weeklyStudyData, .studyRoomState,
             .pairingStatus, .pairingDevices,
             .points, .pointsHistory,
             .locations, .location, .locationNearby, .locationShare,
             .snapshots, .snapshot,
             .notificationList, .notificationPreferences, .notificationSettings,
             .getOrders, .getOrder, .getSubscription,
             .achievementList,
             .friendList, .friendRequests, .friendRecommendations,
             .mallItems, .mallItem, .mallPurchaseHistory,
             .wardrobeOutfits,
             .scheduleList, .scheduleByDateRange, .scheduleUpcoming,
             .todoList,
             .studyHistory, .studyHistoryDaily, .studyHistoryWeekly, .studyHistoryMonthly,
             .placeNearby, .placeSearch, .placeFavorite,
             // New GET endpoints
             .unreadCounts, .unreadCount,
             .clawbotConversations, .clawbotConversationMessages,
             .studyGoals:
            return .get

        // Delete operations - DELETE methods
        case .deleteStudySession, .friendRemove,
             .chatRoomDelete,
             .studyGoalDelete:
            return .delete

        // Read operations - GET methods (for chat room messages read)
        case .chatRoomMessagesRead:
            return .get
        @unknown default:
            return .get
        }
    }

    // MARK: - Requires Auth
    var requiresAuth: Bool {
        switch self {
        case .authLogin, .authRegister, .authRefresh:
            return false
        default:
            return true
        }
    }

    // MARK: - Query Parameters (for Supabase auth)
    var queryParameters: [String: String]? {
        switch self {
        case .authLogin:
            return ["grant_type": "password"]
        case .authRefresh:
            return ["grant_type": "refresh_token"]
        default:
            return nil
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
// Supabase-compatible User struct
struct User: Codable, Identifiable {
    let id: String
    let username: String?
    let email: String?
    let avatarUrl: String?
    let avatarConfig: [String: AnyCodable]?
    let fullName: String?
    let displayName: String?
    let bio: String?
    let website: String?
    let points: Int?
    let isStudying: Bool?
    let companionId: String?
    let totalStudyTime: Int?
    let lastActiveAt: Date?
    let currentStreak: Int?
    let daysActive: Int?
    let interactionCount: Int?
    let showOnlineStatus: Bool?
    let school: String?
    let grade: String?
    let createdAt: Date?
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case username
        case email
        case avatarUrl = "avatar_url"
        case avatarConfig = "avatar_config"
        case fullName = "full_name"
        case displayName = "display_name"
        case bio
        case website
        case points
        case isStudying = "is_studying"
        case companionId = "companion_id"
        case totalStudyTime = "total_study_time"
        case lastActiveAt = "last_active_at"
        case currentStreak = "current_streak"
        case daysActive = "days_active"
        case interactionCount = "interaction_count"
        case showOnlineStatus = "show_online_status"
        case school
        case grade
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct UserSession: Codable {
    let id: String
    let userId: String
    let accessToken: String
    let refreshToken: String
    let expiresAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresAt = "expires_at"
    }
}

struct ProfileUpdate: Codable {
    let username: String?
    let fullName: String?
    let displayName: String?
    let bio: String?
    let school: String?
    let grade: String?
    let avatarUrl: String?

    enum CodingKeys: String, CodingKey {
        case username
        case fullName = "full_name"
        case displayName = "display_name"
        case bio
        case school
        case grade
        case avatarUrl = "avatar_url"
    }
}

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
    let accessToken: String
    let tokenType: String
    let expiresIn: Int
    let expiresAt: Int?
    let refreshToken: String
    let user: User
    let session: UserSession?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case tokenType = "token_type"
        case expiresIn = "expires_in"
        case expiresAt = "expires_at"
        case refreshToken = "refresh_token"
        case user
        case session
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        accessToken = try container.decode(String.self, forKey: .accessToken)
        tokenType = try container.decode(String.self, forKey: .tokenType)
        expiresIn = try container.decode(Int.self, forKey: .expiresIn)
        expiresAt = try container.decodeIfPresent(Int.self, forKey: .expiresAt)
        refreshToken = try container.decode(String.self, forKey: .refreshToken)
        user = try container.decode(User.self, forKey: .user)
        session = nil // Will be created from token
    }
}

// MARK: - User
// User, UserSession, ProfileUpdate are defined above

struct UserStats: Codable {
    let totalStudyTime: Int
    let sessionCount: Int
    let averageDuration: Int
    let streakDays: Int
    let todayDuration: Int
    let weekDuration: Int

    enum CodingKeys: String, CodingKey {
        case totalStudyTime = "total_study_time"
        case sessionCount = "session_count"
        case averageDuration = "average_duration"
        case streakDays = "streak_days"
        case todayDuration = "today_duration"
        case weekDuration = "week_duration"
    }
}

// MARK: - Chat

// Chat types
enum ChatRoomType: String, Codable {
    case ai
    case group
    case privateChat = "private"
}

struct ChatRoom: Codable, Identifiable {
    let id: String
    let name: String
    let type: ChatRoomType
    let participants: [User]
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

struct ChatMessage: Codable, Identifiable {
    let id: String
    let roomId: String
    let senderId: String
    let sender: MessageSender
    let content: String
    let messageType: MessageType
    let mediaUrl: String?
    let mediaMimeType: String?
    let mediaDuration: Int?
    let mediaSize: Int64?
    let mediaMetadata: [String: AnyCodable]?
    let voiceUrl: String?
    let voiceDuration: Int?
    let voiceTranscript: String?
    let voiceMimeType: String?
    let isRead: Bool
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case roomId = "room_id"
        case senderId = "sender_id"
        case sender
        case content
        case messageType = "message_type"
        case mediaUrl = "media_url"
        case mediaMimeType = "media_mime_type"
        case mediaDuration = "media_duration"
        case mediaSize = "media_size"
        case mediaMetadata = "media_metadata"
        case voiceUrl = "voice_url"
        case voiceDuration = "voice_duration"
        case voiceTranscript = "voice_transcript"
        case voiceMimeType = "voice_mime_type"
        case isRead = "is_read"
        case createdAt = "created_at"
    }
}

struct SendMessageRequest: Codable {
    let content: String
    let contentType: MessageType
    let mediaUrl: String?
    let mediaMimeType: String?

    enum CodingKeys: String, CodingKey {
        case content
        case contentType = "content_type"
        case mediaUrl = "media_url"
        case mediaMimeType = "media_mime_type"
    }
}

struct MarkAsReadRequest: Codable {
    let messageId: String

    enum CodingKeys: String, CodingKey {
        case messageId = "message_id"
    }
}

/// Request to create a new chat room
struct CreateChatRoomRequest: Codable {
    let name: String
    let type: ChatRoomType
}

// MARK: - Study

struct StudySession: Codable, Identifiable {
    let id: String
    let userId: String
    let duration: Int
    let startedAt: Date
    let endedAt: Date?
    let earnedPoints: Int?
    let isCompleted: Bool
    let subject: String?
    let notes: String?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case duration
        case startedAt = "started_at"
        case endedAt = "ended_at"
        case earnedPoints = "earned_points"
        case isCompleted = "is_completed"
        case subject
        case notes
        case createdAt = "created_at"
    }
}

struct StudyStats: Codable {
    let totalDuration: Int
    let sessionCount: Int
    let averageDuration: Int
    let streakDays: Int
    let todayDuration: Int
    let weekDuration: Int

    enum CodingKeys: String, CodingKey {
        case totalDuration = "total_duration"
        case sessionCount = "session_count"
        case averageDuration = "average_duration"
        case streakDays = "streak_days"
        case todayDuration = "today_duration"
        case weekDuration = "week_duration"
    }
}

struct CreateStudySessionRequest: Codable {
    let duration: Int

    enum CodingKeys: String, CodingKey {
        case duration
    }
}

// MARK: - Study Room

// StudyRoomMember and StudyRoomState are defined in Shared/Models/StudyRoom.swift
// Import from Shared/Models

// MARK: - Pairing

// Pairing types - DeviceType, PairingRequest, PairingResponse, PairingStatusResponse
// are defined in Shared/Models/Device.swift

// PairedDevice is kept here as API-specific type
struct PairedDevice: Codable, Identifiable {
    let id: String
    let deviceId: String
    let deviceName: String
    let deviceType: DeviceType
    let pairedAt: Date
    let isOnline: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case deviceId = "device_id"
        case deviceName = "device_name"
        case deviceType = "device_type"
        case pairedAt = "paired_at"
        case isOnline = "is_online"
    }
}

struct PairWithCodeRequest: Codable {
    let code: String
    let userId: String

    enum CodingKeys: String, CodingKey {
        case code
        case userId = "user_id"
    }
}

struct PairWithTokenRequest: Codable {
    let token: String
    let userId: String

    enum CodingKeys: String, CodingKey {
        case token
        case userId = "user_id"
    }
}

// MARK: - Points
struct PointsResponse: Codable {
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

// MARK: - Points

enum TransactionType: String, Codable {
    case studyComplete = "study_complete"
    case studyStreak = "study_streak"
    case dailyLogin = "daily_login"
    case achievement = "achievement"
    case socialShare = "social_share"
    case redeem = "redeem"
    case adminAdjust = "admin_adjust"
}

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

// PaymentStatus is kept here as it's API-specific
enum PaymentStatus: String, Codable {
    case pending = "pending"
    case processing = "processing"
    case completed = "completed"
    case failed = "failed"
    case cancelled = "cancelled"
    case refunded = "refunded"
}

/// Order model
struct Order: Codable, Identifiable {
    let id: String
    let userId: String
    let productId: String
    let productType: ProductType
    let amount: Double
    let currency: String
    let status: PaymentStatus
    let paymentMethod: PaymentMethod
    let transactionId: String?
    let points: Int?
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case productId = "product_id"
        case productType = "product_type"
        case amount
        case currency
        case status
        case paymentMethod = "payment_method"
        case transactionId = "transaction_id"
        case points
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Upload
struct UploadResponse: Codable {
    let url: String
    let key: String
}

// MARK: - Generic Request Models

/// Empty request for endpoints that don't need body
struct EmptyRequest: Codable {}

/// Generic success response
struct SuccessResponse: Codable {
    let success: Bool
    let message: String?
}

// MARK: - Friend Request Models

/// Add friend request
struct FriendAddRequest: Codable {
    let friendId: String

    enum CodingKeys: String, CodingKey {
        case friendId = "friend_id"
    }
}

/// Friend request action (accept/decline)
struct FriendRequestActionRequest: Codable {
    let requestId: String

    enum CodingKeys: String, CodingKey {
        case requestId = "request_id"
    }
}

// MARK: - Mall Request Models

/// Purchase request for mall
struct MallPurchaseRequest: Codable {
    let itemId: String

    enum CodingKeys: String, CodingKey {
        case itemId = "item_id"
    }
}

/// Purchase result from mall API
struct MallPurchaseResult: Codable {
    let success: Bool
    let itemId: String
    let message: String?
}

// MARK: - Schedule Request Models

/// Create schedule request
struct ScheduleCreateRequest: Codable {
    let title: String
    let description: String?
    let startTime: Date
    let endTime: Date
    let location: String?
    let reminder: Int?

    enum CodingKeys: String, CodingKey {
        case title
        case description
        case startTime = "start_time"
        case endTime = "end_time"
        case location
        case reminder
    }
}

/// Update schedule request
struct ScheduleUpdateRequest: Codable {
    let title: String?
    let description: String?
    let startTime: Date?
    let endTime: Date?
    let location: String?
    let reminder: Int?
}

// MARK: - Todo Request Models

/// Create todo request
struct TodoCreateRequest: Codable {
    let title: String
    let description: String?
    let priority: String
    let dueDate: Date?

    enum CodingKeys: String, CodingKey {
        case title
        case description
        case priority
        case dueDate = "due_date"
    }
}

/// Update todo request
struct TodoUpdateRequest: Codable {
    let title: String?
    let description: String?
    let completed: Bool?
    let priority: String?
    let dueDate: Date?

    enum CodingKeys: String, CodingKey {
        case title
        case description
        case completed
        case priority
        case dueDate = "due_date"
    }
}

// MARK: - Upload Request Models

/// Upload base64 request
struct UploadBase64Request: Codable {
    let data: String

    enum CodingKeys: String, CodingKey {
        case data
    }
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

// MARK: - Payment Verification

/// Receipt verification request
struct ReceiptVerificationRequest: Codable {
    let transactionId: String
    let productId: String
    let receiptData: String?
    let bundleIdentifier: String
    let appVersion: String
    let purchaseDate: String?
    let expirationDate: String?

    enum CodingKeys: String, CodingKey {
        case transactionId = "transaction_id"
        case productId = "product_id"
        case receiptData = "receipt_data"
        case bundleIdentifier = "bundle_identifier"
        case appVersion = "app_version"
        case purchaseDate = "purchase_date"
        case expirationDate = "expiration_date"
    }
}

/// Receipt verification response
struct ReceiptVerificationResponse: Codable {
    let orderId: String
    let status: PaymentStatus
    let pointsAdded: Int?
    let totalPoints: Int?
    let subscriptionStatus: SubscriptionInfo?
    let verified: Bool
    let message: String?

    enum CodingKeys: String, CodingKey {
        case orderId = "order_id"
        case status
        case pointsAdded = "points_added"
        case totalPoints = "total_points"
        case subscriptionStatus = "subscription_status"
        case verified
        case message
    }
}

/// Subscription information
struct SubscriptionInfo: Codable {
    let isActive: Bool
    let tier: String?
    let expiresAt: Date?
    let willAutoRenew: Bool

    enum CodingKeys: String, CodingKey {
        case isActive = "is_active"
        case tier
        case expiresAt = "expires_at"
        case willAutoRenew = "will_auto_renew"
    }
}

/// Order details response
struct OrderDetailsResponse: Codable {
    let id: String
    let userId: String
    let productId: String
    let amount: Double
    let currency: String
    let status: PaymentStatus
    let transactionId: String?
    let points: Int?
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case productId = "product_id"
        case amount
        case currency
        case status
        case transactionId = "transaction_id"
        case points
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Orders list response
struct OrdersListResponse: Codable {
    let orders: [OrderDetailsResponse]
    let total: Int
    let page: Int
    let limit: Int
}

// MARK: - Subscription Management

/// Subscription status response
struct SubscriptionStatusResponse: Codable {
    let isActive: Bool
    let tier: String?
    let productId: String?
    let expiresAt: Date?
    let willAutoRenew: Bool
    let startedAt: Date?
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case isActive = "is_active"
        case tier
        case productId = "product_id"
        case expiresAt = "expires_at"
        case willAutoRenew = "will_auto_renew"
        case startedAt = "started_at"
        case updatedAt = "updated_at"
    }
}

/// Restore purchases response
struct RestorePurchasesResponse: Codable {
    let restoredOrders: [OrderDetailsResponse]
    let totalRestored: Int
    let message: String?

    enum CodingKeys: String, CodingKey {
        case restoredOrders = "restored_orders"
        case totalRestored = "total_restored"
        case message
    }
}

// MARK: - Achievement

/// Achievement rarity
enum AchievementRarity: String, Codable {
    case common
    case rare
    case epic
    case legendary
}

/// Achievement category
enum AchievementCategory: String, Codable {
    case duration
    case streak
    case social
    case milestone
    case special
}

/// Achievement type
enum AchievementType: String, Codable {
    case totalMinutes = "total_minutes"
    case singleSession = "single_session"
    case dailyStreak = "daily_streak"
    case weeklyStreak = "weekly_streak"
    case totalSessions = "total_sessions"
    case friendsStudied = "friends_studied"
    case earlyBird = "early_bird"
    case nightOwl = "night_owl"
    case weekendWarrior = "weekend_warrior"
    case perfectMonth = "perfect_month"
}

/// Achievement model
struct Achievement: Codable, Identifiable {
    let id: String
    let name: String
    let nameEn: String
    let description: String
    let icon: String
    let category: AchievementCategory
    let requirement: Int
    let type: AchievementType
    let rarity: AchievementRarity
    let unlockedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, name, description, icon, category, requirement, type, rarity
        case nameEn = "name_en"
        case unlockedAt = "unlocked_at"
    }
}

/// User achievement with unlock status
struct UserAchievement: Codable, Identifiable {
    let id: String
    let achievementId: String
    let unlockedAt: Date
    let metadata: [String: String]?

    enum CodingKeys: String, CodingKey {
        case id
        case achievementId = "achievement_id"
        case unlockedAt = "unlocked_at"
        case metadata
    }
}

/// Achievement check response
struct AchievementCheckResponse: Codable {
    let newlyUnlocked: [Achievement]
    let totalUnlocked: Int

    enum CodingKeys: String, CodingKey {
        case newlyUnlocked = "newly_unlocked"
        case totalUnlocked = "total_unlocked"
    }
}

// MARK: - Friend Request

/// Friend request model
struct FriendRequest: Codable, Identifiable {
    let id: String
    let fromUserId: String
    let fromUsername: String
    let fromAvatarUrl: String?
    let toUserId: String
    let status: String
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case fromUserId = "from_user_id"
        case fromUsername = "from_username"
        case fromAvatarUrl = "from_avatar_url"
        case toUserId = "to_user_id"
        case status
        case createdAt = "created_at"
    }
}

/// Add friend request
struct AddFriendRequest: Codable {
    let friendId: String

    enum CodingKeys: String, CodingKey {
        case friendId = "friend_id"
    }
}

/// Friend model (API response)
struct APIFriend: Codable, Identifiable {
    let id: String
    let friendId: String
    let username: String
    let displayName: String?
    let avatarUrl: String?
    let status: String
    let addedAt: Date
    let bio: String?
    let studyTime: Int?
    let isStudying: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case friendId = "friend_id"
        case username
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case status
        case addedAt = "added_at"
        case bio
        case studyTime = "study_time"
        case isStudying = "is_studying"
    }
}

/// Recommended friend model (API response)
struct APIFriendRecommendation: Codable, Identifiable {
    let id: String
    let name: String
    let avatarUrl: String?
    let mutualFriends: Int
    let isOnline: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case avatarUrl = "avatar_url"
        case mutualFriends = "mutual_friends"
        case isOnline = "is_online"
    }
}

// MARK: - Mall

/// Mall category
enum MallCategory: String, Codable {
    case clothing
    case accessory
    case prop
}

/// Mall item
struct MallItem: Codable, Identifiable {
    let id: String
    let name: String
    let description: String
    let image: String
    let price: Int
    let category: MallCategory
    let isOwned: Bool
}

/// Purchase request
struct PurchaseRequest: Codable {
    let itemId: String
    let quantity: Int?

    enum CodingKeys: String, CodingKey {
        case itemId = "item_id"
        case quantity
    }
}

/// Purchase response
struct PurchaseResponse: Codable {
    let success: Bool
    let message: String
    let remainingPoints: Int
    let item: MallItem?

    enum CodingKeys: String, CodingKey {
        case success, message
        case remainingPoints = "remaining_points"
        case item
    }
}

/// Purchase history item
struct PurchaseHistoryItem: Codable, Identifiable {
    let id: String
    let item: MallItem
    let purchasedAt: Date
    let pointsSpent: Int

    enum CodingKeys: String, CodingKey {
        case id, item
        case purchasedAt = "purchased_at"
        case pointsSpent = "points_spent"
    }
}

// MARK: - Wardrobe

/// Wardrobe outfit (alias for Outfit)
typealias WardrobeOutfit = Outfit

/// Outfit category
enum OutfitCategory: String, Codable {
    case hair
    case top
    case bottom
    case shoes
    case accessory
    case background
}

/// Outfit item
struct Outfit: Codable, Identifiable {
    let id: String
    let name: String
    let category: OutfitCategory
    let image: String
    let previewImage: String?
    let isOwned: Bool
    let isEquipped: Bool
    let description: String?
    let price: Int?

    enum CodingKeys: String, CodingKey {
        case id, name, category, image, description, price
        case previewImage = "preview_image"
        case isOwned = "is_owned"
        case isEquipped = "is_equipped"
    }
}

/// Equip response
struct EquipResponse: Codable {
    let success: Bool
    let message: String
    let equippedOutfit: Outfit?

    enum CodingKeys: String, CodingKey {
        case success, message
        case equippedOutfit = "equipped_outfit"
    }
}

// MARK: - Todo

/// Todo model from API
struct APITodo: Codable, Identifiable {
    let id: String
    let userId: String
    let title: String
    let description: String?
    let isCompleted: Bool
    let dueDate: Date?
    let priority: Int
    let tags: [String]
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id, title, description, priority, tags
        case userId = "user_id"
        case isCompleted = "is_completed"
        case dueDate = "due_date"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Create todo request
struct APICreateTodoRequest: Codable {
    let title: String
    let description: String?
    let dueDate: Date?
    let priority: Int?
    let tags: [String]?

    enum CodingKeys: String, CodingKey {
        case title, description, priority, tags
        case dueDate = "due_date"
    }
}

/// Update todo request
struct APIUpdateTodoRequest: Codable {
    let title: String?
    let description: String?
    let isCompleted: Bool?
    let dueDate: Date?
    let priority: Int?
    let tags: [String]?

    enum CodingKeys: String, CodingKey {
        case title, description, priority, tags
        case isCompleted = "is_completed"
        case dueDate = "due_date"
    }
}

// MARK: - Study History

/// Daily study summary
struct DailyStudySummary: Codable {
    let date: String
    let totalMinutes: Int
    let sessionsCount: Int
    let longestSession: Int
    let averageDuration: Int

    enum CodingKeys: String, CodingKey {
        case date
        case totalMinutes = "total_minutes"
        case sessionsCount = "sessions_count"
        case longestSession = "longest_session"
        case averageDuration = "average_duration"
    }
}

/// Weekly study summary
struct WeeklyStudySummary: Codable {
    let weekStart: String
    let weekEnd: String
    let totalMinutes: Int
    let sessionsCount: Int
    let dailyAverage: Int
    let bestDay: DailyStudySummary
    let streakDays: Int

    enum CodingKeys: String, CodingKey {
        case weekStart = "week_start"
        case weekEnd = "week_end"
        case totalMinutes = "total_minutes"
        case sessionsCount = "sessions_count"
        case dailyAverage = "daily_average"
        case bestDay = "best_day"
        case streakDays = "streak_days"
    }
}

/// Monthly study summary
struct MonthlyStudySummary: Codable {
    let month: String
    let year: Int
    let totalMinutes: Int
    let sessionsCount: Int
    let dailyAverage: Int
    let weeklyBreakdown: [WeeklyStudySummary]
    let longestStreak: Int

    enum CodingKeys: String, CodingKey {
        case month, year
        case totalMinutes = "total_minutes"
        case sessionsCount = "sessions_count"
        case dailyAverage = "daily_average"
        case weeklyBreakdown = "weekly_breakdown"
        case longestStreak = "longest_streak"
    }
}

// MARK: - Place

/// Place category
enum PlaceCategory: String, Codable {
    case library
    case cafe
    case bookstore
    case university
    case park
    case other
}

/// Place model
struct Place: Codable, Identifiable {
    let id: String
    let name: String
    let category: PlaceCategory
    let address: String?
    let latitude: Double
    let longitude: Double
    let rating: Double?
    let isFavorite: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, category, address, rating
        case latitude, longitude
        case isFavorite = "is_favorite"
    }
}

// MARK: - Clawbot (AI Conversation)

/// AI conversation model
struct ClawbotConversation: Codable, Identifiable {
    let id: String
    let name: String
    let avatarUrl: String?
    let lastMessage: String?
    let lastMessageAt: Date?
    let unreadCount: Int
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id, name
        case avatarUrl = "avatar_url"
        case lastMessage = "last_message"
        case lastMessageAt = "last_message_at"
        case unreadCount = "unread_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Create conversation request
struct CreateClawbotConversationRequest: Codable {
    let name: String?
}

/// Send message request
struct SendClawbotMessageRequest: Codable {
    let content: String
}

// MARK: - Study Goals

/// Study goal model
struct StudyGoal: Codable, Identifiable {
    let id: String
    let userId: String
    let title: String
    let description: String?
    let targetMinutes: Int
    let currentMinutes: Int
    let startDate: Date
    let endDate: Date
    let isCompleted: Bool
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case title, description
        case targetMinutes = "target_minutes"
        case currentMinutes = "current_minutes"
        case startDate = "start_date"
        case endDate = "end_date"
        case isCompleted = "is_completed"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Create study goal request
struct CreateStudyGoalRequest: Codable {
    let title: String
    let description: String?
    let targetMinutes: Int
    let startDate: Date
    let endDate: Date

    enum CodingKeys: String, CodingKey {
        case title, description
        case targetMinutes = "target_minutes"
        case startDate = "start_date"
        case endDate = "end_date"
    }
}

/// Update study goal request
struct UpdateStudyGoalRequest: Codable {
    let title: String?
    let description: String?
    let targetMinutes: Int?
    let currentMinutes: Int?
    let startDate: Date?
    let endDate: Date?
    let isCompleted: Bool?

    enum CodingKeys: String, CodingKey {
        case title, description
        case targetMinutes = "target_minutes"
        case currentMinutes = "current_minutes"
        case startDate = "start_date"
        case endDate = "end_date"
        case isCompleted = "is_completed"
    }
}

// MARK: - Notifications

/// App notification model from API
struct APIAppNotification: Codable, Identifiable {
    let id: String
    let userId: String
    let type: String
    let title: String
    let body: String
    let data: [String: String]?
    let isRead: Bool
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case type, title, body, data
        case isRead = "is_read"
        case createdAt = "created_at"
    }
}

// MARK: - Unread Counts

/// Unread counts model
struct UnreadCounts: Codable {
    let total: Int
    let chat: Int
    let notifications: Int
    let friendRequests: Int

    enum CodingKeys: String, CodingKey {
        case total, chat, notifications
        case friendRequests = "friend_requests"
    }
}

/// Update unread count request
struct UpdateUnreadCountRequest: Codable {
    let count: Int

    enum CodingKeys: String, CodingKey {
        case count
    }
}
