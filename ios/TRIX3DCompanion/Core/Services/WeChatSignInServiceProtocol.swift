//
//  WeChatSignInServiceProtocol.swift
//  TRIX3DCompanion
//
//  Protocol for WeChat Sign In service
//

import Foundation

// MARK: - WeChat Sign In Error

/// Errors that can occur during WeChat Sign In
enum WeChatSignInError: Error, LocalizedError, Equatable {
    case notInstalled
    case notSupported
    case cancelled
    case networkError(Error)
    case invalidCode
    case invalidAccessToken
    case authenticationFailed
    case authorizationFailed(String)
    case invalidResponse
    case noOpenID
    case noAccessToken
    case tokenExpired
    case unknown(Error?)

    var errorDescription: String? {
        switch self {
        case .notInstalled:
            return "WeChat is not installed on this device"
        case .notSupported:
            return "WeChat Sign In is not supported"
        case .cancelled:
            return "WeChat Sign In was cancelled"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .invalidCode:
            return "Invalid authorization code received from WeChat"
        case .invalidAccessToken:
            return "Invalid access token"
        case .authenticationFailed:
            return "Authentication failed"
        case .authorizationFailed(let message):
            return "Authorization failed: \(message)"
        case .invalidResponse:
            return "Invalid response from WeChat"
        case .noOpenID:
            return "No OpenID received from WeChat"
        case .noAccessToken:
            return "No access token received from WeChat"
        case .tokenExpired:
            return "WeChat access token has expired"
        case .unknown(let error):
            return error?.localizedDescription ?? "An unknown error occurred"
        }
    }

    var isRecoverable: Bool {
        switch self {
        case .cancelled, .tokenExpired, .networkError:
            return true
        default:
            return false
        }
    }

    // Manual Equatable implementation for associated values
    static func == (lhs: WeChatSignInError, rhs: WeChatSignInError) -> Bool {
        switch (lhs, rhs) {
        case (.notInstalled, .notInstalled),
             (.notSupported, .notSupported),
             (.cancelled, .cancelled),
             (.invalidCode, .invalidCode),
             (.invalidAccessToken, .invalidAccessToken),
             (.authenticationFailed, .authenticationFailed),
             (.invalidResponse, .invalidResponse),
             (.noOpenID, .noOpenID),
             (.noAccessToken, .noAccessToken),
             (.tokenExpired, .tokenExpired):
            return true
        case (.networkError(let lhsError), .networkError(let rhsError)):
            return lhsError.localizedDescription == rhsError.localizedDescription
        case (.authorizationFailed(let lhsMessage), .authorizationFailed(let rhsMessage)):
            return lhsMessage == rhsMessage
        case (.unknown(let lhsError), .unknown(let rhsError)):
            return lhsError?.localizedDescription == rhsError?.localizedDescription
        default:
            return false
        }
    }
}

// MARK: - WeChat Sign In Result

/// Result type for WeChat Sign In operations
typealias WeChatSignInResult = Result<WeChatSignInCredential, WeChatSignInError>

// MARK: - WeChat Sign In Credential

/// Credential data from WeChat Sign In
struct WeChatSignInCredential {
    let openID: String
    let accessToken: String
    let refreshToken: String?
    let expiresIn: Int
    let unionID: String?
    let scope: String?

    /// Token expiration date
    var expirationDate: Date {
        return Date().addingTimeInterval(TimeInterval(expiresIn))
    }

    /// Check if token is expired
    var isExpired: Bool {
        return Date() >= expirationDate
    }
}

// MARK: - WeChat Sign In Service Protocol

/// Protocol defining WeChat Sign In service interface
@MainActor
protocol WeChatSignInServiceProtocol: AnyObject {
    /// Whether WeChat SDK is available
    var isAvailable: Bool { get }

    /// Whether WeChat app is installed
    var isInstalled: Bool { get }

    /// Current WeChat SDK version
    var sdkVersion: String? { get }

    /// Sign in with WeChat
    /// - Returns: WeChat sign-in credential
    func signIn() async -> WeChatSignInResult

    /// Refresh access token
    /// - Parameter refreshToken: The refresh token
    /// - Returns: New access token
    func refreshAccessToken(refreshToken: String) async -> WeChatSignInResult

    /// Handle WeChat callback
    /// - Parameter url: The callback URL
    /// - Returns: True if the URL was handled successfully
    func handleOpen(_ url: URL) -> Bool
}

// MARK: - WeChat Sign In Delegate Protocol

/// Protocol for receiving WeChat Sign In callbacks
protocol WeChatSignInServiceDelegate: AnyObject {
    /// Called when sign in completes successfully
    func weChatSignInService(_ service: WeChatSignInServiceProtocol, didSignInWith credential: WeChatSignInCredential)

    /// Called when sign in fails
    func weChatSignInService(_ service: WeChatSignInServiceProtocol, didFailWithError error: WeChatSignInError)
}
