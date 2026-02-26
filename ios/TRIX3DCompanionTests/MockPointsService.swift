//
//  MockPointsService.swift
//  TRIX3DCompanionTests
//
//  Mock implementation of PointsServiceProtocol for testing
//

import Foundation
import Combine
@testable import TRIX3DCompanion

/// Mock implementation of PointsServiceProtocol for unit testing
@MainActor
final class MockPointsService: PointsServiceProtocol {

    // MARK: - Published Properties

    @Published private(set) var balance: PointsBalance?
    @Published private(set) var transactions: [PointsTransactionDetail] = []
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var isSyncing: Bool = false
    @Published private(set) var lastError: PointsError?

    // MARK: - Mock Configuration

    var mockRefreshResult: Result<PointsBalance, PointsError>?
    var mockBalance: PointsBalance?
    var mockHistoryResult: Result<[PointsTransactionDetail], PointsError>?
    var mockAddPointsResult: PointsResult?
    var mockDeductPointsResult: PointsResult?
    var mockSyncResult: Result<Void, PointsError>?

    // Call tracking
    var refreshPointsCallCount: Int = 0
    var getBalanceCallCount: Int = 0
    var loadHistoryCallCount: Int = 0
    var addPointsCallCount: Int = 0
    var deductPointsCallCount: Int = 0
    var syncWithServerCallCount: Int = 0
    var clearErrorCallCount: Int = 0

    // MARK: - Initialization

    init() {
        // Initialize with default balance
        mockBalance = PointsBalance(
            totalPoints: 1000,
            availablePoints: 1000,
            pendingPoints: 0,
            level: 1,
            todayEarned: 50,
            weekEarned: 200,
            totalTransactions: 10,
            updatedAt: Date()
        )
        balance = mockBalance
    }

    // MARK: - PointsServiceProtocol

    func refreshPoints() async -> Result<PointsBalance, PointsError> {
        refreshPointsCallCount += 1
        isLoading = true

        defer {
            isLoading = false
        }

        if let result = mockRefreshResult {
            if case .success(let balance) = result {
                self.balance = balance
            }
            return result
        }

        // Default: return current balance
        if let balance = mockBalance {
            self.balance = balance
            return .success(balance)
        }

        return .failure(.syncFailed)
    }

    func getBalance() async -> PointsBalance? {
        getBalanceCallCount += 1
        return balance ?? mockBalance
    }

    func loadHistory(filter: PointsHistoryFilter?) async -> Result<[PointsTransactionDetail], PointsError> {
        loadHistoryCallCount += 1
        isLoading = true

        defer {
            isLoading = false
        }

        if let result = mockHistoryResult {
            if case .success(let transactions) = result {
                self.transactions = transactions
            }
            return result
        }

        // Default: return sample transactions
        let sampleTransactions = createSampleTransactions(count: filter?.limit ?? 20)
        transactions = sampleTransactions
        return .success(sampleTransactions)
    }

    func addPoints(_ points: Int, description: String, metadata: [String: String]?) async -> PointsResult {
        addPointsCallCount += 1

        if let result = mockAddPointsResult {
            return result
        }

        // Default: add points and return success
        if var currentBalance = balance {
            currentBalance = PointsBalance(
                totalPoints: currentBalance.totalPoints + points,
                availablePoints: currentBalance.availablePoints + points,
                pendingPoints: currentBalance.pendingPoints,
                level: max(1, (currentBalance.totalPoints + points) / 1000),
                todayEarned: currentBalance.todayEarned + points,
                weekEarned: currentBalance.weekEarned + points,
                totalTransactions: currentBalance.totalTransactions + 1,
                updatedAt: Date()
            )
            balance = currentBalance
            return .success(balance: currentBalance)
        }

        return .failed(error: .syncFailed)
    }

    func deductPoints(_ points: Int, description: String, metadata: [String: String]?) async -> PointsResult {
        deductPointsCallCount += 1

        if let result = mockDeductPointsResult {
            return result
        }

        // Check if enough balance
        guard let currentBalance = balance, currentBalance.availablePoints >= points else {
            return .insufficientBalance
        }

        // Deduct points
        let newBalance = PointsBalance(
            totalPoints: currentBalance.totalPoints - points,
            availablePoints: currentBalance.availablePoints - points,
            pendingPoints: currentBalance.pendingPoints,
            level: currentBalance.level,
            todayEarned: currentBalance.todayEarned,
            weekEarned: currentBalance.weekEarned,
            totalTransactions: currentBalance.totalTransactions + 1,
            updatedAt: Date()
        )
        balance = newBalance
        return .success(balance: newBalance)
    }

    func syncWithServer() async -> Result<Void, PointsError> {
        syncWithServerCallCount += 1
        isSyncing = true

        defer {
            isSyncing = false
        }

        if let result = mockSyncResult {
            return result
        }

        return .success(())
    }

    func clearError() {
        clearErrorCallCount += 1
        lastError = nil
    }

    // MARK: - Helper Methods

    func setMockBalance(_ balance: PointsBalance) {
        mockBalance = balance
        self.balance = balance
    }

    func setMockBalance(totalPoints: Int, level: Int = 1) {
        let balance = PointsBalance(
            totalPoints: totalPoints,
            availablePoints: totalPoints,
            pendingPoints: 0,
            level: level,
            todayEarned: 100,
            weekEarned: 500,
            totalTransactions: 20,
            updatedAt: Date()
        )
        setMockBalance(balance)
    }

    func setMockRefreshSuccess() {
        mockRefreshResult = .success(balance ?? mockBalance!)
    }

    func setMockRefreshError(_ error: PointsError) {
        mockRefreshResult = .failure(error)
        lastError = error
    }

    func setMockAddPointsSuccess() {
        mockAddPointsResult = nil // Will use default behavior
    }

    func setMockAddPointsFailed() {
        mockAddPointsResult = .failed(error: .invalidAmount)
    }

    func setMockDeductPointsInsufficient() {
        mockDeductPointsResult = .insufficientBalance
    }

    func setMockHistorySuccess(_ transactions: [PointsTransactionDetail]) {
        mockHistoryResult = .success(transactions)
    }

    func setMockHistoryError(_ error: PointsError) {
        mockHistoryResult = .failure(error)
        lastError = error
    }

    func createSampleTransactions(count: Int) -> [PointsTransactionDetail] {
        (0..<count).map { index in
            let types: [PointsTransactionType] = [.earned, .purchased, .redeemed, .bonus]
            let type = types[index % types.count]
            let pointsChange = type == .redeemed ? -50 : 50

            return PointsTransactionDetail(
                id: "txn-\(index)",
                userId: "test-user",
                pointsChange: pointsChange,
                balanceBefore: 1000 + (index * 50),
                balanceAfter: 1000 + ((index + 1) * 50),
                type: type,
                description: "Test transaction \(index)",
                orderId: nil,
                metadata: nil,
                createdAt: Date().addingTimeInterval(-Double(index * 3600))
            )
        }
    }

    func resetCallCounts() {
        refreshPointsCallCount = 0
        getBalanceCallCount = 0
        loadHistoryCallCount = 0
        addPointsCallCount = 0
        deductPointsCallCount = 0
        syncWithServerCallCount = 0
        clearErrorCallCount = 0
    }

    func reset() {
        resetCallCounts()
        balance = nil
        transactions = []
        isLoading = false
        isSyncing = false
        lastError = nil
        mockRefreshResult = nil
        mockBalance = nil
        mockHistoryResult = nil
        mockAddPointsResult = nil
        mockDeductPointsResult = nil
        mockSyncResult = nil
    }
}
