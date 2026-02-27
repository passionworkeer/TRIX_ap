//
//  WeChatSignInService.swift
//  TRIX3DCompanion
//
//  Service for handling WeChat Sign In
//

import Foundation
import UIKit

// MARK: - WeChat Configuration

/// Configuration structure for WeChat Sign In credentials
/// Credentials should be configured via:
/// 1. Environment variables (recommended for CI/CD)
/// 2. Info.plist keys (recommended for local development)
/// 3. Default placeholder values (for development only)
struct WeChatConfiguration {
    /// WeChat App ID
    /// Priority: Info.plist > Environment Variable > Default
    static var appID: String {
        // First try Info.plist
        if let appID = Bundle.main.object(forInfoDictionaryKey: "WECHAT_APP_ID") as? String,
           !appID.isEmpty {
            return appID
        }
        // Then try environment variable
        if let appID = ProcessInfo.processInfo.environment["WECHAT_APP_ID"],
           !appID.isEmpty {
            return appID
        }
        // Fall back to default (not configured)
        return WeChatConfiguration.placeholderAppID
    }

    /// WeChat App Secret
    /// Priority: Info.plist > Environment Variable > Default
    /// NOTE: App Secret should ONLY be stored in environment variables for security
    static var appSecret: String {
        // Only try environment variable for secret (more secure)
        if let secret = ProcessInfo.processInfo.environment["WECHAT_APP_SECRET"],
           !secret.isEmpty {
            return secret
        }
        // Fall back to default (not configured)
        return WeChatConfiguration.placeholderAppSecret
    }

    /// Universal Link for WeChat callback
    static var universalLink: String {
        // First try Info.plist
        if let link = Bundle.main.object(forInfoDictionaryKey: "WECHAT_UNIVERSAL_LINK") as? String,
           !link.isEmpty {
            return link
        }
        // Fall back to default
        return WeChatConfiguration.defaultUniversalLink
    }

    /// Placeholder App ID (returned when not configured)
    static let placeholderAppID = "YOUR_WECHAT_APP_ID"

    /// Placeholder App Secret (returned when not configured)
    static let placeholderAppSecret = "YOUR_WECHAT_APP_SECRET"

    /// Default Universal Link
    static let defaultUniversalLink = "https://api.trix3d.com/wechat/"

    /// Check if WeChat is properly configured
    static var isConfigured: Bool {
        return appID != placeholderAppID && appSecret != placeholderAppSecret
    }

    /// Log configuration warning if not properly configured
    static func validateConfiguration() {
        if !isConfigured {
            SecureLogger.shared.warning(
                "WeChatSignInService: WeChat is not configured. " +
                "Please set WECHAT_APP_ID and WECHAT_APP_SECRET environment variables " +
                "or add WECHAT_APP_ID to Info.plist. " +
                "WeChat Sign In will be disabled until properly configured."
            )
        } else {
            // Log that configuration is present (without exposing the actual values)
            SecureLogger.shared.debug("WeChatSignInService: Configuration validated successfully")
        }
    }
}

/// Protocol for WeChat SDK interaction
/// NOTE: This is a placeholder for the actual WeChat SDK (WXApi)
/// Replace with actual WeChat SDK when available
protocol WeChatSDKProtocol {
    static func registerApp(_ appID: String, universalLink: String?)
    static func isWXAppInstalled() -> Bool
    static func sendReq(_ req: Any) -> Bool
    static func handleOpen(_ url: URL) -> Bool
    static func getApiVersion() -> String?
}

// MARK: - WeChat SDK Placeholder

/// Placeholder implementation for WeChat SDK
/// Replace with actual WeChat OpenPlatform SDK when integrated
enum WeChatSDK: WeChatSDKProtocol {
    static func registerApp(_ appID: String, universalLink: String?) {
        // TODO: Replace with actual WeChat SDK call: WXApi.registerApp(appID, universalLink: universalLink)
        SecureLogger.shared.debug("WeChatSDK: Register app with ID \(appID)")
    }

    static func isWXAppInstalled() -> Bool {
        // Use URL Scheme to check if WeChat is installed
        guard let url = URL(string: "weixin://") else {
            SecureLogger.shared.warning("WeChatSDK: Invalid WeChat URL scheme")
            return false
        }

        // Security check: canOpenURL requires the scheme to be declared in Info.plist
        // Note: iOS 9+ requires LSApplicationQueriesSchemes to include "weixin"
        guard UIApplication.shared.canOpenURL(url) else {
            SecureLogger.shared.debug("WeChatSDK: WeChat app is not installed")
            return false
        }

        SecureLogger.shared.debug("WeChatSDK: WeChat app is installed")
        return true
    }

    static func sendReq(_ req: Any) -> Bool {
        // Use UIApplication to open WeChat
        // Note: In actual implementation, this would send a SendAuthReq through WXApi
        // For now, we open WeChat app using URL scheme for authorization flow
        guard let authURL = URL(string: "weixin://") else {
            SecureLogger.shared.warning("WeChatSDK: Invalid WeChat authorization URL")
            return false
        }

        // Security check: verify URL can be opened
        guard UIApplication.shared.canOpenURL(authURL) else {
            SecureLogger.shared.error("WeChatSDK: Cannot open WeChat URL - app may not be installed")
            return false
        }

        do {
            // Open WeChat app with options to handle the URL
            try UIApplication.shared.open(
                authURL,
                options: [:]
            ) { success in
                if success {
                    SecureLogger.shared.debug("WeChatSDK: Successfully opened WeChat app")
                } else {
                    SecureLogger.shared.warning("WeChatSDK: Failed to open WeChat app")
                }
            }
            return true
        } catch {
            SecureLogger.shared.error("WeChatSDK: Error opening WeChat: \(error.localizedDescription)")
            return false
        }
    }

    static func handleOpen(_ url: URL) -> Bool {
        // TODO: Replace with actual WeChat SDK call: WXApi.handleOpen(url, delegate: delegate)
        SecureLogger.shared.debug("WeChatSDK: Handle open URL: \(url)")
        return true
    }

    static func getApiVersion() -> String? {
        // TODO: Replace with actual WeChat SDK call: WXApi.getApiVersion()
        return "1.9.2" // Placeholder version
    }
}

// MARK: - WeChat Sign In Service

/// Service for managing WeChat Sign In
@MainActor
final class WeChatSignInService: NSObject, WeChatSignInServiceProtocol {

    // MARK: - Configuration

    /// Whether WeChat SDK is available
    var isAvailable: Bool {
        // Check if WeChat SDK is properly configured
        return WeChatConfiguration.isConfigured
    }

    /// Whether WeChat app is installed
    var isInstalled: Bool {
        return WeChatSDK.isWXAppInstalled()
    }

    /// Current WeChat SDK version
    var sdkVersion: String? {
        return WeChatSDK.getApiVersion()
    }

    /// Delegate for callbacks
    weak var delegate: WeChatSignInServiceDelegate?

    // MARK: - Private Properties

    /// Current sign-in continuation for async/await
    private var signInContinuation: CheckedContinuation<WeChatSignInResult, Never>?

    /// WeChat authorization code from callback
    private var authCode: String?

    /// WeChat state parameter for CSRF protection
    private var authState: String?

    // MARK: - Initialization

    private override init() {
        super.init()
        // Validate configuration on initialization
        WeChatConfiguration.validateConfiguration()
        registerWeChatApp()
    }

    // MARK: - Public Methods

    /// Sign in with WeChat
    /// - Returns: WeChat sign-in credential or error
    func signIn() async -> WeChatSignInResult {
        // Check if WeChat is available
        guard isAvailable else {
            return .failure(.notSupported)
        }

        // Check if WeChat is installed
        guard isInstalled else {
            return .failure(.notInstalled)
        }

        // Generate state parameter for CSRF protection
        authState = generateState()

        // Start async sign-in flow
        return await withCheckedContinuation { continuation in
            self.signInContinuation = continuation

            // Send WeChat authorization request
            let success = sendAuthRequest()

            if !success {
                let error = WeChatSignInError.authorizationFailed("Failed to send auth request")
                continuation.resume(returning: .failure(error))
                signInContinuation = nil
            }
        }
    }

    /// Refresh access token
    /// - Parameter refreshToken: The refresh token
    /// - Returns: New access token credential
    func refreshAccessToken(refreshToken: String) async -> WeChatSignInResult {
        guard isAvailable else {
            return .failure(.notSupported)
        }

        // Call WeChat API to refresh token
        // This requires making a network request to WeChat's OAuth endpoint
        do {
            let newCredential = try await performTokenRefresh(refreshToken)
            return .success(newCredential)
        } catch let error as WeChatSignInError {
            return .failure(error)
        } catch {
            return .failure(.unknown(error))
        }
    }

    /// Handle WeChat callback URL
    /// - Parameter url: The callback URL from WeChat
    /// - Returns: True if the URL was handled successfully
    func handleOpen(_ url: URL) -> Bool {
        // Check if this is a WeChat callback
        guard url.scheme == WeChatConfiguration.appID || url.absoluteString.hasPrefix("wx") else {
            return false
        }

        // Let WeChat SDK handle the URL
        let handled = WeChatSDK.handleOpen(url)

        if handled {
            // Parse the callback URL
            parseCallbackURL(url)
        }

        return handled
    }

    // MARK: - Private Methods

    /// Register WeChat app
    private func registerWeChatApp() {
        // Configuration is validated in init(), just register if configured
        guard WeChatConfiguration.isConfigured else {
            SecureLogger.shared.warning("WeChatSignInService: App ID not configured, skipping registration")
            return
        }

        WeChatSDK.registerApp(WeChatConfiguration.appID, universalLink: WeChatConfiguration.universalLink)
    }

    /// Send WeChat authorization request
    /// - Returns: True if request was sent successfully
    private func sendAuthRequest() -> Bool {
        // Build WeChat OAuth authorization URL
        // Format: https://open.weixin.qq.com/connect/oauth2/authorize?appid=APPID&redirect_uri=ENCODED_URI&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect

        guard let authState = authState else {
            SecureLogger.shared.error("WeChatSignInService: Auth state is missing")
            return false
        }

        // Build redirect URI - use universal link as callback
        // Note: This redirect_uri must be registered in WeChat Open Platform console
        let redirectURI = WeChatConfiguration.universalLink

        // URL encode the redirect URI
        guard let encodedRedirectURI = redirectURI.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else {
            SecureLogger.shared.error("WeChatSignInService: Failed to encode redirect URI")
            return false
        }

        // Build OAuth authorization URL
        let oauthURLString = "https://open.weixin.qq.com/connect/oauth2/authorize?appid=\(WeChatConfiguration.appID)&redirect_uri=\(encodedRedirectURI)&response_type=code&scope=snsapi_userinfo&state=\(authState)#wechat_redirect"

        guard let oauthURL = URL(string: oauthURLString) else {
            SecureLogger.shared.error("WeChatSignInService: Failed to create OAuth URL")
            return false
        }

        // Verify URL can be opened
        guard UIApplication.shared.canOpenURL(oauthURL) else {
            SecureLogger.shared.error("WeChatSignInService: Cannot open OAuth URL")
            return false
        }

        // Open WeChat authorization page
        SecureLogger.shared.debug("WeChatSignInService: Opening WeChat OAuth authorization page")

        do {
            try UIApplication.shared.open(oauthURL, options: [.universalLinksOnly: false]) { [weak self] success in
                if success {
                    SecureLogger.shared.debug("WeChatSignInService: Successfully opened WeChat authorization page")
                } else {
                    SecureLogger.shared.warning("WeChatSignInService: Failed to open WeChat authorization page")
                }
            }
            return true
        } catch {
            SecureLogger.shared.error("WeChatSignInService: Error opening OAuth URL: \(error.localizedDescription)")
            return false
        }
    }

    /// Parse WeChat callback URL
    /// - Parameter url: The callback URL
    private func parseCallbackURL(_ url: URL) {
        // Extract authorization code from URL
        // WeChat callback format: appID://oauth?code=CODE&state=STATE

        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let code = components?.queryItems?.first(where: { $0.name == "code" })?.value
        let state = components?.queryItems?.first(where: { $0.name == "state" })?.value

        // Validate state parameter
        guard state == authState else {
            completeSignIn(with: .failure(.authorizationFailed("Invalid state parameter")))
            return
        }

        guard let code = code, !code.isEmpty else {
            completeSignIn(with: .failure(.invalidCode))
            return
        }

        // Store auth code and exchange for access token
        authCode = code

        // Exchange code for access token
        Task {
            let result = await exchangeCodeForToken(code)
            completeSignIn(with: result)
        }
    }

    /// Exchange authorization code for access token
    /// - Parameter code: The authorization code
    /// - Returns: WeChat credential or error
    private func exchangeCodeForToken(_ code: String) async -> WeChatSignInResult {
        guard isAvailable else {
            return .failure(.notSupported)
        }

        do {
            // Call WeChat token endpoint
            let tokenURL = "https://api.weixin.qq.com/sns/oauth2/access_token"
            let parameters: [String: Any] = [
                "appid": WeChatConfiguration.appID,
                "secret": WeChatConfiguration.appSecret,
                "code": code,
                "grant_type": "authorization_code"
            ]

            // Create request
            var request = URLRequest(url: URL(string: tokenURL)!)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            // Encode parameters
            request.httpBody = try JSONSerialization.data(withJSONObject: parameters)

            // Perform request
            let (data, response) = try await URLSession.shared.data(for: request)

            // Validate response
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                return .failure(.invalidResponse)
            }

            // Parse response
            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                // Check for error
                if let errorCode = json["errcode"] as? Int, errorCode != 0 {
                    let errorMessage = json["errmsg"] as? String ?? "Unknown error"
                    return .failure(.authorizationFailed(errorMessage))
                }

                // Extract token data
                guard let openID = json["openid"] as? String,
                      let accessToken = json["access_token"] as? String,
                      let expiresIn = json["expires_in"] as? Int else {
                    return .failure(.invalidResponse)
                }

                let refreshToken = json["refresh_token"] as? String
                let unionID = json["unionid"] as? String
                let scope = json["scope"] as? String

                let credential = WeChatSignInCredential(
                    openID: openID,
                    accessToken: accessToken,
                    refreshToken: refreshToken,
                    expiresIn: expiresIn,
                    unionID: unionID,
                    scope: scope
                )

                return .success(credential)
            }

            return .failure(.invalidResponse)

        } catch {
            return .failure(.networkError(error))
        }
    }

    /// Perform token refresh
    /// - Parameter refreshToken: The refresh token
    /// - Returns: New credential or error
    private func performTokenRefresh(_ refreshToken: String) async throws -> WeChatSignInCredential {
        let tokenURL = "https://api.weixin.qq.com/sns/oauth2/refresh_token"
        let parameters: [String: Any] = [
            "appid": WeChatConfiguration.appID,
            "grant_type": "refresh_token",
            "refresh_token": refreshToken
        ]

        var request = URLRequest(url: URL(string: tokenURL)!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: parameters)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw WeChatSignInError.invalidResponse
        }

        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let errorCode = json["errcode"] as? Int, errorCode != 0 {
                let errorMessage = json["errmsg"] as? String ?? "Unknown error"
                throw WeChatSignInError.authorizationFailed(errorMessage)
            }

            guard let openID = json["openid"] as? String,
                  let accessToken = json["access_token"] as? String,
                  let expiresIn = json["expires_in"] as? Int else {
                throw WeChatSignInError.invalidResponse
            }

            let newRefreshToken = json["refresh_token"] as? String
            let unionID = json["unionid"] as? String
            let scope = json["scope"] as? String

            return WeChatSignInCredential(
                openID: openID,
                accessToken: accessToken,
                refreshToken: newRefreshToken ?? refreshToken,
                expiresIn: expiresIn,
                unionID: unionID,
                scope: scope
            )
        }

        throw WeChatSignInError.invalidResponse
    }

    /// Complete the sign-in flow with a result
    /// - Parameter result: The sign-in result
    private func completeSignIn(with result: WeChatSignInResult) {
        signInContinuation?.resume(returning: result)
        signInContinuation = nil
        authCode = nil
        authState = nil
    }

    /// Generate random state parameter for CSRF protection
    /// - Returns: Random state string
    private func generateState() -> String {
        let characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        return String((0..<32).map { _ in characters.randomElement()! })
    }
}

// MARK: - App Lifecycle Integration

extension WeChatSignInService {

    /// Should be called from AppDelegate application(_:open:options:)
    /// - Parameter url: The URL to handle
    /// - Returns: True if URL was handled
    func applicationDidOpen(_ url: URL) -> Bool {
        return handleOpen(url)
    }

    /// Should be called from SceneDelegate scene(_:openURLContexts:)
    /// - Parameter urlContexts: The URL contexts
    /// - Returns: True if URL was handled
    func sceneDidOpen(_ urlContexts: Set<UIOpenURLContext>) -> Bool {
        for context in urlContexts {
            if handleOpen(context.url) {
                return true
            }
        }
        return false
    }
}
