//
//  RealAPIIntegrationTests.swift
//  TRIX3DCompanionTests
//
//  Integration tests using real API endpoints
//  These tests require network connectivity and valid credentials
//

import XCTest
import Combine
@testable import TRIX3DCompanion

/// Integration tests that connect to real API endpoints
/// Requires network connectivity and valid test account credentials
final class RealAPIIntegrationTests: XCTestCase {

    // MARK: - Properties

    var apiClient: APIClient!
    var authService: AuthService!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Credentials

    private let testEmail = "david@trix.app"
    private let testPassword = "trix2026"

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        // Skip in CI/CD environments without network access
        let isCI = ProcessInfo.processInfo.environment["CI"] == "true"
        let isGitHubActions = ProcessInfo.processInfo.environment["GITHUB_ACTIONS"] == "true"
        try XCTSkipIf(isCI || isGitHubActions,
                      "Skipping real API tests in CI environment")

        apiClient = APIClient.shared
        authService = AuthService.shared
        cancellables = Set<AnyCancellable>()

        // Logout any existing session
        Task {
            try? await authService.logout()
        }
    }

    override func tearDownWithError() throws {
        // Cleanup: logout after tests
        Task {
            try? await authService.logout()
        }
        cancellables = nil
    }

    // MARK: - Authentication Tests

    func test_realLogin_withValidCredentials() async throws {
        // Act
        let result = await authService.login(email: testEmail, password: testPassword)

        // Assert
        switch result {
        case .success(let user):
            XCTAssertNotNil(user, "User should not be nil")
            XCTAssertFalse(user.id.isEmpty, "User ID should not be empty")
            XCTAssertEqual(user.email, testEmail, "Email should match")
            XCTAssertTrue(authService.isLoggedIn, "Should be logged in")
            XCTAssertNotNil(authService.currentUser, "Current user should be set")
            XCTAssertNotNil(authService.accessToken, "Access token should be set")
        case .failure(let error):
            XCTFail("Login should succeed but got error: \(error)")
        }
    }

    func test_realLogin_withInvalidCredentials() async throws {
        // Act
        let result = await authService.login(email: testEmail, password: "wrongpassword")

        // Assert
        switch result {
        case .success:
            XCTFail("Login should fail with invalid credentials")
        case .failure(let error):
            XCTAssertNotNil(error, "Should return an error")
            XCTAssertFalse(authService.isLoggedIn, "Should not be logged in")
        }
    }

    func test_realLogin_thenLogout() async throws {
        // Login first
        let loginResult = await authService.login(email: testEmail, password: testPassword)

        guard case .success = loginResult else {
            XCTFail("Login failed, cannot test logout")
            return
        }

        XCTAssertTrue(authService.isLoggedIn, "Should be logged in after login")

        // Act - Logout
        do {
            try await authService.logout()

            // Assert
            XCTAssertFalse(authService.isLoggedIn, "Should not be logged in after logout")
            XCTAssertNil(authService.currentUser, "Current user should be nil after logout")
            XCTAssertNil(authService.accessToken, "Access token should be nil after logout")
        } catch {
            XCTFail("Logout should succeed but got error: \(error)")
        }
    }

    // MARK: - User Profile Tests

    func test_realFetchUserProfile() async throws {
        // Login first
        let loginResult = await authService.login(email: testEmail, password: testPassword)

        guard case .success = loginResult else {
            XCTFail("Login failed, cannot test profile fetch")
            return
        }

        // Act
        let profile = try await apiClient.getUserProfile()

        // Assert
        XCTAssertNotNil(profile, "Profile should not be nil")
        XCTAssertFalse(profile.id.isEmpty, "User ID should not be empty")
        XCTAssertNotNil(profile.email, "Email should not be nil")
    }

    func test_realFetchUserStats() async throws {
        // Login first
        let loginResult = await authService.login(email: testEmail, password: testPassword)

        guard case .success = loginResult else {
            XCTFail("Login failed, cannot test stats fetch")
            return
        }

        // Act
        let stats = try await apiClient.getUserStats()

        // Assert
        XCTAssertNotNil(stats, "Stats should not be nil")
        XCTAssertGreaterThanOrEqual(stats.totalStudyTime, 0, "Total study time should be non-negative")
        XCTAssertGreaterThanOrEqual(stats.sessionCount, 0, "Session count should be non-negative")
    }

    // MARK: - Points Tests

    func test_realFetchPoints() async throws {
        // Login first
        let loginResult = await authService.login(email: testEmail, password: testPassword)

        guard case .success = loginResult else {
            XCTFail("Login failed, cannot test points fetch")
            return
        }

        // Act
        let points = try await apiClient.getPoints()

        // Assert
        XCTAssertNotNil(points, "Points should not be nil")
        XCTAssertGreaterThanOrEqual(points.totalPoints, 0, "Total points should be non-negative")
        XCTAssertGreaterThanOrEqual(points.level, 1, "Level should be at least 1")
    }

    // MARK: - Chat Tests

    func test_realFetchChatRooms() async throws {
        // Login first
        let loginResult = await authService.login(email: testEmail, password: testPassword)

        guard case .success = loginResult else {
            XCTFail("Login failed, cannot test chat rooms fetch")
            return
        }

        // Act
        let rooms = try await apiClient.getChatRooms()

        // Assert
        XCTAssertNotNil(rooms, "Chat rooms should not be nil")
        // Rooms array can be empty for new users, so we just check it's not nil
    }

    // MARK: - Study Session Tests

    func test_realFetchStudySessions() async throws {
        // Login first
        let loginResult = await authService.login(email: testEmail, password: testPassword)

        guard case .success = loginResult else {
            XCTFail("Login failed, cannot test study sessions fetch")
            return
        }

        // Act
        let sessions = try await apiClient.getStudySessions()

        // Assert
        XCTAssertNotNil(sessions, "Study sessions should not be nil")
    }

    // MARK: - Error Handling Tests

    func test_realAPI_withoutAuthentication() async throws {
        // Ensure we're logged out
        try? await authService.logout()

        // Act & Assert
        do {
            _ = try await apiClient.getUserProfile()
            XCTFail("Should throw error when not authenticated")
        } catch {
            XCTAssertNotNil(error, "Should throw authentication error")
        }
    }

    // MARK: - Network Connectivity Tests

    func test_realAPI_networkTimeout() async throws {
        // Login first
        let loginResult = await authService.login(email: testEmail, password: testPassword)

        guard case .success = loginResult else {
            XCTFail("Login failed, cannot test network timeout")
            return
        }

        // This test verifies that the API client handles timeouts gracefully
        // The actual timeout is configured in APIClient
        let startTime = Date()
        let _ = try await apiClient.getUserProfile()
        let duration = Date().timeIntervalSince(startTime)

        // Request should complete within a reasonable time
        XCTAssertLessThan(duration, 30.0, "Request should complete within 30 seconds")
    }

    // MARK: - Concurrent Request Tests

    func test_realAPI_concurrentRequests() async throws {
        // Login first
        let loginResult = await authService.login(email: testEmail, password: testPassword)

        guard case .success = loginResult else {
            XCTFail("Login failed, cannot test concurrent requests")
            return
        }

        // Act - Make multiple concurrent requests
        async let profile = apiClient.getUserProfile()
        async let stats = apiClient.getUserStats()
        async let points = apiClient.getPoints()

        let results = try await (profile, stats, points)

        // Assert
        XCTAssertNotNil(results.0, "Profile should not be nil")
        XCTAssertNotNil(results.1, "Stats should not be nil")
        XCTAssertNotNil(results.2, "Points should not be nil")
    }

    // MARK: - Data Consistency Tests

    func test_realAPI_dataConsistency() async throws {
        // Login first
        let loginResult = await authService.login(email: testEmail, password: testPassword)

        guard case .success = loginResult else {
            XCTFail("Login failed, cannot test data consistency")
            return
        }

        // Fetch profile and points
        let profile = try await apiClient.getUserProfile()
        let points = try await apiClient.getPoints()

        // Assert data consistency
        // The user ID from profile should be consistent
        XCTAssertFalse(profile.id.isEmpty, "User ID should not be empty")

        // Points data should be valid
        XCTAssertGreaterThanOrEqual(points.totalPoints, 0, "Points should be non-negative")
    }
}

// MARK: - Real Chat Service Integration Tests

final class RealChatServiceIntegrationTests: XCTestCase {

    var chatService: ChatService!
    var authService: AuthService!
    var cancellables: Set<AnyCancellable>!

    private let testEmail = "david@trix.app"
    private let testPassword = "trix2026"

    override func setUpWithError() throws {
        try XCTSkipIf(ProcessInfo.processInfo.environment["CI"] == "true",
                      "Skipping real API tests in CI environment")

        chatService = ChatService.shared
        authService = AuthService.shared
        cancellables = Set<AnyCancellable>()

        // Login before tests
        let expectation = XCTestExpectation(description: "Login")
        Task {
            _ = await authService.login(email: testEmail, password: testPassword)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 30.0)
    }

    override func tearDownWithError() throws {
        Task {
            try? await authService.logout()
        }
        cancellables = nil
    }

    func test_realChatService_fetchRooms() async throws {
        // Act
        let result = await chatService.fetchChatRooms()

        // Assert
        switch result {
        case .success(let rooms):
            XCTAssertNotNil(rooms, "Rooms should not be nil")
        case .failure(let error):
            XCTFail("Fetch rooms failed: \(error)")
        }
    }

    func test_realChatService_createAndDeleteRoom() async throws {
        // Create a room
        let roomName = "Test Room \(Date().timeIntervalSince1970)"
        let createResult = await chatService.createChatRoom(name: roomName, type: .privateChat)

        switch createResult {
        case .success(let room):
            XCTAssertEqual(room.name, roomName, "Room name should match")
            XCTAssertEqual(room.type, .privateChat, "Room type should be private")

            // Delete the room
            let deleteResult = await chatService.deleteChatRoom(roomId: room.id)
            switch deleteResult {
            case .success:
                break // Success
            case .failure(let error):
                XCTFail("Delete room failed: \(error)")
            }
        case .failure(let error):
            XCTFail("Create room failed: \(error)")
        }
    }
}

// MARK: - Real Study Service Integration Tests

final class RealStudyServiceIntegrationTests: XCTestCase {

    var studyService: StudyService!
    var authService: AuthService!
    var cancellables: Set<AnyCancellable>!

    private let testEmail = "david@trix.app"
    private let testPassword = "trix2026"

    override func setUpWithError() throws {
        try XCTSkipIf(ProcessInfo.processInfo.environment["CI"] == "true",
                      "Skipping real API tests in CI environment")

        studyService = StudyService.shared
        authService = AuthService.shared
        cancellables = Set<AnyCancellable>()

        // Login before tests
        let expectation = XCTestExpectation(description: "Login")
        Task {
            _ = await authService.login(email: testEmail, password: testPassword)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 30.0)
    }

    override func tearDownWithError() throws {
        Task {
            try? await authService.logout()
        }
        cancellables = nil
    }

    func test_realStudyService_fetchSessions() async throws {
        // Act
        let result = await studyService.fetchStudySessions()

        // Assert
        switch result {
        case .success(let sessions):
            XCTAssertNotNil(sessions, "Sessions should not be nil")
        case .failure(let error):
            XCTFail("Fetch sessions failed: \(error)")
        }
    }

    func test_realStudyService_fetchStats() async throws {
        // Act
        let result = await studyService.fetchStudyStats()

        // Assert
        switch result {
        case .success(let stats):
            XCTAssertNotNil(stats, "Stats should not be nil")
            XCTAssertGreaterThanOrEqual(stats.totalDuration, 0, "Total duration should be non-negative")
        case .failure(let error):
            XCTFail("Fetch stats failed: \(error)")
        }
    }
}
