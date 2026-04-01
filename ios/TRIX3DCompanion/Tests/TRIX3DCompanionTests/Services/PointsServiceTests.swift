//
//  PointsServiceTests.swift
//  TRIX3DCompanionTests
//
//  Comprehensive unit tests for PointsService
//

import XCTest
import Combine
@testable import TRIX3DCompanion

// MARK: - PointsResponse Extension for Testing

extension PointsResponse {
    init(
        totalPoints: Int,
        level: Int,
        todayEarned: Int,
        weekEarned: Int,
        totalTransactions: Int
    ) {
        self.totalPoints = totalPoints
        self.level = level
        self.todayEarned = todayEarned
        self.weekEarned = weekEarned
        self.totalTransactions = totalTransactions
    }
}

/// Comprehensive unit tests for PointsService
final class PointsServiceTests: XCTestCase {

    // MARK: - Properties

    var pointsService: PointsService!
    var mockAPIClient: MockAPIClient!
    var mockUserDefaults: MockUserDefaultsManager!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        mockAPIClient = MockAPIClient()
        mockUserDefaults = MockUserDefaultsManager()

        pointsService = PointsService(
            apiClient: mockAPIClient,
            userDefaults: mockUserDefaults
        )

        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        pointsService = nil
        mockAPIClient = nil
        mockUserDefaults = nil
        cancellables = nil
    }

    // MARK: - Refresh Points Tests

    func test_refreshPoints_success() async throws {
        // Arrange
        let mockResponse = PointsResponse(
            totalPoints: 1500,
            level: 2,
            todayEarned: 100,
            weekEarned: 300,
            totalTransactions: 15
        )
        mockAPIClient.mockPointsResponse = mockResponse

        // Act
        let result = await pointsService.refreshPoints()

        // Assert
        switch result {
        case .success(let balance):
            XCTAssertEqual(balance.totalPoints, 1500, "Should have correct total points")
            XCTAssertEqual(balance.level, 2, "Should have correct level")
            XCTAssertEqual(balance.todayEarned, 100, "Should have correct today earned")
        case .failure(let error):
            XCTFail("Should succeed but got error: \(error)")
        }
    }

    func test_refreshPoints_networkError() async throws {
        // Arrange
        mockAPIClient.mockNetworkError = .noConnection

        // Act
        let result = await pointsService.refreshPoints()

        // Assert
        switch result {
        case .success:
            XCTFail("Should fail with network error")
        case .failure(let error):
            XCTAssertEqual(error, .networkError, "Should return network error")
        }
    }

    func test_refreshPoints_unauthorized() async throws {
        // Arrange
        mockAPIClient.mockNetworkError = .unauthorized

        // Act
        let result = await pointsService.refreshPoints()

        // Assert
        switch result {
        case .success:
            XCTFail("Should fail with unauthorized")
        case .failure(let error):
            XCTAssertEqual(error, .unauthorized, "Should return unauthorized error")
        }
    }

    // MARK: - Get Balance Tests

    func test_getBalance_returnsCachedBalance() async {
        // Arrange
        let mockResponse = PointsResponse(
            totalPoints: 2000,
            level: 3,
            todayEarned: 150,
            weekEarned: 400,
            totalTransactions: 20
        )
        mockAPIClient.mockPointsResponse = mockResponse
        _ = await pointsService.refreshPoints()

        // Act
        let balance = await pointsService.getBalance()

        // Assert
        XCTAssertNotNil(balance, "Should return cached balance")
        XCTAssertEqual(balance?.totalPoints, 2000, "Should have correct cached points")
    }

    func test_getBalance_refreshesWhenStale() async {
        // Arrange - First call sets initial balance
        let firstResponse = PointsResponse(
            totalPoints: 1000,
            level: 1,
            todayEarned: 50,
            weekEarned: 200,
            totalTransactions: 10
        )
        mockAPIClient.mockPointsResponse = firstResponse
        _ = await pointsService.refreshPoints()

        // Second response for refresh
        let secondResponse = PointsResponse(
            totalPoints: 2500,
            level: 3,
            todayEarned: 200,
            weekEarned: 500,
            totalTransactions: 25
        )
        mockAPIClient.mockPointsResponse = secondResponse

        // Act - Wait for sync interval to pass (simulated by forcing refresh)
        _ = await pointsService.refreshPoints()
        let balance = await pointsService.getBalance()

        // Assert
        XCTAssertEqual(balance?.totalPoints, 2500, "Should refresh stale balance")
    }

    // MARK: - Load History Tests

    func test_loadHistory_success() async throws {
        // Arrange
        let mockTransactions = [
            PointsTransaction(
                id: "tx-1",
                userId: "user-1",
                pointsChange: 100,
                balanceAfter: 1100,
                type: .studyComplete,
                description: "完成学习",
                orderId: nil,
                metadata: nil,
                createdAt: Date()
            ),
            PointsTransaction(
                id: "tx-2",
                userId: "user-1",
                pointsChange: 50,
                balanceAfter: 1150,
                type: .dailyLogin,
                description: "每日登录",
                orderId: nil,
                metadata: nil,
                createdAt: Date()
            )
        ]
        mockAPIClient.mockTransactions = mockTransactions

        // Act
        let result = await pointsService.loadHistory()

        // Assert
        switch result {
        case .success(let transactions):
            XCTAssertEqual(transactions.count, 2, "Should return all transactions")
            XCTAssertEqual(transactions[0].pointsChange, 100, "First transaction should have correct points")
        case .failure(let error):
            XCTFail("Should succeed but got error: \(error)")
        }
    }

    func test_loadHistory_withTypeFilter() async throws {
        // Arrange
        let mockTransactions = [
            PointsTransaction(
                id: "tx-1",
                userId: "user-1",
                pointsChange: 100,
                balanceAfter: 1100,
                type: .studyComplete,
                description: "完成学习",
                orderId: nil,
                metadata: nil,
                createdAt: Date()
            ),
            PointsTransaction(
                id: "tx-2",
                userId: "user-1",
                pointsChange: -100,
                balanceAfter: 1000,
                type: .redeem,
                description: "兑换商品",
                orderId: "order-123",
                metadata: nil,
                createdAt: Date()
            )
        ]
        mockAPIClient.mockTransactions = mockTransactions

        // Act
        let filter = PointsHistoryFilter(type: .earned)
        let result = await pointsService.loadHistory(filter: filter)

        // Assert
        switch result {
        case .success(let transactions):
            XCTAssertEqual(transactions.count, 1, "Should filter to earned transactions only")
            XCTAssertEqual(transactions.first?.pointsChange, 100, "Should be earned transaction")
        case .failure(let error):
            XCTFail("Should succeed but got error: \(error)")
        }
    }

    func test_loadHistory_withDateRangeFilter() async throws {
        // Arrange
        let now = Date()
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: now)!

        let mockTransactions = [
            PointsTransaction(
                id: "tx-1",
                userId: "user-1",
                pointsChange: 100,
                balanceAfter: 1100,
                type: .studyComplete,
                description: "今天的学习",
                orderId: nil,
                metadata: nil,
                createdAt: now
            ),
            PointsTransaction(
                id: "tx-2",
                userId: "user-1",
                pointsChange: 50,
                balanceAfter: 1050,
                type: .dailyLogin,
                description: "昨天的登录",
                orderId: nil,
                metadata: nil,
                createdAt: yesterday
            )
        ]
        mockAPIClient.mockTransactions = mockTransactions

        // Act - Filter for today only
        let filter = PointsHistoryFilter(startDate: now, endDate: now)
        let result = await pointsService.loadHistory(filter: filter)

        // Assert
        switch result {
        case .success(let transactions):
            XCTAssertEqual(transactions.count, 1, "Should filter by date range")
        case .failure(let error):
            XCTFail("Should succeed but got error: \(error)")
        }
    }

    func test_loadHistory_withPagination() async throws {
        // Arrange
        var mockTransactions: [PointsTransaction] = []
        for i in 1...60 {
            mockTransactions.append(PointsTransaction(
                id: "tx-\(i)",
                userId: "user-1",
                pointsChange: 10,
                balanceAfter: 1000 + (i * 10),
                type: .studyComplete,
                description: "学习 #\(i)",
                orderId: nil,
                metadata: nil,
                createdAt: Date()
            ))
        }
        mockAPIClient.mockTransactions = mockTransactions

        // Act - Load first page
        let filter = PointsHistoryFilter(limit: 20, offset: 0)
        let result = await pointsService.loadHistory(filter: filter)

        // Assert
        switch result {
        case .success(let transactions):
            XCTAssertEqual(transactions.count, 20, "Should return limited results")
        case .failure(let error):
            XCTFail("Should succeed but got error: \(error)")
        }
    }

    // MARK: - Add Points Tests

    func test_addPoints_success() async throws {
        // Arrange
        let pointsToAdd = 500
        let mockResponse = PointsResponse(
            totalPoints: 2000,
            level: 2,
            todayEarned: 500,
            weekEarned: 700,
            totalTransactions: 15
        )
        mockAPIClient.mockPointsResponse = mockResponse

        // Act
        let result = await pointsService.addPoints(
            pointsToAdd,
            description: "管理员奖励",
            metadata: ["source": "admin"]
        )

        // Assert
        switch result {
        case .success(let balance):
            XCTAssertEqual(balance.totalPoints, 2000, "Should have updated balance")
        case .invalidAmount:
            XCTFail("Should not return invalid amount")
        case .failed(let error):
            XCTFail("Should succeed but got error: \(error)")
        }
    }

    func test_addPoints_invalidAmount_zero() async {
        // Arrange
        let pointsToAdd = 0

        // Act
        let result = await pointsService.addPoints(
            pointsToAdd,
            description: "无效积分",
            metadata: nil
        )

        // Assert
        XCTAssertEqual(result, .invalidAmount, "Should return invalid amount for zero")
    }

    func test_addPoints_invalidAmount_negative() async {
        // Arrange
        let pointsToAdd = -100

        // Act
        let result = await pointsService.addPoints(
            pointsToAdd,
            description: "负数积分",
            metadata: nil
        )

        // Assert
        XCTAssertEqual(result, .invalidAmount, "Should return invalid amount for negative")
    }

    func test_addPoints_networkError() async throws {
        // Arrange
        mockAPIClient.mockNetworkError = .noConnection

        // Act
        let result = await pointsService.addPoints(
            100,
            description: "测试",
            metadata: nil
        )

        // Assert
        switch result {
        case .failed(let error):
            XCTAssertEqual(error, .networkError, "Should return network error")
        default:
            XCTFail("Should return failed with network error")
        }
    }

    // MARK: - Deduct Points Tests

    func test_deductPoints_success() async throws {
        // Arrange
        let pointsToDeduct = 200
        let mockResponse = PointsResponse(
            totalPoints: 800,
            level: 1,
            todayEarned: 0,
            weekEarned: 0,
            totalTransactions: 15
        )
        mockAPIClient.mockPointsResponse = mockResponse

        // First set up balance
        _ = await pointsService.refreshPoints()

        // Act
        let result = await pointsService.deductPoints(
            pointsToDeduct,
            description: "兑换商品",
            metadata: ["product": "item-123"]
        )

        // Assert
        switch result {
        case .success(let balance):
            XCTAssertEqual(balance.totalPoints, 800, "Should have deducted balance")
        case .insufficientBalance:
            XCTFail("Should have sufficient balance")
        case .invalidAmount:
            XCTFail("Should not return invalid amount")
        case .failed(let error):
            XCTFail("Should succeed but got error: \(error)")
        }
    }

    func test_deductPoints_insufficientBalance() async throws {
        // Arrange
        let mockResponse = PointsResponse(
            totalPoints: 100,
            level: 1,
            todayEarned: 0,
            weekEarned: 0,
            totalTransactions: 10
        )
        mockAPIClient.mockPointsResponse = mockResponse
        _ = await pointsService.refreshPoints()

        // Act - Try to deduct more than available
        let result = await pointsService.deductPoints(
            500,
            description: "积分不足",
            metadata: nil
        )

        // Assert
        XCTAssertEqual(result, .insufficientBalance, "Should return insufficient balance")
    }

    func test_deductPoints_invalidAmount_zero() async {
        // Arrange
        let pointsToDeduct = 0

        // Act
        let result = await pointsService.deductPoints(
            pointsToDeduct,
            description: "测试",
            metadata: nil
        )

        // Assert
        XCTAssertEqual(result, .invalidAmount, "Should return invalid amount for zero")
    }

    func test_deductPoints_invalidAmount_negative() async {
        // Arrange
        let pointsToDeduct = -50

        // Act
        let result = await pointsService.deductPoints(
            pointsToDeduct,
            description: "测试",
            metadata: nil
        )

        // Assert
        XCTAssertEqual(result, .invalidAmount, "Should return invalid amount for negative")
    }

    // MARK: - Sync with Server Tests

    func test_syncWithServer_success() async throws {
        // Arrange
        let mockResponse = PointsResponse(
            totalPoints: 3000,
            level: 3,
            todayEarned: 300,
            weekEarned: 900,
            totalTransactions: 30
        )
        mockAPIClient.mockPointsResponse = mockResponse

        // Act
        let result = await pointsService.syncWithServer()

        // Assert
        switch result {
        case .success:
            XCTAssertTrue(true, "Should sync successfully")
        case .failure(let error):
            XCTFail("Should succeed but got error: \(error)")
        }
    }

    func test_syncWithServer_failure() async throws {
        // Arrange
        mockAPIClient.mockNetworkError = .timeout

        // Act
        let result = await pointsService.syncWithServer()

        // Assert
        switch result {
        case .success:
            XCTFail("Should fail with timeout")
        case .failure(let error):
            XCTAssertEqual(error, .networkError, "Should return network error")
        }
    }

    // MARK: - Published Properties Tests

    func test_balance_publishedChanges() async {
        // Arrange
        let expectation = XCTestExpectation(description: "balance should publish change")

        pointsService.$balance
            .dropFirst()
            .sink { balance in
                if balance != nil {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        let mockResponse = PointsResponse(
            totalPoints: 5000,
            level: 5,
            todayEarned: 500,
            weekEarned: 1500,
            totalTransactions: 50
        )
        mockAPIClient.mockPointsResponse = mockResponse

        // Act
        await pointsService.refreshPoints()

        // Assert
        wait(for: [expectation], timeout: 2.0)
    }

    func test_isLoading_updatesDuringRefresh() async {
        // Arrange
        let expectation = XCTestExpectation(description: "isLoading should update")
        var loadingStates: [Bool] = []

        pointsService.$isLoading
            .sink { isLoading in
                loadingStates.append(isLoading)
                if loadingStates.count >= 2 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        mockAPIClient.mockPointsResponse = PointsResponse(
            totalPoints: 1000,
            level: 1,
            todayEarned: 0,
            weekEarned: 0,
            totalTransactions: 0
        )

        // Act
        await pointsService.refreshPoints()

        // Assert
        wait(for: [expectation], timeout: 2.0)
        XCTAssertTrue(loadingStates.contains(true), "Should have loading state true")
        XCTAssertTrue(loadingStates.contains(false), "Should have loading state false")
    }

    func test_isSyncing_updatesDuringSync() async {
        // Arrange
        let expectation = XCTestExpectation(description: "isSyncing should update")

        pointsService.$isSyncing
            .dropFirst()
            .sink { isSyncing in
                if !isSyncing {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        mockAPIClient.mockPointsResponse = PointsResponse(
            totalPoints: 1000,
            level: 1,
            todayEarned: 0,
            weekEarned: 0,
            totalTransactions: 0
        )

        // Act
        await pointsService.syncWithServer()

        // Assert
        wait(for: [expectation], timeout: 2.0)
    }

    func test_lastError_setOnFailure() async {
        // Arrange
        mockAPIClient.mockNetworkError = .unauthorized
        let expectation = XCTestExpectation(description: "lastError should be set")

        pointsService.$lastError
            .dropFirst()
            .sink { error in
                if error != nil {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // Act
        await pointsService.refreshPoints()

        // Assert
        wait(for: [expectation], timeout: 2.0)
        XCTAssertNotNil(pointsService.lastError, "Should have last error set")
    }

    // MARK: - Clear Error Tests

    func test_clearError_removesLastError() async {
        // Arrange - Set an error
        mockAPIClient.mockNetworkError = .noConnection
        await pointsService.refreshPoints()
        XCTAssertNotNil(pointsService.lastError, "Should have error after failed request")

        // Act
        pointsService.clearError()

        // Assert
        XCTAssertNil(pointsService.lastError, "Error should be cleared")
    }

    // MARK: - Transaction Type Mapping Tests

    func test_transactionTypeMapping_earned() async throws {
        // Arrange
        let earnedTypes: [TransactionType] = [
            .studyComplete, .studyStreak, .dailyLogin, .achievement, .socialShare
        ]

        let mockTransactions = earnedTypes.map { type in
            PointsTransaction(
                id: UUID().uuidString,
                userId: "user-1",
                pointsChange: 100,
                balanceAfter: 1000,
                type: type,
                description: "Test",
                orderId: nil,
                metadata: nil,
                createdAt: Date()
            )
        }
        mockAPIClient.mockTransactions = mockTransactions

        // Act
        let result = await pointsService.loadHistory()

        // Assert
        switch result {
        case .success(let transactions):
            for transaction in transactions {
                XCTAssertEqual(transaction.type, .earned, "All should map to earned type")
            }
        case .failure:
            XCTFail("Should succeed")
        }
    }

    func test_transactionTypeMapping_redeemed() async throws {
        // Arrange
        let mockTransactions = [
            PointsTransaction(
                id: "tx-1",
                userId: "user-1",
                pointsChange: -100,
                balanceAfter: 900,
                type: .redeem,
                description: "兑换",
                orderId: "order-123",
                metadata: nil,
                createdAt: Date()
            )
        ]
        mockAPIClient.mockTransactions = mockTransactions

        // Act
        let result = await pointsService.loadHistory()

        // Assert
        switch result {
        case .success(let transactions):
            XCTAssertEqual(transactions.first?.type, .redeemed, "Should map to redeemed")
        case .failure:
            XCTFail("Should succeed")
        }
    }

    func test_transactionTypeMapping_admin() async throws {
        // Arrange
        let mockTransactions = [
            PointsTransaction(
                id: "tx-1",
                userId: "user-1",
                pointsChange: 500,
                balanceAfter: 1500,
                type: .adminAdjust,
                description: "管理员调整",
                orderId: nil,
                metadata: nil,
                createdAt: Date()
            )
        ]
        mockAPIClient.mockTransactions = mockTransactions

        // Act
        let result = await pointsService.loadHistory()

        // Assert
        switch result {
        case .success(let transactions):
            XCTAssertEqual(transactions.first?.type, .admin, "Should map to admin")
        case .failure:
            XCTFail("Should succeed")
        }
    }

    // MARK: - Error Mapping Tests

    func test_errorMapping_noConnection() async {
        // Arrange
        mockAPIClient.mockNetworkError = .noConnection

        // Act
        let result = await pointsService.refreshPoints()

        // Assert
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .networkError, "Should map to network error")
        default:
            XCTFail("Should return network error")
        }
    }

    func test_errorMapping_timeout() async {
        // Arrange
        mockAPIClient.mockNetworkError = .timeout

        // Act
        let result = await pointsService.refreshPoints()

        // Assert
        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .networkError, "Should map to network error")
        default:
            XCTFail("Should return network error")
        }
    }

    func test_errorMapping_customMessage() async {
        // Arrange
        mockAPIClient.mockNetworkError = .custom("服务器错误")

        // Act
        let result = await pointsService.refreshPoints()

        // Assert
        switch result {
        case .failure(let error):
            if case .serverError(let message) = error {
                XCTAssertEqual(message, "服务器错误", "Should preserve custom message")
            } else {
                XCTFail("Should return server error")
            }
        default:
            XCTFail("Should return error")
        }
    }

    // MARK: - Caching Tests

    func test_balanceCaching() async throws {
        // Arrange
        let mockResponse = PointsResponse(
            totalPoints: 1000,
            level: 1,
            todayEarned: 50,
            weekEarned: 200,
            totalTransactions: 10
        )
        mockAPIClient.mockPointsResponse = mockResponse

        // Act - First call should hit API
        let result1 = await pointsService.refreshPoints()
        // Second call should use cache (if within sync interval)
        let balance = await pointsService.getBalance()

        // Assert
        switch result1 {
        case .success(let initialBalance):
            XCTAssertEqual(balance?.totalPoints, initialBalance.totalPoints, "Cached balance should match")
        case .failure:
            XCTFail("First call should succeed")
        }
    }

    // MARK: - PointsError Tests

    func test_PointsError_descriptions() {
        // Arrange & Assert
        let networkError = PointsError.networkError
        XCTAssertNotNil(networkError.localizedDescription, "networkError should have description")

        let unauthorized = PointsError.unauthorized
        XCTAssertNotNil(unauthorized.localizedDescription, "unauthorized should have description")

        let insufficientBalance = PointsError.insufficientBalance
        XCTAssertNotNil(insufficientBalance.localizedDescription, "insufficientBalance should have description")

        let invalidAmount = PointsError.invalidAmount
        XCTAssertNotNil(invalidAmount.localizedDescription, "invalidAmount should have description")
    }

    // MARK: - PointsResult Tests

    func test_PointsResult_allCases() {
        // Test all points result cases
        let balance = PointsBalance(
            totalPoints: 1000,
            availablePoints: 1000,
            pendingPoints: 0,
            level: 1,
            todayEarned: 50,
            weekEarned: 200,
            totalTransactions: 10,
            updatedAt: Date()
        )

        let success: PointsResult = .success(balance: balance)
        let invalid: PointsResult = .invalidAmount
        let insufficient: PointsResult = .insufficientBalance
        let failed: PointsResult = .failed(error: .networkError)

        // Assert - All cases should be creatable
        switch success {
        case .success: break
        default: XCTFail("Should be success case")
        }

        switch invalid {
        case .invalidAmount: break
        default: XCTFail("Should be invalidAmount case")
        }

        switch insufficient {
        case .insufficientBalance: break
        default: XCTFail("Should be insufficientBalance case")
        }

        switch failed {
        case .failed: break
        default: XCTFail("Should be failed case")
        }
    }
}

// MARK: - Mock Classes

class MockAPIClient: APIClient {
    var mockPointsResponse: PointsResponse?
    var mockTransactions: [PointsTransaction]?
    var mockNetworkError: NetworkError?

    override func get<T: Codable>(_ endpoint: APIEndpoint) async throws -> T {
        if let error = mockNetworkError {
            throw error
        }

        if T.self == PointsResponse.self, let response = mockPointsResponse as? T {
            return response
        }

        if T.self == [PointsTransaction].self, let transactions = mockTransactions as? T {
            return transactions
        }

        throw NetworkError.unknown(NSError(domain: "Mock", code: -1))
    }

    override func getPointsHistory(page: Int, limit: Int) async throws -> [PointsTransaction] {
        if let error = mockNetworkError {
            throw error
        }

        return mockTransactions ?? []
    }

    override func post<T: Codable>(_ endpoint: APIEndpoint, parameters: Parameters? = nil, body: Encodable? = nil, headers: HTTPHeaders? = nil) async throws -> T {
        if let error = mockNetworkError {
            throw error
        }

        if T.self == PointsResponse.self, let response = mockPointsResponse as? T {
            return response
        }

        throw NetworkError.unknown(NSError(domain: "Mock", code: -1))
    }
}

class MockUserDefaultsManager: UserDefaultsManager {
    var storedData: [String: Data] = [:]

    override func getData(forKey key: String) -> Data? {
        return storedData[key]
    }

    override func setData(_ data: Data, forKey key: String) {
        storedData[key] = data
    }
}

// MARK: - Model Mocks

struct PointsResponse: Codable {
    let totalPoints: Int
    let level: Int
    let todayEarned: Int
    let weekEarned: Int
    let totalTransactions: Int
}

struct PointsTransaction: Codable {
    let id: String
    let userId: String
    let pointsChange: Int
    let balanceAfter: Int
    let type: TransactionType
    let description: String
    let orderId: String?
    let metadata: [String: String]?
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

struct PointsBalance {
    let totalPoints: Int
    let availablePoints: Int
    let pendingPoints: Int
    let level: Int
    let todayEarned: Int
    let weekEarned: Int
    let totalTransactions: Int
    let updatedAt: Date
}

struct PointsTransactionDetail {
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
}

enum PointsTransactionType {
    case earned
    case redeemed
    case admin
}

struct PointsHistoryFilter {
    let type: PointsTransactionType?
    let startDate: Date?
    let endDate: Date?
    let limit: Int
    let offset: Int

    init(type: PointsTransactionType? = nil, startDate: Date? = nil, endDate: Date? = nil, limit: Int = 50, offset: Int = 0) {
        self.type = type
        self.startDate = startDate
        self.endDate = endDate
        self.limit = limit
        self.offset = offset
    }
}

enum PointsError: Error, LocalizedError {
    case networkError
    case unauthorized
    case insufficientBalance
    case invalidAmount
    case serverError(message: String)
    case unknown(Error)

    var errorDescription: String? {
        switch self {
        case .networkError:
            return "网络错误，请检查连接"
        case .unauthorized:
            return "未授权，请重新登录"
        case .insufficientBalance:
            return "积分余额不足"
        case .invalidAmount:
            return "无效的积分数量"
        case .serverError(let message):
            return "服务器错误: \(message)"
        case .unknown(let error):
            return error.localizedDescription
        }
    }
}

typealias PointsResult = Result<PointsBalance, PointsError>

enum PointsResult {
    case success(balance: PointsBalance)
    case invalidAmount
    case insufficientBalance
    case failed(error: PointsError)
}
