//
//  OAuthManagerProtocol.swift
//  TRIX3DCompanion
//
//  Protocol for OAuth Manager
//

import Foundation
import AuthenticationServices

// MARK: - OAuth Provider

/// Supported OAuth providers
enum OAuthProvider: String, CaseIterable, Codable {
    case apple = "apple"
    case wechat = "wechat"

    /// Display name
    var displayName: String {
        switch self {
        case .apple: return "Apple"
        case .wechat: return "WeChat"
        }
    }

    /// Icon name (SF Symbol)
    var iconName: String {
        switch self {
        case .apple: return "applelogo"
        case .wechat: return "message.fill"
        }
    }

    /// Button color
    var buttonColor: String {
        switch self {
        case .apple: return "black"
        case .wechat: return "green"
        }
    }
}

// MARK: - OAuth Token

/// OAuth token data
struct OAuthToken: Codable {
    let provider: OAuthProvider
    let accessToken: String
    let refreshToken: String?
    let expiresAt: Date?
    let scopes: [String]?

    /// Check if token is expired
    var isExpired: Bool {
        guard let expiresAt = expiresAt else { return false }
        return Date() >= expiresAt
    }

    /// Check if token is expiring soon (within 5 minutes)
    var isExpiringSoon: Bool {
        guard let expiresAt = expiresAt else { return false }
        let buffer: TimeInterval = 300 // 5 minutes
        return Date().addingTimeInterval(buffer) >= expiresAt
    }
}

// MARK: - OAuth Account

/// Linked OAuth account
struct OAuthAccount: Codable, Identifiable {
    let id: String
    let provider: OAuthProvider
    let providerUserID: String
    let email: String?
    let displayName: String?
    let avatarURL: String?
    let isPrimary: Bool
    let linkedAt: Date
    let lastUsedAt: Date
}

// MARK: - OAuth Manager Protocol

/// Protocol defining OAuth manager interface
@MainActor
protocol OAuthManagerProtocol: AnyObject {
    /// Currently available providers
    var availableProviders: [OAuthProvider] { get }

    /// Currently linked accounts
    var linkedAccounts: [OAuthAccount] { get }

    /// Whether user has any linked accounts
    var hasLinkedAccounts: Bool { get }

    /// Sign in with OAuth provider
    /// - Parameters:
    ///   - provider: The OAuth provider
    ///   - presentationAnchor: The window for presenting UI (required for Apple)
    /// - Returns: Auth result with user
    func signIn(
        with provider: OAuthProvider,
        presentationAnchor: ASPresentationAnchor?
    ) async -> AuthResult<User>

    /// Link an OAuth account to current user
    /// - Parameters:
    ///   - provider: The OAuth provider
    ///   - presentationAnchor: The window for presenting UI
    /// - Returns: Auth result indicating success or failure
    func linkAccount(
        provider: OAuthProvider,
        presentationAnchor: ASPresentationAnchor?
    ) async -> AuthResult<Void>

    /// Unlink an OAuth account
    /// - Parameter accountID: The account ID to unlink
    /// - Returns: Auth result indicating success or failure
    func unlinkAccount(accountID: String) async -> AuthResult<Void>

    /// Refresh OAuth token if needed
    /// - Parameter provider: The provider to refresh
    /// - Returns: Auth result indicating success or failure
    func refreshToken(for provider: OAuthProvider) async -> AuthResult<Void>

    /// Get linked accounts from server
    /// - Returns: Array of linked accounts
    func fetchLinkedAccounts() async -> AuthResult<[OAuthAccount]>

    /// Check if provider is available
    /// - Parameter provider: The provider to check
    /// - Returns: True if provider is available
    func isProviderAvailable(_ provider: OAuthProvider) -> Bool

    /// Handle OAuth callback URL
    /// - Parameter url: The callback URL
    /// - Returns: True if URL was handled
    func handleOpenURL(_ url: URL) -> Bool
}

// MARK: - OAuth Manager Delegate

/// Protocol for OAuth manager callbacks
protocol OAuthManagerDelegate: AnyObject {
    /// Called when user signs in successfully
    func oauthManager(_ manager: OAuthManagerProtocol, didSignInUser user: User)

    /// Called when sign in fails
    func oauthManager(_ manager: OAuthManagerProtocol, didFailSignIn error: Error)

    /// Called when account is linked
    func oauthManager(_ manager: OAuthManagerProtocol, didLinkAccount account: OAuthAccount)

    /// Called when account is unlinked
    func oauthManager(_ manager: OAuthManagerProtocol, didUnlinkAccount accountID: String)
}
