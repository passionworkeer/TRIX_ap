//
//  RequestDeduplicator.swift
//  TRIX3DCompanion
//
//  Request deduplication manager to prevent duplicate requests
//

import Foundation
import Alamofire

/// Request deduplication manager
/// Prevents duplicate in-flight requests to the same endpoint
final class RequestDeduplicator: @unchecked Sendable {

    // MARK: - Singleton

    static let shared = RequestDeduplicator()

    // MARK: - Types

    /// Request key for deduplication
    struct RequestKey: Hashable {
        let method: String
        let path: String
        let parametersHash: Int
        let bodyHash: Int?

        init(method: HTTPMethod, path: String, parameters: [String: Any]?, body: Data?) {
            self.method = method.rawValue
            self.path = path
            self.parametersHash = Self.hashParameters(parameters)
            self.bodyHash = body?.hashValue
        }

        /// Compute stable hash for [String: Any] dictionary
        private static func hashParameters(_ parameters: [String: Any]?) -> Int {
            guard let params = parameters else { return 0 }
            var hasher = Hasher()
            // Sort keys for stable hashing
            for key in params.keys.sorted() {
                hasher.combine(key)
                if let value = params[key] {
                    // Handle common types
                    if let stringValue = value as? String {
                        hasher.combine(stringValue)
                    } else if let intValue = value as? Int {
                        hasher.combine(intValue)
                    } else if let doubleValue = value as? Double {
                        hasher.combine(doubleValue)
                    } else if let boolValue = value as? Bool {
                        hasher.combine(boolValue)
                    } else {
                        // For other types, use their description
                        hasher.combine(String(describing: value))
                    }
                }
            }
            return hasher.finalize()
        }

        func hash(into hasher: inout Hasher) {
            hasher.combine(method)
            hasher.combine(path)
            hasher.combine(parametersHash)
            if let bodyHash = bodyHash {
                hasher.combine(bodyHash)
            }
        }

        static func == (lhs: RequestKey, rhs: RequestKey) -> Bool {
            return lhs.method == rhs.method &&
                   lhs.path == rhs.path &&
                   lhs.parametersHash == rhs.parametersHash &&
                   lhs.bodyHash == rhs.bodyHash
        }
    }

    /// Pending request information
    struct PendingRequest {
        let key: RequestKey
        let task: Task<Void, Never>
        let createdAt: Date

        var isExpired: Bool {
            Date().timeIntervalSince(createdAt) > 30.0 // 30 second timeout
        }
    }

    /// Configure deduplication for specific endpoint types
    enum DeduplicationScope {
        /// Deduplicate all requests
        case all

        /// Only deduplicate GET requests (safe operations)
        case safeOnly

        /// Only deduplicate POST/PUT/PATCH requests (mutations)
        case mutationsOnly

        /// No deduplication
        case none
    }

    // MARK: - Properties

    /// Currently pending requests
    private var pendingRequests: [RequestKey: PendingRequest] = [:]

    /// Lock for thread-safe access
    private let lock = NSLock()

    /// Enable deduplication
    private(set) var isEnabled: Bool

    /// Current deduplication scope
    private(set) var scope: DeduplicationScope = .safeOnly

    // MARK: - Initialization

    private init() {
        // Enable deduplication by default
        self.isEnabled = true

        // Start cleanup timer
        startCleanupTimer()
    }

    // MARK: - Public Methods

    /// Enable or disable request deduplication
    /// - Parameter enabled: Whether to enable deduplication
    func setEnabled(_ enabled: Bool) {
        lock.lock()
        defer { lock.unlock() }
        isEnabled = enabled
        SecureLogger.shared.info("Request deduplication \(enabled ? "enabled" : "disabled")")
    }

    /// Check if request should be deduplicated
    /// - Parameter key: Request key
    /// - Returns: True if request is a duplicate
    func isDuplicate(key: RequestKey) -> Bool {
        guard isEnabled else { return false }

        lock.lock()
        defer { lock.unlock() }

        // Clean up expired requests first
        cleanupExpired()

        return pendingRequests[key] != nil
    }

    /// Register a pending request
    /// - Parameters:
    ///   - key: Request key
    ///   - task: Task that completes when request finishes
    func registerRequest(key: RequestKey, task: Task<Void, Never>) {
        guard isEnabled else { return }

        lock.lock()
        defer { lock.unlock() }

        let pending = PendingRequest(
            key: key,
            task: task,
            createdAt: Date()
        )

        pendingRequests[key] = pending

        // Auto-remove when task completes
        Task {
            await task.value
            removeRequest(key: key)
        }
    }

    /// Remove a completed request
    /// - Parameter key: Request key
    func removeRequest(key: RequestKey) {
        lock.lock()
        defer { lock.unlock() }
        pendingRequests.removeValue(forKey: key)
    }

    /// Create request key from URLRequest
    /// - Parameter request: URL request
    /// - Returns: Request key for deduplication
    func makeKey(from request: URLRequest) -> RequestKey {
        let methodRaw = request.httpMethod ?? "GET"
        let method = HTTPMethod(rawValue: methodRaw) ?? .get
        let path = request.url?.path ?? ""

        // Use body data directly
        let bodyData: Data? = request.httpBody?.isEmpty == false ? request.httpBody : nil

        return RequestKey(method: method, path: path, parameters: nil, body: bodyData)
    }

    /// Create request key from components
    /// - Parameters:
    ///   - endpoint: API endpoint
    ///   - method: HTTP method
    ///   - parameters: Request parameters
    /// - Returns: Request key for deduplication
    func makeKey(
        from endpoint: APIEndpoint,
        method: HTTPMethod,
        parameters: [String: Any]?
    ) -> RequestKey {
        let path = endpoint.path
        return RequestKey(method: method, path: path, parameters: parameters, body: nil)
    }

    /// Get count of pending requests
    var pendingCount: Int {
        lock.lock()
        defer { lock.unlock() }
        return pendingRequests.count
    }

    /// Clear all pending requests
    func clearAll() {
        lock.lock()
        defer { lock.unlock() }
        pendingRequests.removeAll()
    }

    /// Update deduplication scope
    /// - Parameter newScope: New scope to apply
    func updateScope(_ newScope: DeduplicationScope) {
        lock.lock()
        defer { lock.unlock() }
        self.scope = newScope
        SecureLogger.shared.info("Deduplication scope updated: \(newScope)")
    }

    /// Check if endpoint should be deduplicated based on current scope
    /// - Parameters:
    ///   - endpoint: API endpoint
    ///   - method: HTTP method
    /// - Returns: True if should deduplicate
    func shouldDeduplicate(endpoint: APIEndpoint, method: HTTPMethod) -> Bool {
        guard isEnabled else { return false }

        switch scope {
        case .all:
            return true

        case .safeOnly:
            return method == .get

        case .mutationsOnly:
            return method == .post || method == .put || method == .patch

        case .none:
            return false
        }
    }

    // MARK: - Private Methods

    /// Clean up expired requests
    private func cleanupExpired() {
        let expiredKeys = pendingRequests.filter { $0.value.isExpired }.map { $0.key }
        for key in expiredKeys {
            pendingRequests.removeValue(forKey: key)
        }
    }

    /// Start periodic cleanup timer
    private func startCleanupTimer() {
        Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { [weak self] _ in
            self?.cleanupExpired()
        }
    }
}

// MARK: - Request Adapter Extension

extension RequestDeduplicator: RequestAdapter {

    /// Adapt request to check for duplicates
    func adapt(
        _ urlRequest: URLRequest,
        for session: Session,
        completion: @escaping (Result<URLRequest, Error>) -> Void
    ) {
        guard isEnabled else {
            completion(.success(urlRequest))
            return
        }

        let key = makeKey(from: urlRequest)

        if isDuplicate(key: key) {
            // Request is a duplicate - return error
            let error = NetworkError.custom(
                message: "Duplicate request in flight"
            )
            completion(.failure(error))
            return
        }

        // Register this request
        let task = Task {}
        registerRequest(key: key, task: task)

        completion(.success(urlRequest))
    }
}
