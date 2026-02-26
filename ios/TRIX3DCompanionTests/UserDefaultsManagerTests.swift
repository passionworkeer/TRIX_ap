//
//  UserDefaultsManagerTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for UserDefaultsManager
//

import XCTest
@testable import TRIX3DCompanion

/// Unit tests for UserDefaultsManager
final class UserDefaultsManagerTests: XCTestCase {

    // MARK: - Properties

    var userDefaultsManager: UserDefaultsManager!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        userDefaultsManager = UserDefaultsManager.shared

        // Clear all UserDefaults before each test
        userDefaultsManager.clearAll()
    }

    override func tearDownWithError() throws {
        // Clean up after each test
        userDefaultsManager.clearAll()
        userDefaultsManager = nil
    }

    // MARK: - User Cache Tests

    func test_cacheUser_savesUser() throws {
        // Arrange
        let user = createTestUser(id: "user-1", username: "testuser", email: "test@example.com")

        // Act
        userDefaultsManager.cacheUser(user)
        let cachedUser = userDefaultsManager.getCachedUser()

        // Assert
        XCTAssertNotNil(cachedUser, "User should be cached")
        XCTAssertEqual(cachedUser?.id, "user-1")
        XCTAssertEqual(cachedUser?.username, "testuser")
        XCTAssertEqual(cachedUser?.email, "test@example.com")
    }

    func test_getCachedUser_whenNoCachedUser_returnsNil() throws {
        // Act
        let cachedUser = userDefaultsManager.getCachedUser()

        // Assert
        XCTAssertNil(cachedUser, "Should return nil when no user is cached")
    }

    func test_clearCachedUser_removesUser() throws {
        // Arrange
        let user = createTestUser(id: "user-1", username: "testuser", email: "test@example.com")
        userDefaultsManager.cacheUser(user)

        // Act
        userDefaultsManager.clearCachedUser()
        let cachedUser = userDefaultsManager.getCachedUser()

        // Assert
        XCTAssertNil(cachedUser, "User should be cleared")
    }

    // MARK: - Sync Time Tests

    func test_updateLastSyncTime_savesTime() throws {
        // Arrange
        let beforeSync = Date()

        // Act
        userDefaultsManager.updateLastSyncTime()
        let syncTime = userDefaultsManager.getLastSyncTime()

        // Assert
        XCTAssertNotNil(syncTime, "Sync time should be saved")
        XCTAssertGreaterThanOrEqual(syncTime!, beforeSync, "Sync time should be after beforeSync time")
        XCTAssertLessThanOrEqual(syncTime!, Date(), "Sync time should be before now")
    }

    func test_getLastSyncTime_whenNeverSynced_returnsNil() throws {
        // Act
        let syncTime = userDefaultsManager.getLastSyncTime()

        // Assert
        XCTAssertNil(syncTime, "Should return nil when never synced")
    }

    // MARK: - Onboarding Tests

    func test_setOnboardingCompleted_savesState() throws {
        // Act
        userDefaultsManager.setOnboardingCompleted(true)

        // Assert
        XCTAssertTrue(userDefaultsManager.hasCompletedOnboarding(), "Onboarding should be marked as completed")

        // Test setting to false
        userDefaultsManager.setOnboardingCompleted(false)
        XCTAssertFalse(userDefaultsManager.hasCompletedOnboarding(), "Onboarding should be marked as not completed")
    }

    func test_hasCompletedOnboarding_defaultsToFalse() throws {
        // Act
        let hasCompleted = userDefaultsManager.hasCompletedOnboarding()

        // Assert
        XCTAssertFalse(hasCompleted, "Should default to false")
    }

    // MARK: - Theme Tests

    func test_setSelectedTheme_savesTheme() throws {
        // Act & Assert
        userDefaultsManager.setSelectedTheme(.light)
        XCTAssertEqual(userDefaultsManager.getSelectedTheme(), .light)

        userDefaultsManager.setSelectedTheme(.dark)
        XCTAssertEqual(userDefaultsManager.getSelectedTheme(), .dark)

        userDefaultsManager.setSelectedTheme(.system)
        XCTAssertEqual(userDefaultsManager.getSelectedTheme(), .system)
    }

    func test_getSelectedTheme_defaultsToSystem() throws {
        // Act
        let theme = userDefaultsManager.getSelectedTheme()

        // Assert
        XCTAssertEqual(theme, .system, "Should default to system theme")
    }

    // MARK: - Language Tests

    func test_setLanguage_savesLanguage() throws {
        // Arrange
        let testLanguage = "zh-CN"

        // Act
        userDefaultsManager.setLanguage(testLanguage)

        // Assert
        XCTAssertEqual(userDefaultsManager.getLanguage(), testLanguage)
    }

    func test_getLanguage_whenNotSet_returnsNil() throws {
        // Act
        let language = userDefaultsManager.getLanguage()

        // Assert
        XCTAssertNil(language, "Should return nil when language not set")
    }

    // MARK: - Notification Settings Tests

    func test_setNotificationsEnabled_savesState() throws {
        // Act & Assert
        userDefaultsManager.setNotificationsEnabled(true)
        XCTAssertTrue(userDefaultsManager.isNotificationsEnabled())

        userDefaultsManager.setNotificationsEnabled(false)
        XCTAssertFalse(userDefaultsManager.isNotificationsEnabled())
    }

    func test_isNotificationsEnabled_defaultsToTrue() throws {
        // Act
        let isEnabled = userDefaultsManager.isNotificationsEnabled()

        // Assert
        XCTAssertTrue(isEnabled, "Should default to true")
    }

    func test_setStudyRemindersEnabled_savesState() throws {
        // Act & Assert
        userDefaultsManager.setStudyRemindersEnabled(true)
        XCTAssertTrue(userDefaultsManager.isStudyRemindersEnabled())

        userDefaultsManager.setStudyRemindersEnabled(false)
        XCTAssertFalse(userDefaultsManager.isStudyRemindersEnabled())
    }

    func test_setReminderTime_savesTime() throws {
        // Arrange
        let hour = 9
        let minute = 30

        // Act
        userDefaultsManager.setReminderTime(hour: hour, minute: minute)

        // Assert
        let reminderTime = userDefaultsManager.getReminderTime()
        XCTAssertNotNil(reminderTime, "Reminder time should be saved")
        XCTAssertEqual(reminderTime?.hour, 9)
        XCTAssertEqual(reminderTime?.minute, 30)
    }

    func test_getReminderTime_whenNotSet_returnsNil() throws {
        // Act
        let reminderTime = userDefaultsManager.getReminderTime()

        // Assert
        XCTAssertNil(reminderTime, "Should return nil when not set")
    }

    // MARK: - Study Settings Tests

    func test_setFocusDuration_savesDuration() throws {
        // Arrange
        let durations = [15, 25, 45, 60]

        for duration in durations {
            // Act
            userDefaultsManager.setFocusDuration(duration)

            // Assert
            XCTAssertEqual(userDefaultsManager.getFocusDuration(), duration)
        }
    }

    func test_getFocusDuration_defaultsToTwentyFive() throws {
        // Act
        let duration = userDefaultsManager.getFocusDuration()

        // Assert
        XCTAssertEqual(duration, 25, "Should default to 25 minutes")
    }

    func test_setRestDuration_savesDuration() throws {
        // Arrange
        let durations = [5, 10, 15, 20]

        for duration in durations {
            // Act
            userDefaultsManager.setRestDuration(duration)

            // Assert
            XCTAssertEqual(userDefaultsManager.getRestDuration(), duration)
        }
    }

    func test_getRestDuration_defaultsToFive() throws {
        // Act
        let duration = userDefaultsManager.getRestDuration()

        // Assert
        XCTAssertEqual(duration, 5, "Should default to 5 minutes")
    }

    func test_setDailyGoalMinutes_savesGoal() throws {
        // Arrange
        let goals = [60, 120, 180, 240]

        for goal in goals {
            // Act
            userDefaultsManager.setDailyGoalMinutes(goal)

            // Assert
            XCTAssertEqual(userDefaultsManager.getDailyGoalMinutes(), goal)
        }
    }

    func test_getDailyGoalMinutes_defaultsToOneHundredTwenty() throws {
        // Act
        let goal = userDefaultsManager.getDailyGoalMinutes()

        // Assert
        XCTAssertEqual(goal, 120, "Should default to 120 minutes")
    }

    // MARK: - Chat Settings Tests

    func test_setSoundEnabled_savesState() throws {
        // Act & Assert
        userDefaultsManager.setSoundEnabled(true)
        XCTAssertTrue(userDefaultsManager.isSoundEnabled())

        userDefaultsManager.setSoundEnabled(false)
        XCTAssertFalse(userDefaultsManager.isSoundEnabled())
    }

    func test_isSoundEnabled_defaultsToTrue() throws {
        // Act
        let isEnabled = userDefaultsManager.isSoundEnabled()

        // Assert
        XCTAssertTrue(isEnabled, "Should default to true")
    }

    func test_setVibrationEnabled_savesState() throws {
        // Act & Assert
        userDefaultsManager.setVibrationEnabled(true)
        XCTAssertTrue(userDefaultsManager.isVibrationEnabled())

        userDefaultsManager.setVibrationEnabled(false)
        XCTAssertFalse(userDefaultsManager.isVibrationEnabled())
    }

    func test_isVibrationEnabled_defaultsToTrue() throws {
        // Act
        let isEnabled = userDefaultsManager.isVibrationEnabled()

        // Assert
        XCTAssertTrue(isEnabled, "Should default to true")
    }

    func test_setMessagePreviewEnabled_savesState() throws {
        // Act & Assert
        userDefaultsManager.setMessagePreviewEnabled(true)
        XCTAssertTrue(userDefaultsManager.isMessagePreviewEnabled())

        userDefaultsManager.setMessagePreviewEnabled(false)
        XCTAssertFalse(userDefaultsManager.isMessagePreviewEnabled())
    }

    func test_isMessagePreviewEnabled_defaultsToTrue() throws {
        // Act
        let isEnabled = userDefaultsManager.isMessagePreviewEnabled()

        // Assert
        XCTAssertTrue(isEnabled, "Should default to true")
    }

    // MARK: - Cache Data Tests

    func test_cacheChatRooms_savesRooms() throws {
        // Arrange
        let rooms = [
            createTestRoom(id: "room-1", name: "Room 1"),
            createTestRoom(id: "room-2", name: "Room 2"),
            createTestRoom(id: "room-3", name: "Room 3")
        ]

        // Act
        userDefaultsManager.cacheChatRooms(rooms)
        let cachedRooms = userDefaultsManager.getCachedChatRooms()

        // Assert
        XCTAssertNotNil(cachedRooms, "Rooms should be cached")
        XCTAssertEqual(cachedRooms?.count, 3)
        XCTAssertEqual(cachedRooms?[0].name, "Room 1")
    }

    func test_getCachedChatRooms_whenNotCached_returnsNil() throws {
        // Act
        let cachedRooms = userDefaultsManager.getCachedChatRooms()

        // Assert
        XCTAssertNil(cachedRooms, "Should return nil when not cached")
    }

    func test_cacheStudyStats_savesStats() throws {
        // Arrange
        let stats = createTestStats(totalDuration: 1000, sessionCount: 20)

        // Act
        userDefaultsManager.cacheStudyStats(stats)
        let cachedStats = userDefaultsManager.getCachedStudyStats()

        // Assert
        XCTAssertNotNil(cachedStats, "Stats should be cached")
        XCTAssertEqual(cachedStats?.totalDuration, 1000)
        XCTAssertEqual(cachedStats?.sessionCount, 20)
    }

    func test_getCachedStudyStats_whenNotCached_returnsNil() throws {
        // Act
        let cachedStats = userDefaultsManager.getCachedStudyStats()

        // Assert
        XCTAssertNil(cachedStats, "Should return nil when not cached")
    }

    func test_cachePointsStats_savesStats() throws {
        // Arrange
        let stats = createTestPointsStats(currentBalance: 500, totalEarned: 1000)

        // Act
        userDefaultsManager.cachePointsStats(stats)
        let cachedStats = userDefaultsManager.getCachedPointsStats()

        // Assert
        XCTAssertNotNil(cachedStats, "Points stats should be cached")
        XCTAssertEqual(cachedStats?.currentBalance, 500)
        XCTAssertEqual(cachedStats?.totalEarned, 1000)
    }

    func test_getCachedPointsStats_whenNotCached_returnsNil() throws {
        // Act
        let cachedStats = userDefaultsManager.getCachedPointsStats()

        // Assert
        XCTAssertNil(cachedStats, "Should return nil when not cached")
    }

    // MARK: - Last Known State Tests

    func test_saveLastKnownLocation_savesCoordinates() throws {
        // Arrange
        let latitude = 37.7749
        let longitude = -122.4194

        // Act
        userDefaultsManager.saveLastKnownLocation(latitude: latitude, longitude: longitude)
        let location = userDefaultsManager.getLastKnownLocation()

        // Assert
        XCTAssertNotNil(location, "Location should be saved")
        XCTAssertEqual(location?.latitude, latitude, accuracy: 0.0001)
        XCTAssertEqual(location?.longitude, longitude, accuracy: 0.0001)
    }

    func test_getLastKnownLocation_whenNotSaved_returnsNil() throws {
        // Act
        let location = userDefaultsManager.getLastKnownLocation()

        // Assert
        XCTAssertNil(location, "Should return nil when not saved")
    }

    func test_saveLastActiveTab_savesTabIndex() throws {
        // Arrange
        let tabIndex = 2

        // Act
        userDefaultsManager.saveLastActiveTab(tabIndex)
        let savedIndex = userDefaultsManager.getLastActiveTab()

        // Assert
        XCTAssertEqual(savedIndex, tabIndex)
    }

    func test_getLastActiveTab_defaultsToZero() throws {
        // Act
        let tabIndex = userDefaultsManager.getLastActiveTab()

        // Assert
        XCTAssertEqual(tabIndex, 0, "Should default to 0")
    }

    // MARK: - Generic Methods Tests

    func test_setAndGet_genericTypes() throws {
        // Arrange
        let stringValue = "Test String"
        let intValue = 42
        let boolValue = true

        // Act
        userDefaultsManager.set(stringValue, forKey: "testString")
        userDefaultsManager.set(intValue, forKey: "testInt")
        userDefaultsManager.set(boolValue, forKey: "testBool")

        let retrievedString: String? = userDefaultsManager.get("testString")
        let retrievedInt: Int? = userDefaultsManager.get("testInt")
        let retrievedBool: Bool? = userDefaultsManager.get("testBool")

        // Assert
        XCTAssertEqual(retrievedString, stringValue)
        XCTAssertEqual(retrievedInt, intValue)
        XCTAssertEqual(retrievedBool, boolValue)
    }

    func test_remove_deletesValue() throws {
        // Arrange
        userDefaultsManager.set("Test Value", forKey: "testKey")

        // Act
        userDefaultsManager.remove(forKey: "testKey")
        let retrievedValue: String? = userDefaultsManager.get("testKey")

        // Assert
        XCTAssertNil(retrievedValue, "Value should be removed")
    }

    // MARK: - Clear Data Tests

    func test_clearCache_removesCachedDataOnly() throws {
        // Arrange
        let user = createTestUser(id: "user-1", username: "testuser", email: "test@example.com")
        userDefaultsManager.cacheUser(user)
        userDefaultsManager.setOnboardingCompleted(true)
        userDefaultsManager.setSelectedTheme(.dark)

        // Act
        userDefaultsManager.clearCache()
        let cachedUser = userDefaultsManager.getCachedUser()

        // Assert
        XCTAssertNil(cachedUser, "Cached user should be cleared")
        XCTAssertTrue(userDefaultsManager.hasCompletedOnboarding(), "Onboarding should remain")
        XCTAssertEqual(userDefaultsManager.getSelectedTheme(), .dark, "Theme should remain")
    }

    func test_clearAll_removesAllData() throws {
        // Arrange
        let user = createTestUser(id: "user-1", username: "testuser", email: "test@example.com")
        userDefaultsManager.cacheUser(user)
        userDefaultsManager.setOnboardingCompleted(true)
        userDefaultsManager.setSelectedTheme(.dark)
        userDefaultsManager.saveLastActiveTab(2)

        // Act
        userDefaultsManager.clearAll()
        let cachedUser = userDefaultsManager.getCachedUser()
        let onboardingCompleted = userDefaultsManager.hasCompletedOnboarding()
        let lastActiveTab = userDefaultsManager.getLastActiveTab()

        // Assert
        XCTAssertNil(cachedUser, "User should be cleared")
        XCTAssertFalse(onboardingCompleted, "Onboarding should be cleared")
        XCTAssertEqual(lastActiveTab, 0, "Last active tab should be reset to 0")

        // Note: User preferences like theme are preserved according to implementation
    }

    // MARK: - Theme Enum Tests

    func test_appTheme_displayName() throws {
        // Assert
        XCTAssertEqual(AppTheme.system.displayName, "跟随系统")
        XCTAssertEqual(AppTheme.light.displayName, "浅色模式")
        XCTAssertEqual(AppTheme.dark.displayName, "深色模式")
    }

    func test_appTheme_rawValue() throws {
        // Assert
        XCTAssertEqual(AppTheme.system.rawValue, "system")
        XCTAssertEqual(AppTheme.light.rawValue, "light")
        XCTAssertEqual(AppTheme.dark.rawValue, "dark")
    }

    // MARK: - Helper Methods

    private func createTestUser(id: String, username: String, email: String) -> User {
        return User(
            id: id,
            username: username,
            email: email,
            displayName: "Test User",
            avatarUrl: nil,
            points: 100,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    private func createTestRoom(id: String, name: String) -> ChatRoom {
        return ChatRoom(
            id: id,
            name: name,
            type: .ai,
            participants: nil,
            lastMessage: nil,
            unreadCount: 0,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    private func createTestStats(totalDuration: Int, sessionCount: Int) -> StudyStats {
        return StudyStats(
            totalDuration: totalDuration,
            sessionCount: sessionCount,
            averageDuration: totalDuration / sessionCount,
            streakDays: 5,
            todayDuration: 60,
            weekDuration: 300
        )
    }

    private func createTestPointsStats(currentBalance: Int, totalEarned: Int) -> UserPointsStats {
        return UserPointsStats(
            currentBalance: currentBalance,
            totalEarned: totalEarned,
            totalRedeemed: 500,
            transactionCount: 10,
            recentTransactions: []
        )
    }
}
