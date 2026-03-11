//
//  NotificationManager.swift
//  TRIX3DCompanion
//
//  Unified notification manager for managing all notification operations and preferences
//

import Foundation
import UserNotifications
import Combine

// MARK: - Notification Manager

/// Unified notification manager implementation
@MainActor
final class NotificationManager: NSObject, ObservableObject, NotificationManagerProtocol {

    // MARK: - Singleton

    static let shared = NotificationManager()

    // MARK: - Published Properties

    /// Current notification preferences
    @Published private(set) var preferences: NotificationPreferences

    /// Last error
    @Published private(set) var lastError: Error?

    // MARK: - Dependencies

    private let localNotificationService: LocalNotificationService
    private let pushNotificationService: PushNotificationService
    private let userDefaults: UserDefaults

    // MARK: - Private Properties

    /// Event publisher subject
    private let eventSubject = PassthroughSubject<NotificationEvent, Never>()

    /// Cancellables for Combine subscriptions
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Computed Properties

    /// Whether any notifications are enabled
    var isAnyNotificationEnabled: Bool {
        return preferences.studyReminderEnabled ||
               preferences.dailyGoalEnabled ||
               preferences.chatMessageEnabled ||
               preferences.friendRequestEnabled ||
               preferences.systemEnabled
    }

    /// Whether DND is currently active
    var isDoNotDisturbActive: Bool {
        return preferences.doNotDisturbEnabled && preferences.isInQuietHours()
    }

    /// Publisher for notification events
    var eventPublisher: AnyPublisher<NotificationEvent, Never> {
        eventSubject.eraseToAnyPublisher()
    }

    /// Publisher for preferences changes
    var preferencesPublisher: AnyPublisher<NotificationPreferences, Never> {
        $preferences.eraseToAnyPublisher()
    }

    // MARK: - Initialization

    /// Initialize notification manager
    /// - Parameters:
    ///   - localNotificationService: Local notification service
    ///   - pushNotificationService: Push notification service
    ///   - userDefaults: User defaults
    init(
        localNotificationService: LocalNotificationService? = nil,
        pushNotificationService: PushNotificationService? = nil,
        userDefaults: UserDefaults = .standard
    ) {
        self.localNotificationService = localNotificationService ?? .shared
        self.pushNotificationService = pushNotificationService ?? .shared
        self.userDefaults = userDefaults

        // Load preferences from user defaults
        self.preferences = Self.loadPreferences(from: userDefaults)

        super.init()

        // Setup subscriptions
        setupSubscriptions()
    }

    // MARK: - Initialization

    /// Initialize notification manager
    func initialize() async throws {
        // Request permissions
        let granted = try await requestPermissions()

        if granted {
            // Register for remote notifications
            try? await pushNotificationService.registerForRemoteNotifications()
        }

        // Post initial event
        eventSubject.send(.permissionChanged(granted: granted))
    }

    // MARK: - Permissions

    /// Request notification permissions
    /// - Returns: Whether permission was granted
    func requestPermissions() async throws -> Bool {
        do {
            let granted = try await localNotificationService.requestAuthorization()
            eventSubject.send(.permissionChanged(granted: granted))
            lastError = nil
            return granted
        } catch {
            lastError = error
            throw error
        }
    }

    // MARK: - Preferences Management

    /// Update notification preferences
    /// - Parameter preferences: New preferences
    func updatePreferences(_ preferences: NotificationPreferences) async throws {
        self.preferences = preferences
        savePreferences(preferences)

        eventSubject.send(.preferencesChanged(preferences: preferences))

        // Re-evaluate scheduled notifications
        await rescheduleNotificationsIfNeeded()
    }

    /// Enable/disable notification type
    /// - Parameters:
    ///   - type: Notification type
    ///   - enabled: Whether to enable
    func setNotificationType(_ type: NotificationTypePreference, enabled: Bool) async throws {
        switch type {
        case .studyReminder:
            preferences.studyReminderEnabled = enabled
        case .dailyGoal:
            preferences.dailyGoalEnabled = enabled
        case .chatMessage:
            preferences.chatMessageEnabled = enabled
        case .friendRequest:
            preferences.friendRequestEnabled = enabled
        case .system:
            preferences.systemEnabled = enabled
        }

        savePreferences(preferences)
        eventSubject.send(.preferencesChanged(preferences: preferences))

        // Re-evaluate scheduled notifications
        await rescheduleNotificationsIfNeeded()
    }

    /// Enable/disable DND mode
    /// - Parameter enabled: Whether to enable DND
    func setDoNotDisturb(enabled: Bool) async throws {
        preferences.doNotDisturbEnabled = enabled
        savePreferences(preferences)

        eventSubject.send(.doNotDisturbToggled(enabled: enabled))

        // Re-evaluate scheduled notifications
        await rescheduleNotificationsIfNeeded()
    }

    /// Set quiet hours
    /// - Parameters:
    ///   - start: Start time (HH:MM)
    ///   - end: End time (HH:MM)
    func setQuietHours(start: String, end: String) async throws {
        // Validate time format
        guard isValidTimeFormat(start) && isValidTimeFormat(end) else {
            lastError = NotificationManagerError.invalidTimeFormat
            throw NotificationManagerError.invalidTimeFormat
        }

        preferences.quietHoursStart = start
        preferences.quietHoursEnd = end
        savePreferences(preferences)

        eventSubject.send(.preferencesChanged(preferences: preferences))

        // Re-evaluate scheduled notifications
        await rescheduleNotificationsIfNeeded()
    }

    // MARK: - Notification Delivery

    /// Check if notification should be delivered
    /// - Parameter type: Notification type
    /// - Returns: Whether notification should be delivered
    func shouldDeliverNotification(type: NotificationTypePreference) -> Bool {
        // Check if type is enabled
        guard preferences.isNotificationTypeEnabled(type) else {
            return false
        }

        // Check DND
        guard !preferences.shouldSuppressNotifications() else {
            return false
        }

        return true
    }

    /// Schedule local notification with preference check
    /// - Parameter request: Notification request
    /// - Returns: Notification ID if scheduled, nil if suppressed
    func scheduleIfAllowed(_ request: LocalNotificationRequest) async throws -> String? {
        // Check if notifications are authorized
        guard localNotificationService.isAuthorized else {
            lastError = NotificationManagerError.notAuthorized
            throw NotificationManagerError.notAuthorized
        }

        // Check if type is enabled
        let typePreference = NotificationTypePreference(rawValue: request.type.rawValue)
        if let preference = typePreference {
            guard shouldDeliverNotification(type: preference) else {
                // Notification suppressed by preferences
                return nil
            }
        }

        // Schedule notification
        return try await localNotificationService.schedule(request)
    }

    // MARK: - Notification Management

    /// Get all scheduled notifications
    /// - Returns: Array of pending notification requests
    func getScheduledNotifications() async -> [UNNotificationRequest] {
        return await localNotificationService.getScheduledNotifications()
    }

    /// Cancel all notifications
    func cancelAllNotifications() async {
        await localNotificationService.cancelAllNotifications()
    }

    /// Clear notification badge
    func clearBadge() {
        localNotificationService.clearBadge()
    }

    /// Get notification preferences
    /// - Returns: Current preferences
    func getPreferences() -> NotificationPreferences {
        return preferences
    }

    /// Reset preferences to default
    func resetPreferences() async throws {
        preferences = NotificationPreferences()
        savePreferences(preferences)

        eventSubject.send(.preferencesChanged(preferences: preferences))

        // Re-evaluate scheduled notifications
        await rescheduleNotificationsIfNeeded()
    }

    /// Get notification settings summary
    /// - Returns: Summary string
    func getSettingsSummary() async -> String {
        var summary = "通知设置摘要:\n"

        summary += "\n权限状态: \(localNotificationService.authorizationStatusDescription)"

        if preferences.doNotDisturbEnabled {
            summary += "\n免打扰: 开启 (\(preferences.quietHoursStart) - \(preferences.quietHoursEnd))"
        } else {
            summary += "\n免打扰: 关闭"
        }

        summary += "\n\n通知类型:"
        summary += "\n  学习提醒: \(preferences.studyReminderEnabled ? "✓" : "✗")"
        summary += "\n  每日目标: \(preferences.dailyGoalEnabled ? "✓" : "✗")"
        summary += "\n  聊天消息: \(preferences.chatMessageEnabled ? "✓" : "✗")"
        summary += "\n  好友请求: \(preferences.friendRequestEnabled ? "✓" : "✗")"
        summary += "\n  系统通知: \(preferences.systemEnabled ? "✓" : "✗")"

        let scheduled = await localNotificationService.getScheduledNotifications()
        summary += "\n\n已安排通知: \(scheduled.count) 个"

        return summary
    }

    // MARK: - Private Methods

    /// Setup Combine subscriptions
    private func setupSubscriptions() {
        // Subscribe to local notification service
        localNotificationService.$authorizationStatus
            .sink { [weak self] status in
                guard let self = self else { return }
                let granted = status == .authorized
                self.eventSubject.send(.permissionChanged(granted: granted))
            }
            .store(in: &cancellables)

        // Subscribe to push notification service
        pushNotificationService.notificationPublisher
            .sink { [weak self] payload in
                guard let self = self else { return }
                let type = NotificationTypePreference(rawValue: payload.type.rawValue)

                // Check if should deliver
                if let type = type {
                    if self.shouldDeliverNotification(type: type) {
                        self.eventSubject.send(.pushNotificationReceived(type: payload.type, userInfo: [:]))
                    }
                }
            }
            .store(in: &cancellables)
    }

    /// Load preferences from user defaults
    private static func loadPreferences(from userDefaults: UserDefaults) -> NotificationPreferences {
        if let data = userDefaults.data(forKey: "notificationPreferences"),
           let preferences = try? JSONDecoder().decode(NotificationPreferences.self, from: data) {
            return preferences
        }

        // Return default preferences
        return NotificationPreferences()
    }

    /// Save preferences to user defaults
    private func savePreferences(_ preferences: NotificationPreferences) {
        if let data = try? JSONEncoder().encode(preferences) {
            userDefaults.set(data, forKey: "notificationPreferences")
        }
    }

    /// Validate time format
    private func isValidTimeFormat(_ time: String) -> Bool {
        let pattern = "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
        let regex = try? NSRegularExpression(pattern: pattern)
        let range = NSRange(location: 0, length: time.utf16.count)
        return regex?.firstMatch(in: time, options: [], range: range) != nil
    }

    /// Re-schedule notifications if preferences changed
    private func rescheduleNotificationsIfNeeded() async {
        // Check if study reminders need to be re-scheduled
        if !preferences.studyReminderEnabled {
            await localNotificationService.cancelNotifications(ofType: .studyReminder)
        }

        // Check if daily goal reminders need to be re-scheduled
        if !preferences.dailyGoalEnabled {
            await localNotificationService.cancelNotifications(ofType: .dailyGoal)
        }
    }
}

// MARK: - Notification Manager Error

enum NotificationManagerError: Error, LocalizedError {
    case notAuthorized
    case invalidTimeFormat
    case preferenceSaveFailed

    var errorDescription: String? {
        switch self {
        case .notAuthorized:
            return "通知权限未授权"
        case .invalidTimeFormat:
            return "无效的时间格式，请使用 HH:MM 格式"
        case .preferenceSaveFailed:
            return "偏好设置保存失败"
        }
    }
}

// MARK: - Convenience Extensions

extension NotificationManager {

    /// Clear error state
    func clearError() {
        lastError = nil
    }

    /// Get enabled notification types
    var enabledNotificationTypes: [NotificationTypePreference] {
        return NotificationTypePreference.allCases.filter { type in
            preferences.isNotificationTypeEnabled(type)
        }
    }

    /// Get disabled notification types
    var disabledNotificationTypes: [NotificationTypePreference] {
        return NotificationTypePreference.allCases.filter { type in
            !preferences.isNotificationTypeEnabled(type)
        }
    }

    /// Check if currently in quiet hours
    var isInQuietHours: Bool {
        return preferences.isInQuietHours()
    }

    /// Get next scheduled notification
    func getNextScheduledNotification() async -> UNNotificationRequest? {
        let notifications = await localNotificationService.getScheduledNotifications()
        return notifications.first
    }

    /// Export preferences as JSON
    func exportPreferencesAsJSON() -> String? {
        guard let data = try? JSONEncoder().encode(preferences),
              let json = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] else {
            return nil
        }

        guard let jsonData = try? JSONSerialization.data(withJSONObject: json, options: .prettyPrinted) else {
            return nil
        }

        return String(data: jsonData, encoding: .utf8)
    }
}

// MARK: - UserDefaults Helpers

extension UserDefaults {
    var notificationPreferencesData: Data? {
        get {
            data(forKey: "notificationPreferences")
        }
        set {
            set(newValue, forKey: "notificationPreferences")
        }
    }
}
