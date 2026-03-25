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

// MARK: - Auth API Protocol

/// Protocol for authentication API methods
/// This allows us to create mock implementations for testing
protocol AuthAPIProtocol {
    func login(email: String, password: String) async throws -> AuthResponse
    func register(username: String, email: String, password: String) async throws -> User
    func logout() async throws
    func getCurrentUser() async throws -> User
    func post<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable
}

// MARK: - Mock Auth API Client

@MainActor
final class MockAuthAPIClient: AuthAPIProtocol {
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

    func login(email: String, password: String) async throws -> AuthResponse {
        lastLoginEmail = email
        lastLoginPassword = password

        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        guard let response = mockAuthResponse else {
            throw NetworkError.custom(message: "No mock response configured")
        }

        return response
    }

    func register(username: String, email: String, password: String) async throws -> User {
        lastRegisterUsername = username
        lastRegisterEmail = email
        lastRegisterPassword = password

        if shouldFailRequests {
            throw mockError ?? NetworkError.custom(message: "Registration failed")
        }

        guard let user = mockUser else {
            throw NetworkError.custom(message: "No mock user configured")
        }

        return user
    }

    func logout() async throws {
        logoutCalled = true
        if shouldFailRequests {
            throw mockError ?? NetworkError.custom(message: "Logout failed")
        }
    }

    func getCurrentUser() async throws -> User {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        guard let user = mockUser else {
            throw NetworkError.custom(message: "No mock user configured")
        }

        return user
    }

    func post<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.custom(message: "Request failed")
        }

        if T.self == AuthResponse.self, let authResponse = mockAuthResponse {
            return authResponse as! T
        }

        throw NetworkError.custom(message: "Unknown endpoint")
    }
}

// MARK: - Keychain Protocol

/// Protocol for keychain operations
/// This allows us to create mock implementations for testing
protocol KeychainProtocol {
    func saveSession(_ session: UserSession) throws
    func clearSession() throws
    func saveAccessToken(_ token: String) throws
    func saveRefreshToken(_ token: String) throws
    func getAccessToken() -> String?
    func getRefreshToken() -> String?
    func getUserId() -> String?
    func hasValidSession() -> Bool
}

// Extend KeychainManager to conform to the protocol
extension KeychainManager: KeychainProtocol {}

// MARK: - Mock Keychain Manager for Auth

@MainActor
final class MockKeychainManagerForAuth: KeychainProtocol {
    var shouldFailSaveSession = false
    var shouldFailClearSession = false
    var shouldFailSaveAccessToken = false
    var shouldFailSaveRefreshToken = false
    var shouldReturnValidSession = false
    var storedAccessToken: String?
    var storedRefreshToken: String?
    var storedUserId: String?
    var clearSessionCalled = false

    func saveSession(_ session: UserSession) throws {
        if shouldFailSaveSession {
            throw KeychainError.securityValidationFailed
        }
        storedAccessToken = session.accessToken
        storedRefreshToken = session.refreshToken
        storedUserId = session.userId
    }

    func clearSession() throws {
        clearSessionCalled = true
        if shouldFailClearSession {
            throw KeychainError.securityValidationFailed
        }
        storedAccessToken = nil
        storedRefreshToken = nil
        storedUserId = nil
    }

    func saveAccessToken(_ token: String) throws {
        if shouldFailSaveAccessToken {
            throw KeychainError.securityValidationFailed
        }
        storedAccessToken = token
    }

    func saveRefreshToken(_ token: String) throws {
        if shouldFailSaveRefreshToken {
            throw KeychainError.securityValidationFailed
        }
        storedRefreshToken = token
    }

    func getAccessToken() -> String? {
        return storedAccessToken
    }

    func getRefreshToken() -> String? {
        return storedRefreshToken
    }

    func getUserId() -> String? {
        return storedUserId
    }

    func hasValidSession() -> Bool {
        return shouldReturnValidSession && storedAccessToken != nil && storedRefreshToken != nil
    }
}

// MARK: - Testable Auth Service

/// A testable version of AuthService that accepts mock dependencies
@MainActor
final class TestableAuthService: AuthServiceProtocol {

    // MARK: - Published Properties

    @Published private(set) var currentUser: User?
    @Published private(set) var isLoggedIn: Bool = false
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var lastError: AuthError?

    // MARK: - Dependencies

    private let authAPI: AuthAPIProtocol
    private let keychainManager: KeychainProtocol

    // MARK: - Private Properties

    private let tokenRefreshBuffer: TimeInterval = 300
    private var tokenExpirationDate: Date?
    private var refreshTask: Task<AuthResult<Void>, Never>?
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    init(
        authAPI: AuthAPIProtocol,
        keychainManager: KeychainProtocol
    ) {
        self.authAPI = authAPI
        self.keychainManager = keychainManager
    }

    // MARK: - Internal Methods

    func updateCurrentUser(_ user: User?) {
        currentUser = user
    }

    func updateLoginStatus(_ loggedIn: Bool) {
        isLoggedIn = loggedIn
    }

    func updateProfile(_ updates: User) async -> AuthResult<User> {
        currentUser = updates
        return .success(updates)
    }

    func deleteAccount() async -> AuthResult<Void> {
        clearSession()
        return .success(())
    }

    // MARK: - Public Methods

    func login(email: String, password: String) async -> AuthResult<User> {
        // Validate input
        guard isValidEmail(email) else {
            let error = AuthError.validationError(message: "Invalid email format")
            lastError = error
            return .failure(error)
        }

        guard password.count >= 6 else {
            let error = AuthError.validationError(message: "Password must be at least 6 characters")
            lastError = error
            return .failure(error)
        }

        isLoading = true
        lastError = nil

        do {
            let response = try await authAPI.login(email: email, password: password)

            // Save session tokens
            try saveSession(response.session!)

            // Set current user
            currentUser = response.user
            isLoggedIn = true

            isLoading = false

            return .success(response.user)

        } catch let error as NetworkError {
            isLoading = false
            let authError = mapNetworkError(error)
            lastError = authError
            return .failure(authError)
        } catch {
            isLoading = false
            let authError = AuthError.unknown(underlying: error)
            lastError = authError
            return .failure(authError)
        }
    }

    func register(username: String, email: String, password: String) async -> AuthResult<User> {
        // Validate input
        guard isValidEmail(email) else {
            let error = AuthError.validationError(message: "Invalid email format")
            lastError = error
            return .failure(error)
        }

        guard username.count >= 3 else {
            let error = AuthError.validationError(message: "Username must be at least 3 characters")
            lastError = error
            return .failure(error)
        }

        guard password.count >= 6 else {
            let error = AuthError.validationError(message: "Password must be at least 6 characters")
            lastError = error
            return .failure(error)
        }

        isLoading = true
        lastError = nil

        do {
            let user = try await authAPI.register(username: username, email: email, password: password)

            // After registration, automatically login
            let loginResult = await login(email: email, password: password)

            isLoading = false

            switch loginResult {
            case .success:
                return .success(user)
            case .failure(let error):
                // Registration succeeded but auto-login failed
                // Return user anyway since registration was successful
                return .success(user)
            }

        } catch let error as NetworkError {
            isLoading = false

            // Check for specific error cases
            if case .validationError(let message) = mapNetworkError(error),
               message.lowercased().contains("email") || message.lowercased().contains("exists") {
                let authError = AuthError.emailAlreadyExists
                lastError = authError
                return .failure(authError)
            }

            let authError = mapNetworkError(error)
            lastError = authError
            return .failure(authError)
        } catch {
            isLoading = false
            let authError = AuthError.unknown(underlying: error)
            lastError = authError
            return .failure(authError)
        }
    }

    func logout() async -> AuthResult<Void> {
        isLoading = true

        // Call logout API (best effort - don't fail if API is unavailable)
        do {
            try await authAPI.logout()
        } catch {
            // Continue with local logout even if API call fails
        }

        // Clear local session
        clearSession()

        isLoading = false

        return .success(())
    }

    func refreshTokenIfNeeded() async -> AuthResult<Void> {
        // If not logged in, nothing to refresh
        guard isLoggedIn else {
            return .success(())
        }

        // If no refresh token, cannot refresh
        guard keychainManager.getRefreshToken() != nil else {
            return .failure(.refreshFailed)
        }

        // Check if token needs refresh
        guard shouldRefreshToken() else {
            return .success(())
        }

        // Prevent concurrent refresh attempts
        if let existingTask = refreshTask {
            await existingTask.value
            return .success(())
        }

        let task = Task {
            await performTokenRefresh()
        }

        refreshTask = task

        let result = await task.value
        refreshTask = nil

        return result
    }

    func fetchCurrentUser() async -> AuthResult<User> {
        guard isLoggedIn else {
            return .failure(.invalidCredentials)
        }

        do {
            let user = try await authAPI.getCurrentUser()
            currentUser = user
            return .success(user)
        } catch let error as NetworkError {
            let authError = mapNetworkError(error)

            // If unauthorized, clear session
            if case .unauthorized = error {
                clearSession()
            }

            return .failure(authError)
        } catch {
            return .failure(.unknown(underlying: error))
        }
    }

    // MARK: - Session Management

    func saveSession(_ session: UserSession) throws {
        try keychainManager.saveSession(session)
        tokenExpirationDate = session.expiresAt
    }

    func clearSession() {
        try? keychainManager.clearSession()
        currentUser = nil
        isLoggedIn = false
        tokenExpirationDate = nil
        lastError = nil
    }

    // MARK: - Token Management

    private func shouldRefreshToken() -> Bool {
        guard let expirationDate = tokenExpirationDate else {
            return true
        }

        // Refresh if token expires within buffer time
        return Date().addingTimeInterval(tokenRefreshBuffer) >= expirationDate
    }

    private func performTokenRefresh() async -> AuthResult<Void> {
        guard let refreshToken = keychainManager.getRefreshToken() else {
            clearSession()
            return .failure(.refreshFailed)
        }

        do {
            // Create refresh request
            let refreshRequest = RefreshTokenRequest(refreshToken: refreshToken)
            let response: AuthResponse = try await authAPI.post(
                .authRefresh,
                body: refreshRequest
            )

            // Save new tokens
            try saveSession(response.session!)

            // Update current user
            currentUser = response.user

            return .success(())

        } catch {
            // Refresh failed - clear session
            clearSession()
            return .failure(.refreshFailed)
        }
    }

    // MARK: - Validation Helpers

    private func isValidEmail(_ email: String) -> Bool {
        let emailRegex = #"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#
        return email.range(of: emailRegex, options: .regularExpression) != nil
    }

    private func mapNetworkError(_ error: NetworkError) -> AuthError {
        switch error {
        case .noConnection, .timeout:
            return .networkError(underlying: error)
        case .unauthorized:
            return .invalidCredentials
        case .custom(let message):
            return .validationError(message: message)
        default:
            return .unknown(underlying: error)
        }
    }
}

// MARK: - Convenience Extensions

extension TestableAuthService {

    var isPremium: Bool {
        currentUser?.points ?? 0 > 0
    }

    var displayName: String {
        currentUser?.displayName ?? currentUser?.username ?? "User"
    }

    func clearError() {
        lastError = nil
    }
}

// MARK: - Auth Service Tests

@MainActor
final class AuthServiceTests: XCTestCase {

    var sut: TestableAuthService!
    var mockAuthAPI: MockAuthAPIClient!
    var mockKeychainManager: MockKeychainManagerForAuth!

    override func setUp() async throws {
        try await super.setUp()

        mockAuthAPI = MockAuthAPIClient()
        mockKeychainManager = MockKeychainManagerForAuth()

        // Setup default mock response
        mockAuthAPI.mockAuthResponse = createMockAuthResponse()
        mockAuthAPI.mockUser = createMockUser()

        sut = TestableAuthService(
            authAPI: mockAuthAPI,
            keychainManager: mockKeychainManager
        )
    }

    override func tearDown() async throws {
        sut = nil
        mockAuthAPI = nil
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
            XCTAssertEqual(mockAuthAPI.lastLoginEmail, email, "Should call API with correct email")
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
        mockAuthAPI.shouldFailRequests = true
        mockAuthAPI.mockError = .unauthorized

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
        mockAuthAPI.shouldFailRequests = true
        mockAuthAPI.mockError = .timeout

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
            XCTAssertEqual(user.id, "test_user_id", "Should return registered user")
            XCTAssertEqual(mockAuthAPI.lastRegisterUsername, username, "Should call API with correct username")
            XCTAssertEqual(mockAuthAPI.lastRegisterEmail, email, "Should call API with correct email")
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
        mockAuthAPI.shouldFailRequests = true
        mockAuthAPI.mockError = .custom(message: "Email already exists")

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
        mockAuthAPI.shouldFailRequests = true
        mockAuthAPI.mockError = .timeout

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
        mockAuthAPI.shouldFailRequests = true
        mockAuthAPI.mockError = .timeout

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
            accessToken: "new_access_token",
            tokenType: "bearer",
            expiresIn: 3600,
            expiresAt: nil,
            refreshToken: "new_refresh_token",
            user: createMockUser(),
            session: UserSession(
                id: "new_session_id",
                userId: "test_user_id",
                accessToken: "new_access_token",
                refreshToken: "new_refresh_token",
                expiresAt: Date().addingTimeInterval(3600)
            )
        )
        mockAuthAPI.mockAuthResponse = newAuthResponse

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
        mockAuthAPI.shouldFailRequests = true
        mockAuthAPI.mockError = .unauthorized

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
        mockAuthAPI.shouldFailRequests = true
        mockAuthAPI.mockError = .unauthorized

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
        mockAuthAPI.shouldFailRequests = true
        mockAuthAPI.mockError = .timeout

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
        mockAuthAPI.shouldFailRequests = true
        mockAuthAPI.mockError = .unauthorized

        // When
        _ = await sut.login(email: "test@example.com", password: "password123")

        // Then
        XCTAssertNotNil(sut.lastError, "Should set last error")
    }

    func testClearErrorClearsErrorState() async {
        // Given
        mockAuthAPI.shouldFailRequests = true
        mockAuthAPI.mockError = .unauthorized
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
            avatarConfig: nil,
            fullName: nil,
            displayName: "Test User",
            bio: nil,
            website: nil,
            points: 0,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 0,
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
        mockAuthAPI.mockUser = userWithNoPoints
        mockAuthAPI.mockAuthResponse = AuthResponse(
            accessToken: "test_access_token",
            tokenType: "bearer",
            expiresIn: 3600,
            expiresAt: nil,
            refreshToken: "test_refresh_token",
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
            avatarConfig: nil,
            fullName: nil,
            displayName: "Test User",
            bio: nil,
            website: nil,
            points: 100,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 0,
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
            accessToken: "test_access_token",
            tokenType: "bearer",
            expiresIn: 3600,
            expiresAt: nil,
            refreshToken: "test_refresh_token",
            user: createMockUser(),
            session: createMockSession()
        )
    }
}
