//
//  AuthServiceTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for AuthService
//

import XCTest
import Combine
@testable import TRIX3DCompanion

/// Unit tests for AuthService
final class AuthServiceTests: XCTestCase {

    // MARK: - Properties

    var authService: AuthService!
    var mockAPIClient: MockAPIClient!
    var mockKeychainManager: MockKeychainManager!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        mockAPIClient = MockAPIClient()
        mockKeychainManager = MockKeychainManager()

        authService = AuthService(
            apiClient: mockAPIClient,
            keychainManager: mockKeychainManager
        )

        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        authService = nil
        mockAPIClient = nil
        mockKeychainManager = nil
        cancellables = nil
    }

    // MARK: - Login Tests

    func test_login_success_withValidCredentials() async throws {
        // Arrange
        let testUser = createTestUser(id: "user-1", username: "testuser", email: "test@example.com")
        let testSession = createTestSession(accessToken: "access-token", refreshToken: "refresh-token")

        mockAPIClient.mockLoginResponse = AuthResponse(user: testUser, session: testSession)

        // Act
        let result = await authService.login(email: "test@example.com", password: "password123")

        // Assert
        switch result {
        case .success(let user):
            XCTAssertEqual(user.id, "user-1")
            XCTAssertEqual(user.email, "test@example.com")
            XCTAssertTrue(authService.isLoggedIn)
            XCTAssertNotNil(authService.currentUser)
        case .failure(let error):
            XCTFail("Login should succeed but got error: \(error)")
        }
    }

    func test_login_failure_withInvalidEmail() async throws {
        // Act
        let result = await authService.login(email: "invalid-email", password: "password123")

        // Assert
        switch result {
        case .success:
            XCTFail("Login should fail with invalid email")
        case .failure(let error):
            if case .validationError(let message) = error {
                XCTAssertTrue(message.contains("Invalid email format"), "Should return validation error for invalid email")
            } else {
                XCTFail("Should return validation error")
            }
        }
    }

    func test_login_failure_withShortPassword() async throws {
        // Act
        let result = await authService.login(email: "test@example.com", password: "12345")

        // Assert
        switch result {
        case .success:
            XCTFail("Login should fail with short password")
        case .failure(let error):
            if case .validationError(let message) = error {
                XCTAssertTrue(message.contains("Password must be at least 6 characters"))
            } else {
                XCTFail("Should return validation error")
            }
        }
    }

    func test_login_failure_withNetworkError() async throws {
        // Arrange
        mockAPIClient.mockNetworkError = .noConnection

        // Act
        let result = await authService.login(email: "test@example.com", password: "password123")

        // Assert
        switch result {
        case .success:
            XCTFail("Login should fail with network error")
        case .failure(let error):
            if case .networkError = error {
                XCTAssertTrue(true, "Should return network error")
            } else {
                XCTFail("Should return network error but got: \(error)")
            }
        }
    }

    // MARK: - Register Tests

    func test_register_success_withValidData() async throws {
        // Arrange
        let testUser = createTestUser(id: "user-1", username: "testuser", email: "test@example.com")
        mockAPIClient.mockRegisterResponse = testUser
        mockAPIClient.mockLoginResponse = AuthResponse(
            user: testUser,
            session: createTestSession(accessToken: "access-token", refreshToken: "refresh-token")
        )

        // Act
        let result = await authService.register(username: "testuser", email: "test@example.com", password: "password123")

        // Assert
        switch result {
        case .success(let user):
            XCTAssertEqual(user.username, "testuser")
            XCTAssertEqual(user.email, "test@example.com")
        case .failure(let error):
            XCTFail("Registration should succeed but got error: \(error)")
        }
    }

    func test_register_failure_withShortUsername() async throws {
        // Act
        let result = await authService.register(username: "ab", email: "test@example.com", password: "password123")

        // Assert
        switch result {
        case .success:
            XCTFail("Registration should fail with short username")
        case .failure(let error):
            if case .validationError(let message) = error {
                XCTAssertTrue(message.contains("Username must be at least 3 characters"))
            } else {
                XCTFail("Should return validation error")
            }
        }
    }

    func test_register_failure_withInvalidEmail() async throws {
        // Act
        let result = await authService.register(username: "testuser", email: "invalid", password: "password123")

        // Assert
        switch result {
        case .success:
            XCTFail("Registration should fail with invalid email")
        case .failure(let error):
            if case .validationError = error {
                XCTAssertTrue(true, "Should return validation error")
            } else {
                XCTFail("Should return validation error")
            }
        }
    }

    func test_register_failure_withShortPassword() async throws {
        // Act
        let result = await authService.register(username: "testuser", email: "test@example.com", password: "12345")

        // Assert
        switch result {
        case .success:
            XCTFail("Registration should fail with short password")
        case .failure(let error):
            if case .validationError(let message) = error {
                XCTAssertTrue(message.contains("Password must be at least 6 characters"))
            } else {
                XCTFail("Should return validation error")
            }
        }
    }

    func test_register_failure_withExistingEmail() async throws {
        // Arrange
        mockAPIClient.mockNetworkError = .custom("Email already exists")

        // Act
        let result = await authService.register(username: "testuser", email: "existing@example.com", password: "password123")

        // Assert
        switch result {
        case .success:
            XCTFail("Registration should fail with existing email")
        case .failure(let error):
            XCTAssertEqual(error, .emailAlreadyExists, "Should return email already exists error")
        }
    }

    // MARK: - Logout Tests

    func test_logout_success_clearsSession() async throws {
        // Arrange
        let testUser = createTestUser(id: "user-1", username: "testuser", email: "test@example.com")
        let testSession = createTestSession(accessToken: "access-token", refreshToken: "refresh-token")

        mockAPIClient.mockLoginResponse = AuthResponse(user: testUser, session: testSession)
        _ = await authService.login(email: "test@example.com", password: "password123")

        XCTAssertTrue(authService.isLoggedIn)

        // Act
        let result = await authService.logout()

        // Assert
        switch result {
        case .success:
            XCTAssertFalse(authService.isLoggedIn, "Should not be logged in after logout")
            XCTAssertNil(authService.currentUser, "Current user should be cleared")
            XCTAssertNil(mockKeychainManager.getAccessToken(), "Access token should be cleared")
            XCTAssertNil(mockKeychainManager.getRefreshToken(), "Refresh token should be cleared")
        case .failure(let error):
            XCTFail("Logout should succeed but got error: \(error)")
        }
    }

    // MARK: - Token Refresh Tests

    func test_refreshTokenIfNeeded_success_refreshesToken() async throws {
        // Arrange
        let testUser = createTestUser(id: "user-1", username: "testuser", email: "test@example.com")
        let expiredSession = createTestSession(accessToken: "old-access-token", refreshToken: "refresh-token")
        let newSession = createTestSession(accessToken: "new-access-token", refreshToken: "new-refresh-token")

        mockAPIClient.mockLoginResponse = AuthResponse(user: testUser, session: expiredSession)
        mockAPIClient.mockRefreshResponse = AuthResponse(user: testUser, session: newSession)

        // Log in first
        _ = await authService.login(email: "test@example.com", password: "password123")

        // Act
        let result = await authService.refreshTokenIfNeeded()

        // Assert
        switch result {
        case .success:
            let newAccessToken = mockKeychainManager.getAccessToken()
            XCTAssertEqual(newAccessToken, "new-access-token", "Access token should be updated")
        case .failure(let error):
            XCTFail("Token refresh should succeed but got error: \(error)")
        }
    }

    func test_refreshTokenIfNeeded_failure_clearsSession() async throws {
        // Arrange
        let testUser = createTestUser(id: "user-1", username: "testuser", email: "test@example.com")
        let testSession = createTestSession(accessToken: "access-token", refreshToken: "refresh-token")

        mockAPIClient.mockLoginResponse = AuthResponse(user: testUser, session: testSession)
        mockAPIClient.mockRefreshError = .unauthorized

        // Log in first
        _ = await authService.login(email: "test@example.com", password: "password123")
        XCTAssertTrue(authService.isLoggedIn)

        // Force token to need refresh by setting expiration
        mockKeychainManager.tokenExpirationDate = Date().addingTimeInterval(-1000)

        // Act
        let result = await authService.refreshTokenIfNeeded()

        // Assert
        switch result {
        case .success:
            XCTFail("Token refresh should fail")
        case .failure(let error):
            XCTAssertEqual(error, .refreshFailed, "Should return refresh failed error")
            XCTAssertFalse(authService.isLoggedIn, "Session should be cleared on refresh failure")
        }
    }

    // MARK: - Fetch Current User Tests

    func test_fetchCurrentUser_success_updatesCurrentUser() async throws {
        // Arrange
        let testUser = createTestUser(id: "user-1", username: "testuser", email: "test@example.com")
        let testSession = createTestSession(accessToken: "access-token", refreshToken: "refresh-token")

        mockAPIClient.mockLoginResponse = AuthResponse(user: testUser, session: testSession)
        mockAPIClient.mockCurrentUser = testUser

        // Log in first
        _ = await authService.login(email: "test@example.com", password: "password123")

        // Act
        let result = await authService.fetchCurrentUser()

        // Assert
        switch result {
        case .success(let user):
            XCTAssertEqual(user.id, "user-1")
            XCTAssertEqual(authService.currentUser?.id, "user-1")
        case .failure(let error):
            XCTFail("Fetch current user should succeed but got error: \(error)")
        }
    }

    func test_fetchCurrentUser_failure_withUnauthorized_clearsSession() async throws {
        // Arrange
        let testUser = createTestUser(id: "user-1", username: "testuser", email: "test@example.com")
        let testSession = createTestSession(accessToken: "access-token", refreshToken: "refresh-token")

        mockAPIClient.mockLoginResponse = AuthResponse(user: testUser, session: testSession)
        mockAPIClient.mockFetchUserError = .unauthorized

        // Log in first
        _ = await authService.login(email: "test@example.com", password: "password123")
        XCTAssertTrue(authService.isLoggedIn)

        // Act
        let result = await authService.fetchCurrentUser()

        // Assert
        switch result {
        case .success:
            XCTFail("Fetch current user should fail with unauthorized")
        case .failure(let error):
            XCTAssertFalse(authService.isLoggedIn, "Session should be cleared on unauthorized")
        }
    }

    // MARK: - Published Properties Tests

    func test_isLoggedIn_publishesChanges() throws {
        // Arrange
        let expectation = XCTestExpectation(description: "isLoggedIn should publish change")

        let testUser = createTestUser(id: "user-1", username: "testuser", email: "test@example.com")
        let testSession = createTestSession(accessToken: "access-token", refreshToken: "refresh-token")
        mockAPIClient.mockLoginResponse = AuthResponse(user: testUser, session: testSession)

        // Act
        authService.$isLoggedIn
            .dropFirst() // Skip initial value
            .sink { isLoggedIn in
                if isLoggedIn {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        Task {
            _ = await authService.login(email: "test@example.com", password: "password123")
        }

        // Assert
        wait(for: [expectation], timeout: 5.0)
    }

    func test_currentUser_publishesChanges() throws {
        // Arrange
        let expectation = XCTestExpectation(description: "currentUser should publish change")

        let testUser = createTestUser(id: "user-1", username: "testuser", email: "test@example.com")
        let testSession = createTestSession(accessToken: "access-token", refreshToken: "refresh-token")
        mockAPIClient.mockLoginResponse = AuthResponse(user: testUser, session: testSession)

        // Act
        authService.$currentUser
            .dropFirst() // Skip initial nil value
            .compactMap { $0 }
            .sink { user in
                if user.id == "user-1" {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        Task {
            _ = await authService.login(email: "test@example.com", password: "password123")
        }

        // Assert
        wait(for: [expectation], timeout: 5.0)
    }

    func test_isLoading_publishesChanges() throws {
        // Arrange
        let expectation = XCTestExpectation(description: "isLoading should publish changes")
        var loadingStates: [Bool] = []

        let testUser = createTestUser(id: "user-1", username: "testuser", email: "test@example.com")
        let testSession = createTestSession(accessToken: "access-token", refreshToken: "refresh-token")
        mockAPIClient.mockLoginResponse = AuthResponse(user: testUser, session: testSession)

        // Act
        authService.$isLoading
            .sink { isLoading in
                loadingStates.append(isLoading)
                if loadingStates.count >= 2 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        Task {
            _ = await authService.login(email: "test@example.com", password: "password123")
        }

        // Assert
        wait(for: [expectation], timeout: 5.0)

        // Should have true (loading) then false (done)
        XCTAssertEqual(loadingStates, [true, false], "Should publish loading states")
    }

    // MARK: - Error Tests

    func test_authErrorDescriptions() {
        let invalidCredentials = AuthError.invalidCredentials
        XCTAssertEqual(invalidCredentials.localizedDescription, "Invalid email or password")

        let emailAlreadyExists = AuthError.emailAlreadyExists
        XCTAssertEqual(emailAlreadyExists.localizedDescription, "An account with this email already exists")

        let tokenExpired = AuthError.tokenExpired
        XCTAssertEqual(tokenExpired.localizedDescription, "Your session has expired. Please log in again.")

        let refreshFailed = AuthError.refreshFailed
        XCTAssertEqual(refreshFailed.localizedDescription, "Failed to refresh session. Please log in again.")
    }

    func test_authErrorRecoverability() {
        XCTAssertTrue(AuthError.tokenExpired.isRecoverable, "Token expired should be recoverable")
        XCTAssertTrue(AuthError.refreshFailed.isRecoverable, "Refresh failed should be recoverable")
        XCTAssertFalse(AuthError.invalidCredentials.isRecoverable, "Invalid credentials should not be recoverable")
        XCTAssertFalse(AuthError.emailAlreadyExists.isRecoverable, "Email exists should not be recoverable")
    }

    // MARK: - Convenience Properties Tests

    func test_isPremium_withPositivePoints() throws {
        // Arrange
        let testUser = createTestUser(id: "user-1", username: "testuser", email: "test@example.com", points: 100)
        let testSession = createTestSession(accessToken: "access-token", refreshToken: "refresh-token")

        mockAPIClient.mockLoginResponse = AuthResponse(user: testUser, session: testSession)

        // Act
        _ = await authService.login(email: "test@example.com", password: "password123")

        // Assert
        XCTAssertTrue(authService.isPremium, "User with positive points should be premium")
    }

    func test_isPremium_withZeroPoints() throws {
        // Arrange
        let testUser = createTestUser(id: "user-1", username: "testuser", email: "test@example.com", points: 0)
        let testSession = createTestSession(accessToken: "access-token", refreshToken: "refresh-token")

        mockAPIClient.mockLoginResponse = AuthResponse(user: testUser, session: testSession)

        // Act
        _ = await authService.login(email: "test@example.com", password: "password123")

        // Assert
        XCTAssertFalse(authService.isPremium, "User with zero points should not be premium")
    }

    func test_displayName_returnsDisplayName() throws {
        // Arrange
        let testUser = createTestUser(id: "user-1", username: "testuser", email: "test@example.com", displayName: "Test User")
        let testSession = createTestSession(accessToken: "access-token", refreshToken: "refresh-token")

        mockAPIClient.mockLoginResponse = AuthResponse(user: testUser, session: testSession)

        // Act
        _ = await authService.login(email: "test@example.com", password: "password123")

        // Assert
        XCTAssertEqual(authService.displayName, "Test User", "Should return display name")
    }

    func test_displayName_fallsBackToUsername() throws {
        // Arrange
        let testUser = createTestUser(id: "user-1", username: "testuser", email: "test@example.com", displayName: nil)
        let testSession = createTestSession(accessToken: "access-token", refreshToken: "refresh-token")

        mockAPIClient.mockLoginResponse = AuthResponse(user: testUser, session: testSession)

        // Act
        _ = await authService.login(email: "test@example.com", password: "password123")

        // Assert
        XCTAssertEqual(authService.displayName, "testuser", "Should fall back to username")
    }

    // MARK: - Clear Error Tests

    func test_clearError_removesLastError() throws {
        // Arrange
        let testError = AuthError.validationError(message: "Test error")
        authService.lastError = testError

        // Act
        authService.clearError()

        // Assert
        XCTAssertNil(authService.lastError, "Last error should be cleared")
    }

    // MARK: - Helper Methods

    private func createTestUser(
        id: String,
        username: String,
        email: String,
        displayName: String? = "Test User",
        points: Int = 0
    ) -> User {
        return User(
            id: id,
            username: username,
            email: email,
            displayName: displayName,
            avatarUrl: nil,
            points: points,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    private func createTestSession(accessToken: String, refreshToken: String) -> UserSession {
        return UserSession(
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: Date().addingTimeInterval(3600)
        )
    }
}

// MARK: - Mock API Client

private class MockAPIClient: APIClient {
    var mockLoginResponse: AuthResponse?
    var mockRegisterResponse: User?
    var mockRefreshResponse: AuthResponse?
    var mockCurrentUser: User?
    var mockNetworkError: NetworkError?
    var mockRefreshError: NetworkError?
    var mockFetchUserError: NetworkError?

    override func login(email: String, password: String) async throws -> AuthResponse {
        if let error = mockNetworkError {
            throw error
        }
        return mockLoginResponse ?? AuthResponse(
            user: User(id: "1", username: "test", email: email, displayName: "Test", avatarUrl: nil, points: 0, createdAt: Date(), updatedAt: Date()),
            session: UserSession(accessToken: "token", refreshToken: "refresh", expiresAt: Date().addingTimeInterval(3600))
        )
    }

    override func register(username: String, email: String, password: String) async throws -> User {
        if let error = mockNetworkError {
            throw error
        }
        return mockRegisterResponse ?? User(
            id: "1",
            username: username,
            email: email,
            displayName: username,
            avatarUrl: nil,
            points: 0,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    override func logout() async throws {
        if let error = mockNetworkError {
            throw error
        }
    }

    override func getCurrentUser() async throws -> User {
        if let error = mockFetchUserError {
            throw error
        }
        return mockCurrentUser ?? User(
            id: "1",
            username: "test",
            email: "test@example.com",
            displayName: "Test",
            avatarUrl: nil,
            points: 0,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    override func post<T: Codable>(_ endpoint: APIEndpoints, body: Codable) async throws -> T {
        if let error = mockRefreshError, endpoint == .authRefresh {
            throw error
        }

        if let response = mockRefreshResponse as? T {
            return response
        }

        throw NetworkError.invalidResponse
    }
}

// MARK: - Mock Keychain Manager

private class MockKeychainManager: KeychainManager {
    var accessToken: String?
    var refreshToken: String?
    var tokenExpirationDate: Date?

    override func saveSession(_ session: UserSession) throws {
        accessToken = session.accessToken
        refreshToken = session.refreshToken
        tokenExpirationDate = session.expiresAt
    }

    override func getAccessToken() -> String? {
        return accessToken
    }

    override func getRefreshToken() -> String? {
        return refreshToken
    }

    override func hasValidSession() -> Bool {
        return accessToken != nil && refreshToken != nil
    }

    override func clearSession() throws {
        accessToken = nil
        refreshToken = nil
        tokenExpirationDate = nil
    }
}
