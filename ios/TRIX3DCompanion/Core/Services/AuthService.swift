//
//  AuthService.swift
//  TRIX3DCompanion
//
//  Authentication service for managing user login, registration, and session state
//

import Foundation
import Combine

// MARK: - Auth Error

/// Authentication error types
enum AuthError: Error, LocalizedError, Equatable {
    case invalidCredentials
    case emailAlreadyExists
    case networkError(underlying: Error)
    case tokenExpired
    case refreshFailed
    case unknown(underlying: Error?)
    case validationError(message: String)

    static func == (lhs: AuthError, rhs: AuthError) -> Bool {
        switch (lhs, rhs) {
        case (.invalidCredentials, .invalidCredentials):
            return true
        case (.emailAlreadyExists, .emailAlreadyExists):
            return true
        case (.networkError, .networkError):
            return true
        case (.tokenExpired, .tokenExpired):
            return true
        case (.refreshFailed, .refreshFailed):
            return true
        case (.unknown, .unknown):
            return true
        case (.validationError(let lhsMsg), .validationError(let rhsMsg)):
            return lhsMsg == rhsMsg
        default:
            return false
        }
    }

    var errorDescription: String? {
        switch self {
        case .invalidCredentials:
            return "Invalid email or password"
        case .emailAlreadyExists:
            return "An account with this email already exists"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .tokenExpired:
            return "Your session has expired. Please log in again."
        case .refreshFailed:
            return "Failed to refresh session. Please log in again."
        case .unknown(let error):
            return error?.localizedDescription ?? "An unknown error occurred"
        case .validationError(let message):
            return message
        }
    }

    var isRecoverable: Bool {
        switch self {
        case .tokenExpired, .refreshFailed:
            return true
        default:
            return false
        }
    }
}

// MARK: - Auth Result

/// Result type for authentication operations
typealias AuthResult<T> = Result<T, AuthError>

// MARK: - Auth Service Protocol

/// Protocol defining authentication service interface
protocol AuthServiceProtocol {
    var isLoggedIn: Bool { get }
    var currentUser: User? { get }
    var isLoading: Bool { get }

    func login(email: String, password: String) async -> AuthResult<User>
    func register(username: String, email: String, password: String) async -> AuthResult<User>
    func logout() async -> AuthResult<Void>
    func refreshTokenIfNeeded() async -> AuthResult<Void>
    func fetchCurrentUser() async -> AuthResult<User>
}

// MARK: - Auth Service

/// Main authentication service handling user authentication and session management
@MainActor
final class AuthService: ObservableObject, AuthServiceProtocol {

    // MARK: - Singleton

    static let shared = AuthService()

    // MARK: - Published Properties

    /// Current authenticated user
    @Published private(set) var currentUser: User?

    /// Whether user is currently authenticated
    @Published private(set) var isLoggedIn: Bool = false

    /// Whether an authentication operation is in progress
    @Published private(set) var isLoading: Bool = false

    /// Last authentication error if any
    @Published private(set) var lastError: AuthError?

    // MARK: - Dependencies

    private let apiClient: APIClient
    private let keychainManager: KeychainManager

    // MARK: - Private Properties

    /// Token expiration buffer (5 minutes before actual expiration)
    private let tokenRefreshBuffer: TimeInterval = 300

    /// Current access token expiration date
    private var tokenExpirationDate: Date?

    /// Refresh task to prevent concurrent token refresh
    private var refreshTask: Task<AuthResult<Void>, Never>?

    /// Cancellables for Combine subscriptions
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    /// Initialize with dependencies
    /// - Parameters:
    ///   - apiClient: API client instance (defaults to shared)
    ///   - keychainManager: Keychain manager instance (defaults to shared)
    init(
        apiClient: APIClient = .shared,
        keychainManager: KeychainManager = .shared
    ) {
        self.apiClient = apiClient
        self.keychainManager = keychainManager

        // Restore session on initialization
        restoreSession()
    }

    // MARK: - Internal Methods

    /// Update current user (internal use)
    /// - Parameter user: User to set
    func updateCurrentUser(_ user: User?) {
        currentUser = user
    }

    /// Update login status (internal use)
    /// - Parameter loggedIn: Whether user is logged in
    func updateLoginStatus(_ loggedIn: Bool) {
        isLoggedIn = loggedIn
    }

    // MARK: - Public Methods

    /// Login with email and password
    /// - Parameters:
    ///   - email: User's email address
    ///   - password: User's password
    /// - Returns: AuthResult containing the authenticated user
    func login(email: String, password: String) async -> AuthResult<User> {
        // DEMO MODE: Allow demo login for testing
        if email.lowercased() == "demo@trix3d.com" && password == "demo123" {
            return await demoLogin()
        }

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
            let response = try await apiClient.login(email: email, password: password)

            // Save session tokens
            try saveSession(response.session)

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

    /// Demo login for testing without backend
    private func demoLogin() async -> AuthResult<User> {
        isLoading = true

        // Create a demo user
        let demoUser = User(
            id: "demo-user-001",
            username: "demo_user",
            email: "demo@trix3d.com",
            avatarUrl: nil,
            fullName: "演示用户",
            displayName: "demo_user",
            bio: nil,
            points: 0,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 0,
            school: nil,
            grade: nil,
            createdAt: Date(),
            updatedAt: Date()
        )

        // Create a demo session
        let demoSession = UserSession(
            id: "demo-session-001",
            userId: demoUser.id,
            accessToken: "demo_access_token_12345",
            refreshToken: "demo_refresh_token_67890",
            expiresAt: Date().addingTimeInterval(86400 * 7) // 7 days
        )

        // Save session
        do {
            try saveSession(demoSession)
        } catch {
            // Continue even if save fails
        }

        // Set current user
        currentUser = demoUser
        isLoggedIn = true
        isLoading = false

        return .success(demoUser)
    }

    /// Register a new user account
    /// - Parameters:
    ///   - username: Desired username
    ///   - email: User's email address
    ///   - password: User's password
    /// - Returns: AuthResult containing the newly created user
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
            let user = try await apiClient.register(username: username, email: email, password: password)

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

    /// Logout the current user
    /// - Returns: AuthResult indicating success or failure
    func logout() async -> AuthResult<Void> {
        isLoading = true

        // Call logout API (best effort - don't fail if API is unavailable)
        do {
            try await apiClient.logout()
        } catch {
            // Continue with local logout even if API call fails
            SecureLogger.shared.warning("Logout API call failed: \(error.localizedDescription)")
        }

        // Clear local session
        clearSession()

        isLoading = false

        return .success(())
    }

    /// Refresh access token if needed
    /// - Returns: AuthResult indicating success or failure
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

    /// Fetch the current user's profile from the server
    /// - Returns: AuthResult containing the current user
    func fetchCurrentUser() async -> AuthResult<User> {
        guard isLoggedIn else {
            return .failure(.invalidCredentials)
        }

        do {
            let user = try await apiClient.getCurrentUser()
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

    /// Restore session from keychain on app launch
    private func restoreSession() {
        let hasValidSession = keychainManager.hasValidSession()

        if hasValidSession {
            // Check if token is expired
            if shouldRefreshToken() {
                // Token needs refresh - try to refresh asynchronously
                Task {
                    _ = await refreshTokenIfNeeded()
                }
            } else {
                isLoggedIn = true

                // Fetch user profile in background
                Task {
                    _ = await fetchCurrentUser()
                }
            }
        }
    }

    /// Save session tokens to keychain
    /// - Parameter session: User session containing tokens
    private func saveSession(_ session: UserSession) throws {
        try keychainManager.saveSession(session)
        tokenExpirationDate = session.expiresAt
    }

    /// Clear all session data
    private func clearSession() {
        try? keychainManager.clearSession()
        currentUser = nil
        isLoggedIn = false
        tokenExpirationDate = nil
        lastError = nil
    }

    // MARK: - Token Management

    /// Check if token should be refreshed
    /// - Returns: True if token needs refresh
    private func shouldRefreshToken() -> Bool {
        guard let expirationDate = tokenExpirationDate else {
            return true
        }

        // Refresh if token expires within buffer time
        return Date().addingTimeInterval(tokenRefreshBuffer) >= expirationDate
    }

    /// Perform the actual token refresh
    private func performTokenRefresh() async -> AuthResult<Void> {
        guard let refreshToken = keychainManager.getRefreshToken() else {
            clearSession()
            return .failure(.refreshFailed)
        }

        do {
            // Create refresh request
            let refreshRequest = RefreshTokenRequest(refreshToken: refreshToken)
            let response: AuthResponse = try await apiClient.post(
                .authRefresh,
                body: refreshRequest
            )

            // Save new tokens
            try saveSession(response.session)

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

    /// Validate email format
    /// - Parameter email: Email string to validate
    /// - Returns: True if email is valid
    private func isValidEmail(_ email: String) -> Bool {
        let emailRegex = #"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#
        return email.range(of: emailRegex, options: .regularExpression) != nil
    }

    /// Map network errors to auth errors
    /// - Parameter error: Network error
    /// - Returns: Corresponding auth error
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

// MARK: - Refresh Token Request

/// Request body for token refresh
struct RefreshTokenRequest: Codable {
    let refreshToken: String

    enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }
}

// MARK: - Convenience Extensions

extension AuthService {

    /// Check if user has premium features
    var isPremium: Bool {
        currentUser?.points ?? 0 > 0
    }

    /// Get user's display name
    var displayName: String {
        currentUser?.displayName ?? currentUser?.username ?? "User"
    }

    /// Get user's avatar URL if available
    var avatarURL: URL? {
        guard let urlString = currentUser?.avatarUrl else { return nil }
        return URL(string: urlString)
    }

    /// Clear error state
    func clearError() {
        lastError = nil
    }
}

// MARK: - AsyncStream Support (iOS 16+)

#if swift(>=5.9)
extension AuthService {

    /// Observe authentication state changes as AsyncStream
    var authStateStream: AsyncStream<Bool> {
        AsyncStream { continuation in
            // Emit initial state
            continuation.yield(isLoggedIn)

            // Observe changes
            $isLoggedIn
                .dropFirst()
                .sink { isLoggedIn in
                    continuation.yield(isLoggedIn)
                }
                .store(in: &cancellables)

            continuation.onTermination = { _ in
                // Cleanup handled by cancellables
            }
        }
    }
}
#endif
