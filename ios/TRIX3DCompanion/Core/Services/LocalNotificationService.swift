//
//  LocalNotificationService.swift
//  TRIX3DCompanion
//
//  Local notification service for managing local notifications, permissions, and scheduling
//

import Foundation
import UIKit
import UserNotifications
import Combine

// MARK: - Local Notification Service

/// Local notification service implementation
@MainActor
final class LocalNotificationService: NSObject, ObservableObject, LocalNotificationServiceProtocol {

    // MARK: - Singleton

    static let shared = LocalNotificationService()

    // MARK: - Published Properties

    /// Current authorization status
    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined

    /// Last error
    @Published private(set) var lastError: LocalNotificationError?

    // MARK: - Dependencies

    private let notificationCenter: UNUserNotificationCenter

    // MARK: - Initialization

    /// Initialize notification service
    /// - Parameter notificationCenter: Notification center instance (default: shared)
    init(
        notificationCenter: UNUserNotificationCenter = .current()
    ) {
        self.notificationCenter = notificationCenter
        super.init()

        // Set delegate
        notificationCenter.delegate = self

        // Register categories
        registerCategories()

        // Check initial authorization status
        Task {
            _ = await checkAuthorizationStatus()
        }
    }

    // MARK: - Computed Properties

    /// Whether notifications are authorized
    var isAuthorized: Bool {
        return authorizationStatus == .authorized || authorizationStatus == .provisional
    }

    // MARK: - Authorization

    /// Request notification permissions
    /// - Parameter options: Authorization options to request
    /// - Returns: Whether permission was granted
    func requestAuthorization(options: UNAuthorizationOptions = [.alert, .sound, .badge]) async throws -> Bool {
        let granted = try await notificationCenter.requestAuthorization(options: options)

        _ = await checkAuthorizationStatus()

        if !granted {
            lastError = .permissionDenied
            throw LocalNotificationError.permissionDenied
        }

        lastError = nil
        return granted
    }

    /// Check current authorization status
    func checkAuthorizationStatus() async -> UNAuthorizationStatus {
        let settings = await notificationCenter.notificationSettings()
        authorizationStatus = settings.authorizationStatus
        return authorizationStatus
    }

    // MARK: - Scheduling

    /// Schedule a local notification
    /// - Parameter request: Notification request
    /// - Returns: Notification ID
    func schedule(_ request: LocalNotificationRequest) async throws -> String {
        // Check authorization
        guard isAuthorized else {
            lastError = .permissionDenied
            throw LocalNotificationError.permissionDenied
        }

        // Create content
        let content = UNMutableNotificationContent()
        content.title = request.title
        content.body = request.body
        content.sound = request.sound ?? .default

        if let categoryIdentifier = request.categoryIdentifier {
            content.categoryIdentifier = categoryIdentifier
        }

        // Add user info
        if let userInfo = request.userInfo {
            content.userInfo = userInfo
        }

        // Add notification type
        content.userInfo["type"] = request.type.rawValue

        // Create trigger
        let trigger: UNNotificationTrigger
        if let scheduledDate = request.scheduledDate {
            if request.repeats {
                // For repeating notifications, use calendar trigger
                let dateComponents = Calendar.current.dateComponents(
                    [.hour, .minute, .weekday],
                    from: scheduledDate
                )
                trigger = UNCalendarNotificationTrigger(
                    dateMatching: dateComponents,
                    repeats: true
                )
            } else {
                // For one-time notifications, use date trigger
                trigger = UNTimeIntervalNotificationTrigger(
                    timeInterval: scheduledDate.timeIntervalSinceNow,
                    repeats: false
                )
            }
        } else {
            // Immediate notification
            trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.1, repeats: false)
        }

        // Create request
        let notificationRequest = UNNotificationRequest(
            identifier: request.id,
            content: content,
            trigger: trigger
        )

        // Schedule notification
        do {
            try await notificationCenter.add(notificationRequest)
            lastError = nil
            return request.id
        } catch {
            let notificationError = LocalNotificationError.schedulingFailed(error)
            lastError = notificationError
            throw notificationError
        }
    }

    /// Schedule study reminder
    /// - Parameters:
    ///   - config: Study reminder configuration
    ///   - customMessage: Custom message (optional)
    /// - Returns: Notification ID
    func scheduleStudyReminder(
        config: StudyReminderConfig,
        customMessage: String? = nil
    ) async throws -> String {
        guard config.isValid() else {
            lastError = .invalidTime
            throw LocalNotificationError.invalidTime
        }

        let message = customMessage ?? config.message ?? "该开始学习了！保持学习习惯，达成每日目标。"

        var dateComponents = DateComponents()
        dateComponents.hour = config.hour
        dateComponents.minute = config.minute

        if let weekdays = config.weekdays, !weekdays.isEmpty {
            dateComponents.weekday = weekdays.first
        }

        let scheduledDate = Calendar.current.date(from: dateComponents) ?? Date()

        let request = LocalNotificationRequest(
            id: "STUDY_REMINDER_\(UUID().uuidString)",
            type: .studyReminder,
            title: "学习提醒",
            body: message,
            scheduledDate: scheduledDate,
            repeats: config.repeats,
            sound: .default,
            userInfo: ["config": config]
        )

        return try await schedule(request)
    }

    /// Schedule daily goal reminder
    /// - Parameters:
    ///   - config: Daily goal configuration
    ///   - goalProgress: Current goal progress (optional)
    /// - Returns: Notification ID
    func scheduleDailyGoalReminder(
        config: DailyGoalConfig,
        goalProgress: String? = nil
    ) async throws -> String {
        guard config.isValid() else {
            lastError = .invalidTime
            throw LocalNotificationError.invalidTime
        }

        var message = config.message ?? "别忘了检查今日学习目标！"

        if let progress = goalProgress {
            message += " 当前进度：\(progress)"
        }

        var dateComponents = DateComponents()
        dateComponents.hour = config.hour
        dateComponents.minute = config.minute

        let scheduledDate = Calendar.current.date(from: dateComponents) ?? Date()

        let request = LocalNotificationRequest(
            id: "DAILY_GOAL_\(UUID().uuidString)",
            type: .dailyGoal,
            title: "每日目标提醒",
            body: message,
            scheduledDate: scheduledDate,
            repeats: true,
            sound: .default,
            userInfo: nil
        )

        return try await schedule(request)
    }

    // MARK: - Retrieval

    /// Get all scheduled notifications
    /// - Returns: Array of pending notification requests
    func getScheduledNotifications() async -> [UNNotificationRequest] {
        return await notificationCenter.pendingNotificationRequests()
    }

    /// Get pending notifications by type
    /// - Parameter type: Notification type
    /// - Returns: Array of pending notification requests
    func getPendingNotifications(ofType type: LocalNotificationType) async -> [UNNotificationRequest] {
        let allPending = await notificationCenter.pendingNotificationRequests()
        return allPending.filter { request in
            request.content.userInfo["type"] as? String == type.rawValue
        }
    }

    // MARK: - Cancellation

    /// Cancel a specific notification
    /// - Parameter identifier: Notification ID
    func cancelNotification(identifier: String) async throws {
        let pending = await notificationCenter.pendingNotificationRequests()
        let exists = pending.contains { $0.identifier == identifier }

        guard exists else {
            lastError = .notificationNotFound
            throw LocalNotificationError.notificationNotFound
        }

        notificationCenter.removePendingNotificationRequests(withIdentifiers: [identifier])
        lastError = nil
    }

    /// Cancel all notifications of a specific type
    /// - Parameter type: Notification type
    func cancelNotifications(ofType type: LocalNotificationType) async {
        let pending = await notificationCenter.pendingNotificationRequests()
        let toRemove = pending.filter { $0.content.userInfo["type"] as? String == type.rawValue }

        let identifiers = toRemove.map { $0.identifier }
        notificationCenter.removePendingNotificationRequests(withIdentifiers: identifiers)
    }

    /// Cancel all scheduled notifications
    func cancelAllNotifications() async {
        notificationCenter.removeAllPendingNotificationRequests()
    }

    /// Remove delivered notifications
    func removeDeliveredNotifications() async {
        notificationCenter.removeAllDeliveredNotifications()
    }

    // MARK: - Settings

    /// Get notification settings
    /// - Returns: Current notification settings
    func getNotificationSettings() async -> UNNotificationSettings {
        return await notificationCenter.notificationSettings()
    }

    /// Register notification categories
    func registerCategories() {
        let studyReminderCategory = UNNotificationCategory(
            identifier: LocalNotificationType.studyReminder.categoryIdentifier,
            actions: [],
            intentIdentifiers: [],
            options: []
        )

        let dailyGoalCategory = UNNotificationCategory(
            identifier: LocalNotificationType.dailyGoal.categoryIdentifier,
            actions: [],
            intentIdentifiers: [],
            options: []
        )

        let systemCategory = UNNotificationCategory(
            identifier: LocalNotificationType.system.categoryIdentifier,
            actions: [],
            intentIdentifiers: [],
            options: []
        )

        notificationCenter.setNotificationCategories([
            studyReminderCategory,
            dailyGoalCategory,
            systemCategory
        ])
    }

    /// Set notification badge count
    /// - Parameter count: Badge count
    func setBadgeCount(_ count: Int) {
        UIApplication.shared.applicationIconBadgeNumber = count
    }

    /// Clear notification badge
    func clearBadge() {
        UIApplication.shared.applicationIconBadgeNumber = 0
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension LocalNotificationService: UNUserNotificationCenterDelegate {

    /// Called when notification is presented while app is in foreground
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show notification even when app is in foreground
        let options: UNNotificationPresentationOptions = [.banner, .sound, .badge]
        completionHandler(options)
    }

    /// Called when user taps on notification
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo

        // Handle notification tap
        Task { @MainActor in
            // Post notification about tap event
            NotificationCenter.default.post(
                name: .notificationDidReceive,
                object: nil,
                userInfo: userInfo
            )
        }

        completionHandler()
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let notificationDidReceive = Notification.Name("notificationDidReceive")
    static let studyReminderReceived = Notification.Name("studyReminderReceived")
    static let dailyGoalReminderReceived = Notification.Name("dailyGoalReminderReceived")
}

// MARK: - Convenience Extensions

extension LocalNotificationService {

    /// Get count of pending notifications
    var pendingNotificationCount: Int {
        get async {
            let pending = await notificationCenter.pendingNotificationRequests()
            return pending.count
        }
    }

    /// Check if specific notification type is scheduled
    /// - Parameter type: Notification type
    /// - Returns: Whether notifications of this type are scheduled
    func hasScheduledNotifications(ofType type: LocalNotificationType) async -> Bool {
        let notifications = await getPendingNotifications(ofType: type)
        return !notifications.isEmpty
    }

    /// Get next fire date for a notification type
    /// - Parameter type: Notification type
    /// - Returns: Next fire date, if any
    func getNextFireDate(forType type: LocalNotificationType) async -> Date? {
        let notifications = await getPendingNotifications(ofType: type)

        guard let notification = notifications.first,
              let trigger = notification.trigger as? UNCalendarNotificationTrigger else {
            return nil
        }

        return trigger.nextTriggerDate()
    }

    /// Clear error state
    func clearError() {
        lastError = nil
    }

    /// Get authorization status description
    var authorizationStatusDescription: String {
        switch authorizationStatus {
        case .notDetermined:
            return "未决定"
        case .denied:
            return "已拒绝"
        case .authorized:
            return "已授权"
        case .provisional:
            return "临时授权"
        case .ephemeral:
            return "临时应用"
        @unknown default:
            return "未知"
        }
    }
}
