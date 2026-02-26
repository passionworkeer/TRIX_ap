//
//  PointsHistoryViewModel.swift
//  TRIX3DCompanion
//
//  Points history feature ViewModel - manages points transactions
//

import Foundation
import Combine

// MARK: - Points History View Model

/// Points history view model managing points transactions and pagination
@MainActor
final class PointsHistoryViewModel: ObservableObject {

    // MARK: - Published Properties

    /// Current points balance
    @Published private(set) var pointsBalance: PointsResponse?

    /// Points transactions
    @Published private(set) var transactions: [PointsTransaction] = []

    /// Whether currently loading
    @Published private(set) var isLoading: Bool = false

    /// Whether loading more pages
    @Published private(set) var isLoadingMore: Bool = false

    /// Whether has more pages to load
    @Published private(set) var hasMorePages: Bool = true

    /// Error message to display
    @Published var errorMessage: String?

    /// Current page number
    private var currentPage: Int = 1

    /// Page size
    private let pageSize: Int = 20

    // MARK: - Dependencies

    private let apiClient: APIClient
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    /// Initialize PointsHistoryViewModel
    /// - Parameter apiClient: API client dependency
    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - Public Methods

    /// Load initial data
    func loadData() async {
        await loadPointsBalance()
        await loadTransactions(reset: true)
    }

    /// Load points balance
    func loadPointsBalance() async {
        do {
            pointsBalance = try await apiClient.getPoints()
        } catch {
            handleError(error)
        }
    }

    /// Load transactions
    /// - Parameter reset: Whether to reset to first page
    func loadTransactions(reset: Bool = false) async {
        if reset {
            currentPage = 1
            transactions = []
            hasMorePages = true
        }

        guard !isLoading && !isLoadingMore && hasMorePages else {
            return
        }

        if currentPage == 1 {
            isLoading = true
        } else {
            isLoadingMore = true
        }

        errorMessage = nil

        do {
            let newTransactions = try await apiClient.getPointsHistory(
                page: currentPage,
                limit: pageSize
            )

            if reset {
                transactions = newTransactions
            } else {
                transactions.append(contentsOf: newTransactions)
            }

            // Check if there are more pages
            hasMorePages = newTransactions.count >= pageSize

            if hasMorePages {
                currentPage += 1
            }

        } catch {
            handleError(error)
        }

        isLoading = false
        isLoadingMore = false
    }

    /// Load more transactions (pagination)
    func loadMore() async {
        await loadTransactions(reset: false)
    }

    /// Refresh data
    func refresh() async {
        await loadData()
    }

    /// Clear error
    func clearError() {
        errorMessage = nil
    }

    // MARK: - Computed Properties

    /// Total points
    var totalPoints: Int {
        pointsBalance?.totalPoints ?? 0
    }

    /// User level
    var level: Int {
        pointsBalance?.level ?? 1
    }

    /// Points earned today
    var todayEarned: Int {
        pointsBalance?.todayEarned ?? 0
    }

    /// Points earned this week
    var weekEarned: Int {
        pointsBalance?.weekEarned ?? 0
    }

    /// Total transactions count
    var totalTransactions: Int {
        pointsBalance?.totalTransactions ?? 0
    }

    /// Progress to next level (0-1)
    var progressToNextLevel: Double {
        let currentLevelPoints = (level - 1) * 1000
        let nextLevelPoints = level * 1000
        let progress = Double(totalPoints - currentLevelPoints) / Double(nextLevelPoints - currentLevelPoints)
        return max(0, min(1, progress))
    }

    /// Points needed for next level
    var pointsToNextLevel: Int {
        let nextLevelPoints = level * 1000
        return max(0, nextLevelPoints - totalPoints)
    }

    // MARK: - Helper Methods

    /// Get icon for transaction type
    /// - Parameter type: Transaction type
    /// - Returns: SF Symbol name
    func iconForTransactionType(_ type: TransactionType) -> String {
        switch type {
        case .studyComplete:
            return "book.fill"
        case .studyStreak:
            return "flame.fill"
        case .dailyLogin:
            return "calendar.badge.checkmark"
        case .achievement:
            return "trophy.fill"
        case .socialShare:
            return "square.and.arrow.up.fill"
        case .redeem:
            return "gift.fill"
        case .adminAdjust:
            return "gearshape.fill"
        }
    }

    /// Get color for transaction type
    /// - Parameter type: Transaction type
    /// - Returns: Color for the transaction
    func colorForTransactionType(_ type: TransactionType) -> Color {
        switch type {
        case .studyComplete:
            return .blue
        case .studyStreak:
            return .orange
        case .dailyLogin:
            return .green
        case .achievement:
            return .yellow
        case .socialShare:
            return .purple
        case .redeem:
            return .pink
        case .adminAdjust:
            return .gray
        }
    }

    /// Format transaction date
    /// - Parameter date: Date to format
    /// - Returns: Formatted date string
    func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    /// Group transactions by date
    /// - Returns: Dictionary with date strings as keys and transaction arrays as values
    func groupedTransactions() -> [(String: [PointsTransaction])] {
        let calendar = Calendar.current
        var grouped: [String: [PointsTransaction]] = [:]

        for transaction in transactions {
            let key = calendar.startOfDay(for: transaction.createdAt)
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d, yyyy"

            if calendar.isDateInToday(transaction.createdAt) {
                let keyString = "Today"
                if grouped[keyString] == nil {
                    grouped[keyString] = []
                }
                grouped[keyString]?.append(transaction)
            } else if calendar.isDateInYesterday(transaction.createdAt) {
                let keyString = "Yesterday"
                if grouped[keyString] == nil {
                    grouped[keyString] = []
                }
                grouped[keyString]?.append(transaction)
            } else {
                let keyString = formatter.string(from: key)
                if grouped[keyString] == nil {
                    grouped[keyString] = []
                }
                grouped[keyString]?.append(transaction)
            }
        }

        return grouped.map { [$0.key: $0.value] }
    }

    // MARK: - Private Methods

    /// Handle error
    /// - Parameter error: Error to handle
    private func handleError(_ error: Error) {
        if let networkError = error as? NetworkError {
            errorMessage = networkError.errorDescription
        } else {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension PointsHistoryViewModel {
    /// Create preview view model with sample data
    static var preview: PointsHistoryViewModel {
        let vm = PointsHistoryViewModel()
        vm.pointsBalance = PointsResponse(
            totalPoints: 2450,
            level: 3,
            todayEarned: 150,
            weekEarned: 520,
            totalTransactions: 45
        )
        vm.transactions = [
            PointsTransaction(
                id: "1",
                pointsChange: 50,
                type: .studyComplete,
                description: "Completed 30-minute study session",
                balanceAfter: 2450,
                createdAt: Date().addingTimeInterval(-3600)
            ),
            PointsTransaction(
                id: "2",
                pointsChange: 100,
                type: .studyStreak,
                description: "7-day study streak achieved!",
                balanceAfter: 2400,
                createdAt: Date().addingTimeInterval(-86400)
            ),
            PointsTransaction(
                id: "3",
                pointsChange: 20,
                type: .dailyLogin,
                description: "Daily login bonus",
                balanceAfter: 2300,
                createdAt: Date().addingTimeInterval(-172800)
            ),
            PointsTransaction(
                id: "4",
                pointsChange: -200,
                type: .redeem,
                description: "Redeemed premium theme",
                balanceAfter: 2280,
                createdAt: Date().addingTimeInterval(-259200)
            )
        ]
        return vm
    }
}
#endif
