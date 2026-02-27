//
//  AuthServiceTests.swift
//  TRIX3DCompanionTests
//
//  Test suite for AuthService authentication functionality
//
//  Test Coverage:
//  - Login flow (success, invalid credentials, network error, validation)
//  - Register flow (success, email exists, validation errors)
//  - Token management (storage, refresh, expiration)
//  - Logout flow (clear tokens, clear cache)
//  - Error handling (various error scenarios)
//

import XCTest
import Combine
@testable import TRIX3DCompanion

// MARK: - Mock API Client for Auth

@MainActor
final class MockAPIClientForAuth: APIClient {
    var shouldFailRequests = false
    var mockError: NetworkError?
    var mockAuthResponse: AuthResponse?
    var mockUser: User?
    var lastLoginEmail: String?
    var lastLoginPassword: String?
    var lastRegisterUsername: String?
    var lastRegisterEmail: String?
    var lastRegisterPassword: String?
    var logoutCalled = false

    override func login(email: String, password: String) async throws -> AuthResponse {
        lastLoginEmail = email
        lastLoginPassword = password

        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        return mockAuthResponse!
    }

    override func register(username: String, email: String, password: String) async throws -> User {
        lastRegisterUsername = username
        lastRegisterEmail = email
        lastRegisterPassword = password

        if shouldFailRequests {
            throw mockError ?? NetworkError.custom("Registration failed")
        }

        return mockUser!
    }

    override func logout() async throws {
        logoutCalled = true
        if shouldFailRequests {
            throw mockError ?? NetworkError.custom("Logout failed")
        }
    }

    override func getCurrentUser() async throws -> User {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        return mockUser!
    }

    override func post<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.custom("Request failed")
        }

        if T.self == AuthResponse.self {
            return mockAuthResponse as! T
        }

        throw NetworkError.custom("Unknown endpoint")
    }
}

// MARK: - Mock Keychain Manager for Auth

@MainActor
final class MockKeychainManagerForAuth: KeychainManager {
    var shouldFailSaveSession = false
    var shouldFailClearSession = false
    var shouldFailSaveAccessToken = false
    var shouldFailSaveRefreshToken = false
    var shouldReturnValidSession = false
    var storedAccessToken: String?
    var storedRefreshToken: String?
    var storedUserId: String?
    var clearSessionCalled = false

    override func saveSession(_ session: UserSession) throws {
        if shouldFailSaveSession {
            throw KeychainError.securityValidationFailed
        }
        storedAccessToken = session.accessToken
        storedRefreshToken = session.refreshToken
        storedUserId = session.userId
    }

    override func clearSession() throws {
        clearSessionCalled = true
        if shouldFailClearSession {
            throw KeychainError.securityValidationFailed
        }
        storedAccessToken = nil
        storedRefreshToken = nil
        storedUserId = nil
    }

    override func saveAccessToken(_ token: String) throws {
        if shouldFailSaveAccessToken {
            throw KeychainError.securityValidationFailed
        }
        storedAccessToken = token
    }

    override func saveRefreshToken(_ token: String) throws {
        if shouldFailSaveRefreshToken {
            throw KeychainError.securityValidationFailed
        }
        storedRefreshToken = token
    }

    override func getAccessToken() -> String? {
        return storedAccessToken
    }

    override func getRefreshToken() -> String? {
        return storedRefreshToken
    }

    override func getUserId() -> String? {
        return storedUserId
    }

    override func hasValidSession() -> Bool {
        return shouldReturnValidSession && storedAccessToken != nil && storedRefreshToken != nil
    }
}

// MARK: - Auth Service Tests

@MainActor
final class AuthServiceTests: XCTestCase {

    var sut: AuthService!
    var mockAPIClient: MockAPIClientForAuth!
    var mockKeychainManager: MockKeychainManagerForAuth!

    override func setUp() async throws {
        try await super.setUp()

        mockAPIClient = MockAPIClientForAuth()
        mockKeychainManager = MockKeychainManagerForAuth()

        // Setup default mock response
        mockAPIClient.mockAuthResponse = createMockAuthResponse()
        mockAPIClient.mockUser = createMockUser()

        sut = AuthService(
            apiClient: mockAPIClient,
            keychainManager: mockKeychainManager
        )
    }

    override func tearDown() async throws {
        sut = nil
        mockAPIClient = nil
        mockKeychainManager = nil
        try await super.tearDown()
    }
}

// MARK: - Login Tests

extension AuthServiceTests {

    func testLoginSuccess() async {
        // Given
        let email = "test@example.com"
        let password = "password123"

        // When
        let result = await sut.login(email: email, password: password)

        // Then
        switch result {
        case .success(let user):
            XCTAssertEqual(user.id, "test_user_id", "Should return correct user")
            XCTAssertEqual(mockAPIClient.lastLoginEmail, email, "Should call API with correct email")
            XCTAssertTrue(sut.isLoggedIn, "Should be logged in")
            XCTAssertEqual(sut.currentUser?.id, user.id, "Should set current user")
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }

    func testLoginWithInvalidEmailFormat() async {
        // Given
        let invalidEmail = "invalid-email"

        // When
        let result = await sut.login(email: invalidEmail, password: "password123")

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with validation error")
        case .failure(let error):
            if case .validationError(let message) = error {
                XCTAssertTrue(message.contains("email"), "Should be email validation error")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        }
    }

    func testLoginWithShortPassword() async {
        // Given
        let shortPassword = "123"

        // When
        let result = await sut.login(email: "test@example.com", password: shortPassword)

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with validation error")
        case .failure(let error):
            if case .validationError(let message) = error {
                XCTAssertTrue(message.contains("Password"), "Should be password validation error")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        }
    }

    func testLoginWithInvalidCredentials() async {
        // Given
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .unauthorized

        // When
        let result = await sut.login(email: "test@example.com", password: "password123")

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with invalid credentials")
        case .failure(let error):
            XCTAssertEqual(error, .invalidCredentials, "Should return invalid credentials error")
        }
    }

    func testLoginWithNetworkError() async {
        // Given
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .timeout

        // When
        let result = await sut.login(email: "test@example.com", password: "password123")

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with network error")
        case .failure(let error):
            if case .networkError = error {
                XCTAssertTrue(true, "Should return network error")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        }
    }

    func testLoginFailsWhenKeychainSaveFails() async {
        // Given
        mockKeychainManager.shouldFailSaveSession = true

        // When
        let result = await sut.login(email: "test@example.com", password: "password123")

        // Then
        switch result {
        case .success:
            XCTFail("Should fail when keychain save fails")
        case .failure:
            XCTAssertFalse(sut.isLoggedIn, "Should not be logged in after failure")
        }
    }
}

// MARK: - Register Tests

extension AuthServiceTests {

    func testRegisterSuccess() async {
        // Given
        let username = "newuser"
        let email = "newuser@example.com"
        let password = "password123"

        // When
        let result = await sut.register(username: username, email: email, password: password)

        // Then
        switch result {
        case .success(let user):
            XCTAssertEqual(user.id, "new_user_id", "Should return registered user")
            XCTAssertEqual(mockAPIClient.lastRegisterUsername, username, "Should call API with correct username")
            XCTAssertEqual(mockAPIClient.lastRegisterEmail, email, "Should call API with correct email")
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }

    func testRegisterWithInvalidEmail() async {
        // Given
        let invalidEmail = "not-an-email"

        // When
        let result = await sut.register(username: "user", email: invalidEmail, password: "password123")

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with validation error")
        case .failure(let error):
            if case .validationError(let message) = error {
                XCTAssertTrue(message.contains("email"), "Should be email validation error")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        }
    }

    func testRegisterWithShortUsername() async {
        // Given
        let shortUsername = "ab"

        // When
        let result = await sut.register(username: shortUsername, email: "test@example.com", password: "password123")

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with validation error")
        case .failure(let error):
            if case .validationError(let message) = error {
                XCTAssertTrue(message.contains("Username"), "Should be username validation error")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        }
    }

    func testRegisterWithShortPassword() async {
        // Given
        let shortPassword = "123"

        // When
        let result = await sut.register(username: "user", email: "test@example.com", password: shortPassword)

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with validation error")
        case .failure(let error):
            if case .validationError(let message) = error {
                XCTAssertTrue(message.contains("Password"), "Should be password validation error")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        }
    }

    func testRegisterWithEmailAlreadyExists() async {
        // Given
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .custom("Email already exists")

        // When
        let result = await sut.register(username: "newuser", email: "existing@example.com", password: "password123")

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with email exists error")
        case .failure(let error):
            XCTAssertEqual(error, .emailAlreadyExists, "Should return email already exists error")
        }
    }

    func testRegisterWithNetworkError() async {
        // Given
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .timeout

        // When
        let result = await sut.register(username: "newuser", email: "new@example.com", password: "password123")

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with network error")
        case .failure(let error):
            if case .networkError = error {
                XCTAssertTrue(true, "Should return network error")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        }
    }
}

// MARK: - Logout Tests

extension AuthServiceTests {

    func testLogoutSuccess() async {
        // Given - first login to establish session
        _ = await sut.login(email: "test@example.com", password: "password123")
        XCTAssertTrue(sut.isLoggedIn, "Should be logged in before logout")

        // When
        let result = await sut.logout()

        // Then
        switch result {
        case .success:
            XCTAssertFalse(sut.isLoggedIn, "Should not be logged in after logout")
            XCTAssertNil(sut.currentUser, "Should clear current user")
            XCTAssertTrue(mockKeychainManager.clearSessionCalled, "Should clear keychain session")
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }

    func testLogoutClearsTokenCache() async {
        // Given
        _ = await sut.login(email: "test@example.com", password: "password123")
        XCTAssertNotNil(mockKeychainManager.storedAccessToken, "Should have stored access token")

        // When
        _ = await sut.logout()

        // Then
        XCTAssertNil(mockKeychainManager.storedAccessToken, "Should clear access token")
        XCTAssertNil(mockKeychainManager.storedRefreshToken, "Should clear refresh token")
    }

    func testLogoutContinuesEvenWhenAPIFails() async {
        // Given
        _ = await sut.login(email: "test@example.com", password: "password123")
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .timeout

        // When
        let result = await sut.logout()

        // Then
        switch result {
        case .success:
            XCTAssertFalse(sut.isLoggedIn, "Should logout even if API fails")
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }
}

// MARK: - Token Refresh Tests

extension AuthServiceTests {

    func testRefreshTokenWhenNotLoggedIn() async {
        // Given - not logged in

        // When
        let result = await sut.refreshTokenIfNeeded()

        // Then
        switch result {
        case .success:
            XCTAssertTrue(true, "Should succeed with no action")
        case .failure:
            XCTFail("Should not fail when not logged in")
        }
    }

    func testRefreshTokenWithNoRefreshToken() async {
        // Given - logged in but no refresh token
        _ = await sut.login(email: "test@example.com", password: "password123")
        mockKeychainManager.storedRefreshToken = nil

        // When
        let result = await sut.refreshTokenIfNeeded()

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with no refresh token")
        case .failure(let error):
            XCTAssertEqual(error, .refreshFailed, "Should return refresh failed error")
        }
    }

    func testRefreshTokenSuccess() async {
        // Given - logged in with expired token
        _ = await sut.login(email: "test@example.com", password: "password123")

        // Mock a new auth response for refresh
        let newAuthResponse = AuthResponse(
            user: createMockUser(),
            session: UserSession(
                id: "new_session_id",
                userId: "test_user_id",
                accessToken: "new_access_token",
                refreshToken: "new_refresh_token",
                expiresAt: Date().addingTimeInterval(3600)
            )
        )
        mockAPIClient.mockAuthResponse = newAuthResponse

        // When
        let result = await sut.refreshTokenIfNeeded()

        // Then
        switch result {
        case .success:
            XCTAssertEqual(mockKeychainManager.storedAccessToken, "new_access_token", "Should save new access token")
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }

    func testRefreshTokenFailure() async {
        // Given - logged in
        _ = await sut.login(email: "test@example.com", password: "password123")
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .unauthorized

        // When
        let result = await sut.refreshTokenIfNeeded()

        // Then
        switch result {
        case .success:
            XCTFail("Should fail when refresh fails")
        case .failure(let error):
            XCTAssertEqual(error, .refreshFailed, "Should return refresh failed error")
            XCTAssertFalse(sut.isLoggedIn, "Should clear login state")
        }
    }
}

// MARK: - Fetch Current User Tests

extension AuthServiceTests {

    func testFetchCurrentUserWhenNotLoggedIn() async {
        // Given - not logged in

        // When
        let result = await sut.fetchCurrentUser()

        // Then
        switch result {
        case .success:
            XCTFail("Should fail when not logged in")
        case .failure(let error):
            XCTAssertEqual(error, .invalidCredentials, "Should return invalid credentials error")
        }
    }

    func testFetchCurrentUserSuccess() async {
        // Given - logged in
        _ = await sut.login(email: "test@example.com", password: "password123")

        // When
        let result = await sut.fetchCurrentUser()

        // Then
        switch result {
        case .success(let user):
            XCTAssertEqual(user.id, "test_user_id", "Should return current user")
        case .failure(let error):
            XCTFail("Should succeed: \(error)")
        }
    }

    func testFetchCurrentUserWithUnauthorizedError() async {
        // Given - logged in but API returns unauthorized
        _ = await sut.login(email: "test@example.com", password: "password123")
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .unauthorized

        // When
        let result = await sut.fetchCurrentUser()

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with unauthorized error")
        case .failure(let error):
            XCTAssertEqual(error, .invalidCredentials, "Should return invalid credentials error")
            XCTAssertFalse(sut.isLoggedIn, "Should clear login state on unauthorized")
        }
    }

    func testFetchCurrentUserWithNetworkError() async {
        // Given - logged in
        _ = await sut.login(email: "test@example.com", password: "password123")
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .timeout

        // When
        let result = await sut.fetchCurrentUser()

        // Then
        switch result {
        case .success:
            XCTFail("Should fail with network error")
        case .failure(let error):
            if case .networkError = error {
                XCTAssertTrue(true, "Should return network error")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        }
    }
}

// MARK: - Error Handling Tests

extension AuthServiceTests {

    func testLoginSetsLastError() async {
        // Given
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .unauthorized

        // When
        _ = await sut.login(email: "test@example.com", password: "password123")

        // Then
        XCTAssertNotNil(sut.lastError, "Should set last error")
    }

    func testClearErrorClearsErrorState() async {
        // Given
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .unauthorized
        _ = await sut.login(email: "test@example.com", password: "password123")
        XCTAssertNotNil(sut.lastError, "Should have error after failed login")

        // When
        sut.clearError()

        // Then
        XCTAssertNil(sut.lastError, "Should clear error")
    }

    func testValidationErrorMessageIsCorrect() async {
        // Given
        let validationError = AuthError.validationError(message: "Test validation error")

        // Then
        XCTAssertEqual(validationError.errorDescription, "Test validation error")
        XCTAssertFalse(validationError.isRecoverable, "Validation error should not be recoverable")
    }

    func testTokenExpiredErrorIsRecoverable() async {
        // Given
        let tokenExpiredError = AuthError.tokenExpired
        let refreshFailedError = AuthError.refreshFailed

        // Then
        XCTAssertTrue(tokenExpiredError.isRecoverable, "Token expired should be recoverable")
        XCTAssertTrue(refreshFailedError.isRecoverable, "Refresh failed should be recoverable")
    }

    func testNetworkErrorMapsCorrectly() async {
        // Given - test error mapping
        let noConnectionError = AuthError.networkError(underlying: NetworkError.noConnection)
        let timeoutError = AuthError.networkError(underlying: NetworkError.timeout)

        // Then
        XCTAssertNotNil(noConnectionError.errorDescription)
        XCTAssertNotNil(timeoutError.errorDescription)
    }
}

// MARK: - Session State Tests

extension AuthServiceTests {

    func testIsPremiumProperty() async {
        // Given - user with points
        _ = await sut.login(email: "test@example.com", password: "password123")

        // Then
        XCTAssertTrue(sut.isPremium, "User with points should be premium")
    }

    func testIsPremiumPropertyFalseForZeroPoints() async {
        // Given - user with zero points
        let userWithNoPoints = User(
            id: "test_user_id",
            username: "test",
            email: "test@example.com",
            avatarUrl: nil,
            fullName: nil,
            displayName: "Test User",
            bio: nil,
            points: 0,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 0,
            createdAt: Date(),
            updatedAt: Date()
        )
        mockAPIClient.mockUser = userWithNoPoints
        mockAPIClient.mockAuthResponse = AuthResponse(
            user: userWithNoPoints,
            session: createMockSession()
        )

        _ = await sut.login(email: "test@example.com", password: "password123")

        // Then
        XCTAssertFalse(sut.isPremium, "User with zero points should not be premium")
    }

    func testDisplayNameReturnsUsername() async {
        // Given
        _ = await sut.login(email: "test@example.com", password: "password123")

        // Then
        XCTAssertEqual(sut.displayName, "Test User", "Should return display name")
    }

    func testDisplayNameFallback() async {
        // Given - no user logged in

        // Then
        XCTAssertEqual(sut.displayName, "User", "Should return default display name")
    }
}

// MARK: - Helper Methods

extension AuthServiceTests {

    private func createMockUser() -> User {
        User(
            id: "test_user_id",
            username: "test_user",
            email: "test@example.com",
            avatarUrl: nil,
            fullName: nil,
            displayName: "Test User",
            bio: nil,
            points: 100,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 0,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    private func createMockSession() -> UserSession {
        UserSession(
            id: "session_123",
            userId: "test_user_id",
            accessToken: "test_access_token",
            refreshToken: "test_refresh_token",
            expiresAt: Date().addingTimeInterval(3600)
        )
    }

    private func createMockAuthResponse() -> AuthResponse {
        AuthResponse(
            user: createMockUser(),
            session: createMockSession()
        )
    }
}
