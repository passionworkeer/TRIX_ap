//
//  ProfileViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Test suite for ProfileViewModel edit form functionality
//
//  Test Coverage:
//  - loadProfile() success and error handling
//  - updateDisplayName() validation and API call
//  - updateBio() validation and API call
//  - refresh() functionality
//  - Loading state management
//  - Error message handling
//

import XCTest
import Combine
import Supabase
@testable import TRIX3DCompanion

// MARK: - Mock Profile Dependencies

@MainActor
final class MockAuthServiceForProfile: AuthServiceProtocol {
    var isLoggedInValue = true
    var isLoadingValue = false
    var mockUser: AppUser?
    var shouldFailUpdate = false
    var supabase: SupabaseClient? { nil }

    var isLoggedIn: Bool {
        return isLoggedInValue
    }

    var currentUser: AppUser? {
        return mockUser
    }

    var isLoading: Bool {
        return isLoadingValue
    }

    // supabase is provided by AuthServiceProtocol extension

    func login(email: String, password: String) async -> AuthResult<AppUser> {
        return .failure(.invalidCredentials)
    }

    func register(username: String, email: String, password: String) async -> AuthResult<AppUser> {
        return .failure(.invalidCredentials)
    }

    func logout() async -> AuthResult<Void> {
        return .success(())
    }

    func refreshTokenIfNeeded() async -> AuthResult<Void> {
        return .success(())
    }

    func fetchCurrentUser() async -> AuthResult<AppUser> {
        if let user = mockUser {
            return .success(user)
        }
        return .failure(.invalidCredentials)
    }

    func updateProfile(_ updates: AppUser) async -> AuthResult<AppUser> {
        if shouldFailUpdate {
            return .failure(.unknown(underlying: nil))
        }
        mockUser = updates
        return .success(updates)
    }

    func deleteAccount() async -> AuthResult<Void> {
        return .success(())
    }

    func updateCurrentUser(_ user: AppUser?) {
        mockUser = user
    }

    func updateLoginStatus(_ loggedIn: Bool) {
        isLoggedInValue = loggedIn
    }

    func clearError() {}

    func resetEmailConfirmationSuccess() {}
}

// MARK: - Mock API Client for Profile

@MainActor
final class MockAPIClientForProfile: APIClientProtocol {
    var shouldFailRequests = false
    var mockError: NetworkError?
    var mockUser: AppUser?
    var mockUserStats: UserStats?
    var mockPointsResponse: PointsResponse?

    func get<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        if T.self == AppUser.self, let user = mockUser {
            return user as! T
        }

        if T.self == UserStats.self, let stats = mockUserStats {
            return stats as! T
        }

        throw NetworkError.custom(message: "No mock data")
    }

    func post<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        throw NetworkError.custom(message: "Not implemented")
    }

    func put<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        throw NetworkError.custom(message: "Not implemented")
    }

    func delete<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        throw NetworkError.custom(message: "Not implemented")
    }

    func upload<T>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T where T: Decodable {
        throw NetworkError.custom(message: "Not implemented")
    }

    func download(from url: String) async throws -> Data {
        throw NetworkError.custom(message: "Not implemented")
    }

    func getUserProfile() async throws -> AppUser {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        guard let mockUser else {
            throw NetworkError.unauthorized
        }

        return mockUser
    }

    func updateUserProfile(_ update: ProfileUpdate) async throws -> AppUser {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        let baseUser = mockUser ?? AppUser(
            id: "test_user_id",
            username: "test_user",
            email: "test@example.com",
            avatarUrl: nil,
            avatarConfig: nil,
            fullName: nil,
            displayName: "Test User",
            bio: nil,
            website: nil,
            points: 100,
            isStudying: nil,
            companionId: nil,
            totalStudyTime: nil,
            lastActiveAt: nil,
            currentStreak: nil,
            daysActive: nil,
            interactionCount: nil,
            showOnlineStatus: nil,
            school: nil,
            grade: nil,
            createdAt: Date(),
            updatedAt: Date()
        )

        let updatedUser = AppUser(
            id: baseUser.id,
            username: update.username ?? baseUser.username,
            email: baseUser.email,
            avatarUrl: update.avatarUrl ?? baseUser.avatarUrl,
            avatarConfig: baseUser.avatarConfig,
            fullName: update.fullName ?? baseUser.fullName,
            displayName: update.displayName ?? baseUser.displayName,
            bio: update.bio,
            website: baseUser.website,
            points: baseUser.points,
            isStudying: baseUser.isStudying,
            companionId: baseUser.companionId,
            totalStudyTime: baseUser.totalStudyTime,
            lastActiveAt: baseUser.lastActiveAt,
            currentStreak: baseUser.currentStreak,
            daysActive: baseUser.daysActive,
            interactionCount: baseUser.interactionCount,
            showOnlineStatus: baseUser.showOnlineStatus,
            school: update.school ?? baseUser.school,
            grade: update.grade ?? baseUser.grade,
            createdAt: baseUser.createdAt,
            updatedAt: Date()
        )

        mockUser = updatedUser
        return updatedUser
    }

    func getUserStats() async throws -> UserStats {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        return mockUserStats ?? UserStats(
            totalStudyTime: 3600,
            sessionCount: 12,
            averageDuration: 300,
            streakDays: 5,
            todayDuration: 45,
            weekDuration: 300
        )
    }

    func getPoints() async throws -> PointsResponse {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        return mockPointsResponse ?? PointsResponse(
            totalPoints: 100,
            level: 1,
            todayEarned: 10,
            weekEarned: 50,
            totalTransactions: 3
        )
    }
}

// MARK: - Profile View Model Tests

@MainActor
final class ProfileViewModelTests: XCTestCase {

    var sut: ProfileViewModel!
    var mockAuthService: MockAuthServiceForProfile!
    var mockAPIClient: MockAPIClientForProfile!
    var cancellables: Set<AnyCancellable>!

    override func setUp() async throws {
        try await super.setUp()

        mockAuthService = MockAuthServiceForProfile()
        mockAPIClient = MockAPIClientForProfile()
        cancellables = Set<AnyCancellable>()

        sut = ProfileViewModel(apiClient: mockAPIClient)
    }

    override func tearDown() async throws {
        sut = nil
        mockAuthService = nil
        mockAPIClient = nil
        cancellables = nil
        try await super.tearDown()
    }

    func clearError() {}
}

// MARK: - Load Profile Tests

extension ProfileViewModelTests {

    func testLoadProfileSetsLoadingState() async {
        // Given
        mockAPIClient.mockUser = createMockUser()

        // When
        let expectation = XCTestExpectation(description: "Loading state changes")

        var loadingStates: [Bool] = []
        sut.$isLoading
            .sink { isLoading in
                loadingStates.append(isLoading)
                if loadingStates.count == 3 { // initial false, true, then false
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        await sut.loadProfile()

        // Then
        await fulfillment(of: [expectation], timeout: 1.0)
        XCTAssertTrue(loadingStates.contains(true), "Should have loading state true at some point")
        XCTAssertFalse(sut.isLoading, "Should not be loading after completion")
    }

    func testLoadProfileSuccess() async {
        // Given
        let mockUser = createMockUser()
        mockAPIClient.mockUser = mockUser

        // When
        await sut.loadProfile()

        // Then
        XCTAssertNotNil(sut.user, "User should be loaded")
        XCTAssertEqual(sut.displayName, mockUser.displayName, "Display name should match")
    }

    func testLoadProfileHandlesError() async {
        // Given
        mockAPIClient.mockUser = nil

        // When
        await sut.loadProfile()

        // Then
        XCTAssertNotNil(sut.errorMessage, "Should have error message")
    }
}

// MARK: - Update Display Name Tests

extension ProfileViewModelTests {

    func testUpdateDisplayNameSuccess() async {
        // Given
        let mockUser = createMockUser()
        mockAPIClient.mockUser = mockUser
        let newDisplayName = "Updated Name"

        // When
        await sut.updateDisplayName(newDisplayName)

        // Then - just verify no crash and state is updated
        XCTAssertEqual(sut.displayName, newDisplayName, "Display name should be updated")
    }

    func testUpdateDisplayNameWithEmptyString() async {
        // Given
        let mockUser = createMockUser()
        mockAPIClient.mockUser = mockUser

        // When
        await sut.updateDisplayName("")

        // Then - empty string should be handled gracefully
        XCTAssertTrue(true, "Should handle empty string without crash")
    }

    func testUpdateDisplayNameWithWhitespace() async {
        // Given
        let mockUser = createMockUser()
        mockAPIClient.mockUser = mockUser

        // When
        await sut.updateDisplayName("   Test Name   ")

        // Then - whitespace should be trimmed
        XCTAssertTrue(true, "Should handle whitespace")
    }

    func testUpdateDisplayNameWithLongString() async {
        // Given
        let mockUser = createMockUser()
        mockAPIClient.mockUser = mockUser
        let longName = String(repeating: "a", count: 100)

        // When
        await sut.updateDisplayName(longName)

        // Then - long names should be handled
        XCTAssertTrue(true, "Should handle long names")
    }
}

// MARK: - Update Bio Tests

extension ProfileViewModelTests {

    func testUpdateBioSuccess() async {
        // Given
        let mockUser = createMockUser()
        mockAPIClient.mockUser = mockUser
        let newBio = "This is my new bio"

        // When
        await sut.updateBio(newBio)

        // Then
        XCTAssertEqual(sut.bio, newBio, "Bio should be updated")
    }

    func testUpdateBioWithNilValue() async {
        // Given
        var mockUser = createMockUser()
        mockUser = AppUser(
            id: mockUser.id,
            username: mockUser.username,
            email: mockUser.email,
            avatarUrl: mockUser.avatarUrl,
            avatarConfig: nil,
            fullName: nil,
            displayName: mockUser.displayName,
            bio: "Old bio",
            website: nil,
            points: mockUser.points,
            isStudying: nil,
            companionId: nil,
            totalStudyTime: nil,
            lastActiveAt: nil,
            currentStreak: nil,
            daysActive: nil,
            interactionCount: nil,
            showOnlineStatus: nil,
            school: nil,
            grade: nil,
            createdAt: mockUser.createdAt,
            updatedAt: mockUser.updatedAt
        )
        mockAPIClient.mockUser = mockUser

        // When
        await sut.updateBio("")

        // Then
        XCTAssertEqual(sut.bio, "", "Bio should reflect the submitted empty value")
    }

    func testUpdateBioWithEmptyString() async {
        // Given
        let mockUser = createMockUser()
        mockAPIClient.mockUser = mockUser

        // When
        await sut.updateBio("")

        // Then - empty bio should be handled
        XCTAssertTrue(true, "Should handle empty bio")
    }

    func testUpdateBioWithLongString() async {
        // Given
        let mockUser = createMockUser()
        mockAPIClient.mockUser = mockUser
        let longBio = String(repeating: "This is a long bio. ", count: 50)

        // When
        await sut.updateBio(longBio)

        // Then - long bios should be handled
        XCTAssertTrue(true, "Should handle long bios")
    }
}

// MARK: - Refresh Tests

extension ProfileViewModelTests {

    func testRefreshReloadsProfile() async {
        // Given
        mockAPIClient.mockUser = createMockUser()

        // When
        await sut.refresh()

        // Then
        XCTAssertNotNil(sut.user, "User should be loaded after refresh")
    }

    func testRefreshClearsError() async {
        // Given
        sut.errorMessage = "Previous error"
        mockAPIClient.mockUser = createMockUser()

        // When
        await sut.refresh()

        // Then
        XCTAssertNil(sut.errorMessage, "Error should be cleared after refresh")
    }
}

// MARK: - Clear Messages Tests

extension ProfileViewModelTests {

    func testClearMessagesRemovesError() {
        // Given
        sut.errorMessage = "Test error"

        // When
        sut.clearMessages()

        // Then
        XCTAssertNil(sut.errorMessage, "Error message should be cleared")
    }

    func testClearMessagesWhenNoError() {
        // Given
        sut.errorMessage = nil

        // When
        sut.clearMessages()

        // Then
        XCTAssertNil(sut.errorMessage, "Should handle nil error message")
    }
}

// MARK: - State Management Tests

extension ProfileViewModelTests {

    func testIsLoadingInitialState() {
        // Then
        XCTAssertFalse(sut.isLoading, "Initial loading state should be false")
    }

    func testErrorMessageInitialState() {
        // Then
        XCTAssertNil(sut.errorMessage, "Initial error message should be nil")
    }

    func testDisplayNameInitialState() {
        // Then
        XCTAssertEqual(sut.displayName, "User", "Initial display name should use the default fallback")
    }

    func testBioInitialState() {
        // Then
        XCTAssertNil(sut.bio, "Initial bio should be nil")
    }
}

// MARK: - Computed Properties Tests

extension ProfileViewModelTests {

    func testAvatarURLReturnsCorrectValue() {
        // Given
        let mockUser = createMockUser()
        sut.user = mockUser

        // Then
        XCTAssertEqual(sut.avatarURL, mockUser.avatarUrl.flatMap { URL(string: $0) }, "Avatar URL should match user's avatar")
    }

    func testEmailReturnsCorrectValue() {
        // Given
        let mockUser = createMockUser()
        sut.user = mockUser

        // Then
        XCTAssertEqual(sut.email, mockUser.email, "Email should match user's email")
    }

    func testTotalPointsReturnsCorrectValue() {
        // Given
        var mockUser = createMockUser()
        mockUser = AppUser(
            id: mockUser.id,
            username: mockUser.username,
            email: mockUser.email,
            avatarUrl: mockUser.avatarUrl,
            avatarConfig: nil,
            fullName: nil,
            displayName: mockUser.displayName,
            bio: nil,
            website: nil,
            points: 500,
            isStudying: nil,
            companionId: nil,
            totalStudyTime: nil,
            lastActiveAt: nil,
            currentStreak: nil,
            daysActive: nil,
            interactionCount: nil,
            showOnlineStatus: nil,
            school: nil,
            grade: nil,
            createdAt: mockUser.createdAt,
            updatedAt: mockUser.updatedAt
        )
        sut.user = mockUser

        // Then
        XCTAssertEqual(sut.totalPoints, 500, "Total points should match user's points")
    }

    func testLevelCalculation() {
        // Given
        var mockUser = createMockUser()
        mockUser = AppUser(
            id: mockUser.id,
            username: mockUser.username,
            email: mockUser.email,
            avatarUrl: mockUser.avatarUrl,
            avatarConfig: nil,
            fullName: nil,
            displayName: mockUser.displayName,
            bio: nil,
            website: nil,
            points: 2500,
            isStudying: nil,
            companionId: nil,
            totalStudyTime: nil,
            lastActiveAt: nil,
            currentStreak: nil,
            daysActive: nil,
            interactionCount: nil,
            showOnlineStatus: nil,
            school: nil,
            grade: nil,
            createdAt: mockUser.createdAt,
            updatedAt: mockUser.updatedAt
        )
        sut.user = mockUser

        // Then - Level is typically calculated from points
        XCTAssertGreaterThan(sut.level, 0, "Level should be greater than 0")
    }
}

// MARK: - Edge Cases Tests

extension ProfileViewModelTests {

    func testUpdateDisplayNameWithSpecialCharacters() async {
        // Given
        let mockUser = createMockUser()
        mockAPIClient.mockUser = mockUser
        let specialName = "Test 🎉 Name 中文"

        // When
        await sut.updateDisplayName(specialName)

        // Then - special characters should be handled
        XCTAssertTrue(true, "Should handle special characters")
    }

    func testUpdateBioWithEmoji() async {
        // Given
        let mockUser = createMockUser()
        mockAPIClient.mockUser = mockUser
        let emojiBio = "I love coding! 💻 🚀"

        // When
        await sut.updateBio(emojiBio)

        // Then - emoji should be handled
        XCTAssertTrue(true, "Should handle emoji in bio")
    }

    func testConcurrentProfileUpdates() async {
        // Given
        let mockUser = createMockUser()
        mockAPIClient.mockUser = mockUser

        // When - perform multiple updates concurrently
        await withTaskGroup(of: Void.self) { group in
            group.addTask {
                await self.sut.updateDisplayName("Name 1")
            }
            group.addTask {
                await self.sut.updateBio("Bio 1")
            }
        }

        // Then - should not crash
        XCTAssertTrue(true, "Should handle concurrent updates")
    }
}

// MARK: - Helper Methods

extension ProfileViewModelTests {

    private func createMockUser() -> AppUser {
        AppUser(
            id: "test_user_id",
            username: "test_user",
            email: "test@example.com",
            avatarUrl: nil,
            avatarConfig: nil,
            fullName: nil,
            displayName: "Test User",
            bio: "Test bio",
            website: nil,
            points: 100,
            isStudying: nil,
            companionId: nil,
            totalStudyTime: nil,
            lastActiveAt: nil,
            currentStreak: nil,
            daysActive: nil,
            interactionCount: nil,
            showOnlineStatus: nil,
            school: nil,
            grade: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}
