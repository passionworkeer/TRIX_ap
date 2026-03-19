//
//  AuthViewModel.swift
//  TRIX3DCompanion
//
//  ViewModel for authentication screens (Login/Register)
//  Handles validation, error state, and delegates business logic to services
//

import Foundation
import UIKit
import Combine

// MARK: - Validation Error

/// Validation errors for auth forms
enum AuthValidationError: Error, LocalizedError {
    case emailRequired
    case emailInvalid
    case passwordRequired
    case passwordTooShort(minLength: Int)
    case usernameRequired
    case usernameTooShort(minLength: Int)
    case confirmPasswordRequired
    case passwordMismatch
    case presentationAnchorRequired

    var errorDescription: String? {
        switch self {
        case .emailRequired:
            return NSLocalizedString("auth.email.required", comment: "Email is required")
        case .emailInvalid:
            return NSLocalizedString("auth.email.invalid", comment: "Invalid email format")
        case .passwordRequired:
            return NSLocalizedString("auth.password.required", comment: "Password is required")
        case .passwordTooShort(let minLength):
            return String(format: NSLocalizedString("auth.password.min.length", comment: "Password too short"), minLength)
        case .usernameRequired:
            return NSLocalizedString("auth.username.required", comment: "Username is required")
        case .usernameTooShort(let minLength):
            return String(format: NSLocalizedString("auth.username.min.length", comment: "Username too short"), minLength)
        case .confirmPasswordRequired:
            return NSLocalizedString("auth.confirm.password.required", comment: "Confirm password is required")
        case .passwordMismatch:
            return NSLocalizedString("auth.password.mismatch", comment: "Passwords do not match")
        case .presentationAnchorRequired:
            return NSLocalizedString("auth.signin.apple.error", comment: "Presentation anchor required")
        }
    }
}

// MARK: - Auth View Model

/// ViewModel for authentication screens
/// Extracts validation logic and state management from Views
@Observable
@MainActor
final class AuthViewModel {

    // MARK: - Dependencies

    private let authService: AuthService
    private let oauthManager: OAuthManager

    // MARK: - Login State

    /// Email input
    var loginEmail: String = ""

    /// Password input
    var loginPassword: String = ""

    /// Login validation error
    var loginValidationError: String?

    /// Login API error
    var loginApiError: String?

    /// Is login in progress
    var isLoginLoading: Bool = false

    /// Is OAuth in progress
    var isOAuthLoading: Bool = false

    // MARK: - Register State

    /// Username input
    var registerUsername: String = ""

    /// Email input
    var registerEmail: String = ""

    /// Password input
    var registerPassword: String = ""

    /// Confirm password input
    var registerConfirmPassword: String = ""

    /// Register validation error
    var registerValidationError: String?

    /// Register API error
    var registerApiError: String?

    /// Is registration in progress
    var isRegisterLoading: Bool = false

    /// Registration success
    var isRegisterSuccess: Bool = false

    // MARK: - Initialization

    init(
        authService: AuthService = .shared,
        oauthManager: OAuthManager = .shared
    ) {
        self.authService = authService
        self.oauthManager = oauthManager
    }

    // MARK: - Login Methods

    /// Validates login email field
    /// - Returns: Validation error if invalid, nil if valid
    func validateLoginEmail() -> AuthValidationError? {
        let email = loginEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        if email.isEmpty {
            return .emailRequired
        }

        // Basic email format validation
        let emailRegex = #"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#
        if email.range(of: emailRegex, options: .regularExpression) == nil {
            return .emailInvalid
        }

        return nil
    }

    /// Validates login password field
    /// - Returns: Validation error if invalid, nil if valid
    func validateLoginPassword() -> AuthValidationError? {
        let password = loginPassword.trimmingCharacters(in: .newlines)

        if password.isEmpty {
            return .passwordRequired
        }

        return nil
    }

    /// Performs login with email and password
    /// - Returns: AuthResult with user on success, error on failure
    func login() async -> AuthResult<User> {
        // Clear previous errors
        loginValidationError = nil
        loginApiError = nil

        // Validate inputs
        if let emailError = validateLoginEmail() {
            loginValidationError = emailError.localizedDescription
            return .failure(.validationError(message: emailError.localizedDescription))
        }

        if let passwordError = validateLoginPassword() {
            loginValidationError = passwordError.localizedDescription
            return .failure(.validationError(message: passwordError.localizedDescription))
        }

        // Perform login
        isLoginLoading = true
        defer { isLoginLoading = false }

        let normalizedEmail = loginEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normalizedPassword = loginPassword.trimmingCharacters(in: .newlines)

        let result = await authService.login(email: normalizedEmail, password: normalizedPassword)

        // Handle retry for whitespace in password
        if case .failure(let error) = result {
            let trimmedPassword = normalizedPassword.trimmingCharacters(in: .whitespacesAndNewlines)
            if error == .invalidCredentials && trimmedPassword != normalizedPassword {
                let retryResult = await authService.login(email: normalizedEmail, password: trimmedPassword)
                switch retryResult {
                case .success(let user):
                    return .success(user)
                case .failure(let retryError):
                    loginApiError = retryError.localizedDescription
                    return .failure(retryError)
                }
            } else {
                loginApiError = error.localizedDescription
            }
        }

        return result
    }

    /// Signs in with Apple
    /// - Parameter presentationAnchor: Window for presenting UI
    /// - Returns: AuthResult with user on success, error on failure
    func signInWithApple(presentationAnchor: UIWindow?) async -> AuthResult<User> {
        guard let window = presentationAnchor else {
            let error = AuthValidationError.presentationAnchorRequired
            loginApiError = error.localizedDescription
            return .failure(.validationError(message: error.localizedDescription))
        }

        isOAuthLoading = true
        defer { isOAuthLoading = false }

        let result = await oauthManager.signIn(with: .apple, presentationAnchor: window)

        if case .failure(let error) = result {
            loginApiError = error.localizedDescription
        }

        return result
    }

    /// Signs in with WeChat
    /// - Returns: AuthResult with user on success, error on failure
    func signInWithWeChat() async -> AuthResult<User> {
        isOAuthLoading = true
        defer { isOAuthLoading = false }

        let result = await oauthManager.signIn(with: .wechat, presentationAnchor: nil)

        if case .failure(let error) = result {
            loginApiError = error.localizedDescription
        }

        return result
    }

    // MARK: - Register Methods

    /// Validates registration username
    /// - Returns: Validation error if invalid, nil if valid
    func validateRegisterUsername() -> AuthValidationError? {
        let username = registerUsername.trimmingCharacters(in: .whitespacesAndNewlines)

        if username.isEmpty {
            return .usernameRequired
        }

        if username.count < 3 {
            return .usernameTooShort(minLength: 3)
        }

        return nil
    }

    /// Validates registration email
    /// - Returns: Validation error if invalid, nil if valid
    func validateRegisterEmail() -> AuthValidationError? {
        let email = registerEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        if email.isEmpty {
            return .emailRequired
        }

        let emailRegex = #"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#
        if email.range(of: emailRegex, options: .regularExpression) == nil {
            return .emailInvalid
        }

        return nil
    }

    /// Validates registration password
    /// - Returns: Validation error if invalid, nil if valid
    func validateRegisterPassword() -> AuthValidationError? {
        let password = registerPassword.trimmingCharacters(in: .whitespacesAndNewlines)

        if password.isEmpty {
            return .passwordRequired
        }

        if password.count < 6 {
            return .passwordTooShort(minLength: 6)
        }

        return nil
    }

    /// Validates confirm password
    /// - Returns: Validation error if invalid, nil if valid
    func validateRegisterConfirmPassword() -> AuthValidationError? {
        let confirmPassword = registerConfirmPassword.trimmingCharacters(in: .whitespacesAndNewlines)

        if confirmPassword.isEmpty {
            return .confirmPasswordRequired
        }

        if confirmPassword != registerPassword {
            return .passwordMismatch
        }

        return nil
    }

    /// Performs registration
    /// - Returns: AuthResult with user on success, error on failure
    func register() async -> AuthResult<User> {
        // Clear previous errors
        registerValidationError = nil
        registerApiError = nil
        isRegisterSuccess = false

        // Validate all fields
        if let usernameError = validateRegisterUsername() {
            registerValidationError = usernameError.localizedDescription
            return .failure(.validationError(message: usernameError.localizedDescription))
        }

        if let emailError = validateRegisterEmail() {
            registerValidationError = emailError.localizedDescription
            return .failure(.validationError(message: emailError.localizedDescription))
        }

        if let passwordError = validateRegisterPassword() {
            registerValidationError = passwordError.localizedDescription
            return .failure(.validationError(message: passwordError.localizedDescription))
        }

        if let confirmError = validateRegisterConfirmPassword() {
            registerValidationError = confirmError.localizedDescription
            return .failure(.validationError(message: confirmError.localizedDescription))
        }

        // Perform registration
        isRegisterLoading = true
        defer { isRegisterLoading = false }

        let normalizedUsername = registerUsername.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedEmail = registerEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normalizedPassword = registerPassword.trimmingCharacters(in: .whitespacesAndNewlines)

        let result = await authService.register(
            username: normalizedUsername,
            email: normalizedEmail,
            password: normalizedPassword
        )

        switch result {
        case .success:
            isRegisterSuccess = true
        case .failure(let error):
            registerApiError = error.localizedDescription
        }

        return result
    }

    // MARK: - Utility Methods

    /// Clears all login state
    func clearLoginState() {
        loginEmail = ""
        loginPassword = ""
        loginValidationError = nil
        loginApiError = nil
        isLoginLoading = false
    }

    /// Clears all register state
    func clearRegisterState() {
        registerUsername = ""
        registerEmail = ""
        registerPassword = ""
        registerConfirmPassword = ""
        registerValidationError = nil
        registerApiError = nil
        isRegisterLoading = false
        isRegisterSuccess = false
    }

    /// Clears all errors
    func clearErrors() {
        loginValidationError = nil
        loginApiError = nil
        registerValidationError = nil
        registerApiError = nil
        authService.clearError()
    }
}
