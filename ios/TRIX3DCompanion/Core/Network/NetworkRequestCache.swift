//
//  NetworkRequestCache.swift
//  TRIX3DCompanion
//
//  HTTP request caching for improved network performance
//
//  Features:
//  - In-memory response cache
//  - Cache expiration policies
//  - Conditional requests (ETag/Last-Modified)
//  - Request deduplication
//

import Foundation
import Alamofire

/// Network request cache manager
final class NetworkRequestCache {

    // MARK: - Singleton

    static let shared = NetworkRequestCache()

    // MARK: - Types

    enum CachePolicy {
        case noCache
        case memoryOnly(duration: TimeInterval)
        case diskAndMemory(duration: TimeInterval)
    }

    private struct CachedResponse {
        let response: URLResponse
        let data: Data
        let timestamp: Date
        let etag: String?
        let lastModified: String?
        var accessCount: Int
    }

    // MARK: - Properties

    private var cache: [String: CachedResponse] = [:]
    private let queue = DispatchQueue(label: "com.trix3d.requestcache", attributes: .concurrent)
    private var defaultPolicy: CachePolicy = .memoryOnly(duration: 300) // 5 minutes

    // Memory limit (50MB)
    private let memoryLimit: UInt64 = 50 * 1024 * 1024
    private var currentMemoryUsage: UInt64 = 0

    // Request deduplication
    private var inFlightRequests: [String: Task<Any, Error>] = [:]
    private let flightQueue = DispatchQueue(label: "com.trix3d.requestflight")

    // MARK: - Initialization

    private init() {}

    // MARK: - Public Methods

    /// Set default cache policy
    func setDefaultPolicy(_ policy: CachePolicy) {
        defaultPolicy = policy
    }

    /// Get cached response for a request
    func getCachedResponse(for request: URLRequest) -> CachedURLResponse? {
        let key = cacheKey(for: request)

        var cached: CachedResponse?
        queue.sync {
            cached = cache[key]
        }

        guard var entry = cached else { return nil }

        // Check expiration
        let duration: TimeInterval
        switch defaultPolicy {
        case .noCache:
            return nil
        case .memoryOnly(let seconds), .diskAndMemory(let seconds):
            duration = seconds
        }

        if Date().timeIntervalSince(entry.timestamp) > duration {
            // Cache expired
            removeCachedResponse(for: request)
            return nil
        }

        // Update access metadata
        queue.async(flags: .barrier) { [weak self] in
            guard let self = self else { return }
            self.cache[key]?.accessCount += 1
        }

        // Add conditional headers if available
        var mutableRequest = request
        if let etag = entry.etag {
            mutableRequest.setValue(etag, forHTTPHeaderField: "If-None-Match")
        }
        if let lastModified = entry.lastModified {
            mutableRequest.setValue(lastModified, forHTTPHeaderField: "If-Modified-Since")
        }

        return CachedURLResponse(
            response: entry.response,
            data: entry.data
        )
    }

    /// Cache a response
    func cacheResponse(_ response: CachedURLResponse, for request: URLRequest) {
        guard defaultPolicy != .noCache else { return }

        let key = cacheKey(for: request)

        // Extract cache headers
        let etag = response.response.urlHeader?.value(for: "ETag")
        let lastModified = response.response.urlHeader?.value(for: "Last-Modified")

        queue.async(flags: .barrier) { [weak self] in
            guard let self = self else { return }

            // Remove old entry if exists
            if let oldEntry = self.cache.removeValue(forKey: key) {
                self.currentMemoryUsage -= UInt64(oldEntry.data.count)
            }

            // Add new entry
            let entry = CachedResponse(
                response: response.response,
                data: response.data,
                timestamp: Date(),
                etag: etag,
                lastModified: lastModified,
                accessCount: 1
            )

            self.cache[key] = entry
            self.currentMemoryUsage += UInt64(response.data.count)

            // Enforce memory limit
            self.evictIfNeeded()
        }
    }

    /// Remove cached response for a request
    func removeCachedResponse(for request: URLRequest) {
        let key = cacheKey(for: request)

        queue.async(flags: .barrier) { [weak self] in
            guard let self = self else { return }

            if let entry = self.cache.removeValue(forKey: key) {
                self.currentMemoryUsage -= UInt64(entry.data.count)
            }
        }
    }

    /// Clear all cached responses
    func clearCache() {
        queue.async(flags: .barrier) { [weak self] in
            guard let self = self else { return }

            self.cache.removeAll()
            self.currentMemoryUsage = 0
        }
    }

    /// Get cache statistics
    func getCacheStats() -> CacheStats {
        var stats = CacheStats()
        queue.sync {
            stats.entryCount = cache.count
            stats.memoryUsage = currentMemoryUsage
            stats.memoryLimit = memoryLimit
            stats.totalAccesses = cache.values.reduce(0) { $0 + $1.accessCount }
        }
        return stats
    }

    // MARK: - Private Methods

    private func cacheKey(for request: URLRequest) -> String {
        // Create cache key from method and URL
        var key = "\(request.httpMethod ?? "GET"):\(request.url?.absoluteString ?? "")"

        // Include query parameters
        if let url = request.url, let query = url.query {
            key += "?\(query)"
        }

        return key
    }

    private func evictIfNeeded() {
        guard currentMemoryUsage > memoryLimit else { return }

        // LRU eviction
        let sortedKeys = cache.sorted { lhs, rhs in
            let lhsScore = lhs.value.accessCount * 1000 + lhs.value.timestamp.timeIntervalSince1970
            let rhsScore = rhs.value.accessCount * 1000 + rhs.value.timestamp.timeIntervalSince1970
            return lhsScore < rhsScore
        }.map { $0.key }

        for key in sortedKeys {
            guard currentMemoryUsage > memoryLimit * 80 / 100 else { break }

            if let entry = cache.removeValue(forKey: key) {
                currentMemoryUsage -= UInt64(entry.data.count)
            }
        }
    }

    // MARK: - Types

    struct CacheStats {
        var entryCount: Int = 0
        var memoryUsage: UInt64 = 0
        var memoryLimit: UInt64 = 0
        var totalAccesses: Int = 0
        var memoryUsagePercent: Double {
            guard memoryLimit > 0 else { return 0 }
            return Double(memoryUsage) / Double(memoryLimit)
        }
    }
}

// MARK: - URLResponse Extension

private extension URLResponse {
    var urlHeader: HTTPURLResponse? {
        self as? HTTPURLResponse
    }
}

private extension HTTPURLResponse {
    func value(for header: String) -> String? {
        allHeaderFields[header] as? String
    }
}

// MARK: - Cache Policy Helpers

extension NetworkRequestCache {

    /// Get cache policy for specific endpoint
    func cachePolicy(for endpoint: APIEndpoint) -> CachePolicy {
        switch endpoint {
        // GET requests for static data - longer cache
        case .getUserProfile, .getStudyRoomInfo:
            return .memoryOnly(duration: 600) // 10 minutes

        // GET requests for dynamic data - shorter cache
        case .getChatRooms, .getChatMessages:
            return .memoryOnly(duration: 60) // 1 minute

        // POST/PUT/DELETE - no cache
        default:
            return .noCache
        }
    }
}

// MARK: - Request Deduplication

extension NetworkRequestCache {

    /// Execute request with deduplication
    func executeWithDeduplication<T>(
        for request: URLRequest,
        execution: @escaping () async throws -> T
    ) async throws -> T {
        let key = cacheKey(for: request)

        // Check if request is already in flight
        flightQueue.sync {
            if let existingTask = inFlightRequests[key] {
                // Request is in flight, wait for it
                Task {
                    let result = try await existingTask.value as? T
                    return result
                }
            }
        }

        // Execute new request
        let task = Task {
            return try await execution()
        }

        flightQueue.sync {
            inFlightRequests[key] = task as? Task<Any, Error>
        }

        defer {
            flightQueue.sync {
                inFlightRequests.removeValue(forKey: key)
            }
        }

        let result = try await task.value
        guard let typedResult = result as? T else {
            throw NetworkError.typeMismatch("Failed to cast response to expected type")
        }
        return typedResult
    }
}
