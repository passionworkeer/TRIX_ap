//
//  PaymentServiceTests.swift
//  TRIX3DCompanionTests
//
//  Focused unit tests for PaymentService against the current API surface
//

import XCTest
import Combine
import StoreKit
@testable import TRIX3DCompanion

typealias PaymentTestsSubscriptionStatus = TRIX3DCompanion.SubscriptionStatus
typealias PaymentTestsStoreKitError = TRIX3DCompanion.StoreKitError

@MainActor
final class PaymentServiceTests: XCTestCase {

    private var paymentService: PaymentService!
    private var mockStoreKitService: PaymentServiceTestsMockStoreKitService!
    private var mockPointsService: PaymentServiceTestsMockPointsService!
    private var mockAPIClient: PaymentServiceTestsMockAPIClient!
    private var cancellables: Set<AnyCancellable>!

    override func setUpWithError() throws {
        mockStoreKitService = PaymentServiceTestsMockStoreKitService()
        mockPointsService = PaymentServiceTestsMockPointsService()
        mockAPIClient = PaymentServiceTestsMockAPIClient()
        paymentService = PaymentService(
            storeKitService: mockStoreKitService,
            pointsService: mockPointsService,
            apiClient: mockAPIClient
        )
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        paymentService = nil
        mockStoreKitService = nil
        mockPointsService = nil
        mockAPIClient = nil
        cancellables = nil
    }

    func test_purchasePoints_pendingReturnsPendingOrder() async {
        mockStoreKitService.setMockPurchasePending()

        let result = await paymentService.purchasePoints(
            productId: StoreProductConfiguration.points100,
            points: 100
        )

        switch result {
        case .pending(let order):
            XCTAssertEqual(order.productId, StoreProductConfiguration.points100)
            XCTAssertEqual(order.status, .pending)
            XCTAssertEqual(order.points, 100)
        default:
            XCTFail("Expected pending order")
        }
    }

    func test_purchasePoints_cancelledReturnsCancelled() async {
        mockStoreKitService.setMockPurchaseCancelled()

        let result = await paymentService.purchasePoints(
            productId: StoreProductConfiguration.points300,
            points: 330
        )

        switch result {
        case .cancelled:
            break
        default:
            XCTFail("Expected cancelled result")
        }
    }

    func test_purchasePoints_failedWrapsStoreKitError() async {
        mockStoreKitService.setMockPurchaseFailed(.productNotFound)

        let result = await paymentService.purchasePoints(
            productId: StoreProductConfiguration.points500,
            points: 580
        )

        switch result {
        case .failed(let error):
            XCTAssertEqual(error, .paymentFailed(underlying: StoreKitError.productNotFound))
        default:
            XCTFail("Expected failed result")
        }
    }

    func test_subscribe_pendingReturnsPendingOrder() async {
        mockStoreKitService.setMockPurchasePending()

        let result = await paymentService.subscribe(productId: StoreProductConfiguration.monthlySubscription)

        switch result {
        case .pending(let order):
            XCTAssertEqual(order.productId, StoreProductConfiguration.monthlySubscription)
            XCTAssertEqual(order.productType, .subscription)
            XCTAssertEqual(order.status, .pending)
        default:
            XCTFail("Expected pending subscription order")
        }
    }

    func test_subscribe_cancelledReturnsCancelled() async {
        mockStoreKitService.setMockPurchaseCancelled()

        let result = await paymentService.subscribe(productId: StoreProductConfiguration.yearlySubscription)

        switch result {
        case .cancelled:
            break
        default:
            XCTFail("Expected cancelled result")
        }
    }

    func test_verifyReceipt_successCachesOrderAndRefreshesPoints() async {
        let response = makeVerificationResponse(
            orderId: "order-success",
            status: .completed,
            pointsAdded: 100
        )
        mockAPIClient.verifyReceiptResponse = response

        let result = await paymentService.verifyReceipt(
            transactionId: "txn-success",
            productId: StoreProductConfiguration.points100,
            receiptData: nil
        )

        switch result {
        case .success(let order):
            XCTAssertEqual(order.id, "order-success")
            XCTAssertEqual(order.productId, StoreProductConfiguration.points100)
            XCTAssertEqual(order.status, .completed)
            XCTAssertEqual(mockPointsService.refreshPointsCallCount, 1)

            let cachedOrder = await paymentService.getAppOrder(orderId: order.id)
            XCTAssertEqual(cachedOrder?.id, order.id)
        case .failure(let error):
            XCTFail("Expected success, got \(error)")
        }
    }

    func test_verifyReceipt_invalidProductFailsBeforeNetwork() async {
        let result = await paymentService.verifyReceipt(
            transactionId: "txn-invalid",
            productId: "invalid.product.id",
            receiptData: nil
        )

        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .invalidProduct)
            XCTAssertEqual(mockAPIClient.verifyReceiptCallCount, 0)
        default:
            XCTFail("Expected invalid product failure")
        }
    }

    func test_verifyReceipt_networkErrorSetsLastError() async {
        let expectation = expectation(description: "lastError publishes networkError")
        paymentService.$lastError
            .dropFirst()
            .sink { error in
                if error == .networkError {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        mockAPIClient.verifyReceiptError = .noConnection

        let result = await paymentService.verifyReceipt(
            transactionId: "txn-network",
            productId: StoreProductConfiguration.points100,
            receiptData: nil
        )

        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .networkError)
        default:
            XCTFail("Expected network error")
        }

        await fulfillment(of: [expectation], timeout: 2.0)
        XCTAssertEqual(paymentService.lastError, .networkError)
    }

    func test_getAppOrderHistoryReturnsCachedOrders() async {
        mockAPIClient.verifyReceiptResponse = makeVerificationResponse(
            orderId: "order-1",
            status: .completed,
            pointsAdded: 100
        )
        _ = await paymentService.verifyReceipt(
            transactionId: "txn-1",
            productId: StoreProductConfiguration.points100,
            receiptData: nil
        )

        mockAPIClient.verifyReceiptResponse = makeVerificationResponse(
            orderId: "order-2",
            status: .completed,
            pointsAdded: 330
        )
        _ = await paymentService.verifyReceipt(
            transactionId: "txn-2",
            productId: StoreProductConfiguration.points300,
            receiptData: nil
        )

        let history = await paymentService.getAppOrderHistory(limit: 10, offset: 0)
        XCTAssertEqual(history.count, 2)
        XCTAssertEqual(Set(history.map(\.id)), Set(["order-1", "order-2"]))
    }

    func test_cancelAppOrder_successRemovesPendingOrder() async {
        mockAPIClient.verifyReceiptResponse = makeVerificationResponse(
            orderId: "order-pending",
            status: .pending,
            pointsAdded: 100
        )

        let verifyResult = await paymentService.verifyReceipt(
            transactionId: "txn-pending",
            productId: StoreProductConfiguration.points100,
            receiptData: nil
        )

        guard case .success(let order) = verifyResult else {
            return XCTFail("Expected pending order to be cached")
        }

        let cancelResult = await paymentService.cancelAppOrder(orderId: order.id)

        switch cancelResult {
        case .success:
            XCTAssertEqual(mockAPIClient.cancelledOrderIds, [order.id])
            let history = await paymentService.getAppOrderHistory(limit: 10, offset: 0)
            XCTAssertTrue(history.isEmpty)
        case .failure(let error):
            XCTFail("Expected successful cancellation, got \(error)")
        }
    }

    func test_cancelAppOrder_missingOrderReturnsNotFound() async {
        let result = await paymentService.cancelAppOrder(orderId: "missing-order")

        switch result {
        case .failure(let error):
            XCTAssertEqual(error, .orderNotFound)
        default:
            XCTFail("Expected orderNotFound failure")
        }
    }

    func test_getSubscriptionMapsResponse() async {
        mockAPIClient.subscriptionResponse = SubscriptionStatusResponse(
            isActive: true,
            tier: "pro",
            productId: StoreProductConfiguration.monthlySubscription,
            expiresAt: Date().addingTimeInterval(3600),
            willAutoRenew: true,
            startedAt: Date().addingTimeInterval(-3600),
            updatedAt: Date()
        )

        let subscription = await paymentService.getSubscription()

        XCTAssertTrue(subscription.isActive)
        XCTAssertEqual(subscription.productId, StoreProductConfiguration.monthlySubscription)
        XCTAssertEqual(subscription.tier, "pro")
    }

    func test_restorePurchasesCachesOrdersAndRefreshesPoints() async {
        mockAPIClient.restorePurchasesResponse = RestorePurchasesResponse(
            restoredOrders: [
                makeOrderDetailsResponse(
                    id: "restored-1",
                    productId: StoreProductConfiguration.points500,
                    status: .completed,
                    points: 580
                )
            ],
            totalRestored: 1,
            message: nil
        )

        let result = await paymentService.restorePurchases()

        switch result {
        case .success(let orders):
            XCTAssertEqual(orders.count, 1)
            XCTAssertEqual(orders.first?.id, "restored-1")
            XCTAssertEqual(mockPointsService.refreshPointsCallCount, 1)
        case .failure(let error):
            XCTFail("Expected restore success, got \(error)")
        }
    }

    func test_isProcessingPublishesDuringPurchase() async {
        let expectation = expectation(description: "isProcessing toggles")
        var observedStates: [Bool] = []

        paymentService.$isProcessing
            .dropFirst()
            .prefix(2)
            .sink { isProcessing in
                observedStates.append(isProcessing)
                if observedStates.count == 2 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        mockStoreKitService.setMockPurchaseCancelled()
        _ = await paymentService.purchasePoints(
            productId: StoreProductConfiguration.points100,
            points: 100
        )

        await fulfillment(of: [expectation], timeout: 2.0)
        XCTAssertTrue(observedStates.contains(true))
        XCTAssertTrue(observedStates.contains(false))
    }

    func test_clearErrorRemovesLastError() async {
        mockAPIClient.verifyReceiptError = .noConnection
        _ = await paymentService.verifyReceipt(
            transactionId: "txn-clear",
            productId: StoreProductConfiguration.points100,
            receiptData: nil
        )
        XCTAssertEqual(paymentService.lastError, .networkError)

        paymentService.clearError()

        XCTAssertNil(paymentService.lastError)
    }

    private func makeVerificationResponse(
        orderId: String,
        status: PaymentStatus,
        pointsAdded: Int?
    ) -> ReceiptVerificationResponse {
        ReceiptVerificationResponse(
            orderId: orderId,
            status: status,
            pointsAdded: pointsAdded,
            totalPoints: 1000 + (pointsAdded ?? 0),
            subscriptionStatus: nil,
            verified: true,
            message: nil
        )
    }

    private func makeOrderDetailsResponse(
        id: String,
        productId: String,
        status: PaymentStatus,
        points: Int?
    ) -> OrderDetailsResponse {
        OrderDetailsResponse(
            id: id,
            userId: "user-1",
            productId: productId,
            amount: 6.0,
            currency: "CNY",
            status: status,
            transactionId: "txn-\(id)",
            points: points,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}

private final class PaymentServiceTestsMockAPIClient: APIClientProtocol {
    var verifyReceiptResponse: ReceiptVerificationResponse?
    var verifyReceiptError: NetworkError?
    var ordersListResponse = OrdersListResponse(orders: [], total: 0, page: 1, limit: 50)
    var orderDetailsResponses: [String: OrderDetailsResponse] = [:]
    var subscriptionResponse = SubscriptionStatusResponse(
        isActive: false,
        tier: nil,
        productId: nil,
        expiresAt: nil,
        willAutoRenew: false,
        startedAt: nil,
        updatedAt: nil
    )
    var restorePurchasesResponse = RestorePurchasesResponse(
        restoredOrders: [],
        totalRestored: 0,
        message: nil
    )

    var verifyReceiptCallCount = 0
    var cancelledOrderIds: [String] = []

    func get<T: Codable>(_ endpoint: APIEndpoint) async throws -> T {
        throw NetworkError.custom(message: "Not implemented in PaymentServiceTestsMockAPIClient")
    }

    func get<T: Decodable>(_ endpoint: APIEndpoint, parameters: [String : Any]) async throws -> T {
        throw NetworkError.custom(message: "Not implemented in PaymentServiceTestsMockAPIClient")
    }

    func post<T: Codable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T {
        throw NetworkError.custom(message: "Not implemented in PaymentServiceTestsMockAPIClient")
    }

    func put<T: Codable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T {
        throw NetworkError.custom(message: "Not implemented in PaymentServiceTestsMockAPIClient")
    }

    func delete<T: Codable>(_ endpoint: APIEndpoint) async throws -> T {
        throw NetworkError.custom(message: "Not implemented in PaymentServiceTestsMockAPIClient")
    }

    func upload<T: Codable>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T {
        throw NetworkError.custom(message: "Not implemented in PaymentServiceTestsMockAPIClient")
    }

    func download(from url: String) async throws -> Data {
        throw NetworkError.custom(message: "Not implemented in PaymentServiceTestsMockAPIClient")
    }

    func verifyReceipt(_ request: ReceiptVerificationRequest) async throws -> ReceiptVerificationResponse {
        verifyReceiptCallCount += 1
        if let verifyReceiptError {
            throw verifyReceiptError
        }
        guard let verifyReceiptResponse else {
            throw NetworkError.custom(message: "Missing mock verifyReceiptResponse")
        }
        return verifyReceiptResponse
    }

    func getOrders(page: Int, limit: Int) async throws -> OrdersListResponse {
        ordersListResponse
    }

    func getOrder(orderId: String) async throws -> OrderDetailsResponse {
        if let response = orderDetailsResponses[orderId] {
            return response
        }
        throw NetworkError.notFound
    }

    func cancelOrder(orderId: String) async throws {
        cancelledOrderIds.append(orderId)
    }

    func getSubscription() async throws -> SubscriptionStatusResponse {
        subscriptionResponse
    }

    func restorePurchases() async throws -> RestorePurchasesResponse {
        restorePurchasesResponse
    }
}

@MainActor
private final class PaymentServiceTestsMockStoreKitService: StoreKitServiceProtocol {
    @Published var availableProducts: [StoreProduct] = []
    @Published var isLoadingProducts: Bool = false
    @Published var subscriptionStatus: PaymentTestsSubscriptionStatus?
    @Published var isPurchasing: Bool = false
    @Published var lastError: PaymentTestsStoreKitError?

    var mockPurchaseResult: PurchaseResult = .cancelled
    var mockTransactionInfo: TransactionInfo?

    func loadProducts(productIds: [String]) async -> Result<Void, PaymentTestsStoreKitError> {
        .success(())
    }

    func purchase(product productId: String) async -> PurchaseResult {
        isPurchasing = true
        defer { isPurchasing = false }
        return mockPurchaseResult
    }

    func restorePurchases() async -> Result<[TransactionInfo], PaymentTestsStoreKitError> {
        .success([])
    }

    func checkSubscriptionStatus() async -> PaymentTestsSubscriptionStatus? {
        subscriptionStatus
    }

    func getTransactionHistory() async -> [TransactionInfo] {
        []
    }

    func getReceiptData() async -> String? {
        nil
    }

    func getLatestTransactionId(for productId: String) async -> String? {
        nil
    }

    func getTransactionInfo(transactionId: String) async -> TransactionInfo? {
        mockTransactionInfo
    }

    func prepareVerificationPayload(transaction: Transaction, productId: String) -> [String : Any]? {
        nil
    }

    func clearError() {
        lastError = nil
    }

    func setMockPurchasePending() {
        mockPurchaseResult = .pending
    }

    func setMockPurchaseCancelled() {
        mockPurchaseResult = .cancelled
    }

    func setMockPurchaseFailed(_ error: PaymentTestsStoreKitError) {
        mockPurchaseResult = .failed(error: error)
        lastError = error
    }
}

@MainActor
private final class PaymentServiceTestsMockPointsService: PointsServiceProtocol {
    @Published var balance: PointsBalance? = PointsBalance(
        totalPoints: 1000,
        availablePoints: 1000,
        pendingPoints: 0,
        level: 1,
        todayEarned: 0,
        weekEarned: 0,
        totalTransactions: 0,
        updatedAt: Date()
    )
    @Published var transactions: [PointsTransactionDetail] = []
    @Published var isLoading: Bool = false
    @Published var isSyncing: Bool = false
    @Published var lastError: PointsError?

    var refreshPointsCallCount = 0

    func refreshPoints() async -> Result<PointsBalance, PointsError> {
        refreshPointsCallCount += 1
        return .success(balance!)
    }

    func getBalance() async -> PointsBalance? {
        balance
    }

    func loadHistory(filter: PointsHistoryFilter?) async -> Result<[PointsTransactionDetail], PointsError> {
        .success([])
    }

    func addPoints(_ points: Int, description: String, metadata: [String : String]?) async -> PointsResult {
        .success(balance: balance!)
    }

    func deductPoints(_ points: Int, description: String, metadata: [String : String]?) async -> PointsResult {
        .success(balance: balance!)
    }

    func syncWithServer() async -> Result<Void, PointsError> {
        .success(())
    }

    func clearError() {
        lastError = nil
    }
}
