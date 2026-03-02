//
//  RequestRetryManager.swift
//  TRIX3DCompanion
//
//  Request retry manager with exponential backoff
//

import Foundation
import Alamofire

/// Request retry manager with exponential backoff strategy
/// Implements intelligent retry logic for failed network requests
final class RequestRetryManager {

    // MARK: - Singleton

    static let shared = RequestRetryManager()

    // MARK: - Types

    /// Retry policy configuration
    struct RetryPolicy {
        /// Maximum number of retry attempts
        let maxAttempts: Int

        /// Initial delay before first retry (in seconds)
        let initialDelay: TimeInterval

        /// Maximum delay between retries (in seconds)
        let maxDelay: TimeInterval

        /// Multiplier for exponential backoff
        let backoffMultiplier: Double

        /// HTTP status codes that should trigger a retry
        let retryableStatusCodes: Set<Int>

        /// Network error types that should trigger a retry
        let retryableErrors: Set<NetworkError>

        /// Default retry policy
        static let `default` = RetryPolicy(
            maxAttempts: 3,
            initialDelay: 1.0,
            maxDelay: 10.0,
            backoffMultiplier: 2.0,
            retryableStatusCodes: [408, 429, 500, 502, 503, 504],
            retryableErrors: [.noConnection, .timeout]
        )

        /// Aggressive retry policy for critical operations
        static let aggressive = RetryPolicy(
            maxAttempts: 5,
            initialDelay: 0.5,
            maxDelay: 15.0,
            backoffMultiplier: 1.5,
            retryableStatusCodes: [408, 429, 500, 502, 503, 504],
            retryableErrors: [.noConnection, .timeout]
        )

        /// Conservative retry policy for non-critical operations
        static let conservative = RetryPolicy(
            maxAttempts: 2,
            initialDelay: 2.0,
            maxDelay: 5.0,
            backoffMultiplier: 2.0,
            retryableStatusCodes: [500, 502, 503, 504],
            retryableErrors: [.noConnection, .timeout]
        )
    }

    /// Retry attempt information
    struct RetryAttempt {
        let attemptNumber: Int
        let delay: TimeInterval
        let error: Error
    }

    // MARK: - Properties

    /// Current retry policy
    private(set) var policy: RetryPolicy

    /// Track retry attempts by request ID
    private var retryAttempts: [String: [RetryAttempt]] = [:]

    /// Lock for thread-safe access
    private let lock = NSLock()

    // MARK: - Initialization

    private init(policy: RetryPolicy = .default) {
        self.policy = policy
    }

    // MARK: - Public Methods

    /// Update retry policy
    /// - Parameter policy: New retry policy
    func updatePolicy(_ policy: RetryPolicy) {
        lock.lock()
        defer { lock.unlock() }
        self.policy = policy
        SecureLogger.shared.info("Retry policy updated: maxAttempts=\(policy.maxAttempts)")
    }

    /// Calculate delay for next retry attempt
    /// - Parameter attemptNumber: Current attempt number (0-indexed)
    /// - Returns: Delay in seconds before next retry
    func calculateDelay(forAttempt attemptNumber: Int) -> TimeInterval {
        let exponentialDelay = policy.initialDelay * pow(policy.backoffMultiplier, Double(attemptNumber))
        return min(exponentialDelay, policy.maxDelay)
    }

    /// Check if request should be retried
    /// - Parameters:
    ///   - request: The failed request
    ///   - error: The error that occurred
    /// - Returns: True if request should be retried
    func shouldRetry(
        request: URLRequest,
        dueTo error: Error,
        currentAttempt: Int
    ) -> Bool {
        // Check if we've exceeded max attempts
        guard currentAttempt < policy.maxAttempts else {
            return false
        }

        // Check if error is retryable
        if let networkError = error as? NetworkError {
            return policy.retryableErrors.contains(networkError)
        }

        // Check if status code is retryable
        if let httpError = error as? AFError,
           let statusCode = httpError.responseCode {
            return policy.retryableStatusCodes.contains(statusCode)
        }

        return false
    }

    /// Record retry attempt
    /// - Parameters:
    ///   - requestId: Unique identifier for the request
    ///   - attempt: Retry attempt information
    func recordAttempt(requestId: String, attempt: RetryAttempt) {
        lock.lock()
        defer { lock.unlock() }

        if retryAttempts[requestId] == nil {
            retryAttempts[requestId] = []
        }
        retryAttempts[requestId]?.append(attempt)
    }

    /// Get retry attempts for a request
    /// - Parameter requestId: Unique identifier for the request
    /// - Returns: Array of retry attempts
    func getAttempts(forRequestId requestId: String) -> [RetryAttempt] {
        lock.lock()
        defer { lock.unlock() }
        return retryAttempts[requestId] ?? []
    }

    /// Clear retry attempts for a request
    /// - Parameter requestId: Unique identifier for the request
    func clearAttempts(forRequestId requestId: String) {
        lock.lock()
        defer { lock.unlock() }
        retryAttempts.removeValue(forKey: requestId)
    }

    /// Clear all retry attempts
    func clearAllAttempts() {
        lock.lock()
        defer { lock.unlock() }
        retryAttempts.removeAll()
    }
}

// MARK: - RequestInterceptor Extension

extension RequestRetryManager: RequestInterceptor {

    /// Retry request using exponential backoff
    /// - Parameters:
    ///   - request: The request to retry
    ///   - session: The URL session
    ///   - error: The error that occurred
    ///   - completion: Completion handler with retry decision
    func retry(
        _ request: Request,
        for session: Session,
        dueTo error: Error,
        completion: @escaping (RetryResult) -> Void
    ) {
        let currentAttempt = request.retryCount

        guard let urlRequest = request.request,
              shouldRetry(request: urlRequest, dueTo: error, currentAttempt: currentAttempt) else {
            completion(.doNotRetry)
            return
        }

        let delay = calculateDelay(forAttempt: currentAttempt)
        let requestId = request.id.uuidString

        // Record this attempt
        let attempt = RequestRetryManager.RetryAttempt(
            attemptNumber: currentAttempt + 1,
            delay: delay,
            error: error
        )
        recordAttempt(requestId: requestId, attempt: attempt)

        // Log retry
        SecureLogger.shared.warning(
            "Retrying request (attempt \(currentAttempt + 1)/\(policy.maxAttempts)) after \(delay)s delay"
        )

        // Retry after calculated delay
        DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + delay) {
            completion(.retry)
        }
    }
}

// MARK: - Convenience Extensions

extension RequestRetryManager {

    /// Execute async operation with retry logic
    /// - Parameters:
    ///   - operation: Async operation to execute
    ///   - policy: Retry policy to use
    /// - Returns: Result of the operation
    func executeWithRetry<T>(
        operation: @escaping () async throws -> T,
        policy: RetryPolicy = .default
    ) async throws -> T {
        var lastError: Error?

        for attempt in 0..<policy.maxAttempts {
            do {
                return try await operation()
            } catch {
                lastError = error

                // Check if we should retry
                guard attempt < policy.maxAttempts - 1 else {
                    break
                }

                if let networkError = error as? NetworkError,
                   policy.retryableErrors.contains(networkError) {
                    // Wait before retrying
                    let delay = calculateDelay(forAttempt: attempt)
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                    continue
                }

                // Non-retryable error
                throw error
            }
        }

        throw lastError ?? NetworkError.unknown(nil)
    }
}
