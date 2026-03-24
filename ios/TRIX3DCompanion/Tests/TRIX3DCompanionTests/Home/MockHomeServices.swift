//
//  MockHomeServices.swift
//  TRIX3DCompanionTests
//
//  Mock services for Home module testing
//

import Foundation
@testable import TRIX3DCompanion

// MARK: - Mock User Service for Home

@MainActor
final class MockUserServiceForHome: UserServiceProtocol {
    var currentUserValue: User?
    var isLoadingValue: Bool = false
    var shouldFailFetch: Bool = false
    var shouldFailUpdate: Bool = false
    var lastFetchProfileCall: Bool = false
    var lastUpdateProfileCall: ProfileUpdate?
    var lastFetchStatsCall: Bool = false

    var currentUser: User? {
        return currentUserValue
    }

    var isLoading: Bool {
        return isLoadingValue
    }

    func fetchProfile() async throws -> User {
        lastFetchProfileCall = true
        isLoadingValue = true

        if shouldFailFetch {
            isLoadingValue = false
            throw UserServiceError.fetchFailed(underlying: NSError(domain: "Test", code: -1))
        }

        if let user = currentUserValue {
            isLoadingValue = false
            return user
        }

        isLoadingValue = false
        throw UserServiceError.profileNotFound
    }

    func updateProfile(_ update: ProfileUpdate) async throws -> User {
        lastUpdateProfileCall = update
        isLoadingValue = true

        if shouldFailUpdate {
            isLoadingValue = false
            throw UserServiceError.updateFailed(underlying: NSError(domain: "Test", code: -1))
        }

        let updatedUser = User(
            id: currentUserValue?.id ?? UUID().uuidString,
            username: update.username ?? currentUserValue?.username,
            email: currentUserValue?.email,
            avatarUrl: update.avatarUrl ?? currentUserValue?.avatarUrl,
            avatarConfig: currentUserValue?.avatarConfig,
            fullName: update.fullName ?? currentUserValue?.fullName,
            displayName: update.displayName ?? currentUserValue?.displayName,
            bio: update.bio ?? currentUserValue?.bio,
            website: currentUserValue?.website,
            points: currentUserValue?.points,
            isStudying: currentUserValue?.isStudying,
            companionId: currentUserValue?.companionId,
            totalStudyTime: currentUserValue?.totalStudyTime,
            lastActiveAt: currentUserValue?.lastActiveAt,
            currentStreak: currentUserValue?.currentStreak,
            daysActive: currentUserValue?.daysActive,
            interactionCount: currentUserValue?.interactionCount,
            showOnlineStatus: currentUserValue?.showOnlineStatus,
            school: update.school ?? currentUserValue?.school,
            grade: update.grade ?? currentUserValue?.grade,
            createdAt: currentUserValue?.createdAt,
            updatedAt: Date()
        )

        currentUserValue = updatedUser
        isLoadingValue = false
        return updatedUser
    }

    func fetchStats() async throws -> UserStats {
        lastFetchStatsCall = true
        isLoadingValue = true

        if shouldFailFetch {
            isLoadingValue = false
            throw UserServiceError.fetchFailed(underlying: NSError(domain: "Test", code: -1))
        }

        let stats = UserStats(
            totalStudyTime: 3600,
            sessionCount: 42,
            averageDuration: 30,
            streakDays: 7,
            todayDuration: 120,
            weekDuration: 540
        )

        isLoadingValue = false
        return stats
    }

    func updateUser(_ user: User?) {
        currentUserValue = user
    }

    func reset() {
        currentUserValue = nil
        isLoadingValue = false
        shouldFailFetch = false
        shouldFailUpdate = false
        lastFetchProfileCall = false
        lastUpdateProfileCall = nil
        lastFetchStatsCall = false
    }
}

// MARK: - Mock App Notification Service for Home

@MainActor
final class MockAppNotificationServiceForHome {
    var notifications: [APIAppNotification] = []
    var unreadCount: Int = 0
    var isLoading: Bool = false
    var shouldFailFetch: Bool = false
    var shouldFailMarkAsRead: Bool = false
    var lastMarkAsReadId: String?

    var fetchNotificationsCalled: Bool = false
    var markAsReadCalled: Bool = false
    var markAllAsReadCalled: Bool = false

    func fetchNotifications() async throws -> [APIAppNotification] {
        fetchNotificationsCalled = true
        isLoading = true

        if shouldFailFetch {
            isLoading = false
            throw NotificationError.fetchFailed
        }

        unreadCount = notifications.filter { !$0.isRead }.count
        isLoading = false
        return notifications
    }

    func markAsRead(id: String) async throws {
        lastMarkAsReadId = id
        markAsReadCalled = true

        if shouldFailMarkAsRead {
            throw NotificationError.markAsReadFailed
        }

        if let index = notifications.firstIndex(where: { $0.id == id }) {
            // Update notification - note: APIAppNotification is let so we can't modify
            unreadCount = max(0, unreadCount - 1)
        }
    }

    func markAllAsRead() async throws {
        markAllAsReadCalled = true

        if shouldFailMarkAsRead {
            throw NotificationError.markAsReadFailed
        }

        unreadCount = 0
    }

    func reset() {
        notifications = []
        unreadCount = 0
        isLoading = false
        shouldFailFetch = false
        shouldFailMarkAsRead = false
        lastMarkAsReadId = nil
        fetchNotificationsCalled = false
        markAsReadCalled = false
        markAllAsReadCalled = false
    }
}

// MARK: - Notification Error

enum NotificationError: Error, LocalizedError {
    case fetchFailed
    case markAsReadFailed
    case permissionDenied

    var errorDescription: String? {
        switch self {
        case .fetchFailed:
            return "Failed to fetch notifications"
        case .markAsReadFailed:
            return "Failed to mark notification as read"
        case .permissionDenied:
            return "Notification permission denied"
        }
    }
}

// MARK: - Mock Study Service for Home

@MainActor
final class MockStudyService {
    var currentSession: StudySession?
    var todayStudyMinutes: Int = 0
    var weekStudyMinutes: Int = 0
    var streakDays: Int = 0
    var isStudying: Bool = false
    var shouldFailFetch: Bool = false

    var fetchStatsCalled: Bool = false
    var startSessionCalled: Bool = false
    var endSessionCalled: Bool = false

    func fetchStudyStats() async throws -> StudyStats {
        fetchStatsCalled = true

        if shouldFailFetch {
            throw StudyError.networkError(underlying: NSError(domain: "Test", code: -1))
        }

        return StudyStats(
            totalDuration: todayStudyMinutes,
            sessionCount: 0,
            averageDuration: 0,
            streakDays: streakDays,
            todayDuration: todayStudyMinutes,
            weekDuration: weekStudyMinutes
        )
    }

    func startStudySession() async throws -> StudySession {
        startSessionCalled = true
        isStudying = true

        let session = StudySession(
            id: UUID().uuidString,
            userId: "test_user",
            duration: 0,
            startedAt: Date(),
            endedAt: nil,
            earnedPoints: nil,
            isCompleted: false,
            subject: nil,
            notes: nil,
            createdAt: Date()
        )

        currentSession = session
        return session
    }

    func endStudySession() async throws -> StudySession {
        endSessionCalled = true
        isStudying = false

        guard var session = currentSession else {
            throw StudyError.noActiveSession
        }

        currentSession = nil
        return session
    }

    func reset() {
        currentSession = nil
        todayStudyMinutes = 0
        weekStudyMinutes = 0
        streakDays = 0
        isStudying = false
        shouldFailFetch = false
        fetchStatsCalled = false
        startSessionCalled = false
        endSessionCalled = false
    }
}

// MARK: - Mock Mail Service for Home

@MainActor
final class MockMailService {
    var unreadMailCount: Int = 0
    var mails: [MailItem] = []
    var isLoading: Bool = false
    var shouldFailFetch: Bool = false

    var fetchMailsCalled: Bool = false
    var markMailAsReadCalled: Bool = false

    func fetchMails() async throws -> [MailItem] {
        fetchMailsCalled = true
        isLoading = true

        if shouldFailFetch {
            isLoading = false
            throw MailError.fetchFailed
        }

        unreadMailCount = mails.filter { !$0.isRead }.count
        isLoading = false
        return mails
    }

    func markAsRead(id: String) async throws {
        markMailAsReadCalled = true
        if let index = mails.firstIndex(where: { $0.id == id }) {
            // Update mail read status
            unreadMailCount = max(0, unreadMailCount - 1)
        }
    }

    func reset() {
        unreadMailCount = 0
        mails = []
        isLoading = false
        shouldFailFetch = false
        fetchMailsCalled = false
        markMailAsReadCalled = false
    }
}

// MARK: - Mail Item

struct MailItem: Identifiable {
    let id: String
    let subject: String
    let sender: String
    let preview: String
    let receivedAt: Date
    let isRead: Bool
}

// MARK: - Mail Error

enum MailError: Error, LocalizedError {
    case fetchFailed
    case sendFailed

    var errorDescription: String? {
        switch self {
        case .fetchFailed:
            return "Failed to fetch mails"
        case .sendFailed:
            return "Failed to send mail"
        }
    }
}

// MARK: - Helper Extensions for Tests

extension MockUserServiceForHome {
    static func createMockUser(
        id: String = "test_user_id",
        username: String = "test_user",
        email: String = "test@example.com",
        displayName: String = "Test User",
        points: Int = 100,
        isStudying: Bool = false,
        companionId: String? = nil
    ) -> User {
        User(
            id: id,
            username: username,
            email: email,
            avatarUrl: nil,
            avatarConfig: nil,
            fullName: nil,
            displayName: displayName,
            bio: nil,
            website: nil,
            points: points,
            isStudying: isStudying,
            companionId: companionId,
            totalStudyTime: 3600,
            lastActiveAt: Date(),
            currentStreak: 5,
            daysActive: 30,
            interactionCount: 100,
            showOnlineStatus: true,
            school: nil,
            grade: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}

extension MockAppNotificationServiceForHome {
    static func createMockNotifications(count: Int = 5) -> [APIAppNotification] {
        (1...count).map { index in
            APIAppNotification(
                id: "notif_\(index)",
                userId: "test_user",
                type: "system",
                title: "Notification \(index)",
                body: "This is notification body \(index)",
                data: nil,
                isRead: index > 2,
                createdAt: Date().addingTimeInterval(Double(-index * 3600))
            )
        }
    }
}

extension MockStudyService {
    func setupMockStats(
        todayMinutes: Int = 120,
        weekMinutes: Int = 540,
        streak: Int = 7
    ) {
        todayStudyMinutes = todayMinutes
        weekStudyMinutes = weekMinutes
        streakDays = streak
    }
}
