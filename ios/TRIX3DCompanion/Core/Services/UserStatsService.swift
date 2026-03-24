//
//  UserStatsService.swift
//  TRIX3DCompanion
//
//  User Stats Service - Manages user and study statistics
//

import Foundation
import Combine

// MARK: - Error Types

/// User Stats Service error types
enum UserStatsServiceError: Error, LocalizedError {
    case notAuthenticated
    case userNotFound
    case invalidPeriod
    case networkError(underlying: Error)
    case unknown(underlying: Error?)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "You must be logged in to view stats"
        case .userNotFound:
            return "User not found"
        case .invalidPeriod:
            return "Invalid stats period"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .unknown(let error):
            return error?.localizedDescription ?? "An unknown error occurred"
        }
    }
}

// MARK: - Type Aliases

/// Type alias for API parameters
private typealias Parameters = [String: Any]

// MARK: - Service Implementation

/// Main service handling user and study statistics
@MainActor
final class UserStatsService: ObservableObject, UserStatsServiceProtocol {

    // MARK: - Singleton

    static let shared = UserStatsService()

    // MARK: - Published Properties

    /// Current user stats
    @Published private(set) var userStats: UserStats?

    /// Current study stats
    @Published private(set) var studyStats: StudyStats?

    /// Whether currently loading stats
    @Published private(set) var isLoading: Bool = false

    /// Last error if any
    @Published private(set) var lastError: UserStatsServiceError?

    // MARK: - Dependencies

    private let apiClient: APIClientProtocol
    private let authService: AuthServiceProtocol

    // MARK: - Private Properties

    /// Cancellables for Combine subscriptions
    private var cancellables = Set<AnyCancellable>()

    /// Cache for stats
    private var statsCache: [String: CachedStats] = [:]

    /// Cache duration (5 minutes)
    private let cacheDuration: TimeInterval = 5 * 60

    // MARK: - Cached Stats Structure

    private struct CachedStats {
        let data: Any
        let timestamp: Date

        func isExpired(duration: TimeInterval) -> Bool {
            return Date().timeIntervalSince(timestamp) > duration
        }
    }

    // MARK: - Initialization

    /// Initialize with dependencies
    /// - Parameters:
    ///   - apiClient: API client instance (defaults to shared)
    ///   - authService: Auth service instance (defaults to shared)
    init(
        apiClient: APIClientProtocol? = nil,
        authService: AuthServiceProtocol? = nil
    ) {
        self.apiClient = apiClient ?? APIClient.shared
        self.authService = authService ?? AuthService.shared
    }

    // MARK: - Public Methods

    /// Fetch user statistics
    /// - Parameter userId: The user ID to fetch stats for
    /// - Returns: User statistics
    func getUserStats(userId: String) async throws -> UserStats {
        // Verify authentication
        guard authService.isLoggedIn else {
            let error = UserStatsServiceError.notAuthenticated
            lastError = error
            throw error
        }

        // Check cache first
        let cacheKey = "userStats_\(userId)"
        if let cached = statsCache[cacheKey], !cached.isExpired(duration: cacheDuration) {
            if let stats = cached.data as? UserStats {
                userStats = stats
                return stats
            }
        }

        isLoading = true
        lastError = nil

        do {
            let stats = try await apiClient.getUserStats()

            // Update local state
            userStats = stats

            // Cache the result
            statsCache[cacheKey] = CachedStats(data: stats, timestamp: Date())

            isLoading = false
            SecureLogger.shared.info("Fetched user stats for: \(userId)")

            return stats

        } catch let error as NetworkError {
            isLoading = false
            let serviceError = mapNetworkError(error)
            lastError = serviceError
            SecureLogger.shared.error("Failed to fetch user stats: \(error.localizedDescription)")
            throw serviceError
        } catch {
            isLoading = false
            let serviceError = UserStatsServiceError.unknown(underlying: error)
            lastError = serviceError
            SecureLogger.shared.error("Failed to fetch user stats: \(error.localizedDescription)")
            throw serviceError
        }
    }

    /// Fetch study statistics for a period
    /// - Parameters:
    ///   - userId: The user ID to fetch stats for
    ///   - period: The stats period (daily, weekly, monthly, yearly, all)
    /// - Returns: Study statistics
    func getStudyStats(userId: String, period: StatsPeriod) async throws -> StudyStats {
        // Verify authentication
        guard authService.isLoggedIn else {
            let error = UserStatsServiceError.notAuthenticated
            lastError = error
            throw error
        }

        // Validate period
        guard period != .all else {
            // For "all" period, fetch total stats
            return try await getAllTimeStats(userId: userId)
        }

        // Check cache first
        let cacheKey = "studyStats_\(userId)_\(period.rawValue)"
        if let cached = statsCache[cacheKey], !cached.isExpired(duration: cacheDuration) {
            if let stats = cached.data as? StudyStats {
                studyStats = stats
                return stats
            }
        }

        isLoading = true
        lastError = nil

        do {
            // Determine the appropriate endpoint based on period
            let endpoint: APIEndpoint
            switch period {
            case .daily:
                endpoint = .studyStats
            case .weekly:
                endpoint = .weeklyStudyData
            case .monthly, .yearly, .all:
                // Use weekly as fallback for now
                endpoint = .weeklyStudyData
            }

            // Fetch from API with query parameters
            let params: Parameters = ["period": period.rawValue]
            let stats: StudyStats = try await apiClient.get(endpoint, parameters: params)

            // Update local state
            studyStats = stats

            // Cache the result
            statsCache[cacheKey] = CachedStats(data: stats, timestamp: Date())

            isLoading = false
            SecureLogger.shared.info("Fetched study stats for \(userId), period: \(period.rawValue)")

            return stats

        } catch let error as NetworkError {
            isLoading = false
            let serviceError = mapNetworkError(error)
            lastError = serviceError
            SecureLogger.shared.error("Failed to fetch study stats: \(error.localizedDescription)")
            throw serviceError
        } catch {
            isLoading = false
            let serviceError = UserStatsServiceError.unknown(underlying: error)
            lastError = serviceError
            SecureLogger.shared.error("Failed to fetch study stats: \(error.localizedDescription)")
            throw serviceError
        }
    }

    // MARK: - Private Methods

    /// Get all-time statistics
    private func getAllTimeStats(userId: String) async throws -> StudyStats {
        // For "all" period, create a combined stats object
        // This is a placeholder - the actual implementation might call a different API
        return try await getStudyStats(userId: userId, period: .yearly)
    }

    /// Map network errors to service errors
    private func mapNetworkError(_ error: NetworkError) -> UserStatsServiceError {
        switch error {
        case .noConnection, .timeout:
            return .networkError(underlying: error)
        case .unauthorized:
            return .notAuthenticated
        case .notFound:
            return .userNotFound
        default:
            return .unknown(underlying: error)
        }
    }

    /// Clear cache for a specific user
    func clearCache(for userId: String) {
        let keysToRemove = statsCache.keys.filter { $0.hasPrefix("userStats_\(userId)") || $0.hasPrefix("studyStats_\(userId)") }
        for key in keysToRemove {
            statsCache.removeValue(forKey: key)
        }
    }

    /// Clear all cache
    func clearAllCache() {
        statsCache.removeAll()
    }
}

// MARK: - Convenience Methods

extension UserStatsService {

    /// Get stats for current user
    func getCurrentUserStats() async throws -> UserStats {
        guard let userId = authService.currentUser?.id else {
            let error = UserStatsServiceError.notAuthenticated
            lastError = error
            throw error
        }
        return try await getUserStats(userId: userId)
    }

    /// Get study stats for current user
    func getCurrentUserStudyStats(period: StatsPeriod) async throws -> StudyStats {
        guard let userId = authService.currentUser?.id else {
            let error = UserStatsServiceError.notAuthenticated
            lastError = error
            throw error
        }
        return try await getStudyStats(userId: userId, period: period)
    }

    /// Get today's stats
    func getTodayStats() async throws -> StudyStats {
        return try await getCurrentUserStudyStats(period: .daily)
    }

    /// Get this week's stats
    func getWeeklyStats() async throws -> StudyStats {
        return try await getCurrentUserStudyStats(period: .weekly)
    }

    /// Get this month's stats
    func getMonthlyStats() async throws -> StudyStats {
        return try await getCurrentUserStudyStats(period: .monthly)
    }

    /// Get formatted total study time
    var formattedTotalTime: String {
        guard let stats = userStats else { return "0h" }
        let hours = stats.totalStudyTime / 60
        return "\(hours)h"
    }

    /// Get formatted today's study time
    var formattedTodayTime: String {
        guard let stats = userStats else { return "0m" }
        let minutes = stats.todayDuration
        if minutes >= 60 {
            let hours = minutes / 60
            let mins = minutes % 60
            return "\(hours)h \(mins)m"
        }
        return "\(minutes)m"
    }

    /// Get current streak
    var currentStreak: Int {
        return userStats?.streakDays ?? 0
    }

    /// Clear error state
    func clearError() {
        lastError = nil
    }

    /// Refresh all stats for current user
    func refresh() async throws {
        clearAllCache()
        _ = try await getCurrentUserStats()
        _ = try await getCurrentUserStudyStats(period: .weekly)
    }
}
