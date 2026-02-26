//
//  PushNotificationServiceProtocol.swift
//  TRIX3DCompanion
//
//  Push notification service protocol defining the interface for remote notification operations
//

import Foundation
import UserNotifications
import Combine

/// Push notification error types
enum PushNotificationError: Error, LocalizedError {
    /// Registration failed
    case registrationFailed(Error)
    /// Token upload failed
    case tokenUploadFailed(Error)
    /// Invalid device token
    case invalidToken
    /// Not registered for remote notifications
    case notRegistered
    /// APNs unavailable
    case apnsUnavailable

    var errorDescription: String? {
        switch self {
        case .registrationFailed(let error):
            return "推送通知注册失败: \(error.localizedDescription)"
        case .tokenUploadFailed(let error):
            return "设备令牌上传失败: \(error.localizedDescription)"
        case .invalidToken:
            return "无效的设备令牌"
        case .notRegistered:
            return "未注册远程通知"
        case .apnsUnavailable:
            return "APNs 服务不可用"
        }
    }

    var isRecoverable: Bool {
        switch self {
        case .invalidToken, .notRegistered, .apnsUnavailable:
            return false
        case .registrationFailed, .tokenUploadFailed:
            return true
        }
    }
}

/// Push notification payload
struct PushNotificationPayload: Codable {
    let type: PushNotificationType
    let title: String?
    let body: String
    let sound: String?
    let badge: Int?
    let data: [String: String]?
    let category: String?

    init(
        type: PushNotificationType,
        title: String? = nil,
        body: String,
        sound: String? = "default",
        badge: Int? = nil,
        data: [String: String]? = nil,
        category: String? = nil
    ) {
        self.type = type
        self.title = title
        self.body = body
        self.sound = sound
        self.badge = badge
        self.data = data
        self.category = category
    }

    init(from userInfo: [AnyHashable: Any]) throws {
        guard let typeString = userInfo["type"] as? String,
              let type = PushNotificationType(rawValue: typeString) else {
            throw PushNotificationError.invalidToken
        }

        self.type = type
        self.title = userInfo["title"] as? String
        self.body = userInfo["body"] as? String ?? ""
        self.sound = userInfo["sound"] as? String
        self.badge = userInfo["badge"] as? Int
        self.data = userInfo["data"] as? [String: String]
        self.category = userInfo["category"] as? String
    }
}

/// Push notification type
enum PushNotificationType: String, Codable {
    case chatMessage = "chat_message"
    case friendRequest = "friend_request"
    case system = "system"
    case studyReminder = "study_reminder"
    case dailyGoal = "daily_goal"

    var categoryIdentifier: String {
        return "PUSH_\(self.rawValue.uppercased())"
    }

    var defaultTitle: String {
        switch self {
        case .chatMessage:
            return "新消息"
        case .friendRequest:
            return "好友请求"
        case .system:
            return "系统通知"
        case .studyReminder:
            return "学习提醒"
        case .dailyGoal:
            return "每日目标"
        }
    }
}

/// Device token information
struct DeviceTokenInfo: Codable {
    let token: String
    let deviceType: DeviceTokenType
    let appVersion: String
    let osVersion: String
    let registeredAt: Date

    init(
        token: String,
        deviceType: DeviceTokenType = .iOS,
        appVersion: String = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0",
        osVersion: String = UIDevice.current.systemVersion
    ) {
        self.token = token
        self.deviceType = deviceType
        self.appVersion = appVersion
        self.osVersion = osVersion
        self.registeredAt = Date()
    }
}

/// Device token type
enum DeviceTokenType: String, Codable {
    case iOS = "ios"
    case iPadOS = "ipados"
}

/// Push notification service result type
typealias PushNotificationResult<T> = Result<T, PushNotificationError>

/// Protocol defining push notification service interface
protocol PushNotificationServiceProtocol {

    /// Current device token
    var currentDeviceToken: String? { get }

    /// Whether device is registered for remote notifications
    var isRegistered: Bool { get }

    /// Registration status
    var registrationStatus: RegistrationStatus { get }

    /// Publisher for push notification events
    var notificationPublisher: AnyPublisher<PushNotificationPayload, Never> { get }

    /// Publisher for token updates
    var tokenPublisher: AnyPublisher<String?, Never> { get }

    /// Register for remote notifications
    func registerForRemoteNotifications() async throws

    /// Unregister from remote notifications
    func unregisterForRemoteNotifications()

    /// Handle device token registration
    /// - Parameter deviceToken: Device token from APNs
    func didRegisterForRemoteNotifications(withDeviceToken deviceToken: Data)

    /// Handle registration failure
    /// - Parameter error: Error from APNs
    func didFailToRegisterForRemoteNotifications(error: Error)

    /// Handle incoming remote notification
    /// - Parameters:
    ///   - userInfo: Notification payload
    ///   - isForeground: Whether app is in foreground
    func didReceiveRemoteNotification(userInfo: [AnyHashable: Any], isForeground: Bool)

    /// Upload device token to server
    /// - Parameter tokenInfo: Device token information
    func uploadDeviceToken(_ tokenInfo: DeviceTokenInfo) async throws

    /// Get current device token info
    /// - Returns: Device token info, if available
    func getCurrentTokenInfo() -> DeviceTokenInfo?

    /// Refresh device token registration
    func refreshRegistration() async throws
}

/// Registration status
enum RegistrationStatus {
    case notRegistered
    case registering
    case registered
    case failed(Error)

    var isRegistered: Bool {
        if case .registered = self {
            return true
        }
        return false
    }
}
