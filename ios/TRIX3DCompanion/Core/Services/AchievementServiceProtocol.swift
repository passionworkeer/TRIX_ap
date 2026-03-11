//
//  AchievementServiceProtocol.swift
//  TRIX3DCompanion
//
//  Protocol for AchievementService
//

import Foundation

/// Protocol defining achievement service interface
@MainActor
protocol AchievementServiceProtocol {
    /// All achievements
    var achievements: [Achievement] { get }

    /// Whether an operation is in progress
    var isLoading: Bool { get }

    /// Fetch all achievements with user progress
    func fetchAchievements() async throws -> [Achievement]

    /// Check and unlock achievements based on current user stats
    func checkAndUnlock() async throws -> AchievementCheckResponse
}
