//
//  NotificationServicesTests.swift
//  TRIX3DCompanionTests
//
//  Comprehensive tests for notification services
//

import XCTest
@testable import TRIX3DCompanion
import UserNotifications
import Combine

// MARK: - Local Notification Service Tests

final class LocalNotificationServiceTests: XCTestCase {

    var sut: LocalNotificationService!
    var mockNotificationCenter: MockNotificationCenter!

    override func setUp() async throws {
        try await super.setUp()
        mockNotificationCenter = MockNotificationCenter()
        sut = LocalNotificationService(notificationCenter: mockNotificationCenter)
    }

    override func tearDown() async throws {
        sut = nil
        mockNotificationCenter = nil
        try await super.tearDown()
    }

    // MARK: - Authorization Tests

    func testRequestAuthorization() async throws {
        // Given
        mockNotificationCenter.authorizationStatus = .notDetermined
        mockNotificationCenter.shouldGrantPermission = true

        // When
        let granted = try await sut.requestAuthorization()

        // Then
        XCTAssertTrue(granted)
        XCTAssertTrue(mockNotificationCenter.requestAuthorizationCalled)
        XCTAssertEqual(sut.authorizationStatus, .authorized)
    }

    func testRequestAuthorizationDenied() async throws {
        // Given
        mockNotificationCenter.authorizationStatus = .denied
        mockNotificationCenter.shouldGrantPermission = false

        // When/Then
        do {
            _ = try await sut.requestAuthorization()
            XCTFail("Should throw permission denied error")
        } catch let error as LocalNotificationError {
            if case .permissionDenied = error {
                XCTAssertTrue(true)
            } else {
                XCTFail("Wrong error type")
            }
        }
    }

    func testCheckAuthorizationStatus() async {
        // Given
        mockNotificationCenter.authorizationStatus = .authorized

        // When
        let status = await sut.checkAuthorizationStatus()

        // Then
        XCTAssertEqual(status, .authorized)
        XCTAssertEqual(sut.authorizationStatus, .authorized)
    }

    // MARK: - Scheduling Tests

    func testScheduleNotification() async throws {
        // Given
        mockNotificationCenter.authorizationStatus = .authorized
        await sut.checkAuthorizationStatus()

        let request = LocalNotificationRequest(
            type: .studyReminder,
            title: "Test Notification",
            body: "This is a test",
            scheduledDate: Date().addingTimeInterval(60)
        )

        // When
        let id = try await sut.schedule(request)

        // Then
        XCTAssertFalse(id.isEmpty)
        XCTAssertTrue(mockNotificationCenter.addCalled)
    }

    func testScheduleStudyReminder() async throws {
        // Given
        mockNotificationCenter.authorizationStatus = .authorized
        await sut.checkAuthorizationStatus()

        let config = StudyReminderConfig(hour: 20, minute: 0, repeats: true)

        // When
        let id = try await sut.scheduleStudyReminder(config: config)

        // Then
        XCTAssertFalse(id.isEmpty)
        XCTAssertTrue(mockNotificationCenter.addCalled)
    }

    func testScheduleDailyGoalReminder() async throws {
        // Given
        mockNotificationCenter.authorizationStatus = .authorized
        await sut.checkAuthorizationStatus()

        let config = DailyGoalConfig(hour: 21, minute: 0)

        // When
        let id = try await sut.scheduleDailyGoalReminder(config: config, goalProgress: "50%")

        // Then
        XCTAssertFalse(id.isEmpty)
        XCTAssertTrue(mockNotificationCenter.addCalled)
    }

    func testScheduleNotificationWithoutPermission() async {
        // Given
        mockNotificationCenter.authorizationStatus = .denied
        await sut.checkAuthorizationStatus()

        let request = LocalNotificationRequest(
            type: .studyReminder,
            title: "Test",
            body: "Test"
        )

        // When/Then
        do {
            _ = try await sut.schedule(request)
            XCTFail("Should throw permission denied error")
        } catch let error as LocalNotificationError {
            if case .permissionDenied = error {
                XCTAssertTrue(true)
            } else {
                XCTFail("Wrong error type")
            }
        }
    }

    // MARK: - Cancellation Tests

    func testCancelNotification() async throws {
        // Given
        let notificationID = "test-notification-id"
        mockNotificationCenter.pendingRequests = [
            UNNotificationRequest(
                identifier: notificationID,
                content: UNNotificationContent(),
                trigger: nil
            )
        ]

        // When
        try await sut.cancelNotification(identifier: notificationID)

        // Then
        XCTAssertTrue(mockNotificationCenter.removePendingNotificationRequestsCalled)
        XCTAssertEqual(mockNotificationCenter.removedIdentifiers, [notificationID])
    }

    func testCancelNonExistentNotification() async {
        // Given
        mockNotificationCenter.pendingRequests = []

        // When/Then
        do {
            try await sut.cancelNotification(identifier: "non-existent")
            XCTFail("Should throw notification not found error")
        } catch let error as LocalNotificationError {
            if case .notificationNotFound = error {
                XCTAssertTrue(true)
            } else {
                XCTFail("Wrong error type")
            }
        }
    }

    func testCancelAllNotifications() async {
        // When
        await sut.cancelAllNotifications()

        // Then
        XCTAssertTrue(mockNotificationCenter.removeAllPendingNotificationRequestsCalled)
    }

    // MARK: - Retrieval Tests

    func testGetScheduledNotifications() async {
        // Given
        let requests = [
            UNNotificationRequest(
                identifier: "1",
                content: UNNotificationContent(),
                trigger: nil
            ),
            UNNotificationRequest(
                identifier: "2",
                content: UNNotificationContent(),
                trigger: nil
            )
        ]
        mockNotificationCenter.pendingRequests = requests

        // When
        let scheduled = await sut.getScheduledNotifications()

        // Then
        XCTAssertEqual(scheduled.count, 2)
    }

    func testGetPendingNotificationsByType() async {
        // Given
        let content1 = UNMutableNotificationContent()
        content1.userInfo = ["type": "study_reminder"]
        let request1 = UNNotificationRequest(identifier: "1", content: content1, trigger: nil)

        let content2 = UNMutableNotificationContent()
        content2.userInfo = ["type": "daily_goal"]
        let request2 = UNNotificationRequest(identifier: "2", content: content2, trigger: nil)

        mockNotificationCenter.pendingRequests = [request1, request2]

        // When
        let studyReminders = await sut.getPendingNotifications(ofType: .studyReminder)

        // Then
        XCTAssertEqual(studyReminders.count, 1)
        XCTAssertEqual(studyReminders.first?.identifier, "1")
    }

    // MARK: - Badge Tests

    func testSetBadgeCount() {
        // When
        sut.setBadgeCount(5)

        // Then
        XCTAssertEqual(UIApplication.shared.applicationIconBadgeNumber, 5)
    }

    func testClearBadge() {
        // When
        sut.clearBadge()

        // Then
        XCTAssertEqual(UIApplication.shared.applicationIconBadgeNumber, 0)
    }
}

// MARK: - Push Notification Service Tests

final class PushNotificationServiceTests: XCTestCase {

    var sut: PushNotificationService!
    var mockNotificationCenter: MockNotificationCenter!
    var mockAPIClient: MockAPIClient!
    var mockKeychain: MockKeychainManager!

    override func setUp() async throws {
        try await super.setUp()
        mockNotificationCenter = MockNotificationCenter()
        mockAPIClient = MockAPIClient()
        mockKeychain = MockKeychainManager()
        sut = PushNotificationService(
            notificationCenter: mockNotificationCenter,
            apiClient: mockAPIClient,
            keychain: mockKeychain
        )
    }

    override func tearDown() async throws {
        sut = nil
        mockNotificationCenter = nil
        mockAPIClient = nil
        mockKeychain = nil
        try await super.tearDown()
    }

    // MARK: - Registration Tests

    func testDidRegisterForRemoteNotifications() {
        // Given
        let deviceToken = "abcd1234".data(using: .utf8)!

        // When
        sut.didRegisterForRemoteNotifications(withDeviceToken: deviceToken)

        // Then
        XCTAssertNotNil(sut.currentDeviceToken)
        XCTAssertTrue(sut.isRegistered)
        XCTAssertEqual(sut.registrationStatus.isRegistered, true)
    }

    func testDidFailToRegister() {
        // Given
        let error = NSError(domain: "APNs", code: -1, userInfo: nil)

        // When
        sut.didFailToRegisterForRemoteNotifications(error: error)

        // Then
        XCTAssertFalse(sut.isRegistered)
        XCTAssertNotNil(sut.lastError)
    }

    func testUnregisterForRemoteNotifications() {
        // Given
        let deviceToken = "abcd1234".data(using: .utf8)!
        sut.didRegisterForRemoteNotifications(withDeviceToken: deviceToken)

        // When
        sut.unregisterForRemoteNotifications()

        // Then
        XCTAssertNil(sut.currentDeviceToken)
        XCTAssertFalse(sut.isRegistered)
    }

    // MARK: - Token Upload Tests

    func testUploadDeviceToken() async throws {
        // Given
        let tokenInfo = DeviceTokenInfo(token: "test-token-123")
        mockAPIClient.shouldSucceed = true

        // When
        try await sut.uploadDeviceToken(tokenInfo)

        // Then
        XCTAssertTrue(mockAPIClient.postCalled)
    }

    func testUploadDeviceTokenFailure() async {
        // Given
        let tokenInfo = DeviceTokenInfo(token: "test-token-123")
        mockAPIClient.shouldSucceed = false

        // When/Then
        do {
            try await sut.uploadDeviceToken(tokenInfo)
            XCTFail("Should throw token upload failed error")
        } catch {
            XCTAssertTrue(error is PushNotificationError)
        }
    }

    // MARK: - Notification Handling Tests

    func testDidReceiveRemoteNotification() {
        // Given
        let userInfo: [AnyHashable: Any] = [
            "type": "chat_message",
            "title": "New Message",
            "body": "You have a new message"
        ]

        var receivedPayload: PushNotificationPayload?
        let expectation = expectation(description: "Notification received")

        sut.notificationPublisher
            .sink { payload in
                receivedPayload = payload
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // When
        sut.didReceiveRemoteNotification(userInfo: userInfo, isForeground: true)

        // Then
        wait(for: [expectation], timeout: 1.0)
        XCTAssertNotNil(receivedPayload)
        XCTAssertEqual(receivedPayload?.type, .chatMessage)
        XCTAssertEqual(receivedPayload?.title, "New Message")
    }

    // MARK: - Publisher Tests

    func testTokenPublisher() {
        // Given
        var receivedToken: String?
        let expectation = expectation(description: "Token received")

        sut.tokenPublisher
            .sink { token in
                receivedToken = token
                if token != nil {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        let deviceToken = "abcd1234".data(using: .utf8)!
        sut.didRegisterForRemoteNotifications(withDeviceToken: deviceToken)

        // Then
        wait(for: [expectation], timeout: 1.0)
        XCTAssertNotNil(receivedToken)
    }

    private var cancellables = Set<AnyCancellable>()
}

// MARK: - Notification Manager Tests

final class NotificationManagerTests: XCTestCase {

    var sut: NotificationManager!
    var mockLocalService: LocalNotificationService!
    var mockPushService: PushNotificationService!
    var mockUserDefaults: UserDefaults!

    override func setUp() async throws {
        try await super.setUp()
        mockUserDefaults = UserDefaults(suiteName: #file)!
        mockLocalService = LocalNotificationService()
        mockPushService = PushNotificationService()
        sut = NotificationManager(
            localNotificationService: mockLocalService,
            pushNotificationService: mockPushService,
            userDefaults: mockUserDefaults
        )
    }

    override func tearDown() async throws {
        sut = nil
        mockLocalService = nil
        mockPushService = nil
        mockUserDefaults.removeSuite(named: #file)
        mockUserDefaults = nil
        try await super.tearDown()
    }

    // MARK: - Preferences Tests

    func testDefaultPreferences() {
        // Then
        XCTAssertTrue(sut.preferences.studyReminderEnabled)
        XCTAssertTrue(sut.preferences.dailyGoalEnabled)
        XCTAssertFalse(sut.preferences.doNotDisturbEnabled)
    }

    func testUpdatePreferences() async throws {
        // Given
        var newPreferences = sut.preferences
        newPreferences.studyReminderEnabled = false
        newPreferences.dailyGoalEnabled = false

        // When
        try await sut.updatePreferences(newPreferences)

        // Then
        XCTAssertFalse(sut.preferences.studyReminderEnabled)
        XCTAssertFalse(sut.preferences.dailyGoalEnabled)
    }

    func testSetNotificationType() async throws {
        // When
        try await sut.setNotificationType(.studyReminder, enabled: false)

        // Then
        XCTAssertFalse(sut.preferences.studyReminderEnabled)
    }

    func testSetDoNotDisturb() async throws {
        // When
        try await sut.setDoNotDisturb(enabled: true)

        // Then
        XCTAssertTrue(sut.preferences.doNotDisturbEnabled)
    }

    func testSetQuietHours() async throws {
        // When
        try await sut.setQuietHours(start: "22:00", end: "08:00")

        // Then
        XCTAssertEqual(sut.preferences.quietHoursStart, "22:00")
        XCTAssertEqual(sut.preferences.quietHoursEnd, "08:00")
    }

    func testSetInvalidQuietHours() async {
        // When/Then
        do {
            try await sut.setQuietHours(start: "25:00", end: "08:00")
            XCTFail("Should throw invalid time format error")
        } catch {
            XCTAssertTrue(error is NotificationManagerError)
        }
    }

    // MARK: - DND Tests

    func testIsInQuietHours() {
        // Given
        let preferences = NotificationPreferences(
            doNotDisturbEnabled: true,
            quietHoursStart: "22:00",
            quietHoursEnd: "08:00"
        )
        sut.preferences = preferences

        // Then
        XCTAssertTrue(sut.preferences.doNotDisturbEnabled)
    }

    func testShouldSuppressNotifications() {
        // Given
        var preferences = sut.preferences
        preferences.doNotDisturbEnabled = true
        preferences.quietHoursStart = "00:00"
        preferences.quietHoursEnd = "23:59"
        sut.preferences = preferences

        // When
        let shouldSuppress = sut.preferences.shouldSuppressNotifications()

        // Then
        XCTAssertTrue(shouldSuppress)
    }

    // MARK: - Notification Delivery Tests

    func testShouldDeliverNotificationEnabled() {
        // Given
        sut.preferences.studyReminderEnabled = true
        sut.preferences.doNotDisturbEnabled = false

        // When
        let shouldDeliver = sut.shouldDeliverNotification(type: .studyReminder)

        // Then
        XCTAssertTrue(shouldDeliver)
    }

    func testShouldDeliverNotificationDisabled() {
        // Given
        sut.preferences.studyReminderEnabled = false

        // When
        let shouldDeliver = sut.shouldDeliverNotification(type: .studyReminder)

        // Then
        XCTAssertFalse(shouldDeliver)
    }

    func testShouldDeliverNotificationSuppressedByDND() {
        // Given
        sut.preferences.studyReminderEnabled = true
        sut.preferences.doNotDisturbEnabled = true
        sut.preferences.quietHoursStart = "00:00"
        sut.preferences.quietHoursEnd = "23:59"

        // When
        let shouldDeliver = sut.shouldDeliverNotification(type: .studyReminder)

        // Then
        XCTAssertFalse(shouldDeliver)
    }

    // MARK: - Reset Tests

    func testResetPreferences() async throws {
        // Given
        sut.preferences.studyReminderEnabled = false
        sut.preferences.dailyGoalEnabled = false

        // When
        try await sut.resetPreferences()

        // Then
        XCTAssertTrue(sut.preferences.studyReminderEnabled)
        XCTAssertTrue(sut.preferences.dailyGoalEnabled)
    }

    // MARK: - Summary Tests

    func testGetSettingsSummary() async {
        // When
        let summary = await sut.getSettingsSummary()

        // Then
        XCTAssertTrue(summary.contains("通知设置摘要"))
        XCTAssertTrue(summary.contains("学习提醒"))
    }
}

// MARK: - Mock Classes

class MockNotificationCenter: UNUserNotificationCenter {
    var authorizationStatus: UNAuthorizationStatus = .notDetermined
    var shouldGrantPermission = false
    var requestAuthorizationCalled = false
    var addCalled = false
    var removePendingNotificationRequestsCalled = false
    var removeAllPendingNotificationRequestsCalled = false
    var removedIdentifiers: [String] = []
    var pendingRequests: [UNNotificationRequest] = []

    override func requestAuthorization(options: UNAuthorizationOptions, completionHandler: @escaping (Bool, Error?) -> Void) {
        requestAuthorizationCalled = true
        completionHandler(shouldGrantPermission, nil)
    }

    override func add(_ request: UNNotificationRequest, withCompletionHandler completionHandler: ((Error?) -> Void)?) {
        addCalled = true
        completionHandler?(nil)
    }

    override func removePendingNotificationRequests(withIdentifiers identifiers: [String]) {
        removePendingNotificationRequestsCalled = true
        removedIdentifiers = identifiers
    }

    override func removeAllPendingNotificationRequests() {
        removeAllPendingNotificationRequestsCalled = true
    }

    override func pendingNotificationRequests() async -> [UNNotificationRequest] {
        return pendingRequests
    }

    override func notificationSettings() async -> UNNotificationSettings {
        return MockNotificationSettings(authorizationStatus: authorizationStatus)
    }
}

class MockNotificationSettings: UNNotificationSettings {
    let mockAuthorizationStatus: UNAuthorizationStatus

    init(authorizationStatus: UNAuthorizationStatus) {
        self.mockAuthorizationStatus = authorizationStatus
        super.init()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var authorizationStatus: UNAuthorizationStatus {
        return mockAuthorizationStatus
    }
}

class MockAPIClient: APIClient {
    var shouldSucceed = true
    var postCalled = false

    override func post<T>(_ endpoint: APIEndpoint, parameters: Parameters? = nil, body: Encodable? = nil, headers: HTTPHeaders? = nil) async throws -> T where T : Decodable {
        postCalled = true

        if shouldSucceed {
            if T.self == EmptyResponse.self {
                return EmptyResponse() as! T
            }
            throw NetworkError.unknown(NSError(domain: "Mock", code: -1))
        } else {
            throw NetworkError.unknown(NSError(domain: "Mock", code: -1))
        }
    }
}

class MockKeychainManager: KeychainManager {
    var storedToken: String?

    override func get(_ key: String) -> String? {
        return storedToken
    }

    override func save(_ key: String, value: String) throws {
        storedToken = value
    }

    override func delete(_ key: String) throws {
        storedToken = nil
    }
}
