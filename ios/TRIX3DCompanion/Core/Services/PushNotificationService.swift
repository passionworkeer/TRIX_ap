//
//  PushNotificationService.swift
//  TRIX3DCompanion
//
//  Push notification service for managing APNs registration and remote notifications
//

import Foundation
import UserNotifications
import Combine
import UIKit

// MARK: - Push Notification Service

/// Push notification service implementation
@MainActor
final class PushNotificationService: NSObject, ObservableObject, PushNotificationServiceProtocol {

    // MARK: - Singleton

    static let shared = PushNotificationService()

    // MARK: - Published Properties

    /// Current device token
    @Published private(set) var currentDeviceToken: String?

    /// Registration status
    @Published private(set) var registrationStatus: RegistrationStatus = .notRegistered

    /// Last error
    @Published private(set) var lastError: PushNotificationError?

    // MARK: - Dependencies

    private let notificationCenter: UNUserNotificationCenter
    private let apiClient: APIClient
    private let keychain: KeychainManager

    // MARK: - Private Properties

    /// Notification publisher subject
    private let notificationSubject = PassthroughSubject<PushNotificationPayload, Never>()

    /// Token publisher subject
    private let tokenSubject = CurrentValueSubject<String?, Never>(nil)

    /// Cancellables for Combine subscriptions
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Computed Properties

    /// Whether device is registered for remote notifications
    var isRegistered: Bool {
        return registrationStatus.isRegistered && currentDeviceToken != nil
    }

    /// Publisher for push notification events
    var notificationPublisher: AnyPublisher<PushNotificationPayload, Never> {
        notificationSubject.eraseToAnyPublisher()
    }

    /// Publisher for token updates
    var tokenPublisher: AnyPublisher<String?, Never> {
        tokenSubject.eraseToAnyPublisher()
    }

    // MARK: - Initialization

    /// Initialize push notification service
    /// - Parameters:
    ///   - notificationCenter: Notification center instance
    ///   - apiClient: API client instance
    ///   - keychain: Keychain manager instance
    init(
        notificationCenter: UNUserNotificationCenter = .current(),
        apiClient: APIClient = .shared,
        keychain: KeychainManager = .shared
    ) {
        self.notificationCenter = notificationCenter
        self.apiClient = apiClient
        self.keychain = keychain
        super.init()

        // Load saved token from keychain
        if let savedToken = keychain.getDeviceToken() {
            currentDeviceToken = savedToken
            tokenSubject.send(savedToken)
            registrationStatus = .registered
        }

        // Setup notification delegate
        notificationCenter.delegate = self
    }

    // MARK: - Registration

    /// Register for remote notifications
    func registerForRemoteNotifications() async throws {
        // Check notification permission first
        let settings = await notificationCenter.notificationSettings()
        guard settings.authorizationStatus == .authorized else {
            lastError = .notRegistered
            throw PushNotificationError.notRegistered
        }

        registrationStatus = .registering

        // Request device token from APNs
        await MainActor.run {
            UIApplication.shared.registerForRemoteNotifications()
        }

        // Wait for token to be set (with timeout)
        try await waitForTokenRegistration()
    }

    /// Unregister from remote notifications
    func unregisterForRemoteNotifications() {
        UIApplication.shared.unregisterForRemoteNotifications()

        // Clear stored token
        currentDeviceToken = nil
        try? keychain.deleteDeviceToken()
        tokenSubject.send(nil)
        registrationStatus = .notRegistered

        lastError = nil
    }

    // MARK: - Device Token Handling

    /// Handle device token registration
    /// - Parameter deviceToken: Device token from APNs
    func didRegisterForRemoteNotifications(withDeviceToken deviceToken: Data) {
        // Convert token to string
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()

        currentDeviceToken = token
        tokenSubject.send(token)
        registrationStatus = .registered
        lastError = nil

        // Save to keychain
        try? keychain.saveDeviceToken(token)

        // Upload to server in background
        Task {
            await uploadTokenToServer(token)
        }
    }

    /// Handle registration failure
    /// - Parameter error: Error from APNs
    func didFailToRegisterForRemoteNotifications(error: Error) {
        let pushError = PushNotificationError.registrationFailed(error)
        lastError = pushError
        registrationStatus = .failed(pushError)
    }

    // MARK: - Remote Notification Handling

    /// Handle incoming remote notification
    /// - Parameters:
    ///   - userInfo: Notification payload
    ///   - isForeground: Whether app is in foreground
    func didReceiveRemoteNotification(userInfo: [AnyHashable: Any], isForeground: Bool) {
        do {
            let payload = try PushNotificationPayload(from: userInfo)

            // Post notification
            notificationSubject.send(payload)

            // Handle based on notification type
            handleNotificationType(payload, isForeground: isForeground)

        } catch {
            print("Failed to parse push notification: \(error)")
        }
    }

    // MARK: - Token Upload

    /// Upload device token to server
    /// - Parameter tokenInfo: Device token information
    func uploadDeviceToken(_ tokenInfo: DeviceTokenInfo) async throws {
        do {
            // Create upload request
            let request = DeviceTokenUploadRequest(
                token: tokenInfo.token,
                deviceType: tokenInfo.deviceType.rawValue,
                appVersion: tokenInfo.appVersion,
                osVersion: tokenInfo.osVersion
            )

            // Upload to server
            let _: EmptyResponse = try await apiClient.post(.deviceToken, body: request)

            lastError = nil

        } catch let error as NetworkError {
            let pushError = PushNotificationError.tokenUploadFailed(error)
            lastError = pushError
            throw pushError

        } catch {
            let pushError = PushNotificationError.tokenUploadFailed(error)
            lastError = pushError
            throw pushError
        }
    }

    /// Get current device token info
    /// - Returns: Device token info, if available
    func getCurrentTokenInfo() -> DeviceTokenInfo? {
        guard let token = currentDeviceToken else {
            return nil
        }

        return DeviceTokenInfo(token: token)
    }

    /// Refresh device token registration
    func refreshRegistration() async throws {
        guard let tokenInfo = getCurrentTokenInfo() else {
            lastError = .notRegistered
            throw PushNotificationError.notRegistered
        }

        try await uploadDeviceToken(tokenInfo)
    }

    // MARK: - Private Methods

    /// Wait for token registration with timeout
    private func waitForTokenRegistration() async throws {
        // Monitor registration status
        try await withTimeout(seconds: 10) {
            while !self.isRegistered {
                try await Task.sleep(nanoseconds: 100_000_000) // 0.1s
            }
        }
    }

    /// Upload token to server in background
    private func uploadTokenToServer(_ token: String) async {
        guard let tokenInfo = getCurrentTokenInfo() else {
            return
        }

        do {
            try await uploadDeviceToken(tokenInfo)
            print("Device token uploaded successfully")
        } catch {
            print("Failed to upload device token: \(error)")
            // Don't update lastError here as this is background operation
        }
    }

    /// Handle notification type specific logic
    /// - Parameters:
    ///   - payload: Notification payload
    ///   - isForeground: Whether app is in foreground
    private func handleNotificationType(_ payload: PushNotificationPayload, isForeground: Bool) {
        switch payload.type {
        case .chatMessage:
            // Post chat message notification
            NotificationCenter.default.post(
                name: .chatMessageReceived,
                object: nil,
                userInfo: payload.data
            )

        case .friendRequest:
            // Post friend request notification
            NotificationCenter.default.post(
                name: .friendRequestReceived,
                object: nil,
                userInfo: payload.data
            )

        case .system:
            // Post system notification
            NotificationCenter.default.post(
                name: .systemNotificationReceived,
                object: nil,
                userInfo: payload.data
            )

        case .studyReminder:
            // Post study reminder notification
            NotificationCenter.default.post(
                name: .studyReminderPushReceived,
                object: nil,
                userInfo: payload.data
            )

        case .dailyGoal:
            // Post daily goal notification
            NotificationCenter.default.post(
                name: .dailyGoalPushReceived,
                object: nil,
                userInfo: payload.data
            )
        }
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension PushNotificationService: UNUserNotificationCenterDelegate {

    /// Called when notification is presented while app is in foreground
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        Task { @MainActor in
            // Handle the notification
            didReceiveRemoteNotification(
                userInfo: notification.request.content.userInfo,
                isForeground: true
            )
        }

        // Show notification
        let options: UNNotificationPresentationOptions = [.banner, .sound, .badge]
        completionHandler(options)
    }

    /// Called when user taps on notification
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        Task { @MainActor in
            // Handle the notification
            didReceiveRemoteNotification(
                userInfo: response.notification.request.content.userInfo,
                isForeground: false
            )
        }

        completionHandler()
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let chatMessageReceived = Notification.Name("chatMessageReceived")
    static let friendRequestReceived = Notification.Name("friendRequestReceived")
    static let systemNotificationReceived = Notification.Name("systemNotificationReceived")
    static let studyReminderPushReceived = Notification.Name("studyReminderPushReceived")
    static let dailyGoalPushReceived = Notification.Name("dailyGoalPushReceived")
}

// MARK: - Device Token Upload Request

struct DeviceTokenUploadRequest: Codable {
    let token: String
    let deviceType: String
    let appVersion: String
    let osVersion: String

    enum CodingKeys: String, CodingKey {
        case token
        case deviceType = "device_type"
        case appVersion = "app_version"
        case osVersion = "os_version"
    }
}

// MARK: - Timeout Helper

extension PushNotificationService {

    /// Execute async operation with timeout
    private func withTimeout<T>(
        seconds: TimeInterval,
        operation: @escaping () async throws -> T
    ) async throws -> T {
        try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask {
                try await operation()
            }

            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                throw PushNotificationError.apnsUnavailable
            }

            guard let result = try await group.next() else {
                throw PushNotificationError.apnsUnavailable
            }

            group.cancelAll()
            return result
        }
    }
}

// MARK: - Convenience Extensions

extension PushNotificationService {

    /// Clear error state
    func clearError() {
        lastError = nil
    }

    /// Get registration status description
    var registrationStatusDescription: String {
        switch registrationStatus {
        case .notRegistered:
            return "未注册"
        case .registering:
            return "注册中"
        case .registered:
            return "已注册"
        case .failed(let error):
            return "失败: \(error.localizedDescription)"
        }
    }

    /// Get token expiration status
    var tokenDescription: String? {
        guard let token = currentDeviceToken else {
            return nil
        }

        let prefix = String(token.prefix(8))
        let suffix = String(token.suffix(8))
        return "\(prefix)...\(suffix) (\(token.count) chars)"
    }
}

// MARK: - Keychain Extension

extension KeychainManager {
    private static let deviceTokenKey = "deviceToken"

    func getDeviceToken() -> String? {
        get(KeychainManager.deviceTokenKey)
    }

    func saveDeviceToken(_ token: String) throws {
        try save(KeychainManager.deviceTokenKey, value: token)
    }

    func deleteDeviceToken() throws {
        try delete(KeychainManager.deviceTokenKey)
    }
}
