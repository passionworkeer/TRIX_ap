//
//  AppleSignInServiceProtocol.swift
//  TRIX3DCompanion
//
//  Protocol for Apple Sign In service
//

import Foundation
import AuthenticationServices

// MARK: - Apple Sign In Error

/// Errors that can occur during Apple Sign In
enum AppleSignInError: Error, LocalizedError, Equatable {
    case notAvailable
    case cancelled
    case failed(Error)
    case invalidCredential
    case authorizationFailed
    case noIdentityToken
    case noAuthorizationCode
    case credentialRevoked
    case unknown(Error?)

    static func == (lhs: AppleSignInError, rhs: AppleSignInError) -> Bool {
        switch (lhs, rhs) {
        case (.notAvailable, .notAvailable): return true
        case (.cancelled, .cancelled): return true
        case (.failed, .failed): return true
        case (.invalidCredential, .invalidCredential): return true
        case (.authorizationFailed, .authorizationFailed): return true
        case (.noIdentityToken, .noIdentityToken): return true
        case (.noAuthorizationCode, .noAuthorizationCode): return true
        case (.credentialRevoked, .credentialRevoked): return true
        case (.unknown, .unknown): return true
        default: return false
        }
    }

    var errorDescription: String? {
        switch self {
        case .notAvailable:
            return "Sign in with Apple is not available on this device"
        case .cancelled:
            return "Sign in was cancelled"
        case .failed(let error):
            return "Sign in failed: \(error.localizedDescription)"
        case .invalidCredential:
            return "Invalid credential received"
        case .authorizationFailed:
            return "Authorization failed"
        case .noIdentityToken:
            return "No identity token received from Apple"
        case .noAuthorizationCode:
            return "No authorization code received from Apple"
        case .credentialRevoked:
            return "Apple ID credential has been revoked"
        case .unknown(let error):
            return error?.localizedDescription ?? "An unknown error occurred"
        }
    }

    var isRecoverable: Bool {
        switch self {
        case .cancelled, .credentialRevoked:
            return true
        default:
            return false
        }
    }
}

// MARK: - Apple Sign In Result

/// Result type for Apple Sign In operations
typealias AppleSignInResult = Result<AppleSignInCredential, AppleSignInError>

// MARK: - Apple Sign In Credential

/// Credential data from Apple Sign In
struct AppleSignInCredential {
    let userIdentifier: String
    let identityToken: String
    let authorizationCode: String
    let email: String?
    let fullName: PersonNameComponents?
    let realUserStatus: ASUserDetectionStatus

    /// Identity token data (JWT)
    var identityTokenData: Data? {
        return identityToken.data(using: .utf8)
    }

    /// Authorization code data
    var authorizationCodeData: Data? {
        return authorizationCode.data(using: .utf8)
    }
}

// MARK: - Apple Sign In Service Protocol

/// Protocol defining Apple Sign In service interface
@MainActor
protocol AppleSignInServiceProtocol: AnyObject {
    /// Whether Sign in with Apple is available
    var isAvailable: Bool { get }

    /// Current Apple credential state
    var credentialState: ASAuthorizationAppleIDProvider.CredentialState { get }

    /// Sign in with Apple
    /// - Parameter presentationAnchor: The window to present the sign-in UI
    /// - Returns: Apple sign-in credential
    func signIn(presentationAnchor: ASPresentationAnchor) async -> AppleSignInResult

    /// Check credential state for a user
    /// - Parameter userID: The user identifier to check
    /// - Returns: Current credential state
    func checkCredentialState(forUserID userID: String) async -> ASAuthorizationAppleIDProvider.CredentialState

    /// Get existing credential state synchronously (cached)
    /// - Parameter userID: The user identifier to check
    /// - Returns: Current credential state
    func getCredentialState(forUserID userID: String) -> ASAuthorizationAppleIDProvider.CredentialState
}

// MARK: - Apple Sign In Delegate Protocol

/// Protocol for receiving Apple Sign In callbacks
protocol AppleSignInServiceDelegate: AnyObject {
    /// Called when sign in completes successfully
    func appleSignInService(_ service: AppleSignInServiceProtocol, didSignInWith credential: AppleSignInCredential)

    /// Called when sign in fails
    func appleSignInService(_ service: AppleSignInServiceProtocol, didFailWithError error: AppleSignInError)

    /// Called when credential state changes
    func appleSignInService(_ service: AppleSignInServiceProtocol, credentialStateDidChange state: ASAuthorizationAppleIDProvider.CredentialState)
}
