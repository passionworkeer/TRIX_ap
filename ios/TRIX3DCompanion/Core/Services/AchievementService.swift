//
//  AchievementService.swift
//  TRIX3DCompanion
//
//  Achievement service for managing user achievements
//

import Foundation
import Combine

// MARK: - Achievement Service Error

enum AchievementServiceError: Error, LocalizedError {
    case fetchFailed(underlying: Error)
    case unlockFailed(underlying: Error)
    case checkFailed(underlying: Error)
    case unknown(underlying: Error?)

    var errorDescription: String? {
        switch self {
        case .fetchFailed(let error):
            return "Failed to fetch achievements: \(error.localizedDescription)"
        case .unlockFailed(let error):
            return "Failed to unlock achievement: \(error.localizedDescription)"
        case .checkFailed(let error):
            return "Failed to check achievements: \(error.localizedDescription)"
        case .unknown(let error):
            return error?.localizedDescription ?? "Unknown error"
        }
    }
}

// MARK: - Achievement Service

@MainActor
final class AchievementService: ObservableObject, AchievementServiceProtocol {

    static let shared = AchievementService()

    // MARK: - Published Properties

    @Published private(set) var achievements: [Achievement] = []
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var lastError: AchievementServiceError?

    // MARK: - Dependencies

    private let apiClient: APIClient

    // MARK: - Initialization

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - Public Methods

    /// Fetch all achievements with user progress
    func fetchAchievements() async throws -> [Achievement] {
        isLoading = true
        lastError = nil

        do {
            let response: [Achievement] = try await apiClient.get(.achievementList)
            self.achievements = response
            isLoading = false
            return response
        } catch {
            let serviceError = AchievementServiceError.fetchFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Check and unlock achievements based on current user stats
    func checkAndUnlock() async throws -> AchievementCheckResponse {
        isLoading = true
        lastError = nil

        do {
            let response: AchievementCheckResponse = try await apiClient.post(.achievementCheck)
            // Refresh achievements list after check
            let unlocked = response.newlyUnlocked
            for achievement in unlocked {
                if !self.achievements.contains(where: { $0.id == achievement.id }) {
                    self.achievements.append(achievement)
                }
            }
            isLoading = false
            return response
        } catch {
            let serviceError = AchievementServiceError.checkFailed(underlying: error)
            lastError = serviceError
            isLoading = false
            throw serviceError
        }
    }

    /// Get achievement by ID
    func achievement(byId id: String) -> Achievement? {
        return achievements.first { $0.id == id }
    }

    /// Get achievements by category
    func achievements(byCategory category: AchievementCategory) -> [Achievement] {
        return achievements.filter { $0.category == category }
    }

    /// Get achievements by rarity
    func achievements(byRarity rarity: AchievementRarity) -> [Achievement] {
        return achievements.filter { $0.rarity == rarity }
    }

    /// Get unlocked achievements
    func unlockedAchievements() -> [Achievement] {
        return achievements.filter { $0.unlockedAt != nil }
    }

    /// Get locked achievements
    func lockedAchievements() -> [Achievement] {
        return achievements.filter { $0.unlockedAt == nil }
    }
}
