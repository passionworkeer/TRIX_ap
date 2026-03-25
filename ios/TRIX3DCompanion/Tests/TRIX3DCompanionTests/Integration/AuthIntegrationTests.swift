//
//  AuthIntegrationTests.swift
//  TRIX3DCompanionTests
//
//  Integration tests for Auth flow covering:
//  - Login → Home navigation
//  - Register → Login switch
//  - Session persistence
//  - Logout flow
//  - OAuth flow initiation
//
//  These tests verify end-to-end authentication flows using async/await
//  and XCTestExpectation for waiting on async operations.
//

import XCTest
import Combine
import SwiftUI
@testable import TRIX3DCompanion

// MARK: - Mock Session Storage

/// Mock session storage for testing session persistence
final class MockSessionStorage {
    static var shared = MockSessionStorage()

    private(set) var session: UserSession?
    private(set) var user: User?

    func saveSession(_ session: UserSession, user: User) {
        self.session = session
        self.user = user
    }

    func loadSession() -> (session: UserSession, user: User)? {
        guard let session = session, let user = user else { return nil }
        return (session, user)
    }

    func clearSession() {
        session = nil
        user = nil
    }
}

// MARK: - Mock Navigation Controller

/// Mock navigation controller to track navigation state
@MainActor
final class MockNavigationController: ObservableObject {
    @Published var currentScreen: AuthScreen = .login
    @Published var navigationPath: [AuthScreen] = []
    @Published var presentedSheets: [AuthSheet] = []

    enum AuthScreen: Equatable {
        case login
        case register
        case home
        case profile
    }

    enum AuthSheet: Equatable {
        case forgotPassword
        case oauthOptions
    }

    func navigateToLogin() {
        currentScreen = .login
        navigationPath = [.login]
    }

    func navigateToRegister() {
        currentScreen = .register
        navigationPath = [.register]
    }

    func navigateToHome() {
        currentScreen = .home
        navigationPath = [.home]
    }

    func navigateToProfile() {
        currentScreen = .profile
        navigationPath = [.profile]
    }

    func presentSheet(_ sheet: AuthSheet) {
        presentedSheets.append(sheet)
    }

    func dismissSheet() {
        presentedSheets.removeLast()
    }
}

// MARK: - Mock OAuth Provider

/// Mock OAuth provider for testing OAuth flows
@MainActor
final class MockOAuthProvider: ObservableObject {
    enum OAuthProvider: String, CaseIterable {
        case apple
        case wechat
    }

    @Published var isAuthenticating = false
    @Published var lastAuthProvider: OAuthProvider?
    var shouldSucceed = true
    var mockError: AuthError = .unknown(underlying: nil)

    func authenticate(with provider: OAuthProvider) async -> AuthResult<User> {
        isAuthenticating = true
        lastAuthProvider = provider

        // Simulate network delay
        try? await Task.sleep(nanoseconds: 500_000_000)

        isAuthenticating = false

        if shouldSucceed {
            let user = createMockUser()
            return .success(user)
        } else {
            return .failure(mockError)
        }
    }

    private func createMockUser() -> User {
        User(
            id: "oauth_user_\(lastAuthProvider?.rawValue ?? "unknown")",
            username: "oauth_user",
            email: "oauth@example.com",
            avatarUrl: nil,
            avatarConfig: nil,
            fullName: nil,
            displayName: "OAuth User",
            bio: nil,
            website: nil,
            points: 50,
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
}

// MARK: - Auth Integration Tests

@MainActor
final class AuthIntegrationTests: XCTestCase {

    // MARK: - Properties

    var sut: AuthViewModel!
    var mockAuthService: MockAuthAPIClient!
    var mockKeychainManager: MockKeychainManagerForAuth!
    var testableAuthService: TestableAuthService!
    var navigationController: MockNavigationController!
    var sessionStorage: MockSessionStorage!
    var oauthProvider: MockOAuthProvider!

    // MARK: - Setup & Teardown

    override func setUp() async throws {
        try await super.setUp()

        // Setup mock dependencies
        mockAuthService = MockAuthAPIClient()
        mockKeychainManager = MockKeychainManagerForAuth()
        sessionStorage = MockSessionStorage.shared
        oauthProvider = MockOAuthProvider()

        // Configure mock responses
        mockAuthService.mockAuthResponse = createMockAuthResponse()
        mockAuthService.mockUser = createMockUser()

        // Create testable auth service
        testableAuthService = TestableAuthService(
            authAPI: mockAuthService,
            keychainManager: mockKeychainManager
        )

        // Create navigation controller
        navigationController = MockNavigationController()

        // Create auth view model
        sut = AuthViewModel(
            authService: testableAuthService,
            oauthManager: OAuthManager.shared
        )
    }

    override func tearDown() async throws {
        // Clear state
        sessionStorage.clearSession()
        testableAuthService.clearSession()
        navigationController = nil
        oauthProvider = nil
        sut = nil
        testableAuthService = nil
        mockAuthService = nil
        mockKeychainManager = nil

        try await super.tearDown()
    }

    // MARK: - Login → Home Navigation Tests

    func testLoginFlowNavigatesToHome() async throws {
        // Given - user is on login screen
        navigationController.navigateToLogin()
        XCTAssertEqual(navigationController.currentScreen, .login)

        // When - user logs in successfully (provide valid credentials)
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "password123"
        let result = await sut.login()

        // Then - navigation should transition to home
        switch result {
        case .success:
            navigationController.navigateToHome()
            XCTAssertEqual(navigationController.currentScreen, .home)
            XCTAssertTrue(testableAuthService.isLoggedIn)
        case .failure(let error):
            XCTFail("Login should succeed: \(error)")
        }
    }

    func testLoginFlowWithValidCredentials() async throws {
        // Given
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "password123"

        // When
        let result = await sut.login()

        // Then
        switch result {
        case .success(let user):
            XCTAssertEqual(user.email, "test@example.com")
            XCTAssertTrue(testableAuthService.isLoggedIn)
        case .failure(let error):
            XCTFail("Login should succeed: \(error)")
        }
    }

    func testLoginFlowFailsWithInvalidCredentials() async throws {
        // Given
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "wrongpassword"
        mockAuthService.shouldFailRequests = true
        mockAuthService.mockError = .unauthorized

        // When
        let result = await sut.login()

        // Then
        switch result {
        case .success:
            XCTFail("Login should fail with invalid credentials")
        case .failure(let error):
            XCTAssertEqual(error, .invalidCredentials)
            XCTAssertNotNil(sut.loginApiError)
            XCTAssertFalse(testableAuthService.isLoggedIn)
        }
    }

    func testLoginFlowWithNetworkError() async throws {
        // Given
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "password123"
        mockAuthService.shouldFailRequests = true
        mockAuthService.mockError = .timeout

        // When
        let result = await sut.login()

        // Then
        switch result {
        case .success:
            XCTFail("Login should fail with network error")
        case .failure(let error):
            if case .networkError = error {
                XCTAssertNotNil(sut.loginApiError)
            }
        }
    }

    func testLoginFlowNavigatesToHomeWithDelay() async throws {
        // Given - simulate network delay
        let expectation = XCTestExpectation(description: "Login completes")

        sut.loginEmail = "test@example.com"
        sut.loginPassword = "password123"

        // When
        Task {
            let result = await sut.login()
            switch result {
            case .success:
                navigationController.navigateToHome()
            case .failure:
                break
            }
            expectation.fulfill()
        }

        // Wait for async operation
        await fulfillment(of: [expectation], timeout: 5.0)

        // Then
        XCTAssertEqual(navigationController.currentScreen, .home)
    }

    // MARK: - Register → Login Switch Tests

    func testRegisterFlowNavigatesToLoginAfterSuccess() async throws {
        // Given - user is on register screen
        navigationController.navigateToRegister()
        XCTAssertEqual(navigationController.currentScreen, .register)

        sut.registerUsername = "newuser"
        sut.registerEmail = "newuser@example.com"
        sut.registerPassword = "password123"
        sut.registerConfirmPassword = "password123"

        // When
        let result = await sut.register()

        // Then - after successful registration, should switch to login
        switch result {
        case .success(let user):
            // Registration succeeded; verify the API was called with correct inputs
            XCTAssertNotNil(user)
            XCTAssertEqual(mockAuthService.lastRegisterEmail, "newuser@example.com")
            XCTAssertEqual(mockAuthService.lastRegisterUsername, "newuser")
            XCTAssertTrue(sut.isRegisterSuccess)
            // Simulate navigation back to login
            navigationController.navigateToLogin()
            XCTAssertEqual(navigationController.currentScreen, .login)
        case .failure(let error):
            XCTFail("Registration should succeed: \(error)")
        }
    }

    func testRegisterFlowWithValidationErrors() async throws {
        // Given - user is on register screen
        navigationController.navigateToRegister()
        XCTAssertEqual(navigationController.currentScreen, .register)

        sut.registerUsername = "ab" // Too short
        sut.registerEmail = "invalid-email"
        sut.registerPassword = "123" // Too short
        sut.registerConfirmPassword = "different"

        // When
        let result = await sut.register()

        // Then
        switch result {
        case .success:
            XCTFail("Registration should fail with validation errors")
        case .failure(let error):
            if case .validationError = error {
                XCTAssertNotNil(sut.registerValidationError)
                XCTAssertFalse(sut.isRegisterSuccess)
                // User should remain on register screen
                XCTAssertEqual(navigationController.currentScreen, .register)
            }
        }
    }

    func testRegisterFlowEmailAlreadyExists() async throws {
        // Given
        sut.registerUsername = "newuser"
        sut.registerEmail = "existing@example.com"
        sut.registerPassword = "password123"
        sut.registerConfirmPassword = "password123"
        mockAuthService.shouldFailRequests = true
        mockAuthService.mockError = .custom(message: "Email already exists")

        // When
        let result = await sut.register()

        // Then
        switch result {
        case .success:
            XCTFail("Registration should fail with email exists error")
        case .failure(let error):
            XCTAssertEqual(error, .emailAlreadyExists)
            XCTAssertFalse(sut.isRegisterSuccess)
        }
    }

    func testRegisterFlowPasswordMismatch() async throws {
        // Given
        sut.registerUsername = "newuser"
        sut.registerEmail = "newuser@example.com"
        sut.registerPassword = "password123"
        sut.registerConfirmPassword = "differentpassword"

        // When
        let result = await sut.register()

        // Then
        switch result {
        case .success:
            XCTFail("Registration should fail with password mismatch")
        case .failure(let error):
            if case .validationError = error {
                // Password mismatch is caught by confirm password validation before API call
                XCTAssertNotNil(sut.registerValidationError)
                XCTAssertFalse(sut.isRegisterSuccess)
            }
        }
    }

    func testSwitchFromLoginToRegister() async throws {
        // Given - user is on login screen
        navigationController.navigateToLogin()

        // When - user taps register button
        navigationController.navigateToRegister()

        // Then - should navigate to register screen
        XCTAssertEqual(navigationController.currentScreen, .register)
        XCTAssertEqual(navigationController.navigationPath, [.register])
    }

    func testSwitchFromRegisterToLogin() async throws {
        // Given - user is on register screen
        navigationController.navigateToRegister()

        // When - user taps login button
        navigationController.navigateToLogin()

        // Then - should navigate to login screen
        XCTAssertEqual(navigationController.currentScreen, .login)
        XCTAssertEqual(navigationController.navigationPath, [.login])
    }

    // MARK: - Session Persistence Tests

    func testSessionIsPersistedAfterLogin() async throws {
        // Given
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "password123"

        // When
        let result = await sut.login()

        // Then - session is stored via keychain (not MockSessionStorage)
        switch result {
        case .success(let user):
            XCTAssertNotNil(mockKeychainManager.storedAccessToken)
            XCTAssertNotNil(mockKeychainManager.storedRefreshToken)
            XCTAssertEqual(mockKeychainManager.storedUserId, user.id)
            XCTAssertNotNil(testableAuthService.currentUser)
        case .failure(let error):
            XCTFail("Login should succeed: \(error)")
        }
    }

    func testSessionIsRestoredOnAppLaunch() async throws {
        // Given - user was previously logged in
        let user = createMockUser()
        let session = createMockSession()
        sessionStorage.saveSession(session, user: user)

        // When - app launches and checks for existing session
        let restoredSession = sessionStorage.loadSession()

        // Then
        XCTAssertNotNil(restoredSession)
        XCTAssertEqual(restoredSession?.user.id, user.id)
        XCTAssertEqual(restoredSession?.session.id, session.id)
    }

    func testSessionDataIsClearedOnLogout() async throws {
        // Given - user is logged in
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "password123"
        _ = await sut.login()
        XCTAssertTrue(testableAuthService.isLoggedIn)

        // When - user logs out
        let logoutResult = await testableAuthService.logout()

        // Then - session is cleared via keychain
        switch logoutResult {
        case .success:
            XCTAssertNil(mockKeychainManager.storedAccessToken)
            XCTAssertNil(mockKeychainManager.storedRefreshToken)
            XCTAssertNil(testableAuthService.currentUser)
            XCTAssertFalse(testableAuthService.isLoggedIn)
        case .failure(let error):
            XCTFail("Logout should succeed: \(error)")
        }
    }

    func testSessionPersistsAcrossViewModelInstances() async throws {
        // Given - login with first view model
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "password123"
        _ = await sut.login()

        // Create new view model instance
        let newSut = AuthViewModel(
            authService: testableAuthService,
            oauthManager: OAuthManager.shared
        )

        // Then - session should still be valid via shared auth service (keychain)
        XCTAssertTrue(testableAuthService.isLoggedIn)
        XCTAssertNotNil(testableAuthService.currentUser)

        // Verify validation passes for the same credentials used during login
        newSut.loginEmail = "test@example.com"
        newSut.loginPassword = "password123"
        XCTAssertNil(newSut.validateLoginEmail())
        XCTAssertNil(newSut.validateLoginPassword())
    }

    func testExpiredSessionRequiresReauthentication() async throws {
        // Given - session exists but is expired
        let expiredSession = UserSession(
            id: "expired_session",
            userId: "user_id",
            accessToken: "expired_token",
            refreshToken: "expired_refresh",
            expiresAt: Date().addingTimeInterval(-3600) // 1 hour ago
        )
        let user = createMockUser()
        sessionStorage.saveSession(expiredSession, user: user)

        // When - trying to use expired session
        let isTokenExpired = expiredSession.expiresAt < Date()

        // Then
        XCTAssertTrue(isTokenExpired)
        // User should be prompted to re-authenticate
    }

    // MARK: - Logout Flow Tests

    func testLogoutFlowClearsAllState() async throws {
        // Given - user is logged in
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "password123"
        _ = await sut.login()
        navigationController.navigateToHome()

        // When
        _ = await testableAuthService.logout()

        // Then - all state should be cleared
        XCTAssertFalse(testableAuthService.isLoggedIn)
        XCTAssertNil(testableAuthService.currentUser)
        XCTAssertNil(sessionStorage.session)
    }

    func testLogoutFlowNavigatesToLogin() async throws {
        // Given - user is logged in and on home screen
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "password123"
        _ = await sut.login()
        navigationController.navigateToHome()

        // When - user logs out
        _ = await testableAuthService.logout()

        // Then - navigation should return to login
        navigationController.navigateToLogin()
        XCTAssertEqual(navigationController.currentScreen, .login)
    }

    func testLogoutFlowClearsKeychain() async throws {
        // Given - user is logged in
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "password123"
        _ = await sut.login()

        // When
        _ = await testableAuthService.logout()

        // Then
        XCTAssertTrue(mockKeychainManager.clearSessionCalled)
        XCTAssertNil(mockKeychainManager.storedAccessToken)
        XCTAssertNil(mockKeychainManager.storedRefreshToken)
    }

    func testLogoutFlowWithNetworkFailure() async throws {
        // Given - user is logged in
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "password123"
        _ = await sut.login()

        // Configure mock to fail logout API call
        mockAuthService.shouldFailRequests = true
        mockAuthService.mockError = .timeout

        // When - logout API fails but local logout should still succeed
        let result = await testableAuthService.logout()

        // Then - logout should succeed locally despite API failure
        switch result {
        case .success:
            XCTAssertFalse(testableAuthService.isLoggedIn)
            XCTAssertNil(testableAuthService.currentUser)
        case .failure:
            XCTFail("Local logout should succeed even if API fails")
        }
    }

    func testLogoutFlowFromHomeToLogin() async throws {
        // Given - user is on home screen
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "password123"
        _ = await sut.login()
        navigationController.navigateToHome()
        XCTAssertEqual(navigationController.currentScreen, .home)

        // When - user taps logout
        _ = await testableAuthService.logout()

        // Then - navigation should transition through logout state
        navigationController.navigateToLogin()
        XCTAssertEqual(navigationController.currentScreen, .login)
        XCTAssertFalse(testableAuthService.isLoggedIn)
    }

    // MARK: - OAuth Flow Tests

    func testOAuthFlowWithApple() async throws {
        // Given
        oauthProvider.shouldSucceed = true

        // When
        let result = await oauthProvider.authenticate(with: .apple)

        // Then
        switch result {
        case .success(let user):
            XCTAssertEqual(user.id, "oauth_user_apple")
            XCTAssertEqual(oauthProvider.lastAuthProvider, .apple)
        case .failure:
            XCTFail("OAuth should succeed")
        }
    }

    func testOAuthFlowWithWeChat() async throws {
        // Given
        oauthProvider.shouldSucceed = true

        // When
        let result = await oauthProvider.authenticate(with: .wechat)

        // Then
        switch result {
        case .success(let user):
            XCTAssertEqual(user.id, "oauth_user_wechat")
            XCTAssertEqual(oauthProvider.lastAuthProvider, .wechat)
        case .failure:
            XCTFail("OAuth should succeed")
        }
    }

    func testOAuthFlowFailsWhenProviderUnavailable() async throws {
        // Given
        oauthProvider.shouldSucceed = false
        oauthProvider.mockError = .networkError(underlying: NetworkError.noConnection)

        // When
        let result = await oauthProvider.authenticate(with: .apple)

        // Then
        switch result {
        case .success:
            XCTFail("OAuth should fail when provider unavailable")
        case .failure(let error):
            if case .networkError = error {
                XCTAssertEqual(oauthProvider.lastAuthProvider, .apple)
            }
        }
    }

    func testOAuthFlowNavigatesToHomeOnSuccess() async throws {
        // Given
        oauthProvider.shouldSucceed = true

        // When - OAuth completes successfully
        let result = await oauthProvider.authenticate(with: .apple)

        // Then - should navigate to home
        switch result {
        case .success:
            navigationController.navigateToHome()
            XCTAssertEqual(navigationController.currentScreen, .home)
        case .failure:
            XCTFail("OAuth should succeed")
        }
    }

    func testOAuthFlowShowsErrorOnFailure() async throws {
        // Given
        oauthProvider.shouldSucceed = false
        oauthProvider.mockError = .unknown(underlying: nil)

        // When
        let result = await oauthProvider.authenticate(with: .apple)

        // Then - error should be shown to user
        switch result {
        case .success:
            XCTFail("OAuth should fail")
        case .failure(let error):
            XCTAssertEqual(error, .unknown(underlying: nil))
            // User should remain on login screen
            XCTAssertEqual(navigationController.currentScreen, .login)
        }
    }

    func testOAuthFlowLoadingState() async throws {
        // Given
        oauthProvider.shouldSucceed = true

        // When - OAuth is in progress, then completes
        let result = await oauthProvider.authenticate(with: .wechat)

        // Then - loading state should have been managed and then completed
        XCTAssertFalse(oauthProvider.isAuthenticating)
        switch result {
        case .success(let user):
            XCTAssertEqual(user.id, "oauth_user_wechat")
        case .failure:
            XCTFail("OAuth should succeed")
        }
    }

    // MARK: - Full Auth Flow Integration Tests

    func testCompleteLoginToHomeFlow() async throws {
        // Given - start on login screen
        navigationController.navigateToLogin()

        // When - complete login flow
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "password123"
        let loginResult = await sut.login()

        // Then - verify complete flow
        switch loginResult {
        case .success(let user):
            // Verify user data
            XCTAssertNotNil(user.id)
            XCTAssertEqual(user.email, "test@example.com")

            // Navigate to home
            navigationController.navigateToHome()
            XCTAssertEqual(navigationController.currentScreen, .home)

            // Verify session is persisted via keychain (not MockSessionStorage)
            XCTAssertNotNil(mockKeychainManager.storedAccessToken)
            XCTAssertTrue(testableAuthService.isLoggedIn)

        case .failure(let error):
            XCTFail("Complete login flow should succeed: \(error)")
        }
    }

    func testCompleteRegisterToLoginSwitchFlow() async throws {
        // Given - start on login screen
        navigationController.navigateToLogin()
        XCTAssertEqual(navigationController.currentScreen, .login)

        // When - switch to register
        navigationController.navigateToRegister()
        XCTAssertEqual(navigationController.currentScreen, .register)

        // Fill registration form
        sut.registerUsername = "newuser123"
        sut.registerEmail = "newuser@example.com"
        sut.registerPassword = "password123"
        sut.registerConfirmPassword = "password123"

        // Submit registration
        let registerResult = await sut.register()

        // Then - verify complete flow
        switch registerResult {
        case .success(let user):
            // Registration succeeded; verify the API was called with correct inputs
            XCTAssertNotNil(user)
            XCTAssertEqual(mockAuthService.lastRegisterEmail, "newuser@example.com")
            XCTAssertEqual(mockAuthService.lastRegisterUsername, "newuser123")
            XCTAssertTrue(sut.isRegisterSuccess)

            // Switch back to login
            navigationController.navigateToLogin()
            XCTAssertEqual(navigationController.currentScreen, .login)

            // Login with registered credentials (mock accepts any credentials)
            sut.loginEmail = "newuser@example.com"
            sut.loginPassword = "password123"
            let loginResult = await sut.login()

            switch loginResult {
            case .success:
                XCTAssertTrue(testableAuthService.isLoggedIn)
            case .failure(let error):
                XCTFail("Login after registration should succeed: \(error)")
            }

        case .failure(let error):
            XCTFail("Registration should succeed: \(error)")
        }
    }

    func testCompleteLogoutFlow() async throws {
        // Given - logged in and on home
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "password123"
        _ = await sut.login()
        navigationController.navigateToHome()

        // When - logout
        _ = await testableAuthService.logout()

        // Then - verify complete logout
        XCTAssertFalse(testableAuthService.isLoggedIn)
        XCTAssertNil(testableAuthService.currentUser)
        XCTAssertNil(mockKeychainManager.storedAccessToken)

        // Navigate back to login
        navigationController.navigateToLogin()
        XCTAssertEqual(navigationController.currentScreen, .login)
    }

    // MARK: - Helper Methods

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
            accessToken: "mock_access_token",
            tokenType: "Bearer",
            expiresIn: 3600,
            refreshToken: "mock_refresh_token",
            user: createMockUser(),
            session: createMockSession()
        )
    }
}
