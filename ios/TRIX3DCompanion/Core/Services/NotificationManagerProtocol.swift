//
//  NotificationManagerProtocol.swift
//  TRIX3DCompanion
//
//  Notification manager protocol defining the unified interface for all notification operations
//

import Foundation
import UserNotifications
import Combine

/// Notification preference keys
enum NotificationPreferenceKey: String, CaseIterable {
    case studyReminderEnabled = "study_reminder_enabled"
    case dailyGoalEnabled = "daily_goal_enabled"
    case chatMessageEnabled = "chat_message_enabled"
    case friendRequestEnabled = "friend_request_enabled"
    case systemEnabled = "system_enabled"
    case doNotDisturbEnabled = "do_not_disturb_enabled"
    case quietHoursStart = "quiet_hours_start"
    case quietHoursEnd = "quiet_hours_end"
    case soundEnabled = "sound_enabled"

    var defaultValue: Any {
        switch self {
        case .studyReminderEnabled, .dailyGoalEnabled, .chatMessageEnabled, .friendRequestEnabled, .systemEnabled, .soundEnabled:
            return true
        case .doNotDisturbEnabled:
            return false
        case .quietHoursStart:
            return "22:00"
        case .quietHoursEnd:
            return "08:00"
        }
    }
}

/// Notification type for preferences
enum NotificationTypePreference: String, CaseIterable, Codable {
    case studyReminder = "study_reminder"
    case dailyGoal = "daily_goal"
    case chatMessage = "chat_message"
    case friendRequest = "friend_request"
    case system = "system"

    var displayName: String {
        switch self {
        case .studyReminder:
            return "学习提醒"
        case .dailyGoal:
            return "每日目标"
        case .chatMessage:
            return "聊天消息"
        case .friendRequest:
            return "好友请求"
        case .system:
            return "系统通知"
        }
    }

    var preferenceKey: NotificationPreferenceKey {
        switch self {
        case .studyReminder:
            return .studyReminderEnabled
        case .dailyGoal:
            return .dailyGoalEnabled
        case .chatMessage:
            return .chatMessageEnabled
        case .friendRequest:
            return .friendRequestEnabled
        case .system:
            return .systemEnabled
        }
    }

    var icon: String {
        switch self {
        case .studyReminder:
            return "book.fill"
        case .dailyGoal:
            return "target"
        case .chatMessage:
            return "message.fill"
        case .friendRequest:
            return "person.2.fill"
        case .system:
            return "gear"
        }
    }
}

/// Notification preferences
struct NotificationPreferences: Codable {
    var studyReminderEnabled: Bool
    var dailyGoalEnabled: Bool
    var chatMessageEnabled: Bool
    var friendRequestEnabled: Bool
    var systemEnabled: Bool
    var doNotDisturbEnabled: Bool
    var quietHoursStart: String
    var quietHoursEnd: String
    var soundEnabled: Bool

    init(
        studyReminderEnabled: Bool = true,
        dailyGoalEnabled: Bool = true,
        chatMessageEnabled: Bool = true,
        friendRequestEnabled: Bool = true,
        systemEnabled: Bool = true,
        doNotDisturbEnabled: Bool = false,
        quietHoursStart: String = "22:00",
        quietHoursEnd: String = "08:00",
        soundEnabled: Bool = true
    ) {
        self.studyReminderEnabled = studyReminderEnabled
        self.dailyGoalEnabled = dailyGoalEnabled
        self.chatMessageEnabled = chatMessageEnabled
        self.friendRequestEnabled = friendRequestEnabled
        self.systemEnabled = systemEnabled
        self.doNotDisturbEnabled = doNotDisturbEnabled
        self.quietHoursStart = quietHoursStart
        self.quietHoursEnd = quietHoursEnd
        self.soundEnabled = soundEnabled
    }

    /// Check if notifications should be suppressed based on DND settings
    func shouldSuppressNotifications() -> Bool {
        guard doNotDisturbEnabled else {
            return false
        }

        return isInQuietHours()
    }

    /// Check if current time is in quiet hours
    func isInQuietHours() -> Bool {
        let currentTime = Date()
        let calendar = Calendar.current
        let components = calendar.dateComponents([.hour, .minute], from: currentTime)
        let currentMinutes = components.hour! * 60 + components.minute!

        let startMinutes = minutesFromTime(quietHoursStart)
        let endMinutes = minutesFromTime(quietHoursEnd)

        // Handle overnight quiet hours (e.g., 22:00 to 08:00)
        if startMinutes > endMinutes {
            return currentMinutes >= startMinutes || currentMinutes < endMinutes
        } else {
            return currentMinutes >= startMinutes && currentMinutes < endMinutes
        }
    }

    /// Check if specific notification type is enabled
    func isNotificationTypeEnabled(_ type: NotificationTypePreference) -> Bool {
        switch type {
        case .studyReminder:
            return studyReminderEnabled
        case .dailyGoal:
            return dailyGoalEnabled
        case .chatMessage:
            return chatMessageEnabled
        case .friendRequest:
            return friendRequestEnabled
        case .system:
            return systemEnabled
        }
    }

    /// Convert time string (HH:MM) to minutes
    private func minutesFromTime(_ time: String) -> Int {
        let parts = time.split(separator: ":")
        guard parts.count == 2,
              let hours = Int(parts[0]),
              let minutes = Int(parts[1]) else {
            return 0
        }
        return hours * 60 + minutes
    }
}

/// Notification event
enum NotificationEvent {
    case localNotificationReceived(type: LocalNotificationType, userInfo: [AnyHashable: Any])
    case pushNotificationReceived(type: PushNotificationType, userInfo: [AnyHashable: Any])
    case permissionChanged(granted: Bool)
    case preferencesChanged(preferences: NotificationPreferences)
    case doNotDisturbToggled(enabled: Bool)
}

/// Notification manager result type
typealias NotificationManagerResult<T> = Result<T, Error>

/// Protocol defining unified notification manager interface
protocol NotificationManagerProtocol {

    /// Current notification preferences
    var preferences: NotificationPreferences { get }

    /// Whether any notifications are enabled
    var isAnyNotificationEnabled: Bool { get }

    /// Whether DND is currently active
    var isDoNotDisturbActive: Bool { get }

    /// Publisher for notification events
    var eventPublisher: AnyPublisher<NotificationEvent, Never> { get }

    /// Publisher for preferences changes
    var preferencesPublisher: AnyPublisher<NotificationPreferences, Never> { get }

    /// Initialize notification manager
    func initialize() async throws

    /// Request notification permissions
    /// - Returns: Whether permission was granted
    func requestPermissions() async throws -> Bool

    /// Update notification preferences
    /// - Parameter preferences: New preferences
    func updatePreferences(_ preferences: NotificationPreferences) async throws

    /// Enable/disable notification type
    /// - Parameters:
    ///   - type: Notification type
    ///   - enabled: Whether to enable
    func setNotificationType(_ type: NotificationTypePreference, enabled: Bool) async throws

    /// Enable/disable DND mode
    /// - Parameter enabled: Whether to enable DND
    func setDoNotDisturb(enabled: Bool) async throws

    /// Set quiet hours
    /// - Parameters:
    ///   - start: Start time (HH:MM)
    ///   - end: End time (HH:MM)
    func setQuietHours(start: String, end: String) async throws

    /// Check if notification should be delivered
    /// - Parameter type: Notification type
    /// - Returns: Whether notification should be delivered
    func shouldDeliverNotification(type: NotificationTypePreference) -> Bool

    /// Get notification preferences
    /// - Returns: Current preferences
    func getPreferences() -> NotificationPreferences

    /// Reset preferences to default
    func resetPreferences() async throws

    /// Schedule local notification with preference check
    /// - Parameter request: Notification request
    /// - Returns: Notification ID if scheduled, nil if suppressed
    func scheduleIfAllowed(_ request: LocalNotificationRequest) async throws -> String?

    /// Get all scheduled notifications
    /// - Returns: Array of pending notification requests
    func getScheduledNotifications() async -> [UNNotificationRequest]

    /// Cancel all notifications
    func cancelAllNotifications() async

    /// Clear notification badge
    func clearBadge()

    /// Get notification settings summary
    /// - Returns: Summary string
    func getSettingsSummary() async -> String
}
