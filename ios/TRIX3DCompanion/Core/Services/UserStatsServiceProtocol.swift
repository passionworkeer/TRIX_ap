//
//  UserStatsServiceProtocol.swift
//  TRIX3DCompanion
//
//  Protocol for User Stats Service
//

import Foundation
import Combine

/// Stats period for querying stats
enum StatsPeriod: String, CaseIterable {
    case daily
    case weekly
    case monthly
    case yearly
    case all
}

/// Protocol defining user stats service interface
protocol UserStatsServiceProtocol {
    /// Current user stats
    var userStats: UserStats? { get }

    /// Current study stats
    var studyStats: StudyStats? { get }

    /// Whether currently loading stats
    var isLoading: Bool { get }

    /// Last error if any
    var lastError: UserStatsServiceError? { get }

    /// Fetch user statistics
    /// - Parameter userId: The user ID to fetch stats for
    /// - Returns: User statistics
    func getUserStats(userId: String) async throws -> UserStats

    /// Fetch study statistics for a period
    /// - Parameters:
    ///   - userId: The user ID to fetch stats for
    ///   - period: The stats period (daily, weekly, monthly, yearly, all)
    /// - Returns: Study statistics
    func getStudyStats(userId: String, period: StatsPeriod) async throws -> StudyStats
}
