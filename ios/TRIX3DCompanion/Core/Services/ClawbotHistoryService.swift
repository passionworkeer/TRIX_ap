//
//  ClawbotHistoryService.swift
//  TRIX3DCompanion
//
//  Clawbot History Service - Manages Clawbot chat history with local caching
//

import Foundation
import Combine

// MARK: - Type Aliases

/// Type alias for API parameters
private typealias HistoryParameters = [String: Any]

// MARK: - Error Types

/// Clawbot History Service error types
enum ClawbotHistoryServiceError: Error, LocalizedError {
    case notAuthenticated
    case roomNotFound
    case networkError(underlying: Error)
    case cacheError(underlying: Error)
    case clearFailed(underlying: Error)
    case unknown(underlying: Error?)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "You must be logged in to access chat history"
        case .roomNotFound:
            return "Chat room not found"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .cacheError(let error):
            return "Cache error: \(error.localizedDescription)"
        case .clearFailed(let error):
            return "Failed to clear history: \(error.localizedDescription)"
        case .unknown(let error):
            return error?.localizedDescription ?? "An unknown error occurred"
        }
    }
}

// MARK: - Service Implementation

/// Main service handling Clawbot chat history with local persistence
@MainActor
final class ClawbotHistoryService: ObservableObject, ClawbotHistoryServiceProtocol {

    // MARK: - Singleton

    static let shared = ClawbotHistoryService()

    // MARK: - Published Properties

    /// Current chat history for the selected room
    @Published private(set) var history: [ChatMessage] = []

    /// Whether currently loading history
    @Published private(set) var isLoading: Bool = false

    /// Last error if any
    @Published private(set) var lastError: ClawbotHistoryServiceError?

    // MARK: - Dependencies

    private let apiClient: APIClient
    private let offlineCacheService: OfflineCacheServiceProtocol
    private let authService: AuthService

    // MARK: - Private Properties

    /// Cache key prefix
    private let cacheKeyPrefix = "clawbot_history_"

    /// Default page size
    private let defaultLimit = 50

    // MARK: - Initialization

    /// Initialize with dependencies
    /// - Parameters:
    ///   - apiClient: API client instance (defaults to shared)
    ///   - offlineCacheService: Cache service instance (defaults to shared)
    ///   - authService: Auth service instance (defaults to shared)
    init(
        apiClient: APIClient? = nil,
        offlineCacheService: OfflineCacheServiceProtocol? = nil,
        authService: AuthService? = nil
    ) {
        self.apiClient = apiClient ?? .shared
        self.offlineCacheService = offlineCacheService ?? OfflineCacheService.shared
        self.authService = authService ?? .shared
    }

    // MARK: - Public Methods

    /// Fetch chat history for a specific room
    /// - Parameters:
    ///   - roomId: The room ID to fetch history for
    ///   - limit: Maximum number of messages to fetch (defaults to 50)
    ///   - offset: Offset for pagination (defaults to 0)
    /// - Returns: Array of chat messages
    func getHistory(roomId: String, limit: Int = 50, offset: Int = 0) async throws -> [ChatMessage] {
        // Verify authentication
        guard authService.isLoggedIn else {
            let error = ClawbotHistoryServiceError.notAuthenticated
            lastError = error
            throw error
        }

        isLoading = true
        lastError = nil

        do {
            // Fetch from API
            let params: HistoryParameters = ["limit": limit, "offset": offset]
            let messages: [ChatMessage] = try await apiClient.get(
                .clawbotHistory(roomId: roomId),
                parameters: params
            )

            // Update local state
            if offset == 0 {
                history = messages
            } else {
                // Append for pagination
                let existingIds = Set(history.map { $0.id })
                let newMessages = messages.filter { !existingIds.contains($0.id) }
                history.append(contentsOf: newMessages)
            }

            // Cache the result
            try? await offlineCacheService.cache(
                history,
                forKey: "\(cacheKeyPrefix)\(roomId)",
                type: .messages
            )

            isLoading = false
            SecureLogger.shared.info("Fetched \(messages.count) messages for room: \(roomId)")

            return messages

        } catch let error as NetworkError {
            isLoading = false
            let serviceError = mapNetworkError(error)
            lastError = serviceError
            SecureLogger.shared.error("Failed to fetch history: \(error.localizedDescription)")
            throw serviceError
        } catch {
            isLoading = false
            let serviceError = ClawbotHistoryServiceError.unknown(underlying: error)
            lastError = serviceError
            SecureLogger.shared.error("Failed to fetch history: \(error.localizedDescription)")
            throw serviceError
        }
    }

    /// Clear history for a specific room
    /// - Parameter roomId: The room ID to clear history for
    func clearHistory(roomId: String) async throws {
        isLoading = true
        lastError = nil

        do {
            // Clear from cache
            try await offlineCacheService.remove(
                key: "\(cacheKeyPrefix)\(roomId)",
                type: .messages
            )

            // Clear local state if this is the current room
            if history.first?.roomId == roomId {
                history = []
            }

            isLoading = false
            SecureLogger.shared.info("Cleared history for room: \(roomId)")

        } catch {
            isLoading = false
            let serviceError = ClawbotHistoryServiceError.clearFailed(underlying: error)
            lastError = serviceError
            SecureLogger.shared.error("Failed to clear history: \(error.localizedDescription)")
            throw serviceError
        }
    }

    /// Get cached history for offline access
    /// - Parameter roomId: The room ID to get cached history for
    /// - Returns: Array of cached chat messages
    func getCachedHistory(roomId: String) async throws -> [ChatMessage] {
        do {
            let messages: [ChatMessage] = try await offlineCacheService.retrieve(
                key: "\(cacheKeyPrefix)\(roomId)",
                type: .messages
            )

            // Update local state with cached data
            if history.first?.roomId != roomId {
                history = messages
            }

            SecureLogger.shared.info("Retrieved \(messages.count) cached messages for room: \(roomId)")
            return messages

        } catch let error as CacheError {
            let serviceError = ClawbotHistoryServiceError.cacheError(underlying: error)
            lastError = serviceError
            throw serviceError
        } catch {
            let serviceError = ClawbotHistoryServiceError.cacheError(underlying: error)
            lastError = serviceError
            throw serviceError
        }
    }

    // MARK: - Private Methods

    /// Map network errors to service errors
    private func mapNetworkError(_ error: NetworkError) -> ClawbotHistoryServiceError {
        switch error {
        case .noConnection, .timeout:
            return .networkError(underlying: error)
        case .unauthorized:
            return .notAuthenticated
        case .notFound:
            return .roomNotFound
        default:
            return .unknown(underlying: error)
        }
    }
}

// MARK: - Convenience Methods

extension ClawbotHistoryService {

    /// Get history with pagination
    /// - Parameters:
    ///   - roomId: The room ID
    ///   - limit: Number of messages per page
    /// - Returns: Next page of messages
    func loadMoreHistory(roomId: String, limit: Int = 50) async throws -> [ChatMessage] {
        let offset = history.count
        return try await getHistory(roomId: roomId, limit: limit, offset: offset)
    }

    /// Check if there are more messages to load
    var hasMoreHistory: Bool {
        // This would need to be tracked based on API response
        return true
    }

    /// Clear error state
    func clearError() {
        lastError = nil
    }

    /// Refresh history for current room
    func refreshHistory(roomId: String) async throws -> [ChatMessage] {
        history = []
        return try await getHistory(roomId: roomId, limit: defaultLimit, offset: 0)
    }
}
