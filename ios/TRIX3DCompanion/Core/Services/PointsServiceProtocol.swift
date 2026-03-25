//
//  PointsServiceProtocol.swift
//  TRIX3DCompanion
//
//  Protocol defining points service interface for points management
//

import Foundation

// MARK: - Points Types

/// Points transaction type
enum PointsTransactionType: String, Codable {
    case earned = "earned"
    case purchased = "purchased"
    case redeemed = "redeemed"
    case refund = "refund"
    case bonus = "bonus"
    case admin = "admin"
    case subscription = "subscription"
}

/// Detailed points transaction
struct PointsTransactionDetail: Identifiable, Codable, Equatable {
    let id: String
    let userId: String
    let pointsChange: Int
    let balanceBefore: Int
    let balanceAfter: Int
    let type: PointsTransactionType
    let description: String
    let orderId: String?
    let metadata: [String: String]?
    let createdAt: Date

    var isPositive: Bool {
        pointsChange > 0
    }

    var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        formatter.locale = Locale(identifier: "zh_CN")
        return formatter.string(from: createdAt)
    }
}

/// Points balance information
struct PointsBalance: Codable, Equatable {
    let totalPoints: Int
    let availablePoints: Int
    let pendingPoints: Int
    let level: Int
    let todayEarned: Int
    let weekEarned: Int
    let totalTransactions: Int
    let updatedAt: Date

    /// Points needed for next level
    func pointsForNextLevel() -> Int {
        let nextLevel = level + 1
        return nextLevel * 1000 - totalPoints
    }

    /// Progress towards next level (0.0 to 1.0)
    func progressToNextLevel() -> Double {
        let currentLevelPoints = level * 1000
        let nextLevelPoints = (level + 1) * 1000
        let progress = Double(totalPoints - currentLevelPoints) / Double(nextLevelPoints - currentLevelPoints)
        return max(0, min(1, progress))
    }
}

/// Points operation result
enum PointsResult {
    case success(balance: PointsBalance)
    case insufficientBalance
    case invalidAmount
    case failed(error: PointsError)

    var isSuccess: Bool {
        if case .success = self {
            return true
        }
        return false
    }
}

/// Points errors
enum PointsError: Error, LocalizedError, Equatable {
    case insufficientBalance
    case invalidAmount
    case syncFailed
    case networkError
    case unauthorized
    case serverError(message: String)
    case unknown(Error?)

    static func == (lhs: PointsError, rhs: PointsError) -> Bool {
        switch (lhs, rhs) {
        case (.insufficientBalance, .insufficientBalance),
             (.invalidAmount, .invalidAmount),
             (.syncFailed, .syncFailed),
             (.networkError, .networkError),
             (.unauthorized, .unauthorized):
            return true
        case let (.serverError(lhsMsg), .serverError(rhsMsg)):
            return lhsMsg == rhsMsg
        case (.unknown, .unknown):
            return true
        default:
            return false
        }
    }

    var errorDescription: String? {
        switch self {
        case .insufficientBalance:
            return "Insufficient points balance"
        case .invalidAmount:
            return "Invalid points amount"
        case .syncFailed:
            return "Failed to sync points"
        case .networkError:
            return "Network error. Please check your connection"
        case .unauthorized:
            return "Please log in to continue"
        case .serverError(let message):
            return message
        case .unknown(let error):
            return error?.localizedDescription ?? "An unknown error occurred"
        }
    }
}

/// Points history filter
struct PointsHistoryFilter {
    var type: PointsTransactionType?
    var startDate: Date?
    var endDate: Date?
    var limit: Int = 50
    var offset: Int = 0
}

// MARK: - Points Service Protocol

/// Protocol defining points service interface
@MainActor
protocol PointsServiceProtocol: ObservableObject {

    /// Current points balance
    var balance: PointsBalance? { get }

    /// Points transaction history
    var transactions: [PointsTransactionDetail] { get }

    /// Whether currently loading
    var isLoading: Bool { get }

    /// Whether currently syncing
    var isSyncing: Bool { get }

    /// Last error if any
    var lastError: PointsError? { get }

    /// Refresh points balance from server
    /// - Returns: Result with updated balance
    func refreshPoints() async -> Result<PointsBalance, PointsError>

    /// Get points balance
    /// - Returns: Current balance or nil if not loaded
    func getBalance() async -> PointsBalance?

    /// Load transaction history
    /// - Parameter filter: Optional filter to apply
    /// - Returns: Result with transactions
    func loadHistory(filter: PointsHistoryFilter?) async -> Result<[PointsTransactionDetail], PointsError>

    /// Add points (for testing/admin purposes)
    /// - Parameters:
    ///   - points: Points to add
    ///   - description: Description of the addition
    ///   - metadata: Additional metadata
    /// - Returns: Result with updated balance
    func addPoints(
        _ points: Int,
        description: String,
        metadata: [String: String]?
    ) async -> PointsResult

    /// Deduct points
    /// - Parameters:
    ///   - points: Points to deduct
    ///   - description: Description of the deduction
    ///   - metadata: Additional metadata
    /// - Returns: Result with updated balance
    func deductPoints(
        _ points: Int,
        description: String,
        metadata: [String: String]?
    ) async -> PointsResult

    /// Sync points with server
    /// - Returns: Result indicating success or failure
    func syncWithServer() async -> Result<Void, PointsError>

    /// Clear error state
    func clearError()
}

// MARK: - Points Calculator

/// Points calculation utilities
enum PointsCalculator {
    /// Calculate points for study session completion
    static func pointsForStudySession(durationMinutes: Int) -> Int {
        // Base points: 1 point per minute
        var points = durationMinutes

        // Bonus points for longer sessions
        if durationMinutes >= 60 {
            points += 10 // 10 bonus points for 1+ hour
        }
        if durationMinutes >= 120 {
            points += 20 // Additional 20 bonus points for 2+ hours
        }

        return points
    }

    /// Calculate points for daily login
    static func pointsForDailyLogin(streakDays: Int) -> Int {
        // Base 5 points + 1 point per streak day (max 20)
        let streakBonus = min(streakDays, 15)
        return 5 + streakBonus
    }

    /// Calculate points for achievement
    static func pointsForAchievement(achievementId: String) -> Int {
        // Different achievements award different points
        switch achievementId {
        case "first_study":
            return 10
        case "week_streak":
            return 50
        case "month_streak":
            return 200
        case "perfect_day":
            return 20
        default:
            return 10
        }
    }

    /// Format points for display
    static func formatPoints(_ points: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "zh_CN")
        return formatter.string(from: NSNumber(value: points)) ?? "\(points)"
    }
}
