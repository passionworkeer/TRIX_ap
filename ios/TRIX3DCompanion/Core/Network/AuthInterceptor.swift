//
//  AuthInterceptor.swift
//  TRIX3DCompanion
//
//  Authentication interceptor for Alamofire
//  Automatically handles token refresh on 401 responses
//

import Foundation
import Alamofire

/// Authentication interceptor for automatic token management
/// Implements Alamofire's RequestInterceptor to automatically:
/// 1. Add Authorization headers to requests
/// 2. Handle 401 responses by refreshing tokens
/// 3. Retry failed requests with new tokens
final class AuthInterceptor: RequestInterceptor {

    // MARK: - Properties

    /// Shared keychain manager for token storage
    private let keychainManager: KeychainManager

    /// Retry limit for token refresh attempts
    /// Prevents infinite loops in case refresh keeps failing
    private let maxRetryCount: Int

    /// Lock for thread-safe token refresh
    private let lock = NSLock()

    /// Track ongoing refresh operations to prevent concurrent refreshes
    private var isRefreshing = false

    /// Queue of requests waiting for token refresh
    private var requestsToRetry: [(RetryResult) -> Void] = []

    // MARK: - Initialization

    /// Initialize the auth interceptor
    /// - Parameters:
    ///   - keychainManager: Keychain manager for token storage (defaults to shared)
    ///   - maxRetryCount: Maximum number of retry attempts for token refresh
    init(keychainManager: KeychainManager = .shared, maxRetryCount: Int = 1) {
        self.keychainManager = keychainManager
        self.maxRetryCount = maxRetryCount
    }

    // MARK: - RequestAdapter

    /// Adapts the request by adding authentication headers
    /// Called before each request is sent
    /// - Parameters:
    ///   - urlRequest: The URL request to adapt
    ///   - session: The URL session
    ///   - completion: Completion handler with adapted request or error
    func adapt(
        _ urlRequest: URLRequest,
        for session: Session,
        completion: @escaping (Result<URLRequest, Error>) -> Void
    ) {
        // Skip adaptation for auth endpoints (they don't need tokens)
        if let url = urlRequest.url?.absoluteString,
           url.contains("/auth/login") || url.contains("/auth/register") || url.contains("/auth/refresh") {
            completion(.success(urlRequest))
            return
        }

        // Add Authorization header if we have a token
        if let accessToken = keychainManager.getAccessToken() {
            var request = urlRequest
            request.setValue(
                "Bearer \(accessToken)",
                forHTTPHeaderField: "Authorization"
            )
            completion(.success(request))
        } else {
            // No token available - proceed without auth
            // The API will return 401 and trigger retry
            completion(.success(urlRequest))
        }
    }

    // MARK: - RequestRetrier

    /// Retry policy for handling authentication failures
    /// Called when a request fails, typically with 401 Unauthorized
    /// - Parameters:
    ///   - request: The failed request
    ///   - session: The URL session
    ///   - error: The error that caused the failure
    ///   - completion: Completion handler with retry decision
    func retry(
        _ request: Request,
        for session: Session,
        dueTo error: Error,
        completion: @escaping (RetryResult) -> Void
    ) {
        // Only handle authentication errors (401)
        guard let response = request.task?.response as? HTTPURLResponse,
              response.statusCode == 401 else {
            // Not a 401 error - don't retry
            completion(.doNotRetry)
            return
        }

        // Check if we've exceeded retry limit
        let retryCount = request.retryCount
        guard retryCount < maxRetryCount else {
            // Already retried too many times
            completion(.doNotRetry)
            return
        }

        // Check if we have a refresh token
        guard keychainManager.getRefreshToken() != nil else {
            // No refresh token - can't refresh, require re-login
            // Notify app to clear session
            NotificationCenter.default.post(
                name: .authSessionExpired,
                object: nil
            )
            completion(.doNotRetry)
            return
        }

        // Thread-safe token refresh
        lock.lock()
        if isRefreshing {
            // Another refresh is in progress - queue this request
            requestsToRetry.append(completion)
            lock.unlock()
            return
        }

        isRefreshing = true
        lock.unlock()

        // Perform token refresh
        refreshToken { [weak self] result in
            guard let self = self else {
                completion(.doNotRetry)
                return
            }

            self.lock.lock()

            // Retry all queued requests
            let requests = self.requestsToRetry
            self.requestsToRetry.removeAll()
            self.isRefreshing = false

            self.lock.unlock()

            switch result {
            case .success:
                // Token refresh successful - retry original request
                completion(.retry)

                // Retry all queued requests
                for retryCompletion in requests {
                    retryCompletion(.retry)
                }

            case .failure:
                // Token refresh failed - clear session and notify app
                self.clearTokens()
                NotificationCenter.default.post(
                    name: .authSessionExpired,
                    object: nil
                )

                // Don't retry any requests
                completion(.doNotRetry)
                for retryCompletion in requests {
                    retryCompletion(.doNotRetry)
                }
            }
        }
    }

    // MARK: - Private Methods

    /// Perform token refresh
    /// - Parameter completion: Completion handler with result
    private func refreshToken(completion: @escaping (Result<Void, Error>) -> Void) {
        guard let refreshToken = keychainManager.getRefreshToken() else {
            completion(.failure(AuthInterceptorError.noRefreshToken))
            return
        }

        // Build refresh request
        let baseURL = APIBaseURL.current
        let urlString = "\(baseURL)/auth/refresh"

        guard let url = URL(string: urlString) else {
            completion(.failure(AuthInterceptorError.invalidURL))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let refreshRequestBody = RefreshTokenRequest(refreshToken: refreshToken)

        do {
            request.httpBody = try JSONEncoder().encode(refreshRequestBody)
        } catch {
            completion(.failure(error))
            return
        }

        // Perform token refresh using URLSession (to avoid circular dependency with Alamofire)
        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else {
                completion(.failure(AuthInterceptorError.unknown))
                return
            }

            if let error = error {
                completion(.failure(error))
                return
            }

            guard let httpResponse = response as? HTTPURLResponse else {
                completion(.failure(AuthInterceptorError.invalidResponse))
                return
            }

            guard httpResponse.statusCode == 200 else {
                if httpResponse.statusCode == 401 {
                    // Refresh token expired
                    completion(.failure(AuthInterceptorError.refreshTokenExpired))
                } else {
                    completion(.failure(AuthInterceptorError.serverError(httpResponse.statusCode)))
                }
                return
            }

            guard let data = data else {
                completion(.failure(AuthInterceptorError.noData))
                return
            }

            do {
                // Configure JSON decoder with ISO8601 date strategy
                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                decoder.keyDecodingStrategy = .convertFromSnakeCase

                let authResponse = try decoder.decode(AuthResponse.self, from: data)

                // Save new tokens
                try self.keychainManager.saveAccessToken(authResponse.session.accessToken)
                try self.keychainManager.saveRefreshToken(authResponse.session.refreshToken)

                completion(.success(()))
            } catch {
                completion(.failure(error))
            }
        }

        task.resume()
    }

    /// Clear all authentication tokens
    private func clearTokens() {
        try? keychainManager.deleteAccessToken()
        try? keychainManager.deleteRefreshToken()
        try? keychainManager.deleteSessionToken()
    }
}

// MARK: - Supporting Types

/// Errors that can occur during authentication interception
enum AuthInterceptorError: Error, LocalizedError {
    case noRefreshToken
    case invalidURL
    case invalidResponse
    case noData
    case refreshTokenExpired
    case serverError(Int)
    case unknown

    var errorDescription: String? {
        switch self {
        case .noRefreshToken:
            return "No refresh token available"
        case .invalidURL:
            return "Invalid refresh token URL"
        case .invalidResponse:
            return "Invalid server response"
        case .noData:
            return "No data in response"
        case .refreshTokenExpired:
            return "Refresh token has expired. Please log in again."
        case .serverError(let code):
            return "Server error: \(code)"
        case .unknown:
            return "Unknown error during token refresh"
        }
    }
}

// MARK: - Notification Names

extension Notification.Name {
    /// Posted when the user's session has expired and re-authentication is required
    static let authSessionExpired = Notification.Name("com.trix3d.authSessionExpired")
}

// MARK: - Request Body

/// Request body for token refresh endpoint
private struct RefreshTokenRequest: Codable {
    let refreshToken: String

    enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }
}
