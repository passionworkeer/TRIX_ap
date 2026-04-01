//
//  PointsServiceTests.swift
//  TRIX3DCompanionTests
//
//  Focused unit tests for PointsService against the current API surface
//

import XCTest
import Combine
@testable import TRIX3DCompanion

@MainActor
final class PointsServiceTests: XCTestCase {

    private var pointsService: PointsService!
    private var mockAPIClient: PointsServiceTestsMockAPIClient!
    private var mockUserDefaults: PointsServiceTestsMockUserDefaultsStore!
    private var mockMutationService: PointsServiceTestsMockMutationService!
    private var cancellables: Set<AnyCancellable>!

    override func setUpWithError() throws {
        mockAPIClient = PointsServiceTestsMockAPIClient()
        mockUserDefaults = PointsServiceTestsMockUserDefaultsStore()
        mockMutationService = PointsServiceTestsMockMutationService()
        pointsService = PointsService(
            apiClient: mockAPIClient,
            userDefaults: mockUserDefaults,
            pointsMutationService: mockMutationService,
            enablePeriodicSync: false,
            performInitialRefresh: false
        )
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        pointsService = nil
        mockAPIClient = nil
        mockUserDefaults = nil
        mockMutationService = nil
        cancellables = nil
    }

    func test_refreshPoints_success() async {
        mockAPIClient.mockPointsResponse = makePointsResponse(
            totalPoints: 1500,
            level: 2,
            todayEarned: 100,
            weekEarned: 300,
            totalTransactions: 15
        )

        let result = await pointsService.refreshPoints()

        switch result {
        case .success(let balance):
            XCTAssertEqual(balance.totalPoints, 1500)
            XCTAssertEqual(balance.level, 2)
            XCTAssertEqual(balance.todayEarned, 100)
            XCTAssertEqual(pointsService.balance?.totalPoints, 1500)
        case .failure(let error):
            XCTFail("Expected success, got \(error)")
        }
    }

    func test_refreshPoints_networkError() async {
        mockAPIClient.mockNetworkError = .noConnection

        let result = await pointsService.refreshPoints()

        switch result {
        case .success:
            XCTFail("Expected network error")
        case .failure(let error):
            XCTAssertEqual(error, .networkError)
            XCTAssertEqual(pointsService.lastError, .networkError)
        }
    }

    func test_refreshPoints_unauthorized() async {
        mockAPIClient.mockNetworkError = .unauthorized

        let result = await pointsService.refreshPoints()

        switch result {
        case .success:
            XCTFail("Expected unauthorized")
        case .failure(let error):
            XCTAssertEqual(error, .unauthorized)
            XCTAssertEqual(pointsService.lastError, .unauthorized)
        }
    }

    func test_getBalance_returnsCachedBalanceWithinSyncWindow() async {
        mockAPIClient.mockPointsResponse = makePointsResponse(totalPoints: 2000, level: 3)
        _ = await pointsService.refreshPoints()

        let balance = await pointsService.getBalance()

        XCTAssertEqual(balance?.totalPoints, 2000)
        XCTAssertEqual(mockAPIClient.getPointsCallCount, 1)
    }

    func test_getBalance_refreshesWhenNeverSynced() async {
        mockAPIClient.mockPointsResponse = makePointsResponse(totalPoints: 2500, level: 4)

        let balance = await pointsService.getBalance()

        XCTAssertEqual(balance?.totalPoints, 2500)
        XCTAssertEqual(mockAPIClient.getPointsCallCount, 1)
    }

    func test_loadHistory_success() async {
        mockAPIClient.mockTransactions = [
            makePointsTransaction(
                id: "tx-1",
                pointsChange: 100,
                balanceAfter: 1100,
                type: .studyComplete,
                description: "完成学习"
            ),
            makePointsTransaction(
                id: "tx-2",
                pointsChange: 50,
                balanceAfter: 1150,
                type: .dailyLogin,
                description: "每日登录"
            )
        ]

        let result = await pointsService.loadHistory()

        switch result {
        case .success(let transactions):
            XCTAssertEqual(transactions.count, 2)
            XCTAssertEqual(transactions.first?.pointsChange, 100)
            XCTAssertEqual(transactions.first?.type, .earned)
        case .failure(let error):
            XCTFail("Expected success, got \(error)")
        }
    }

    func test_loadHistory_withTypeFilter() async {
        mockAPIClient.mockTransactions = [
            makePointsTransaction(
                id: "tx-1",
                pointsChange: 100,
                balanceAfter: 1100,
                type: .studyComplete
            ),
            makePointsTransaction(
                id: "tx-2",
                pointsChange: -100,
                balanceAfter: 1000,
                type: .redeem
            )
        ]

        let result = await pointsService.loadHistory(filter: PointsHistoryFilter(type: .earned))

        switch result {
        case .success(let transactions):
            XCTAssertEqual(transactions.count, 1)
            XCTAssertEqual(transactions.first?.pointsChange, 100)
            XCTAssertEqual(transactions.first?.type, .earned)
        case .failure(let error):
            XCTFail("Expected success, got \(error)")
        }
    }

    func test_loadHistory_withDateRangeFilter() async {
        let now = Date()
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: now)!

        mockAPIClient.mockTransactions = [
            makePointsTransaction(
                id: "tx-1",
                pointsChange: 100,
                balanceAfter: 1100,
                type: .studyComplete,
                createdAt: now
            ),
            makePointsTransaction(
                id: "tx-2",
                pointsChange: 50,
                balanceAfter: 1050,
                type: .dailyLogin,
                createdAt: yesterday
            )
        ]

        let filter = PointsHistoryFilter(
            startDate: now.addingTimeInterval(-1),
            endDate: now.addingTimeInterval(1)
        )
        let result = await pointsService.loadHistory(filter: filter)

        switch result {
        case .success(let transactions):
            XCTAssertEqual(transactions.count, 1)
            XCTAssertEqual(transactions.first?.id, "tx-1")
        case .failure(let error):
            XCTFail("Expected success, got \(error)")
        }
    }

    func test_loadHistory_withPagination() async {
        mockAPIClient.mockTransactions = (1...60).map { index in
            makePointsTransaction(
                id: "tx-\(index)",
                pointsChange: 10,
                balanceAfter: 1000 + (index * 10),
                type: .studyComplete,
                description: "学习 #\(index)"
            )
        }

        let filter = PointsHistoryFilter(limit: 20, offset: 0)
        let result = await pointsService.loadHistory(filter: filter)

        switch result {
        case .success(let transactions):
            XCTAssertEqual(transactions.count, 20)
            XCTAssertEqual(transactions.first?.id, "tx-1")
            XCTAssertEqual(mockAPIClient.lastHistoryPage, 1)
            XCTAssertEqual(mockAPIClient.lastHistoryLimit, 20)
        case .failure(let error):
            XCTFail("Expected success, got \(error)")
        }
    }

    func test_addPoints_success() async {
        mockMutationService.mockResponse = makePointsResponse(
            totalPoints: 2000,
            level: 2,
            todayEarned: 500,
            weekEarned: 700,
            totalTransactions: 15
        )

        let result = await pointsService.addPoints(
            500,
            description: "管理员奖励",
            metadata: ["source": "admin"]
        )

        switch result {
        case .success(let balance):
            XCTAssertEqual(balance.totalPoints, 2000)
            XCTAssertEqual(mockMutationService.lastPointsDelta, 500)
            XCTAssertEqual(mockMutationService.lastTransactionType, .adminAdjust)
        default:
            XCTFail("Expected success")
        }
    }

    func test_addPoints_invalidAmount() async {
        let result = await pointsService.addPoints(
            0,
            description: "无效积分",
            metadata: nil
        )

        switch result {
        case .invalidAmount:
            XCTAssertEqual(pointsService.lastError, .invalidAmount)
        default:
            XCTFail("Expected invalidAmount")
        }
    }

    func test_addPoints_networkError() async {
        mockMutationService.mockError = .noConnection

        let result = await pointsService.addPoints(
            100,
            description: "测试",
            metadata: nil
        )

        switch result {
        case .failed(let error):
            XCTAssertEqual(error, .networkError)
            XCTAssertEqual(pointsService.lastError, .networkError)
        default:
            XCTFail("Expected failed(networkError)")
        }
    }

    func test_deductPoints_success() async {
        mockAPIClient.mockPointsResponse = makePointsResponse(totalPoints: 1000, level: 1)
        _ = await pointsService.refreshPoints()

        mockMutationService.mockResponse = makePointsResponse(
            totalPoints: 800,
            level: 1,
            todayEarned: 0,
            weekEarned: 0,
            totalTransactions: 15
        )

        let result = await pointsService.deductPoints(
            200,
            description: "兑换商品",
            metadata: ["product": "item-123"]
        )

        switch result {
        case .success(let balance):
            XCTAssertEqual(balance.totalPoints, 800)
            XCTAssertEqual(mockMutationService.lastPointsDelta, -200)
            XCTAssertEqual(mockMutationService.lastTransactionType, .redeem)
        default:
            XCTFail("Expected success")
        }
    }

    func test_deductPoints_insufficientBalance() async {
        mockAPIClient.mockPointsResponse = makePointsResponse(totalPoints: 100, level: 1)
        _ = await pointsService.refreshPoints()

        let result = await pointsService.deductPoints(
            500,
            description: "积分不足",
            metadata: nil
        )

        switch result {
        case .insufficientBalance:
            XCTAssertEqual(pointsService.lastError, .insufficientBalance)
        default:
            XCTFail("Expected insufficientBalance")
        }
    }

    func test_deductPoints_invalidAmount() async {
        let result = await pointsService.deductPoints(
            -50,
            description: "测试",
            metadata: nil
        )

        switch result {
        case .invalidAmount:
            XCTAssertEqual(pointsService.lastError, .invalidAmount)
        default:
            XCTFail("Expected invalidAmount")
        }
    }

    func test_syncWithServer_success() async {
        mockAPIClient.mockPointsResponse = makePointsResponse(
            totalPoints: 3000,
            level: 3,
            todayEarned: 300,
            weekEarned: 900,
            totalTransactions: 30
        )

        let result = await pointsService.syncWithServer()

        switch result {
        case .success:
            XCTAssertEqual(pointsService.balance?.totalPoints, 3000)
        case .failure(let error):
            XCTFail("Expected success, got \(error)")
        }
    }

    func test_syncWithServer_failure() async {
        mockAPIClient.mockNetworkError = .timeout

        let result = await pointsService.syncWithServer()

        switch result {
        case .success:
            XCTFail("Expected network error")
        case .failure(let error):
            XCTAssertEqual(error, .networkError)
            XCTAssertEqual(pointsService.lastError, .networkError)
        }
    }

    func test_balance_publishedChanges() async {
        let expectation = expectation(description: "balance should publish change")

        pointsService.$balance
            .dropFirst()
            .sink { balance in
                if balance?.totalPoints == 5000 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        mockAPIClient.mockPointsResponse = makePointsResponse(totalPoints: 5000, level: 5)

        await pointsService.refreshPoints()

        await fulfillment(of: [expectation], timeout: 2.0)
    }

    func test_isLoading_updatesDuringRefresh() async {
        let expectation = expectation(description: "isLoading should toggle")
        var states: [Bool] = []

        pointsService.$isLoading
            .sink { isLoading in
                states.append(isLoading)
                if states.contains(true), states.last == false {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        mockAPIClient.mockPointsResponse = makePointsResponse(totalPoints: 1000, level: 1)
        mockAPIClient.responseDelayNanos = 50_000_000

        await pointsService.refreshPoints()

        await fulfillment(of: [expectation], timeout: 2.0)
        XCTAssertTrue(states.contains(true))
        XCTAssertTrue(states.contains(false))
    }

    func test_isSyncing_updatesDuringSync() async {
        let expectation = expectation(description: "isSyncing should toggle")
        var states: [Bool] = []

        pointsService.$isSyncing
            .sink { isSyncing in
                states.append(isSyncing)
                if states.contains(true), states.last == false {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        mockAPIClient.mockPointsResponse = makePointsResponse(totalPoints: 1000, level: 1)
        mockAPIClient.responseDelayNanos = 50_000_000

        _ = await pointsService.syncWithServer()

        await fulfillment(of: [expectation], timeout: 2.0)
        XCTAssertTrue(states.contains(true))
        XCTAssertTrue(states.contains(false))
    }

    func test_lastError_setOnFailure() async {
        let expectation = expectation(description: "lastError should publish")

        pointsService.$lastError
            .dropFirst()
            .sink { error in
                if error == .unauthorized {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        mockAPIClient.mockNetworkError = .unauthorized

        _ = await pointsService.refreshPoints()

        await fulfillment(of: [expectation], timeout: 2.0)
        XCTAssertEqual(pointsService.lastError, .unauthorized)
    }

    func test_clearError_removesLastError() async {
        mockAPIClient.mockNetworkError = .noConnection
        _ = await pointsService.refreshPoints()
        XCTAssertEqual(pointsService.lastError, .networkError)

        pointsService.clearError()

        XCTAssertNil(pointsService.lastError)
    }

    func test_transactionTypeMapping_coversCurrentCases() async {
        mockAPIClient.mockTransactions = [
            makePointsTransaction(id: "earned-study", pointsChange: 100, balanceAfter: 1100, type: .studyComplete),
            makePointsTransaction(id: "earned-streak", pointsChange: 50, balanceAfter: 1150, type: .studyStreak),
            makePointsTransaction(id: "earned-login", pointsChange: 20, balanceAfter: 1170, type: .dailyLogin),
            makePointsTransaction(id: "earned-achievement", pointsChange: 30, balanceAfter: 1200, type: .achievement),
            makePointsTransaction(id: "earned-share", pointsChange: 10, balanceAfter: 1210, type: .socialShare),
            makePointsTransaction(id: "redeemed", pointsChange: -100, balanceAfter: 1110, type: .redeem),
            makePointsTransaction(id: "admin", pointsChange: 500, balanceAfter: 1610, type: .adminAdjust)
        ]

        let result = await pointsService.loadHistory()

        switch result {
        case .success(let transactions):
            let mappedTypes = Dictionary(uniqueKeysWithValues: transactions.map { ($0.id, $0.type) })
            XCTAssertEqual(mappedTypes["earned-study"], .earned)
            XCTAssertEqual(mappedTypes["earned-streak"], .earned)
            XCTAssertEqual(mappedTypes["earned-login"], .earned)
            XCTAssertEqual(mappedTypes["earned-achievement"], .earned)
            XCTAssertEqual(mappedTypes["earned-share"], .earned)
            XCTAssertEqual(mappedTypes["redeemed"], .redeemed)
            XCTAssertEqual(mappedTypes["admin"], .admin)
        case .failure(let error):
            XCTFail("Expected success, got \(error)")
        }
    }

    func test_errorMapping_customMessage() async {
        mockAPIClient.mockNetworkError = .custom(message: "服务器错误")

        let result = await pointsService.refreshPoints()

        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .serverError(message: "服务器错误"))
        default:
            XCTFail("Expected serverError(message:)")
        }
    }

    func test_balanceCaching_storesAndLoadsCachedBalance() async {
        mockAPIClient.mockPointsResponse = makePointsResponse(totalPoints: 1800, level: 2)

        _ = await pointsService.refreshPoints()

        XCTAssertNotNil(mockUserDefaults.storedData["cached_points_balance"])

        let cachedService = PointsService(
            apiClient: mockAPIClient,
            userDefaults: mockUserDefaults,
            pointsMutationService: mockMutationService,
            enablePeriodicSync: false,
            performInitialRefresh: false
        )

        XCTAssertEqual(cachedService.balance?.totalPoints, 1800)
        XCTAssertEqual(cachedService.balance?.level, 2)
    }

    func test_pointsError_descriptions_exist() {
        XCTAssertNotNil(PointsError.networkError.localizedDescription)
        XCTAssertNotNil(PointsError.unauthorized.localizedDescription)
        XCTAssertNotNil(PointsError.insufficientBalance.localizedDescription)
        XCTAssertNotNil(PointsError.invalidAmount.localizedDescription)
    }

    func test_pointsResult_allCases() {
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

        if case .success = success {} else { XCTFail("Expected success") }
        if case .invalidAmount = invalid {} else { XCTFail("Expected invalidAmount") }
        if case .insufficientBalance = insufficient {} else { XCTFail("Expected insufficientBalance") }
        if case .failed = failed {} else { XCTFail("Expected failed") }
    }

    private func makePointsResponse(
        totalPoints: Int,
        level: Int,
        todayEarned: Int = 0,
        weekEarned: Int = 0,
        totalTransactions: Int = 0
    ) -> PointsResponse {
        PointsResponse(
            totalPoints: totalPoints,
            level: level,
            todayEarned: todayEarned,
            weekEarned: weekEarned,
            totalTransactions: totalTransactions
        )
    }

    private func makePointsTransaction(
        id: String,
        pointsChange: Int,
        balanceAfter: Int,
        type: TransactionType,
        description: String = "Test",
        createdAt: Date = Date()
    ) -> PointsTransaction {
        PointsTransaction(
            id: id,
            pointsChange: pointsChange,
            type: type,
            description: description,
            balanceAfter: balanceAfter,
            createdAt: createdAt
        )
    }
}

private final class PointsServiceTestsMockAPIClient: APIClientProtocol {
    var mockPointsResponse = PointsResponse(
        totalPoints: 0,
        level: 0,
        todayEarned: 0,
        weekEarned: 0,
        totalTransactions: 0
    )
    var mockTransactions: [PointsTransaction] = []
    var mockNetworkError: NetworkError?
    var responseDelayNanos: UInt64 = 0
    var getPointsCallCount = 0
    var lastHistoryPage: Int?
    var lastHistoryLimit: Int?

    func get<T: Codable>(_ endpoint: APIEndpoint) async throws -> T {
        throw NetworkError.custom(message: "Not implemented in PointsServiceTestsMockAPIClient")
    }

    func get<T: Decodable>(_ endpoint: APIEndpoint, parameters: [String : Any]) async throws -> T {
        throw NetworkError.custom(message: "Not implemented in PointsServiceTestsMockAPIClient")
    }

    func post<T: Codable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T {
        throw NetworkError.custom(message: "Not implemented in PointsServiceTestsMockAPIClient")
    }

    func put<T: Codable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T {
        throw NetworkError.custom(message: "Not implemented in PointsServiceTestsMockAPIClient")
    }

    func delete<T: Codable>(_ endpoint: APIEndpoint) async throws -> T {
        throw NetworkError.custom(message: "Not implemented in PointsServiceTestsMockAPIClient")
    }

    func upload<T: Codable>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T {
        throw NetworkError.custom(message: "Not implemented in PointsServiceTestsMockAPIClient")
    }

    func download(from url: String) async throws -> Data {
        throw NetworkError.custom(message: "Not implemented in PointsServiceTestsMockAPIClient")
    }

    func getPoints() async throws -> PointsResponse {
        getPointsCallCount += 1
        if responseDelayNanos > 0 {
            try await Task.sleep(nanoseconds: responseDelayNanos)
        }
        if let mockNetworkError {
            throw mockNetworkError
        }
        return mockPointsResponse
    }

    func getPointsHistory(page: Int, limit: Int) async throws -> [PointsTransaction] {
        lastHistoryPage = page
        lastHistoryLimit = limit
        if let mockNetworkError {
            throw mockNetworkError
        }

        let start = max(0, (page - 1) * limit)
        guard start < mockTransactions.count else {
            return []
        }

        let end = min(mockTransactions.count, start + limit)
        return Array(mockTransactions[start..<end])
    }
}

private final class PointsServiceTestsMockUserDefaultsStore: PointsServiceUserDefaultsStore {
    var storedData: [String: Data] = [:]

    func getData(forKey key: String) -> Data? {
        storedData[key]
    }

    func setData(_ data: Data, forKey key: String) {
        storedData[key] = data
    }
}

private final class PointsServiceTestsMockMutationService: PointsMutationServiceProtocol {
    var mockResponse = PointsResponse(
        totalPoints: 0,
        level: 0,
        todayEarned: 0,
        weekEarned: 0,
        totalTransactions: 0
    )
    var mockError: NetworkError?
    var lastPointsDelta: Int?
    var lastTransactionType: TransactionType?
    var lastDescription: String?
    var lastMetadata: [String: String]?

    func applyPointsChange(
        points delta: Int,
        transactionType: TransactionType,
        description: String,
        metadata: [String : String]?
    ) async throws -> PointsResponse {
        lastPointsDelta = delta
        lastTransactionType = transactionType
        lastDescription = description
        lastMetadata = metadata

        if let mockError {
            throw mockError
        }

        return mockResponse
    }
}
