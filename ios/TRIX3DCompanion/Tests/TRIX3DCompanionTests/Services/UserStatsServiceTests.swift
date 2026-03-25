//
//  UserStatsServiceTests.swift
//  TRIX3DCompanionTests
//
//  Test suite for UserStatsService
//
//  Test Coverage:
//  - getUserStats: Success, not authenticated, network error, cache
//  - getStudyStats: Success, not authenticated, invalid period, network error, cache
//  - Cache management: Clear cache, expiration
//

import XCTest
import Combine
@testable import TRIX3DCompanion

// MARK: - Mock API Client for UserStatsService

@MainActor
final class MockAPIClientForUserStats: ObservableObject, APIClientProtocol {
    var shouldFailRequests = false
    var mockError: NetworkError?
    var mockUserStats: UserStats?
    var mockStudyStats: StudyStats?
    var lastRequestedUserId: String?
    var lastRequestedPeriod: String?

    func get<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T {
        if shouldFailRequests {
            throw mockError ?? NetworkError.custom(message: "Request failed")
        }

        switch endpoint {
        case .userStats:
            guard let stats = mockUserStats as? T else {
                throw NetworkError.custom(message: "Invalid mock data for user stats")
            }
            return stats
        case .studyStats, .weeklyStudyData:
            guard let stats = mockStudyStats as? T else {
                throw NetworkError.custom(message: "Invalid mock data for study stats")
            }
            return stats
        default:
            throw NetworkError.custom(message: "Unknown endpoint")
        }
    }

    func get<T: Decodable>(_ endpoint: APIEndpoint, parameters: [String: Any]?) async throws -> T {
        lastRequestedUserId = parameters?["userId"] as? String
        lastRequestedPeriod = parameters?["period"] as? String

        if shouldFailRequests {
            throw mockError ?? NetworkError.custom(message: "Request failed")
        }

        switch endpoint {
        case .userStats:
            guard let stats = mockUserStats as? T else {
                throw NetworkError.custom(message: "Invalid mock data for user stats")
            }
            return stats
        case .studyStats, .weeklyStudyData:
            guard let stats = mockStudyStats as? T else {
                throw NetworkError.custom(message: "Invalid mock data for study stats")
            }
            return stats
        default:
            throw NetworkError.custom(message: "Unknown endpoint")
        }
    }

    func post<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        throw NetworkError.custom(message: "Not implemented")
    }

    func put<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        throw NetworkError.custom(message: "Not implemented")
    }

    func delete<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        throw NetworkError.custom(message: "Not implemented")
    }

    func upload<T>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T where T: Decodable {
        throw NetworkError.custom(message: "Not implemented")
    }

    func download(from url: String) async throws -> Data {
        throw NetworkError.custom(message: "Not implemented")
    }
}

// MARK: - Mock Auth Service for UserStatsService

@MainActor
final class MockAuthServiceForUserStats: AuthServiceProtocol {
    var isLoggedIn: Bool = false
    var shouldFailGetCurrentUser = false

    var currentUser: User? {
        if shouldFailGetCurrentUser {
            return nil
        }
        return isLoggedIn ? User(
            id: "test_user_id",
            username: "test_user",
            email: "test@example.com",
            avatarUrl: nil,
            avatarConfig: nil,
            fullName: nil,
            displayName: "Test User",
            bio: nil,
            website: nil,
            points: 0,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 0,
            lastActiveAt: Date(),
            currentStreak: 0,
            daysActive: 1,
            interactionCount: 0,
            showOnlineStatus: true,
            school: nil,
            grade: nil,
            createdAt: Date(),
            updatedAt: Date()
        ) : nil
    }

    var isLoading: Bool = false
    var lastError: AuthError?

    func login(email: String, password: String) async -> AuthResult<User> {
        return .failure(.invalidCredentials)
    }

    func register(username: String, email: String, password: String) async -> AuthResult<User> {
        return .failure(.invalidCredentials)
    }

    func logout() async -> AuthResult<Void> {
        isLoggedIn = false
        return .success(())
    }

    func refreshTokenIfNeeded() async -> AuthResult<Void> {
        return .success(())
    }

    func fetchCurrentUser() async -> AuthResult<User> {
        if let user = currentUser {
            return .success(user)
        }
        return .failure(.invalidCredentials)
    }

    func clearError() {}

    func updateProfile(_ updates: User) async -> AuthResult<User> {
        return .success(updates)
    }

    func deleteAccount() async -> AuthResult<Void> {
        return .success(())
    }

    func updateCurrentUser(_ user: User?) {}

    func updateLoginStatus(_ loggedIn: Bool) {}

}

// MARK: - UserStatsService Tests

@MainActor
final class UserStatsServiceTests: XCTestCase {

    var sut: UserStatsService!
    var mockAPIClient: MockAPIClientForUserStats!
    var mockAuthService: MockAuthServiceForUserStats!

    override func setUp() async throws {
        try await super.setUp()

        mockAPIClient = MockAPIClientForUserStats()
        mockAuthService = MockAuthServiceForUserStats()

        // Setup default mock data
        mockAPIClient.mockUserStats = createMockUserStats()
        mockAPIClient.mockStudyStats = createMockStudyStats()

        sut = UserStatsService(
            apiClient: mockAPIClient,
            authService: mockAuthService
        )
    }

    override func tearDown() async throws {
        sut = nil
        mockAPIClient = nil
        mockAuthService = nil
        try await super.tearDown()
    }
}

// MARK: - GetUserStats Tests

extension UserStatsServiceTests {

    func testGetUserStatsSuccess() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        let userId = "test_user_id"

        // When
        let stats = try await sut.getUserStats(userId: userId)

        // Then
        XCTAssertEqual(stats.totalStudyTime, 1200, "Should return correct total study time")
        XCTAssertEqual(stats.sessionCount, 10, "Should return correct session count")
        XCTAssertEqual(sut.userStats?.totalStudyTime, 1200, "Should update userStats state")
        XCTAssertFalse(sut.isLoading, "Should not be loading after success")
    }

    func testGetUserStatsNotAuthenticated() async throws {
        // Given
        mockAuthService.isLoggedIn = false

        // When & Then
        do {
            _ = try await sut.getUserStats(userId: "test_user_id")
            XCTFail("Should throw not authenticated error")
        } catch let error as UserStatsServiceError {
            XCTAssertEqual(error, .notAuthenticated, "Should throw not authenticated error")
            XCTAssertNotNil(sut.lastError, "Should set last error")
        }
    }

    func testGetUserStatsNetworkError() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .timeout

        // When & Then
        do {
            _ = try await sut.getUserStats(userId: "test_user_id")
            XCTFail("Should throw network error")
        } catch let error as UserStatsServiceError {
            if case .networkError = error {
                XCTAssertTrue(true, "Should throw network error")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        }
    }

    func testGetUserStatsUnauthorized() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .unauthorized

        // When & Then
        do {
            _ = try await sut.getUserStats(userId: "test_user_id")
            XCTFail("Should throw not authenticated error")
        } catch let error as UserStatsServiceError {
            XCTAssertEqual(error, .notAuthenticated, "Should throw not authenticated error")
        }
    }

    func testGetUserStatsNotFound() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .notFound

        // When & Then
        do {
            _ = try await sut.getUserStats(userId: "test_user_id")
            XCTFail("Should throw user not found error")
        } catch let error as UserStatsServiceError {
            XCTAssertEqual(error, .userNotFound, "Should throw user not found error")
        }
    }

    func testGetUserStatsCachesResults() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        let userId = "test_user_id"

        // When
        _ = try await sut.getUserStats(userId: userId)

        // Second call should use cache
        let cachedStats = try await sut.getUserStats(userId: userId)

        // Then
        XCTAssertEqual(cachedStats.totalStudyTime, 1200, "Should return cached stats")
    }
}

// MARK: - GetStudyStats Tests

extension UserStatsServiceTests {

    func testGetStudyStatsDailySuccess() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        let userId = "test_user_id"
        let period: StatsPeriod = .daily

        // When
        let stats = try await sut.getStudyStats(userId: userId, period: period)

        // Then
        XCTAssertEqual(stats.totalDuration, 60, "Should return correct total duration")
        XCTAssertEqual(stats.sessionCount, 2, "Should return correct session count")
        XCTAssertEqual(sut.studyStats?.totalDuration, 60, "Should update studyStats state")
        XCTAssertFalse(sut.isLoading, "Should not be loading after success")
    }

    func testGetStudyStatsWeeklySuccess() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        let userId = "test_user_id"
        let period: StatsPeriod = .weekly

        // When
        let stats = try await sut.getStudyStats(userId: userId, period: period)

        // Then
        XCTAssertEqual(stats.totalDuration, 60, "Should return correct total duration")
    }

    func testGetStudyStatsMonthlySuccess() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        let userId = "test_user_id"
        let period: StatsPeriod = .monthly

        // When
        let stats = try await sut.getStudyStats(userId: userId, period: period)

        // Then
        XCTAssertEqual(stats.totalDuration, 60, "Should return correct total duration")
    }

    func testGetStudyStatsYearlySuccess() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        let userId = "test_user_id"
        let period: StatsPeriod = .yearly

        // When
        let stats = try await sut.getStudyStats(userId: userId, period: period)

        // Then
        XCTAssertEqual(stats.totalDuration, 60, "Should return correct total duration")
    }

    func testGetStudyStatsAllTime() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        let userId = "test_user_id"
        let period: StatsPeriod = .all

        // When
        let stats = try await sut.getStudyStats(userId: userId, period: period)

        // Then
        // For "all" period, it falls back to yearly
        XCTAssertEqual(stats.totalDuration, 60, "Should return correct total duration")
    }

    func testGetStudyStatsNotAuthenticated() async throws {
        // Given
        mockAuthService.isLoggedIn = false

        // When & Then
        do {
            _ = try await sut.getStudyStats(userId: "test_user_id", period: .daily)
            XCTFail("Should throw not authenticated error")
        } catch let error as UserStatsServiceError {
            XCTAssertEqual(error, .notAuthenticated, "Should throw not authenticated error")
            XCTAssertNotNil(sut.lastError, "Should set last error")
        }
    }

    func testGetStudyStatsNetworkError() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .timeout

        // When & Then
        do {
            _ = try await sut.getStudyStats(userId: "test_user_id", period: .daily)
            XCTFail("Should throw network error")
        } catch let error as UserStatsServiceError {
            if case .networkError = error {
                XCTAssertTrue(true, "Should throw network error")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        }
    }

    func testGetStudyStatsUnauthorized() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .unauthorized

        // When & Then
        do {
            _ = try await sut.getStudyStats(userId: "test_user_id", period: .daily)
            XCTFail("Should throw not authenticated error")
        } catch let error as UserStatsServiceError {
            XCTAssertEqual(error, .notAuthenticated, "Should throw not authenticated error")
        }
    }

    func testGetStudyStatsNotFound() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .notFound

        // When & Then
        do {
            _ = try await sut.getStudyStats(userId: "test_user_id", period: .daily)
            XCTFail("Should throw user not found error")
        } catch let error as UserStatsServiceError {
            XCTAssertEqual(error, .userNotFound, "Should throw user not found error")
        }
    }

    func testGetStudyStatsCachesResults() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        let userId = "test_user_id"
        let period: StatsPeriod = .daily

        // First call
        _ = try await sut.getStudyStats(userId: userId, period: period)

        // Second call should use cache
        let cachedStats = try await sut.getStudyStats(userId: userId, period: period)

        // Then
        XCTAssertEqual(cachedStats.totalDuration, 60, "Should return cached stats")
    }
}

// MARK: - Convenience Methods Tests

extension UserStatsServiceTests {

    func testGetCurrentUserStatsSuccess() async throws {
        // Given
        mockAuthService.isLoggedIn = true

        // When
        let stats = try await sut.getCurrentUserStats()

        // Then
        XCTAssertEqual(stats.totalStudyTime, 1200, "Should return current user stats")
    }

    func testGetCurrentUserStatsNoUser() async throws {
        // Given
        mockAuthService.isLoggedIn = false

        // When & Then
        do {
            _ = try await sut.getCurrentUserStats()
            XCTFail("Should throw not authenticated error")
        } catch let error as UserStatsServiceError {
            XCTAssertEqual(error, .notAuthenticated, "Should throw not authenticated error")
        }
    }

    func testGetCurrentUserStudyStatsSuccess() async throws {
        // Given
        mockAuthService.isLoggedIn = true

        // When
        let stats = try await sut.getCurrentUserStudyStats(period: .daily)

        // Then
        XCTAssertEqual(stats.totalDuration, 60, "Should return current user study stats")
    }

    func testGetTodayStatsSuccess() async throws {
        // Given
        mockAuthService.isLoggedIn = true

        // When
        let stats = try await sut.getTodayStats()

        // Then
        XCTAssertEqual(stats.todayDuration, 30, "Should return today's stats")
    }

    func testGetWeeklyStatsSuccess() async throws {
        // Given
        mockAuthService.isLoggedIn = true

        // When
        let stats = try await sut.getWeeklyStats()

        // Then
        XCTAssertEqual(stats.weekDuration, 300, "Should return weekly stats")
    }

    func testGetMonthlyStatsSuccess() async throws {
        // Given
        mockAuthService.isLoggedIn = true

        // When
        let stats = try await sut.getMonthlyStats()

        // Then
        XCTAssertEqual(stats.totalDuration, 60, "Should return monthly stats")
    }

    func testFormattedTotalTime() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        _ = try await sut.getUserStats(userId: "test_user_id")

        // When
        let formatted = sut.formattedTotalTime

        // Then
        XCTAssertEqual(formatted, "20h", "Should format total time correctly (1200 min = 20h)")
    }

    func testFormattedTotalTimeNoStats() {
        // Given - no stats

        // When
        let formatted = sut.formattedTotalTime

        // Then
        XCTAssertEqual(formatted, "0h", "Should return 0h when no stats")
    }

    func testFormattedTodayTime() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        _ = try await sut.getUserStats(userId: "test_user_id")

        // When
        let formatted = sut.formattedTodayTime

        // Then
        XCTAssertEqual(formatted, "30m", "Should format today's time correctly")
    }

    func testFormattedTodayTimeOverHour() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        mockAPIClient.mockUserStats = UserStats(
            totalStudyTime: 1200,
            sessionCount: 10,
            averageDuration: 120,
            streakDays: 5,
            todayDuration: 90,
            weekDuration: 300
        )
        _ = try await sut.getUserStats(userId: "test_user_id")

        // When
        let formatted = sut.formattedTodayTime

        // Then
        XCTAssertEqual(formatted, "1h 30m", "Should format time over hour correctly")
    }

    func testFormattedTodayTimeNoStats() {
        // Given - no stats

        // When
        let formatted = sut.formattedTodayTime

        // Then
        XCTAssertEqual(formatted, "0m", "Should return 0m when no stats")
    }

    func testCurrentStreak() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        _ = try await sut.getUserStats(userId: "test_user_id")

        // When
        let streak = sut.currentStreak

        // Then
        XCTAssertEqual(streak, 5, "Should return correct streak")
    }

    func testCurrentStreakNoStats() {
        // Given - no stats

        // When
        let streak = sut.currentStreak

        // Then
        XCTAssertEqual(streak, 0, "Should return 0 when no stats")
    }

    func testClearError() async throws {
        // Given
        mockAuthService.isLoggedIn = false
        _ = try? await sut.getUserStats(userId: "test_user_id")
        XCTAssertNotNil(sut.lastError, "Should have error after failed request")

        // When
        sut.clearError()

        // Then
        XCTAssertNil(sut.lastError, "Should clear error")
    }

    func testClearCacheForUser() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        _ = try await sut.getUserStats(userId: "test_user_id")
        _ = try await sut.getStudyStats(userId: "test_user_id", period: .daily)

        // When
        sut.clearCache(for: "test_user_id")

        // Then - cache should be cleared, next call should hit API
        let stats = try await sut.getUserStats(userId: "test_user_id")
        XCTAssertEqual(stats.totalStudyTime, 1200, "Should return fresh stats after cache clear")
    }

    func testClearAllCache() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        _ = try await sut.getUserStats(userId: "test_user_id")
        _ = try await sut.getStudyStats(userId: "test_user_id", period: .daily)

        // When
        sut.clearAllCache()

        // Then - all cache should be cleared
        let stats = try await sut.getUserStats(userId: "test_user_id")
        XCTAssertEqual(stats.totalStudyTime, 1200, "Should return fresh stats after cache clear")
    }

    func testRefresh() async throws {
        // Given
        mockAuthService.isLoggedIn = true

        // When
        try await sut.refresh()

        // Then - should clear cache and fetch fresh data
        XCTAssertNotNil(sut.userStats, "Should have user stats after refresh")
        XCTAssertNotNil(sut.studyStats, "Should have study stats after refresh")
    }
}

// MARK: - Helper Methods

extension UserStatsServiceTests {

    private func createMockUserStats() -> UserStats {
        UserStats(
            totalStudyTime: 1200, // 20 hours
            sessionCount: 10,
            averageDuration: 120,
            streakDays: 5,
            todayDuration: 30,
            weekDuration: 300
        )
    }

    private func createMockStudyStats() -> StudyStats {
        StudyStats(
            totalDuration: 60,
            sessionCount: 2,
            averageDuration: 30,
            streakDays: 3,
            todayDuration: 30,
            weekDuration: 300
        )
    }
}
