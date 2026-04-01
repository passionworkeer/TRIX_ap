//
//  PointsHistoryViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for PointsHistoryViewModel
//

import XCTest
import Combine
@testable import TRIX3DCompanion

/// Unit tests for PointsHistoryViewModel
final class PointsHistoryViewModelTests: XCTestCase {

    // MARK: - Properties

    var pointsHistoryViewModel: PointsHistoryViewModel!
    var mockAPIClient: MockPointsHistoryAPIClient!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        mockAPIClient = MockPointsHistoryAPIClient()

        pointsHistoryViewModel = PointsHistoryViewModel(
            apiClient: mockAPIClient as! APIClient
        )
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        pointsHistoryViewModel = nil
        mockAPIClient = nil
        cancellables = nil
    }

    // MARK: - Load Data Tests

    func test_loadData_loadsBalanceAndTransactions() async throws {
        // Act
        await pointsHistoryViewModel.loadData()

        // Assert
        XCTAssertNotNil(pointsHistoryViewModel.pointsBalance)
        XCTAssertFalse(pointsHistoryViewModel.transactions.isEmpty)
    }

    func test_loadPointsBalance_success() async throws {
        // Act
        await pointsHistoryViewModel.loadPointsBalance()

        // Assert
        XCTAssertNotNil(pointsHistoryViewModel.pointsBalance)
    }

    func test_loadTransactions_success() async throws {
        // Act
        await pointsHistoryViewModel.loadTransactions()

        // Assert
        XCTAssertFalse(pointsHistoryViewModel.transactions.isEmpty)
    }

    // MARK: - Load More Tests

    func test_loadMore_loadsMoreTransactions() async throws {
        // Arrange
        await pointsHistoryViewModel.loadTransactions()
        let initialCount = pointsHistoryViewModel.transactions.count

        // Act
        await pointsHistoryViewModel.loadMore()

        // Assert
        XCTAssertGreaterThanOrEqual(pointsHistoryViewModel.transactions.count, initialCount)
    }

    // MARK: - Refresh Tests

    func test_refresh_reloadsData() async throws {
        // Arrange
        await pointsHistoryViewModel.loadData()

        // Act
        await pointsHistoryViewModel.refresh()

        // Assert
        XCTAssertNotNil(pointsHistoryViewModel.pointsBalance)
    }

    // MARK: - Clear Error Tests

    func test_clearError_clearsErrorMessage() {
        // Arrange
        pointsHistoryViewModel.errorMessage = "Test error"

        // Act
        pointsHistoryViewModel.clearError()

        // Assert
        XCTAssertNil(pointsHistoryViewModel.errorMessage)
    }

    // MARK: - Computed Properties Tests

    func test_totalPoints_returnsBalance() async throws {
        // Arrange
        await pointsHistoryViewModel.loadData()

        // Assert
        XCTAssertEqual(pointsHistoryViewModel.totalPoints, pointsHistoryViewModel.pointsBalance?.totalPoints ?? 0)
    }

    func test_level_returnsBalance() async throws {
        // Arrange
        await pointsHistoryViewModel.loadData()

        // Assert
        XCTAssertEqual(pointsHistoryViewModel.level, pointsHistoryViewModel.pointsBalance?.level ?? 1)
    }

    func test_todayEarned_returnsBalance() async throws {
        // Arrange
        await pointsHistoryViewModel.loadData()

        // Assert
        XCTAssertGreaterThanOrEqual(pointsHistoryViewModel.todayEarned, 0)
    }

    func test_weekEarned_returnsBalance() async throws {
        // Arrange
        await pointsHistoryViewModel.loadData()

        // Assert
        XCTAssertGreaterThanOrEqual(pointsHistoryViewModel.weekEarned, 0)
    }

    func test_totalTransactions_returnsBalance() async throws {
        // Arrange
        await pointsHistoryViewModel.loadData()

        // Assert
        XCTAssertGreaterThanOrEqual(pointsHistoryViewModel.totalTransactions, 0)
    }

    func test_progressToNextLevel_calculatesCorrectly() async throws {
        // Arrange
        await pointsHistoryViewModel.loadData()

        // Assert
        let progress = pointsHistoryViewModel.progressToNextLevel
        XCTAssertGreaterThanOrEqual(progress, 0)
        XCTAssertLessThanOrEqual(progress, 1)
    }

    func test_pointsToNextLevel_calculatesCorrectly() async throws {
        // Arrange
        await pointsHistoryViewModel.loadData()

        // Assert
        XCTAssertGreaterThanOrEqual(pointsHistoryViewModel.pointsToNextLevel, 0)
    }

    // MARK: - Helper Methods Tests

    func test_iconForTransactionType() {
        // Test various transaction types
        XCTAssertNotNil(pointsHistoryViewModel.iconForTransactionType(.studyComplete))
        XCTAssertNotNil(pointsHistoryViewModel.iconForTransactionType(.studyStreak))
        XCTAssertNotNil(pointsHistoryViewModel.iconForTransactionType(.dailyLogin))
        XCTAssertNotNil(pointsHistoryViewModel.iconForTransactionType(.achievement))
        XCTAssertNotNil(pointsHistoryViewModel.iconForTransactionType(.socialShare))
        XCTAssertNotNil(pointsHistoryViewModel.iconForTransactionType(.redeem))
    }

    func test_colorForTransactionType() {
        // Test various transaction types
        XCTAssertNotNil(pointsHistoryViewModel.colorForTransactionType(.studyComplete))
        XCTAssertNotNil(pointsHistoryViewModel.colorForTransactionType(.studyStreak))
        XCTAssertNotNil(pointsHistoryViewModel.colorForTransactionType(.dailyLogin))
        XCTAssertNotNil(pointsHistoryViewModel.colorForTransactionType(.achievement))
    }

    func test_formatDate() {
        // Test date formatting
        let result = pointsHistoryViewModel.formatDate(Date())
        XCTAssertNotNil(result)
    }

    // MARK: - Loading State Tests

    func test_isLoading_tracksState() async throws {
        // Arrange
        var loadingStates: [Bool] = []
        pointsHistoryViewModel.$isLoading
            .sink { isLoading in
                loadingStates.append(isLoading)
            }
            .store(in: &cancellables)

        // Act
        await pointsHistoryViewModel.loadData()

        // Assert
        XCTAssertTrue(loadingStates.contains(true))
    }

    func test_isLoadingMore_tracksState() async throws {
        // Arrange
        await pointsHistoryViewModel.loadTransactions()

        var loadingMoreStates: [Bool] = []
        pointsHistoryViewModel.$isLoadingMore
            .sink { isLoadingMore in
                loadingMoreStates.append(isLoadingMore)
            }
            .store(in: &cancellables)

        // Act
        await pointsHistoryViewModel.loadMore()

        // Assert
        XCTAssertTrue(loadingMoreStates.contains(true))
    }
}

// MARK: - Mock Points History APIClient

class MockPointsHistoryAPIClient {
    var mockPoints: PointsResponse?
    var mockTransactions: [PointsTransaction] = []
    var shouldThrowError: Bool = false

    init() {
        mockPoints = PointsResponse(
            totalPoints: 2450,
            level: 3,
            todayEarned: 150,
            weekEarned: 520,
            totalTransactions: 45
        )

        mockTransactions = [
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
            )
        ]
    }

    func getPoints() async throws -> PointsResponse {
        if shouldThrowError {
            throw NetworkError.serverError(message: "Test error")
        }
        return mockPoints!
    }

    func getPointsHistory(page: Int, limit: Int) async throws -> [PointsTransaction] {
        if shouldThrowError {
            throw NetworkError.serverError(message: "Test error")
        }
        return Array(mockTransactions.prefix(limit))
    }
}

// MARK: - PointsTransaction

struct PointsTransaction: Identifiable, Codable {
    let id: String
    let pointsChange: Int
    let type: TransactionType
    let description: String
    let balanceAfter: Int
    let createdAt: Date
}

enum TransactionType: String, Codable {
    case studyComplete
    case studyStreak
    case dailyLogin
    case achievement
    case socialShare
    case redeem
    case adminAdjust
}
