//
//  AuthViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Test suite for AuthViewModel - Login/Register validation and OAuth flow
//
//  Test Coverage:
//  - Login validation (email, password)
//  - Register validation (username, email, password, confirm password)
//  - Login API call with success/failure
//  - Register API call with success/failure
//  - OAuth sign-in (Apple, WeChat)
//  - State clearing methods
//  - Error message handling
//

import XCTest
import UIKit
@testable import TRIX3DCompanion

// MARK: - Auth View Model Tests

@MainActor
final class AuthViewModelTests: XCTestCase {

    var sut: AuthViewModel!
    var mockAuthService: MockAuthService!
    var mockOAuthManager: MockOAuthManager!

    override func setUp() async throws {
        try await super.setUp()
        mockAuthService = MockAuthService()
        mockOAuthManager = MockOAuthManager()
        sut = AuthViewModel(
            authService: mockAuthService,
            oauthManager: mockOAuthManager
        )
    }

    override func tearDown() async throws {
        sut = nil
        mockAuthService = nil
        mockOAuthManager = nil
        try await super.tearDown()
    }

    private func waitUntil(
        timeout: TimeInterval = 1.0,
        condition: @escaping @MainActor () -> Bool
    ) async -> Bool {
        let deadline = Date().addingTimeInterval(timeout)

        while Date() < deadline {
            if condition() {
                return true
            }

            await Task.yield()
            try? await Task.sleep(nanoseconds: 10_000_000)
        }

        return condition()
    }
}

// MARK: - Login Validation Tests

extension AuthViewModelTests {

    func testValidateLoginEmailWithEmptyString() {
        // Given
        sut.loginEmail = ""

        // When
        let result = sut.validateLoginEmail()

        // Then
        XCTAssertEqual(result, .emailRequired, "Empty email should return emailRequired error")
    }

    func testValidateLoginEmailWithWhitespaceOnly() {
        // Given
        sut.loginEmail = "   "

        // When
        let result = sut.validateLoginEmail()

        // Then
        XCTAssertEqual(result, .emailRequired, "Whitespace-only email should return emailRequired error")
    }

    func testValidateLoginEmailWithInvalidFormat() {
        // Given
        sut.loginEmail = "notanemail"

        // When
        let result = sut.validateLoginEmail()

        // Then
        XCTAssertEqual(result, .emailInvalid, "Invalid email format should return emailInvalid error")
    }

    func testValidateLoginEmailWithMissingTLD() {
        // Given
        sut.loginEmail = "user@domain"

        // When
        let result = sut.validateLoginEmail()

        // Then
        XCTAssertEqual(result, .emailInvalid, "Email without TLD should return emailInvalid error")
    }

    func testValidateLoginEmailWithValidEmail() {
        // Given
        sut.loginEmail = "test@example.com"

        // When
        let result = sut.validateLoginEmail()

        // Then
        XCTAssertNil(result, "Valid email should return nil (no error)")
    }

    func testValidateLoginEmailTrimsWhitespace() {
        // Given
        sut.loginEmail = "  test@example.com  "

        // When
        let result = sut.validateLoginEmail()

        // Then
        XCTAssertNil(result, "Trimmed valid email should return nil")
    }

    func testValidateLoginEmailConvertsToLowercase() {
        // Given
        sut.loginEmail = "TEST@EXAMPLE.COM"

        // When
        let result = sut.validateLoginEmail()

        // Then
        XCTAssertNil(result, "Uppercase email should still be valid")
    }

    func testValidateLoginPasswordWithEmptyString() {
        // Given
        sut.loginPassword = ""

        // When
        let result = sut.validateLoginPassword()

        // Then
        XCTAssertEqual(result, .passwordRequired, "Empty password should return passwordRequired error")
    }

    func testValidateLoginPasswordWithWhitespaceOnly() {
        // Given
        sut.loginPassword = "   "

        // When
        let result = sut.validateLoginPassword()

        // Then
        XCTAssertEqual(result, .passwordRequired, "Whitespace-only password should return passwordRequired error")
    }

    func testValidateLoginPasswordWithValidPassword() {
        // Given
        sut.loginPassword = "password123"

        // When
        let result = sut.validateLoginPassword()

        // Then
        XCTAssertNil(result, "Valid password should return nil")
    }
}

// MARK: - Register Validation Tests

extension AuthViewModelTests {

    func testValidateRegisterUsernameWithEmptyString() {
        // Given
        sut.registerUsername = ""

        // When
        let result = sut.validateRegisterUsername()

        // Then
        XCTAssertEqual(result, .usernameRequired, "Empty username should return usernameRequired error")
    }

    func testValidateRegisterUsernameTooShort() {
        // Given
        sut.registerUsername = "ab"

        // When
        let result = sut.validateRegisterUsername()

        // Then
        XCTAssertEqual(result, .usernameTooShort(minLength: 3), "Short username should return usernameTooShort error")
    }

    func testValidateRegisterUsernameValid() {
        // Given
        sut.registerUsername = "validuser"

        // When
        let result = sut.validateRegisterUsername()

        // Then
        XCTAssertNil(result, "Valid username should return nil")
    }

    func testValidateRegisterUsernameWithWhitespace() {
        // Given
        sut.registerUsername = "  user  "

        // When
        let result = sut.validateRegisterUsername()

        // Then
        XCTAssertNil(result, "Trimmed valid username should return nil")
    }

    func testValidateRegisterEmailWithEmptyString() {
        // Given
        sut.registerEmail = ""

        // When
        let result = sut.validateRegisterEmail()

        // Then
        XCTAssertEqual(result, .emailRequired, "Empty email should return emailRequired error")
    }

    func testValidateRegisterEmailWithInvalidFormat() {
        // Given
        sut.registerEmail = "invalid"

        // When
        let result = sut.validateRegisterEmail()

        // Then
        XCTAssertEqual(result, .emailInvalid, "Invalid email format should return emailInvalid error")
    }

    func testValidateRegisterEmailWithValidEmail() {
        // Given
        sut.registerEmail = "newuser@example.com"

        // When
        let result = sut.validateRegisterEmail()

        // Then
        XCTAssertNil(result, "Valid email should return nil")
    }

    func testValidateRegisterPasswordWithEmptyString() {
        // Given
        sut.registerPassword = ""

        // When
        let result = sut.validateRegisterPassword()

        // Then
        XCTAssertEqual(result, .passwordRequired, "Empty password should return passwordRequired error")
    }

    func testValidateRegisterPasswordTooShort() {
        // Given
        sut.registerPassword = "12345"

        // When
        let result = sut.validateRegisterPassword()

        // Then
        XCTAssertEqual(result, .passwordTooShort(minLength: 6), "Short password should return passwordTooShort error")
    }

    func testValidateRegisterPasswordValid() {
        // Given
        sut.registerPassword = "password123"

        // When
        let result = sut.validateRegisterPassword()

        // Then
        XCTAssertNil(result, "Valid password should return nil")
    }

    func testValidateRegisterConfirmPasswordWithEmptyString() {
        // Given
        sut.registerPassword = "password123"
        sut.registerConfirmPassword = ""

        // When
        let result = sut.validateRegisterConfirmPassword()

        // Then
        XCTAssertEqual(result, .confirmPasswordRequired, "Empty confirm password should return confirmPasswordRequired error")
    }

    func testValidateRegisterConfirmPasswordMismatch() {
        // Given
        sut.registerPassword = "password123"
        sut.registerConfirmPassword = "differentpass"

        // When
        let result = sut.validateRegisterConfirmPassword()

        // Then
        XCTAssertEqual(result, .passwordMismatch, "Mismatched passwords should return passwordMismatch error")
    }

    func testValidateRegisterConfirmPasswordMatch() {
        // Given
        sut.registerPassword = "password123"
        sut.registerConfirmPassword = "password123"

        // When
        let result = sut.validateRegisterConfirmPassword()

        // Then
        XCTAssertNil(result, "Matching passwords should return nil")
    }
}

// MARK: - Login API Tests

extension AuthViewModelTests {

    func testLoginSuccess() async {
        // Given
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "password123"

        // When
        let result = await sut.login()

        // Then
        switch result {
        case .success(let user):
            XCTAssertEqual(user.email, "test@example.com")
            XCTAssertFalse(sut.isLoginLoading)
            XCTAssertNil(sut.loginApiError)
        case .failure:
            XCTFail("Login should succeed")
        }

        XCTAssertTrue(mockAuthService.isLoggedInValue)
        XCTAssertEqual(mockAuthService.lastLoginEmail, "test@example.com")
        XCTAssertEqual(mockAuthService.loginCallCount, 1)
    }

    func testLoginFailureWithInvalidCredentials() async {
        // Given
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "wrongpassword"
        mockAuthService.shouldFailLogin = true

        // When
        let result = await sut.login()

        // Then
        switch result {
        case .success:
            XCTFail("Login should fail with invalid credentials")
        case .failure(let error):
            XCTAssertEqual(error, .invalidCredentials)
            XCTAssertNotNil(sut.loginApiError)
        }

        XCTAssertFalse(mockAuthService.isLoggedInValue)
    }

    func testLoginWithValidationErrorOnEmptyEmail() async {
        // Given
        sut.loginEmail = ""
        sut.loginPassword = "password123"

        // When
        let result = await sut.login()

        // Then
        switch result {
        case .success:
            XCTFail("Login should fail with validation error")
        case .failure(let error):
            XCTAssertEqual(error, .validationError(message: sut.loginValidationError ?? ""))
        }

        XCTAssertEqual(sut.loginValidationError, AuthValidationError.emailRequired.localizedDescription)
        XCTAssertEqual(mockAuthService.loginCallCount, 0, "Service should not be called with validation error")
    }

    func testLoginClearsPreviousErrors() async {
        // Given
        sut.loginValidationError = "Previous error"
        sut.loginApiError = "Previous API error"
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "password123"

        // When
        await sut.login()

        // Then
        XCTAssertNil(sut.loginValidationError, "Validation error should be cleared")
        XCTAssertNil(sut.loginApiError, "API error should be cleared")
    }

    func testLoginSetsLoadingState() async {
        // Given
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "password123"
        mockAuthService.simulatedDelayNanoseconds = 200_000_000

        // When
        let loadingTask = Task {
            await sut.login()
        }

        // Then
        let didEnterLoadingState = await waitUntil { self.sut.isLoginLoading }
        XCTAssertTrue(didEnterLoadingState, "Loading state should be true during login")

        await loadingTask.value
        XCTAssertFalse(sut.isLoginLoading, "Loading state should be false after login completes")
    }

    func testLoginNormalizesEmailToLowercase() async {
        // Given
        sut.loginEmail = "TEST@EXAMPLE.COM"
        sut.loginPassword = "password123"

        // When
        await sut.login()

        // Then
        XCTAssertEqual(mockAuthService.lastLoginEmail, "test@example.com", "Email should be normalized to lowercase")
    }

    func testLoginNormalizesEmailWhitespace() async {
        // Given
        sut.loginEmail = "  test@example.com  "
        sut.loginPassword = "password123"

        // When
        await sut.login()

        // Then
        XCTAssertEqual(mockAuthService.lastLoginEmail, "test@example.com", "Email should be trimmed")
    }
}

// MARK: - Register API Tests

extension AuthViewModelTests {

    func testRegisterSuccess() async {
        // Given
        sut.registerUsername = "newuser"
        sut.registerEmail = "newuser@example.com"
        sut.registerPassword = "password123"
        sut.registerConfirmPassword = "password123"

        // When
        let result = await sut.register()

        // Then
        switch result {
        case .success(let user):
            XCTAssertEqual(user.username, "newuser")
            XCTAssertEqual(user.email, "newuser@example.com")
            XCTAssertFalse(sut.isRegisterLoading)
            XCTAssertNil(sut.registerApiError)
            XCTAssertTrue(sut.isRegisterSuccess)
        case .failure:
            XCTFail("Registration should succeed")
        }
    }

    func testRegisterFailureWithExistingEmail() async {
        // Given
        sut.registerUsername = "newuser"
        sut.registerEmail = "existing@example.com"
        sut.registerPassword = "password123"
        sut.registerConfirmPassword = "password123"
        mockAuthService.shouldFailRegister = true

        // When
        let result = await sut.register()

        // Then
        switch result {
        case .success:
            XCTFail("Registration should fail")
        case .failure(let error):
            XCTAssertEqual(error, .emailAlreadyExists)
            XCTAssertNotNil(sut.registerApiError)
            XCTAssertFalse(sut.isRegisterSuccess)
        }
    }

    func testRegisterWithValidationErrorOnEmptyUsername() async {
        // Given
        sut.registerUsername = ""
        sut.registerEmail = "newuser@example.com"
        sut.registerPassword = "password123"
        sut.registerConfirmPassword = "password123"

        // When
        let result = await sut.register()

        // Then
        switch result {
        case .success:
            XCTFail("Registration should fail with validation error")
        case .failure:
            XCTAssertEqual(sut.registerValidationError, AuthValidationError.usernameRequired.localizedDescription)
        }

        XCTAssertEqual(mockAuthService.registerCallCount, 0, "Service should not be called with validation error")
    }

    func testRegisterWithValidationErrorOnPasswordMismatch() async {
        // Given
        sut.registerUsername = "newuser"
        sut.registerEmail = "newuser@example.com"
        sut.registerPassword = "password123"
        sut.registerConfirmPassword = "differentpass"

        // When
        let result = await sut.register()

        // Then
        switch result {
        case .success:
            XCTFail("Registration should fail with validation error")
        case .failure:
            XCTAssertEqual(sut.registerValidationError, AuthValidationError.passwordMismatch.localizedDescription)
        }
    }

    func testRegisterClearsPreviousState() async {
        // Given
        sut.registerValidationError = "Previous error"
        sut.registerApiError = "Previous API error"
        sut.isRegisterSuccess = true
        sut.registerUsername = "newuser"
        sut.registerEmail = "newuser@example.com"
        sut.registerPassword = "password123"
        sut.registerConfirmPassword = "password123"

        // When
        await sut.register()

        // Then
        XCTAssertNil(sut.registerValidationError)
        XCTAssertNil(sut.registerApiError)
        XCTAssertTrue(sut.isRegisterSuccess)
    }
}

// MARK: - OAuth Sign-In Tests

extension AuthViewModelTests {

    func testSignInWithAppleSuccess() async {
        // Given
        let window = UIWindow()
        mockOAuthManager.shouldFailSignIn = false

        // When
        let result = await sut.signInWithApple(presentationAnchor: window)

        // Then
        switch result {
        case .success(let user):
            XCTAssertEqual(user.email, "oauth_apple@example.com")
            XCTAssertEqual(mockOAuthManager.lastSignInProvider, .apple)
            XCTAssertEqual(mockOAuthManager.signInCallCount, 1)
        case .failure:
            XCTFail("Apple sign-in should succeed")
        }

        XCTAssertFalse(sut.isOAuthLoading)
        XCTAssertNil(sut.loginApiError)
    }

    func testSignInWithAppleWithoutAnchor() async {
        // Given
        mockOAuthManager.shouldFailSignIn = false

        // When
        let result = await sut.signInWithApple(presentationAnchor: nil)

        // Then
        switch result {
        case .success:
            XCTFail("Apple sign-in should fail without presentation anchor")
        case .failure(let error):
            XCTAssertEqual(error, .validationError(message: sut.loginApiError ?? ""))
            XCTAssertNotNil(sut.loginApiError)
        }

        XCTAssertEqual(mockOAuthManager.signInCallCount, 0, "OAuth manager should not be called without anchor")
    }

    func testSignInWithAppleFailure() async {
        // Given
        let window = UIWindow()
        mockOAuthManager.shouldFailSignIn = true

        // When
        let result = await sut.signInWithApple(presentationAnchor: window)

        // Then
        switch result {
        case .success:
            XCTFail("Apple sign-in should fail")
        case .failure:
            XCTAssertNotNil(sut.loginApiError)
        }
    }

    func testSignInWithWeChatSuccess() async {
        // Given
        mockOAuthManager.shouldFailSignIn = false

        // When
        let result = await sut.signInWithWeChat()

        // Then
        switch result {
        case .success(let user):
            XCTAssertEqual(user.email, "oauth_wechat@example.com")
            XCTAssertEqual(mockOAuthManager.lastSignInProvider, .wechat)
        case .failure:
            XCTFail("WeChat sign-in should succeed")
        }
    }

    func testSignInWithWeChatFailure() async {
        // Given
        mockOAuthManager.shouldFailSignIn = true

        // When
        let result = await sut.signInWithWeChat()

        // Then
        switch result {
        case .success:
            XCTFail("WeChat sign-in should fail")
        case .failure:
            XCTAssertNotNil(sut.loginApiError)
        }
    }

    func testOAuthLoadingState() async {
        // Given
        let window = UIWindow()
        mockOAuthManager.shouldFailSignIn = false
        mockOAuthManager.simulatedDelayNanoseconds = 200_000_000
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "password123"

        // When - Apple sign-in
        let task1 = Task {
            await sut.signInWithApple(presentationAnchor: window)
        }
        let appleDidEnterLoadingState = await waitUntil { self.sut.isOAuthLoading }
        XCTAssertTrue(appleDidEnterLoadingState)

        await task1.value

        // When - WeChat sign-in
        let task2 = Task {
            await sut.signInWithWeChat()
        }
        let weChatDidEnterLoadingState = await waitUntil { self.sut.isOAuthLoading }
        XCTAssertTrue(weChatDidEnterLoadingState)

        await task2.value
        XCTAssertFalse(sut.isOAuthLoading)
    }
}

// MARK: - Clear State Tests

extension AuthViewModelTests {

    func testClearLoginState() {
        // Given
        sut.loginEmail = "test@example.com"
        sut.loginPassword = "password123"
        sut.loginValidationError = "Error"
        sut.loginApiError = "API Error"
        sut.isLoginLoading = true

        // When
        sut.clearLoginState()

        // Then
        XCTAssertEqual(sut.loginEmail, "")
        XCTAssertEqual(sut.loginPassword, "")
        XCTAssertNil(sut.loginValidationError)
        XCTAssertNil(sut.loginApiError)
        XCTAssertFalse(sut.isLoginLoading)
    }

    func testClearRegisterState() {
        // Given
        sut.registerUsername = "newuser"
        sut.registerEmail = "new@example.com"
        sut.registerPassword = "password123"
        sut.registerConfirmPassword = "password123"
        sut.registerValidationError = "Error"
        sut.registerApiError = "API Error"
        sut.isRegisterLoading = true
        sut.isRegisterSuccess = true

        // When
        sut.clearRegisterState()

        // Then
        XCTAssertEqual(sut.registerUsername, "")
        XCTAssertEqual(sut.registerEmail, "")
        XCTAssertEqual(sut.registerPassword, "")
        XCTAssertEqual(sut.registerConfirmPassword, "")
        XCTAssertNil(sut.registerValidationError)
        XCTAssertNil(sut.registerApiError)
        XCTAssertFalse(sut.isRegisterLoading)
        XCTAssertFalse(sut.isRegisterSuccess)
    }

    func testClearErrors() {
        // Given
        sut.loginValidationError = "Login error"
        sut.loginApiError = "Login API error"
        sut.registerValidationError = "Register error"
        sut.registerApiError = "Register API error"

        // When
        sut.clearErrors()

        // Then
        XCTAssertNil(sut.loginValidationError)
        XCTAssertNil(sut.loginApiError)
        XCTAssertNil(sut.registerValidationError)
        XCTAssertNil(sut.registerApiError)
    }
}

// MARK: - Initial State Tests

extension AuthViewModelTests {

    func testInitialLoginState() {
        XCTAssertEqual(sut.loginEmail, "")
        XCTAssertEqual(sut.loginPassword, "")
        XCTAssertNil(sut.loginValidationError)
        XCTAssertNil(sut.loginApiError)
        XCTAssertFalse(sut.isLoginLoading)
        XCTAssertFalse(sut.isOAuthLoading)
    }

    func testInitialRegisterState() {
        XCTAssertEqual(sut.registerUsername, "")
        XCTAssertEqual(sut.registerEmail, "")
        XCTAssertEqual(sut.registerPassword, "")
        XCTAssertEqual(sut.registerConfirmPassword, "")
        XCTAssertNil(sut.registerValidationError)
        XCTAssertNil(sut.registerApiError)
        XCTAssertFalse(sut.isRegisterLoading)
        XCTAssertFalse(sut.isRegisterSuccess)
    }
}

// MARK: - AuthValidationError Tests

extension AuthViewModelTests {

    func testAuthValidationErrorCases() {
        XCTAssertNotNil(AuthValidationError.emailRequired.errorDescription)
        XCTAssertNotNil(AuthValidationError.emailInvalid.errorDescription)
        XCTAssertNotNil(AuthValidationError.passwordRequired.errorDescription)
        XCTAssertNotNil(AuthValidationError.passwordTooShort(minLength: 6).errorDescription)
        XCTAssertNotNil(AuthValidationError.usernameRequired.errorDescription)
        XCTAssertNotNil(AuthValidationError.usernameTooShort(minLength: 3).errorDescription)
        XCTAssertNotNil(AuthValidationError.confirmPasswordRequired.errorDescription)
        XCTAssertNotNil(AuthValidationError.passwordMismatch.errorDescription)
        XCTAssertNotNil(AuthValidationError.presentationAnchorRequired.errorDescription)
    }

    func testAuthValidationErrorLocalizedDescriptions() {
        // Test that error descriptions are non-empty (language-independent)
        XCTAssertFalse(AuthValidationError.emailRequired.errorDescription?.isEmpty ?? true)
        XCTAssertFalse(AuthValidationError.passwordRequired.errorDescription?.isEmpty ?? true)
        XCTAssertFalse(AuthValidationError.usernameRequired.errorDescription?.isEmpty ?? true)
        XCTAssertFalse(AuthValidationError.passwordMismatch.errorDescription?.isEmpty ?? true)
    }
}
