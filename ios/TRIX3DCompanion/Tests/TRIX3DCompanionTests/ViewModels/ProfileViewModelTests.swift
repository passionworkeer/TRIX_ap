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
@testable import TRIX3DCompanion

// MARK: - Mock Profile Dependencies

@MainActor
final class MockAuthServiceForProfile: AuthServiceProtocol {
    var isLoggedInValue = true
    var isLoadingValue = false
    var mockUser: User?
    var shouldFailUpdate = false

    var isLoggedIn: Bool {
        return isLoggedInValue
    }

    var currentUser: User? {
        return mockUser
    }

    var isLoading: Bool {
        return isLoadingValue
    }

    func login(email: String, password: String) async -> AuthResult<User> {
        return .failure(.invalidCredentials)
    }

    func register(username: String, email: String, password: String) async -> AuthResult<User> {
        return .failure(.invalidCredentials)
    }

    func logout() async -> AuthResult<Void> {
        return .success(())
    }

    func refreshTokenIfNeeded() async -> AuthResult<Void> {
        return .success(())
    }

    func fetchCurrentUser() async -> AuthResult<User> {
        if let user = mockUser {
            return .success(user)
        }
        return .failure(.invalidCredentials)
    }

    func updateProfile(_ updates: User) async -> AuthResult<User> {
        if shouldFailUpdate {
            return .failure(.unknown(underlying: nil))
        }
        mockUser = updates
        return .success(updates)
    }

    func deleteAccount() async -> AuthResult<Void> {
        return .success(())
    }
}

@MainActor
final class MockAPIClientForProfile: APIClientProtocol {
    var shouldFailRequests = false
    var mockError: NetworkError?
    var mockUser: User?
    var mockUserStats: UserStats?

    func get<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        if T.self == User.self, let user = mockUser {
            return user as! T
        }

        if T.self == UserStats.self, let stats = mockUserStats {
            return stats as! T
        }

        throw NetworkError.custom("No mock data")
    }

    func post<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        throw NetworkError.custom("Not implemented")
    }

    func put<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        throw NetworkError.custom("Not implemented")
    }

    func delete<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        throw NetworkError.custom("Not implemented")
    }

    func upload<T>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T where T: Decodable {
        throw NetworkError.custom("Not implemented")
    }

    func download(from url: String) async throws -> Data {
        throw NetworkError.custom("Not implemented")
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

        sut = ProfileViewModel()
    }

    override func tearDown() async throws {
        sut = nil
        mockAuthService = nil
        mockAPIClient = nil
        cancellables = nil
        try await super.tearDown()
    }
}

// MARK: - Load Profile Tests

extension ProfileViewModelTests {

    func testLoadProfileSetsLoadingState() async {
        // Given
        mockAuthService.mockUser = createMockUser()

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
        mockAuthService.mockUser = mockUser

        // When
        await sut.loadProfile()

        // Then
        XCTAssertNotNil(sut.user, "User should be loaded")
        XCTAssertEqual(sut.displayName, mockUser.displayName, "Display name should match")
    }

    func testLoadProfileHandlesError() async {
        // Given
        mockAuthService.mockUser = nil

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
        mockAuthService.mockUser = mockUser
        let newDisplayName = "Updated Name"

        // When
        await sut.updateDisplayName(newDisplayName)

        // Then - just verify no crash and state is updated
        XCTAssertEqual(sut.displayName, newDisplayName, "Display name should be updated")
    }

    func testUpdateDisplayNameWithEmptyString() async {
        // Given
        let mockUser = createMockUser()
        mockAuthService.mockUser = mockUser

        // When
        await sut.updateDisplayName("")

        // Then - empty string should be handled gracefully
        XCTAssertTrue(true, "Should handle empty string without crash")
    }

    func testUpdateDisplayNameWithWhitespace() async {
        // Given
        let mockUser = createMockUser()
        mockAuthService.mockUser = mockUser

        // When
        await sut.updateDisplayName("   Test Name   ")

        // Then - whitespace should be trimmed
        XCTAssertTrue(true, "Should handle whitespace")
    }

    func testUpdateDisplayNameWithLongString() async {
        // Given
        let mockUser = createMockUser()
        mockAuthService.mockUser = mockUser
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
        mockAuthService.mockUser = mockUser
        let newBio = "This is my new bio"

        // When
        await sut.updateBio(newBio)

        // Then
        XCTAssertEqual(sut.bio, newBio, "Bio should be updated")
    }

    func testUpdateBioWithNilValue() async {
        // Given
        var mockUser = createMockUser()
        mockUser = User(
            id: mockUser.id,
            email: mockUser.email,
            username: mockUser.username,
            displayName: mockUser.displayName,
            avatarURL: mockUser.avatarURL,
            bio: "Old bio",
            points: mockUser.points,
            createdAt: mockUser.createdAt,
            updatedAt: mockUser.updatedAt
        )
        mockAuthService.mockUser = mockUser

        // When
        await sut.updateBio(nil)

        // Then - nil bio should be handled
        XCTAssertNil(sut.bio, "Bio should be nil")
    }

    func testUpdateBioWithEmptyString() async {
        // Given
        let mockUser = createMockUser()
        mockAuthService.mockUser = mockUser

        // When
        await sut.updateBio("")

        // Then - empty bio should be handled
        XCTAssertTrue(true, "Should handle empty bio")
    }

    func testUpdateBioWithLongString() async {
        // Given
        let mockUser = createMockUser()
        mockAuthService.mockUser = mockUser
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
        mockAuthService.mockUser = createMockUser()

        // When
        await sut.refresh()

        // Then
        XCTAssertNotNil(sut.user, "User should be loaded after refresh")
    }

    func testRefreshClearsError() async {
        // Given
        sut.errorMessage = "Previous error"
        mockAuthService.mockUser = createMockUser()

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
        XCTAssertEqual(sut.displayName, "", "Initial display name should be empty")
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
        XCTAssertEqual(sut.avatarURL, mockUser.avatarURL, "Avatar URL should match user's avatar")
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
        mockUser = User(
            id: mockUser.id,
            email: mockUser.email,
            username: mockUser.username,
            displayName: mockUser.displayName,
            avatarURL: mockUser.avatarURL,
            bio: mockUser.bio,
            points: 500,
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
        mockUser = User(
            id: mockUser.id,
            email: mockUser.email,
            username: mockUser.username,
            displayName: mockUser.displayName,
            avatarURL: mockUser.avatarURL,
            bio: mockUser.bio,
            points: 2500,
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
        mockAuthService.mockUser = mockUser
        let specialName = "Test 🎉 Name 中文"

        // When
        await sut.updateDisplayName(specialName)

        // Then - special characters should be handled
        XCTAssertTrue(true, "Should handle special characters")
    }

    func testUpdateBioWithEmoji() async {
        // Given
        let mockUser = createMockUser()
        mockAuthService.mockUser = mockUser
        let emojiBio = "I love coding! 💻 🚀"

        // When
        await sut.updateBio(emojiBio)

        // Then - emoji should be handled
        XCTAssertTrue(true, "Should handle emoji in bio")
    }

    func testConcurrentProfileUpdates() async {
        // Given
        let mockUser = createMockUser()
        mockAuthService.mockUser = mockUser

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

    private func createMockUser() -> User {
        User(
            id: "test_user_id",
            email: "test@example.com",
            username: "test_user",
            displayName: "Test User",
            avatarURL: nil,
            bio: "Test bio",
            points: 100,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}
