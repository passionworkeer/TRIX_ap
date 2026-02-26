//
//  AppleSignInService.swift
//  TRIX3DCompanion
//
//  Service for handling Sign in with Apple
//

import Foundation
import AuthenticationServices
import CryptoKit

// MARK: - Apple Sign In Service

/// Service for managing Sign in with Apple
@MainActor
final class AppleSignInService: NSObject, AppleSignInServiceProtocol {

    // MARK: - Singleton

    static let shared = AppleSignInService()

    // MARK: - Properties

    /// Whether Sign in with Apple is available on this device
    var isAvailable: Bool {
        // Apple Sign In is available on iOS 13.0+
        if #available(iOS 13.0, *) {
            return true
        }
        return false
    }

    /// Current cached credential state
    private(set) var credentialState: ASAuthorizationAppleIDProvider.CredentialState = .notFound

    /// Delegate for callbacks
    weak var delegate: AppleSignInServiceDelegate?

    // MARK: - Private Properties

    /// Provider for Apple ID authentication
    private let appleIDProvider = ASAuthorizationAppleIDProvider()

    /// Current sign-in continuation for async/await
    private var signInContinuation: CheckedContinuation<AppleSignInResult, Never>?

    /// Current presentation anchor
    private var currentPresentationAnchor: ASPresentationAnchor?

    // MARK: - Initialization

    private override init() {
        super.init()
    }

    // MARK: - Public Methods

    /// Sign in with Apple
    /// - Parameter presentationAnchor: The window to present the sign-in UI
    /// - Returns: Apple sign-in credential or error
    func signIn(presentationAnchor: ASPresentationAnchor) async -> AppleSignInResult {
        // Store presentation anchor
        currentPresentationAnchor = presentationAnchor

        // Create Apple ID request
        let request = appleIDProvider.createRequest()
        request.requestedScopes = [.fullName, .email]

        // Create authorization controller
        let authorizationController = ASAuthorizationController(authorizationRequests: [request])
        authorizationController.delegate = self
        authorizationController.presentationContextProvider = self

        // Start async sign-in flow
        return await withCheckedContinuation { continuation in
            self.signInContinuation = continuation
            authorizationController.performRequests()
        }
    }

    /// Check credential state for a user asynchronously
    /// - Parameter userID: The user identifier to check
    /// - Returns: Current credential state
    func checkCredentialState(forUserID userID: String) async -> ASAuthorizationAppleIDProvider.CredentialState {
        do {
            let state = try await appleIDProvider.credentialState(forUserID: userID)
            credentialState = state

            // Notify delegate of state change
            delegate?.appleSignInService(self, credentialStateDidChange: state)

            return state
        } catch {
            SecureLogger.shared.error("Error checking Apple credential state: \(error)")
            return .notFound
        }
    }

    /// Get existing credential state synchronously (cached or immediate)
    /// - Parameter userID: The user identifier to check
    /// - Returns: Current credential state
    func getCredentialState(forUserID userID: String) -> ASAuthorizationAppleIDProvider.CredentialState {
        // Return cached state if available
        if credentialState != .notFound {
            return credentialState
        }

        // For iOS 14+, use the modern API
        if #available(iOS 14.0, *) {
            Task {
                _ = await checkCredentialState(forUserID: userID)
            }
        }

        return credentialState
    }

    // MARK: - Private Methods

    /// Complete the sign-in flow with a result
    /// - Parameter result: The sign-in result
    private func completeSignIn(with result: AppleSignInResult) {
        signInContinuation?.resume(returning: result)
        signInContinuation = nil
        currentPresentationAnchor = nil
    }

    /// Parse Apple ID credential
    /// - Parameter credential: The Apple ID credential
    /// - Returns: Parsed credential data or error
    private func parseCredential(_ credential: ASAuthorizationAppleIDCredential) -> AppleSignInResult {
        // Extract identity token
        guard let identityTokenData = credential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8) else {
            return .failure(.noIdentityToken)
        }

        // Extract authorization code
        guard let authorizationCodeData = credential.authorizationCode,
              let authorizationCode = String(data: authorizationCodeData, encoding: .utf8) else {
            return .failure(.noAuthorizationCode)
        }

        // Extract user identifier
        guard let userIdentifier = credential.user.isEmpty ? nil : credential.user else {
            return .failure(.invalidCredential)
        }

        // Create credential object
        let appleCredential = AppleSignInCredential(
            userIdentifier: userIdentifier,
            identityToken: identityToken,
            authorizationCode: authorizationCode,
            email: credential.email,
            fullName: credential.fullName,
            realUserStatus: credential.realUserStatus
        )

        return .success(appleCredential)
    }
}

// MARK: - ASAuthorizationControllerDelegate

extension AppleSignInService: ASAuthorizationControllerDelegate {

    nonisolated func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        Task { @MainActor in
            guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential else {
                let error = AppleSignInError.invalidCredential
                delegate?.appleSignInService(self, didFailWithError: error)
                completeSignIn(with: .failure(error))
                return
            }

            let result = parseCredential(appleIDCredential)

            switch result {
            case .success(let credential):
                // Update credential state
                credentialState = .authorized
                delegate?.appleSignInService(self, didSignInWith: credential)
                completeSignIn(with: result)

            case .failure(let error):
                delegate?.appleSignInService(self, didFailWithError: error)
                completeSignIn(with: result)
            }
        }
    }

    nonisolated func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        Task { @MainActor in
            let appleError: AppleSignInError

            let asError = error as? ASAuthorizationError
            switch asError?.code {
            case .canceled:
                appleError = .cancelled
            case .failed:
                appleError = .failed(error)
            default:
                appleError = .unknown(error)
            }

            delegate?.appleSignInService(self, didFailWithError: appleError)
            completeSignIn(with: .failure(appleError))
        }
    }
}

// MARK: - ASAuthorizationControllerPresentationContextProviding

extension AppleSignInService: ASAuthorizationControllerPresentationContextProviding {

    nonisolated func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        // Return the stored presentation anchor
        // Note: This should always be available when sign-in is initiated
        return currentPresentationAnchor ?? ASPresentationAnchor()
    }
}

// MARK: - Credential State Monitoring

extension AppleSignInService {

    /// Start monitoring credential state changes for a user
    /// - Parameter userID: The user identifier to monitor
    /// - Returns: Task that monitors credential state
    @discardableResult
    func startCredentialStateMonitoring(forUserID userID: String) -> Task<Void, Never> {
        Task {
            // Check initial state
            let initialState = await checkCredentialState(forUserID: userID)

            // If revoked or not found, notify
            if initialState == .revoked || initialState == .notFound {
                credentialState = initialState
                delegate?.appleSignInService(self, credentialStateDidChange: initialState)
            }
        }
    }
}

// MARK: - Notification Support

extension AppleSignInService {

    /// Handle credential revoked notification
    func handleCredentialRevoked() {
        credentialState = .revoked
        delegate?.appleSignInService(self, credentialStateDidChange: .revoked)
    }
}
