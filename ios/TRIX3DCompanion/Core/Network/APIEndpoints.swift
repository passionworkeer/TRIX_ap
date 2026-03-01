//
//  APIEndpoints.swift
//  TRIX3DCompanion
//
//  API endpoint definitions
//  Common types (User, ChatMessage, etc.) are defined in Shared/Models
//

import Foundation

// Re-export types from Shared/Models for API compatibility
// These typealiases allow code that imports APIEndpoints to use these types
// while avoiding duplicate definitions
//
// NOTE: These types are defined in Shared/Models directory
// The actual definitions are there, these are just aliases for backward compatibility

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
        #if DEBUG
        if APISecurityConfig.allowInsecureInDev {
            // Only for local development convenience - NOT for production use
            return "http://TRIX_SERVER_HOST:8765"
        }
        #endif
        // Default to HTTPS for security
        return "https://api.trix3d.com"
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
        #if DEBUG
        if APISecurityConfig.allowInsecureInDev {
            // Only for local development convenience - NOT for production use
            return "ws://TRIX_SERVER_HOST:8765"
        }
        #endif
        // Default to WSS for security
        return "wss://api.trix3d.com"
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

    // MARK: - Chat
    case chatRooms
    case chatRoomCreate
    case chatRoom(id: String)
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
    case deviceToken
    case notificationPreferences
    case notificationSettings

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
        case .chatRoomCreate: return "/chat/rooms"
        case .chatRoom(let id): return "/chat/rooms/\(id)"
        case .chatRoomMessages(let roomId): return "/chat/rooms/\(roomId)/messages"
        case .chatRoomMessagesSend(let roomId): return "/chat/rooms/\(roomId)/messages"
        case .chatRoomMessagesRead(let roomId): return "/chat/rooms/\(roomId)/messages/read"

        // Study
        case .studySessions: return "/study/sessions"
        case .updateStudySession(let id): return "/study/sessions/\(id)"
        case .deleteStudySession(let id): return "/study/sessions/\(id)"
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
             .deviceToken, .purchasePoints, .verifyReceipt, .restorePurchases,
             .pointsAdd, .pointsDeduct:
            return .post

        // Update operations - PUT methods
        case .userUpdateProfile, .updateStudySession, .pairingDevice, .cancelOrder:
            return .put

        // Read operations - GET methods
        case .userProfile, .authMe, .userStats, .userSettings,
             .chatRooms, .chatRoom, .chatRoomMessages,
             .studySessions, .studyStats, .studyRoomState,
             .pairingStatus, .pairingDevices,
             .points, .pointsHistory,
             .locations, .location, .locationNearby, .locationShare,
             .snapshots, .snapshot,
             .notificationPreferences, .notificationSettings,
             .getOrders, .getOrder, .getSubscription:
            return .get

        // Delete operations - DELETE methods
        case .deleteStudySession:
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

// MARK: - User
// User, UserSession, ProfileUpdate are now typealiases to Shared/Models

struct UserStats: Codable {
    let totalStudyTime: Int
    let sessionCount: Int
    let averageDuration: Int
    let streakDays: Int
    let todayDuration: Int
    let weekDuration: Int
}

// MARK: - Chat
// ChatRoom, ChatRoomType, ChatMessage, MessageSender, MessageType are now typealiases

struct SendMessageRequest: Codable {
    let content: String
    let contentType: MessageType
    let mediaUrl: String?
    let mediaMimeType: String?
}

struct MarkAsReadRequest: Codable {
    let messageId: String
}

/// Request to create a new chat room
struct CreateChatRoomRequest: Codable {
    let name: String
    let type: ChatRoomType
}

// MARK: - Study
// StudySession, StudyStats are now typealiases

struct CreateStudySessionRequest: Codable {
    let durationMinutes: Int
}

// MARK: - Pairing
// PairingRequest, PairingResponse, PairingStatusResponse, DeviceType are now typealiases
// PairedDevice is kept here as API-specific type

struct PairedDevice: Codable, Identifiable {
    let id: String
    let deviceId: String
    let deviceName: String
    let deviceType: DeviceType
    let pairedAt: Date
    let isOnline: Bool
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

// MARK: - Points
// PointsTransaction, TransactionType are now typealiases to Shared/Models
// PaymentStatus is kept here as it's API-specific

enum PaymentStatus: String, Codable {
    case pending = "pending"
    case processing = "processing"
    case completed = "completed"
    case failed = "failed"
    case cancelled = "cancelled"
    case refunded = "refunded"
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
}

/// Subscription information
struct SubscriptionInfo: Codable {
    let isActive: Bool
    let tier: String?
    let expiresAt: Date?
    let willAutoRenew: Bool
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
}

/// Restore purchases response
struct RestorePurchasesResponse: Codable {
    let restoredOrders: [OrderDetailsResponse]
    let totalRestored: Int
    let message: String?
}
