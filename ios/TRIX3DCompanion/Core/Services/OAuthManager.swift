//
//  OAuthManager.swift
//  TRIX3DCompanion
//
//  Manager for third-party OAuth authentication
//

import Foundation
import AuthenticationServices
import Combine

// MARK: - OAuth Manager

/// Manager for handling third-party OAuth authentication
@MainActor
final class OAuthManager: NSObject, OAuthManagerProtocol, ObservableObject {

    // MARK: - Singleton

    static let shared = OAuthManager()

    // MARK: - Published Properties

    /// Currently linked OAuth accounts
    @Published private(set) var linkedAccounts: [OAuthAccount] = []

    /// Whether user has any linked accounts
    var hasLinkedAccounts: Bool {
        return !linkedAccounts.isEmpty
    }

    // MARK: - Properties

    /// Delegate for callbacks
    weak var delegate: OAuthManagerDelegate?

    /// Currently available providers
    var availableProviders: [OAuthProvider] {
        var providers: [OAuthProvider] = []

        // Check Apple Sign In availability
        if AppleSignInService.shared.isAvailable {
            providers.append(.apple)
        }

        // Check WeChat Sign In availability
        if WeChatSignInService.shared.isAvailable {
            providers.append(.wechat)
        }

        return providers
    }

    // MARK: - Dependencies

    private let authService: AuthService
    private let apiClient: APIClient
    private let keychainManager: KeychainManager

    // MARK: - Private Properties

    /// Cancellables for Combine subscriptions
    private var cancellables = Set<AnyCancellable>()

    /// OAuth tokens storage (in keychain)
    private struct TokenKey {
        static let prefix = "oauth_token_"
        static func key(for provider: OAuthProvider) -> String {
            return prefix + provider.rawValue
        }
    }

    // MARK: - Initialization

    /// Initialize with dependencies
    /// - Parameters:
    ///   - authService: Authentication service
    ///   - apiClient: API client
    ///   - keychainManager: Keychain manager
    init(
        authService: AuthService = .shared,
        apiClient: APIClient = .shared,
        keychainManager: KeychainManager = .shared
    ) {
        self.authService = authService
        self.apiClient = apiClient
        self.keychainManager = keychainManager

        super.init()

        // Setup delegates
        AppleSignInService.shared.delegate = self
        WeChatSignInService.shared.delegate = self
    }

    // MARK: - Public Methods

    /// Sign in with OAuth provider
    /// - Parameters:
    ///   - provider: The OAuth provider
    ///   - presentationAnchor: The window for presenting UI (required for Apple)
    /// - Returns: Auth result with user
    func signIn(
        with provider: OAuthProvider,
        presentationAnchor: ASPresentationAnchor? = nil
    ) async -> AuthResult<User> {
        // Check provider availability
        guard isProviderAvailable(provider) else {
            let error = AuthError.validationError(message: "\(provider.displayName) Sign In is not available")
            return .failure(error)
        }

        // Perform sign in based on provider
        switch provider {
        case .apple:
            return await signInWithApple(presentationAnchor: presentationAnchor)

        case .wechat:
            return await signInWithWeChat()
        }
    }

    /// Link an OAuth account to current user
    /// - Parameters:
    ///   - provider: The OAuth provider
    ///   - presentationAnchor: The window for presenting UI
    /// - Returns: Auth result indicating success or failure
    func linkAccount(
        provider: OAuthProvider,
        presentationAnchor: ASPresentationAnchor? = nil
    ) async -> AuthResult<Void> {
        // Verify user is logged in
        guard authService.isLoggedIn else {
            let error = AuthError.validationError(message: "You must be logged in to link an account")
            return .failure(error)
        }

        // Check provider availability
        guard isProviderAvailable(provider) else {
            let error = AuthError.validationError(message: "\(provider.displayName) Sign In is not available")
            return .failure(error)
        }

        // Perform linking based on provider
        switch provider {
        case .apple:
            return await linkAppleAccount(presentationAnchor: presentationAnchor)

        case .wechat:
            return await linkWeChatAccount()
        }
    }

    /// Unlink an OAuth account
    /// - Parameter accountID: The account ID to unlink
    /// - Returns: Auth result indicating success or failure
    func unlinkAccount(accountID: String) async -> AuthResult<Void> {
        // Verify user is logged in
        guard authService.isLoggedIn else {
            let error = AuthError.validationError(message: "You must be logged in to unlink an account")
            return .failure(error)
        }

        // Check if account exists
        guard let account = linkedAccounts.first(where: { $0.id == accountID }) else {
            let error = AuthError.validationError(message: "Account not found")
            return .failure(error)
        }

        // Prevent unlinking primary account if it's the only one
        if account.isPrimary && linkedAccounts.count == 1 {
            let error = AuthError.validationError(message: "Cannot unlink your only authentication method")
            return .failure(error)
        }

        // Call unlink API
        do {
            let endpoint = APIEndpoint.userProfile // POST /user/oauth/unlink
            let request = OAuthUnlinkRequest(provider: account.provider.rawValue, accountID: accountID)
            let _: EmptyResponse = try await apiClient.post(endpoint, body: request)

            // Remove from local storage
            linkedAccounts.removeAll { $0.id == accountID }

            // Remove token from keychain
            try? keychainManager.delete(key: TokenKey.key(for: account.provider))

            // Notify delegate
            delegate?.oauthManager(self, didUnlinkAccount: accountID)

            return .success(())

        } catch let error as NetworkError {
            let authError = mapNetworkError(error)
            return .failure(authError)
        } catch {
            return .failure(.unknown(underlying: error))
        }
    }

    /// Refresh OAuth token if needed
    /// - Parameter provider: The provider to refresh
    /// - Returns: Auth result indicating success or failure
    func refreshToken(for provider: OAuthProvider) async -> AuthResult<Void> {
        // Get stored token
        guard let token = getToken(for: provider) else {
            return .failure(.tokenExpired)
        }

        // Check if refresh is needed
        guard token.isExpiringSoon else {
            return .success(())
        }

        // Refresh based on provider
        switch provider {
        case .apple:
            // Apple Sign In tokens cannot be refreshed
            // User must re-authenticate
            return .failure(.tokenExpired)

        case .wechat:
            return await refreshWeChatToken(token)
        }
    }

    /// Get linked accounts from server
    /// - Returns: Array of linked accounts
    func fetchLinkedAccounts() async -> AuthResult<[OAuthAccount]> {
        guard authService.isLoggedIn else {
            return .failure(.invalidCredentials)
        }

        do {
            let endpoint = APIEndpoint.userProfile // GET /user/oauth/accounts
            let accounts: [OAuthAccount] = try await apiClient.get(endpoint)
            linkedAccounts = accounts
            return .success(accounts)

        } catch let error as NetworkError {
            let authError = mapNetworkError(error)
            return .failure(authError)
        } catch {
            return .failure(.unknown(underlying: error))
        }
    }

    /// Check if provider is available
    /// - Parameter provider: The provider to check
    /// - Returns: True if provider is available
    func isProviderAvailable(_ provider: OAuthProvider) -> Bool {
        switch provider {
        case .apple:
            return AppleSignInService.shared.isAvailable
        case .wechat:
            return WeChatSignInService.shared.isAvailable
        }
    }

    /// Handle OAuth callback URL
    /// - Parameter url: The callback URL
    /// - Returns: True if URL was handled
    func handleOpenURL(_ url: URL) -> Bool {
        // Try WeChat first
        if WeChatSignInService.shared.handleOpen(url) {
            return true
        }

        // Apple Sign In doesn't use URL callbacks in the same way
        // It uses ASAuthorizationControllerDelegate instead

        return false
    }

    // MARK: - Private Methods - Apple Sign In

    /// Sign in with Apple
    /// - Parameter presentationAnchor: The window for presenting UI
    /// - Returns: Auth result with user
    private func signInWithApple(
        presentationAnchor: ASPresentationAnchor?
    ) async -> AuthResult<User> {
        guard let presentationAnchor = presentationAnchor else {
            let error = AuthError.validationError(message: "Presentation anchor required for Apple Sign In")
            return .failure(error)
        }

        let result = await AppleSignInService.shared.signIn(presentationAnchor: presentationAnchor)

        switch result {
        case .success(let credential):
            return await authenticateWithApple(credential)

        case .failure(let error):
            return .failure(mapAppleError(error))
        }
    }

    /// Authenticate with Apple credential
    /// - Parameter credential: The Apple credential
    /// - Returns: Auth result with user
    private func authenticateWithApple(_ credential: AppleSignInCredential) async -> AuthResult<User> {
        do {
            let request = AppleSignInRequest(
                identityToken: credential.identityToken,
                authorizationCode: credential.authorizationCode,
                userIdentifier: credential.userIdentifier
            )

            let response: AuthResponse = try await apiClient.post(.authLogin, body: request)

            // Save session
            try keychainManager.saveSession(response.session)

            // Save Apple token
            let token = OAuthToken(
                provider: .apple,
                accessToken: credential.identityToken,
                refreshToken: nil,
                expiresAt: nil,
                scopes: nil
            )
            saveToken(token, for: .apple)

            // Update auth service
            authService.updateCurrentUser(response.user)
            authService.updateLoginStatus(true)

            // Fetch linked accounts
            _ = await fetchLinkedAccounts()

            // Notify delegate
            delegate?.oauthManager(self, didSignInUser: response.user)

            return .success(response.user)

        } catch let error as NetworkError {
            let authError = mapNetworkError(error)
            return .failure(authError)
        } catch {
            return .failure(.unknown(underlying: error))
        }
    }

    /// Link Apple account
    /// - Parameter presentationAnchor: The window for presenting UI
    /// - Returns: Auth result indicating success or failure
    private func linkAppleAccount(
        presentationAnchor: ASPresentationAnchor?
    ) async -> AuthResult<Void> {
        guard let presentationAnchor = presentationAnchor else {
            let error = AuthError.validationError(message: "Presentation anchor required for Apple Sign In")
            return .failure(error)
        }

        let result = await AppleSignInService.shared.signIn(presentationAnchor: presentationAnchor)

        switch result {
        case .success(let credential):
            do {
                let request = AppleLinkRequest(
                    identityToken: credential.identityToken,
                    authorizationCode: credential.authorizationCode
                )
                let _: EmptyResponse = try await apiClient.post(.userProfile, body: request)

                // Save token
                let token = OAuthToken(
                    provider: .apple,
                    accessToken: credential.identityToken,
                    refreshToken: nil,
                    expiresAt: nil,
                    scopes: nil
                )
                saveToken(token, for: .apple)

                // Refresh linked accounts
                _ = await fetchLinkedAccounts()

                return .success(())

            } catch let error as NetworkError {
                return .failure(mapNetworkError(error))
            } catch {
                return .failure(.unknown(underlying: error))
            }

        case .failure(let error):
            return .failure(mapAppleError(error))
        }
    }

    // MARK: - Private Methods - WeChat Sign In

    /// Sign in with WeChat
    /// - Returns: Auth result with user
    private func signInWithWeChat() async -> AuthResult<User> {
        let result = await WeChatSignInService.shared.signIn()

        switch result {
        case .success(let credential):
            return await authenticateWithWeChat(credential)

        case .failure(let error):
            return .failure(mapWeChatError(error))
        }
    }

    /// Authenticate with WeChat credential
    /// - Parameter credential: The WeChat credential
    /// - Returns: Auth result with user
    private func authenticateWithWeChat(_ credential: WeChatSignInCredential) async -> AuthResult<User> {
        do {
            let request = WeChatSignInRequest(
                openID: credential.openID,
                accessToken: credential.accessToken
            )

            let response: AuthResponse = try await apiClient.post(.authLogin, body: request)

            // Save session
            try keychainManager.saveSession(response.session)

            // Save WeChat token
            let token = OAuthToken(
                provider: .wechat,
                accessToken: credential.accessToken,
                refreshToken: credential.refreshToken,
                expiresAt: credential.expirationDate,
                scopes: credential.scope?.components(separatedBy: ",")
            )
            saveToken(token, for: .wechat)

            // Update auth service
            authService.updateCurrentUser(response.user)
            authService.updateLoginStatus(true)

            // Fetch linked accounts
            _ = await fetchLinkedAccounts()

            // Notify delegate
            delegate?.oauthManager(self, didSignInUser: response.user)

            return .success(response.user)

        } catch let error as NetworkError {
            let authError = mapNetworkError(error)
            return .failure(authError)
        } catch {
            return .failure(.unknown(underlying: error))
        }
    }

    /// Link WeChat account
    /// - Returns: Auth result indicating success or failure
    private func linkWeChatAccount() async -> AuthResult<Void> {
        let result = await WeChatSignInService.shared.signIn()

        switch result {
        case .success(let credential):
            do {
                let request = WeChatLinkRequest(
                    openID: credential.openID,
                    accessToken: credential.accessToken
                )
                let _: EmptyResponse = try await apiClient.post(.userProfile, body: request)

                // Save token
                let token = OAuthToken(
                    provider: .wechat,
                    accessToken: credential.accessToken,
                    refreshToken: credential.refreshToken,
                    expiresAt: credential.expirationDate,
                    scopes: credential.scope?.components(separatedBy: ",")
                )
                saveToken(token, for: .wechat)

                // Refresh linked accounts
                _ = await fetchLinkedAccounts()

                return .success(())

            } catch let error as NetworkError {
                return .failure(mapNetworkError(error))
            } catch {
                return .failure(.unknown(underlying: error))
            }

        case .failure(let error):
            return .failure(mapWeChatError(error))
        }
    }

    /// Refresh WeChat token
    /// - Parameter token: The current token
    /// - Returns: Auth result indicating success or failure
    private func refreshWeChatToken(_ token: OAuthToken) async -> AuthResult<Void> {
        guard let refreshToken = token.refreshToken else {
            return .failure(.tokenExpired)
        }

        let result = await WeChatSignInService.shared.refreshAccessToken(refreshToken: refreshToken)

        switch result {
        case .success(let credential):
            // Save new token
            let newToken = OAuthToken(
                provider: .wechat,
                accessToken: credential.accessToken,
                refreshToken: credential.refreshToken,
                expiresAt: credential.expirationDate,
                scopes: credential.scope?.components(separatedBy: ",")
            )
            saveToken(newToken, for: .wechat)
            return .success(())

        case .failure:
            return .failure(.tokenExpired)
        }
    }

    // MARK: - Token Management

    /// Save OAuth token to keychain
    /// - Parameters:
    ///   - token: The token to save
    ///   - provider: The provider
    private func saveToken(_ token: OAuthToken, for provider: OAuthProvider) {
        do {
            let data = try JSONEncoder().encode(token)
            try keychainManager.save(key: TokenKey.key(for: provider), data: data)
        } catch {
            SecureLogger.shared.error("Failed to save OAuth token: \(error)")
        }
    }

    /// Get OAuth token from keychain
    /// - Parameter provider: The provider
    /// - Returns: The token if found
    private func getToken(for provider: OAuthProvider) -> OAuthToken? {
        do {
            guard let data = keychainManager.get(key: TokenKey.key(for: provider)) else {
                return nil
            }
            return try JSONDecoder().decode(OAuthToken.self, from: data)
        } catch {
            return nil
        }
    }

    // MARK: - Error Mapping

    /// Map Apple Sign In error to auth error
    /// - Parameter error: The Apple error
    /// - Returns: Auth error
    private func mapAppleError(_ error: AppleSignInError) -> AuthError {
        switch error {
        case .cancelled:
            return .validationError(message: "Apple Sign In was cancelled")
        case .notAvailable:
            return .validationError(message: "Apple Sign In is not available")
        case .credentialRevoked:
            return .tokenExpired
        default:
            return .validationError(message: error.localizedDescription)
        }
    }

    /// Map WeChat Sign In error to auth error
    /// - Parameter error: The WeChat error
    /// - Returns: Auth error
    private func mapWeChatError(_ error: WeChatSignInError) -> AuthError {
        switch error {
        case .cancelled:
            return .validationError(message: "WeChat Sign In was cancelled")
        case .notInstalled:
            return .validationError(message: "WeChat is not installed")
        case .notSupported:
            return .validationError(message: "WeChat Sign In is not supported")
        case .tokenExpired:
            return .tokenExpired
        default:
            return .validationError(message: error.localizedDescription)
        }
    }

    /// Map network error to auth error
    /// - Parameter error: The network error
    /// - Returns: Auth error
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

// MARK: - Apple Sign In Service Delegate

extension OAuthManager: AppleSignInServiceDelegate {
    nonisolated func appleSignInService(
        _ service: AppleSignInServiceProtocol,
        didSignInWith credential: AppleSignInCredential
    ) {
        // Handled in async methods
    }

    nonisolated func appleSignInService(
        _ service: AppleSignInServiceProtocol,
        didFailWithError error: AppleSignInError
    ) {
        // Handled in async methods
    }

    nonisolated func appleSignInService(
        _ service: AppleSignInServiceProtocol,
        credentialStateDidChange state: ASAuthorizationAppleIDProvider.CredentialState
    ) {
        Task { @MainActor in
            if state == .revoked {
                // Notify auth service
                _ = await authService.logout()
            }
        }
    }
}

// MARK: - WeChat Sign In Service Delegate

extension OAuthManager: WeChatSignInServiceDelegate {
    nonisolated func weChatSignInService(
        _ service: WeChatSignInServiceProtocol,
        didSignInWith credential: WeChatSignInCredential
    ) {
        // Handled in async methods
    }

    nonisolated func weChatSignInService(
        _ service: WeChatSignInServiceProtocol,
        didFailWithError error: WeChatSignInError
    ) {
        // Handled in async methods
    }
}

// MARK: - API Request Types

/// Apple Sign In request
struct AppleSignInRequest: Codable {
    let identityToken: String
    let authorizationCode: String
    let userIdentifier: String

    enum CodingKeys: String, CodingKey {
        case identityToken = "identity_token"
        case authorizationCode = "authorization_code"
        case userIdentifier = "user_identifier"
    }
}

/// Apple Link request
struct AppleLinkRequest: Codable {
    let identityToken: String
    let authorizationCode: String

    enum CodingKeys: String, CodingKey {
        case identityToken = "identity_token"
        case authorizationCode = "authorization_code"
    }
}

/// WeChat Sign In request
struct WeChatSignInRequest: Codable {
    let openID: String
    let accessToken: String

    enum CodingKeys: String, CodingKey {
        case openID = "openid"
        case accessToken = "access_token"
    }
}

/// WeChat Link request
struct WeChatLinkRequest: Codable {
    let openID: String
    let accessToken: String

    enum CodingKeys: String, CodingKey {
        case openID = "openid"
        case accessToken = "access_token"
    }
}

/// OAuth Unlink request
struct OAuthUnlinkRequest: Codable {
    let provider: String
    let accountID: String

    enum CodingKeys: String, CodingKey {
        case provider
        case accountID = "account_id"
    }
}

/// Empty response
struct EmptyResponse: Codable {}
