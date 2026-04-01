//
//  PointsService.swift
//  TRIX3DCompanion
//
//  Points service implementation for points management
//

import Foundation
import Combine

protocol PointsServiceUserDefaultsStore {
    func getData(forKey key: String) -> Data?
    func setData(_ data: Data, forKey key: String)
}

protocol PointsMutationServiceProtocol {
    func applyPointsChange(
        points delta: Int,
        transactionType: TransactionType,
        description: String,
        metadata: [String: String]?
    ) async throws -> PointsResponse
}

// MARK: - Points Service

/// Main points service handling all points operations
@MainActor
final class PointsService: ObservableObject, PointsServiceProtocol {

    // MARK: - Singleton

    static let shared = PointsService()

    // MARK: - Published Properties

    /// Current points balance
    @Published private(set) var balance: PointsBalance?

    /// Points transaction history
    @Published private(set) var transactions: [PointsTransactionDetail] = []

    /// Whether currently loading
    @Published private(set) var isLoading: Bool = false

    /// Whether currently syncing
    @Published private(set) var isSyncing: Bool = false

    /// Last error if any
    @Published private(set) var lastError: PointsError?

    // MARK: - Dependencies

    private let apiClient: any APIClientProtocol
    private let userDefaults: any PointsServiceUserDefaultsStore
    private let pointsMutationService: any PointsMutationServiceProtocol

    // MARK: - Private Properties

    /// Cached transactions
    private var cachedTransactions: [String: PointsTransactionDetail] = [:]

    /// Last sync timestamp
    private var lastSyncTimestamp: Date?

    /// Sync interval (5 minutes)
    private let syncInterval: TimeInterval = 300

    /// Cancellables for Combine subscriptions
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    /// Initialize with dependencies
    /// - Parameters:
    ///   - apiClient: API client instance
    ///   - userDefaults: UserDefaults manager instance
    ///   - pointsMutationService: Points mutation backend
    ///   - enablePeriodicSync: Whether periodic sync timer should start
    ///   - performInitialRefresh: Whether service should refresh points on init
    init(
        apiClient: any APIClientProtocol = APIClient.shared,
        userDefaults: any PointsServiceUserDefaultsStore = UserDefaultsManager.shared,
        pointsMutationService: any PointsMutationServiceProtocol = SupabaseService.shared,
        enablePeriodicSync: Bool = true,
        performInitialRefresh: Bool = true
    ) {
        self.apiClient = apiClient
        self.userDefaults = userDefaults
        self.pointsMutationService = pointsMutationService

        // Load cached balance
        loadCachedBalance()

        // Setup periodic sync
        if enablePeriodicSync {
            setupPeriodicSync()
        }

        // Initial load
        if performInitialRefresh {
            Task {
                await refreshPoints()
            }
        }
    }

    // MARK: - Setup

    /// Setup periodic background sync
    private func setupPeriodicSync() {
        // Sync every 5 minutes when app is active
        Timer.publish(every: syncInterval, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                Task {
                    await self?.syncWithServer()
                }
            }
            .store(in: &cancellables)
    }

    // MARK: - Public Methods

    /// Refresh points balance from server
    /// - Returns: Result with updated balance
    func refreshPoints() async -> Result<PointsBalance, PointsError> {
        isLoading = true
        lastError = nil

        do {
            // Fetch points from API
            let response = try await apiClient.getPoints()

            // Convert to PointsBalance
            let pointsBalance = PointsBalance(
                totalPoints: response.totalPoints,
                availablePoints: response.totalPoints, // Assuming all points are available
                pendingPoints: 0,
                level: response.level,
                todayEarned: response.todayEarned,
                weekEarned: response.weekEarned,
                totalTransactions: response.totalTransactions,
                updatedAt: Date()
            )

            // Update balance
            balance = pointsBalance

            // Cache balance
            cacheBalance(pointsBalance)

            isLoading = false
            lastSyncTimestamp = Date()

            return .success(pointsBalance)

        } catch let error as NetworkError {
            isLoading = false
            let pointsError = mapNetworkError(error)
            lastError = pointsError
            return .failure(pointsError)

        } catch {
            isLoading = false
            let pointsError = PointsError.unknown(error)
            lastError = pointsError
            return .failure(pointsError)
        }
    }

    /// Get points balance
    /// - Returns: Current balance or nil if not loaded
    func getBalance() async -> PointsBalance? {
        // Check if needs refresh
        if let lastSync = lastSyncTimestamp {
            let timeSinceSync = Date().timeIntervalSince(lastSync)
            if timeSinceSync > syncInterval {
                _ = await refreshPoints()
            }
        } else {
            _ = await refreshPoints()
        }

        return balance
    }

    /// Load transaction history
    /// - Parameter filter: Optional filter to apply
    /// - Returns: Result with transactions
    func loadHistory(filter: PointsHistoryFilter? = nil) async -> Result<[PointsTransactionDetail], PointsError> {
        isLoading = true
        lastError = nil

        do {
            let limit = filter?.limit ?? 50
            let offset = filter?.offset ?? 0

            // Fetch history from API
            let apiTransactions: [PointsTransaction] = try await apiClient.getPointsHistory(
                page: (offset / limit) + 1,
                limit: limit
            )

            // Convert to detailed transactions
            let detailedTransactions = apiTransactions.map { apiTx in
                PointsTransactionDetail(
                    id: apiTx.id,
                    userId: "",
                    pointsChange: apiTx.pointsChange,
                    balanceBefore: 0, // API doesn't provide this
                    balanceAfter: apiTx.balanceAfter,
                    type: mapTransactionType(apiTx.type),
                    description: apiTx.description,
                    orderId: nil,
                    metadata: nil,
                    createdAt: apiTx.createdAt
                )
            }

            // Update cached transactions
            for transaction in detailedTransactions {
                cachedTransactions[transaction.id] = transaction
            }

            // Apply filters if provided
            var filtered = detailedTransactions
            if let typeFilter = filter?.type {
                filtered = filtered.filter { $0.type == typeFilter }
            }
            if let startDate = filter?.startDate {
                filtered = filtered.filter { $0.createdAt >= startDate }
            }
            if let endDate = filter?.endDate {
                filtered = filtered.filter { $0.createdAt <= endDate }
            }

            transactions = filtered
            isLoading = false

            return .success(filtered)

        } catch let error as NetworkError {
            isLoading = false
            let pointsError = mapNetworkError(error)
            lastError = pointsError
            return .failure(pointsError)

        } catch {
            isLoading = false
            let pointsError = PointsError.unknown(error)
            lastError = pointsError
            return .failure(pointsError)
        }
    }

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
    ) async -> PointsResult {
        guard points > 0 else {
            lastError = .invalidAmount
            return .invalidAmount
        }

        isLoading = true
        lastError = nil

        do {
            let response = try await pointsMutationService.applyPointsChange(
                points: points,
                transactionType: .adminAdjust,
                description: description,
                metadata: metadata
            )

            // Update balance
            let pointsBalance = PointsBalance(
                totalPoints: response.totalPoints,
                availablePoints: response.totalPoints,
                pendingPoints: 0,
                level: response.level,
                todayEarned: response.todayEarned,
                weekEarned: response.weekEarned,
                totalTransactions: response.totalTransactions,
                updatedAt: Date()
            )

            balance = pointsBalance
            cacheBalance(pointsBalance)
            isLoading = false

            return .success(balance: pointsBalance)

        } catch let error as NetworkError {
            isLoading = false
            let pointsError = mapNetworkError(error)
            lastError = pointsError
            return .failed(error: pointsError)

        } catch {
            isLoading = false
            let pointsError = PointsError.unknown(error)
            lastError = pointsError
            return .failed(error: pointsError)
        }
    }

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
    ) async -> PointsResult {
        guard points > 0 else {
            lastError = .invalidAmount
            return .invalidAmount
        }

        guard let currentBalance = balance, currentBalance.availablePoints >= points else {
            lastError = .insufficientBalance
            return .insufficientBalance
        }

        isLoading = true
        lastError = nil

        do {
            let response = try await pointsMutationService.applyPointsChange(
                points: -points,
                transactionType: .redeem,
                description: description,
                metadata: metadata
            )

            // Update balance
            let pointsBalance = PointsBalance(
                totalPoints: response.totalPoints,
                availablePoints: response.totalPoints,
                pendingPoints: 0,
                level: response.level,
                todayEarned: response.todayEarned,
                weekEarned: response.weekEarned,
                totalTransactions: response.totalTransactions,
                updatedAt: Date()
            )

            balance = pointsBalance
            cacheBalance(pointsBalance)
            isLoading = false

            return .success(balance: pointsBalance)

        } catch let error as NetworkError {
            isLoading = false
            let pointsError = mapNetworkError(error)
            lastError = pointsError
            return .failed(error: pointsError)

        } catch {
            isLoading = false
            let pointsError = PointsError.unknown(error)
            lastError = pointsError
            return .failed(error: pointsError)
        }
    }

    /// Sync points with server
    /// - Returns: Result indicating success or failure
    func syncWithServer() async -> Result<Void, PointsError> {
        isSyncing = true
        lastError = nil

        let result = await refreshPoints()

        isSyncing = false

        switch result {
        case .success:
            return .success(())

        case .failure(let error):
            return .failure(error)
        }
    }

    /// Clear error state
    func clearError() {
        lastError = nil
    }

    // MARK: - Private Methods

    /// Load cached balance from UserDefaults
    private func loadCachedBalance() {
        if let data = userDefaults.getData(forKey: "cached_points_balance"),
           let cached = try? JSONDecoder().decode(PointsBalance.self, from: data) {
            // Only use cached balance if it's less than 5 minutes old
            let cacheAge = Date().timeIntervalSince(cached.updatedAt)
            if cacheAge < syncInterval {
                balance = cached
            }
        }
    }

    /// Cache balance to UserDefaults
    /// - Parameter pointsBalance: Balance to cache
    private func cacheBalance(_ pointsBalance: PointsBalance) {
        if let data = try? JSONEncoder().encode(pointsBalance) {
            userDefaults.setData(data, forKey: "cached_points_balance")
        }
    }

    /// Map API transaction type to service type
    /// - Parameter type: API transaction type
    /// - Returns: Service transaction type
    private func mapTransactionType(_ type: TransactionType) -> PointsTransactionType {
        switch type {
        case .studyComplete, .studyStreak, .dailyLogin, .achievement, .socialShare:
            return .earned
        case .redeem:
            return .redeemed
        case .adminAdjust:
            return .admin
        }
    }

    /// Map network errors to points errors
    /// - Parameter error: Network error
    /// - Returns: Points error
    private func mapNetworkError(_ error: NetworkError) -> PointsError {
        switch error {
        case .noConnection, .timeout:
            return .networkError
        case .unauthorized:
            return .unauthorized
        case .custom(let message):
            return .serverError(message: message)
        default:
            return .unknown(error)
        }
    }
}

// MARK: - API Request/Response Types

/// Request to add points
struct AddPointsRequest: Codable {
    let points: Int
    let description: String
    let metadata: [String: String]?
}

/// Request to deduct points
struct DeductPointsRequest: Codable {
    let points: Int
    let description: String
    let metadata: [String: String]?
}

extension UserDefaultsManager: PointsServiceUserDefaultsStore {}
extension SupabaseService: PointsMutationServiceProtocol {}
