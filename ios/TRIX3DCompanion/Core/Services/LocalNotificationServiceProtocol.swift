//
//  LocalNotificationServiceProtocol.swift
//  TRIX3DCompanion
//
//  Local notification service protocol defining the interface for local notification operations
//

import Foundation
import UserNotifications

/// Local notification error types
enum LocalNotificationError: Error, LocalizedError {
    /// Notification permission not granted
    case permissionDenied
    /// Notification scheduling failed
    case schedulingFailed(Error)
    /// Notification removal failed
    case removalFailed(Error)
    /// Invalid notification time
    case invalidTime
    /// Notification identifier not found
    case notificationNotFound

    var errorDescription: String? {
        switch self {
        case .permissionDenied:
            return "通知权限被拒绝，请在设置中启用通知权限"
        case .schedulingFailed(let error):
            return "通知调度失败: \(error.localizedDescription)"
        case .removalFailed(let error):
            return "通知移除失败: \(error.localizedDescription)"
        case .invalidTime:
            return "无效的通知时间"
        case .notificationNotFound:
            return "通知不存在"
        }
    }

    var isRecoverable: Bool {
        switch self {
        case .permissionDenied, .invalidTime, .notificationNotFound:
            return false
        case .schedulingFailed, .removalFailed:
            return true
        }
    }
}

/// Local notification type
enum LocalNotificationType: String, Codable, CaseIterable {
    /// Study reminder notification
    case studyReminder = "study_reminder"
    /// Daily goal reminder notification
    case dailyGoal = "daily_goal"
    /// System notification
    case system = "system"

    var categoryIdentifier: String {
        return "CATEGORY_\(self.rawValue.uppercased())"
    }

    var defaultTitle: String {
        switch self {
        case .studyReminder:
            return "学习提醒"
        case .dailyGoal:
            return "每日目标"
        case .system:
            return "系统通知"
        }
    }

    var description: String {
        switch self {
        case .studyReminder:
            return "定时提醒学习时间"
        case .dailyGoal:
            return "每日学习目标提醒"
        case .system:
            return "系统相关通知"
        }
    }
}

/// Local notification request
struct LocalNotificationRequest: Identifiable {
    let id: String
    let type: LocalNotificationType
    let title: String
    let body: String
    let scheduledDate: Date?
    let repeats: Bool
    let sound: UNNotificationSound?
    let userInfo: [String: Any]?
    let categoryIdentifier: String?

    init(
        id: String = UUID().uuidString,
        type: LocalNotificationType,
        title: String,
        body: String,
        scheduledDate: Date? = nil,
        repeats: Bool = false,
        sound: UNNotificationSound? = .default,
        userInfo: [String: Any]? = nil,
        categoryIdentifier: String? = nil
    ) {
        self.id = id
        self.type = type
        self.title = title
        self.body = body
        self.scheduledDate = scheduledDate
        self.repeats = repeats
        self.sound = sound
        self.userInfo = userInfo
        self.categoryIdentifier = categoryIdentifier ?? type.categoryIdentifier
    }
}

/// Study reminder configuration
struct StudyReminderConfig: Codable {
    let hour: Int
    let minute: Int
    let repeats: Bool
    let weekdays: [Int]?
    let message: String?

    init(
        hour: Int = 20,
        minute: Int = 0,
        repeats: Bool = true,
        weekdays: [Int]? = nil,
        message: String? = nil
    ) {
        self.hour = hour
        self.minute = minute
        self.repeats = repeats
        self.weekdays = weekdays
        self.message = message
    }

    func isValid() -> Bool {
        return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
    }
}

/// Daily goal reminder configuration
struct DailyGoalConfig: Codable {
    let hour: Int
    let minute: Int
    let message: String?

    init(
        hour: Int = 21,
        minute: Int = 0,
        message: String? = nil
    ) {
        self.hour = hour
        self.minute = minute
        self.message = message
    }

    func isValid() -> Bool {
        return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
    }
}

/// Local notification service result type
typealias LocalNotificationResult<T> = Result<T, LocalNotificationError>

/// Protocol defining local notification service interface
protocol LocalNotificationServiceProtocol {

    /// Current authorization status
    var authorizationStatus: UNAuthorizationStatus { get }

    /// Whether notifications are authorized
    var isAuthorized: Bool { get }

    /// Request notification permissions
    /// - Parameter options: Authorization options to request
    /// - Returns: Whether permission was granted
    func requestAuthorization(options: UNAuthorizationOptions) async throws -> Bool

    /// Check current authorization status
    func checkAuthorizationStatus() async -> UNAuthorizationStatus

    /// Schedule a local notification
    /// - Parameter request: Notification request
    /// - Returns: Notification ID
    func schedule(_ request: LocalNotificationRequest) async throws -> String

    /// Schedule study reminder
    /// - Parameters:
    ///   - config: Study reminder configuration
    ///   - customMessage: Custom message (optional)
    /// - Returns: Notification ID
    func scheduleStudyReminder(config: StudyReminderConfig, customMessage: String? = nil) async throws -> String

    /// Schedule daily goal reminder
    /// - Parameters:
    ///   - config: Daily goal configuration
    ///   - goalProgress: Current goal progress (optional)
    /// - Returns: Notification ID
    func scheduleDailyGoalReminder(config: DailyGoalConfig, goalProgress: String? = nil) async throws -> String

    /// Get all scheduled notifications
    /// - Returns: Array of pending notification requests
    func getScheduledNotifications() async -> [UNNotificationRequest]

    /// Get pending notifications by type
    /// - Parameter type: Notification type
    /// - Returns: Array of pending notification requests
    func getPendingNotifications(ofType type: LocalNotificationType) async -> [UNNotificationRequest]

    /// Cancel a specific notification
    /// - Parameter identifier: Notification ID
    func cancelNotification(identifier: String) async throws

    /// Cancel all notifications of a specific type
    /// - Parameter type: Notification type
    func cancelNotifications(ofType type: LocalNotificationType) async

    /// Cancel all scheduled notifications
    func cancelAllNotifications() async

    /// Remove delivered notifications
    func removeDeliveredNotifications() async

    /// Get notification settings
    /// - Returns: Current notification settings
    func getNotificationSettings() async -> UNNotificationSettings

    /// Register notification categories
    func registerCategories()

    /// Set notification badge count
    /// - Parameter count: Badge count (0 to clear)
    func setBadgeCount(_ count: Int)

    /// Clear notification badge
    func clearBadge()
}
