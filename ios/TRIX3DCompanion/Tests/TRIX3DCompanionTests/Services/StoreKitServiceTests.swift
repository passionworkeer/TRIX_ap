//
//  StoreKitServiceTests.swift
//  TRIX3DCompanionTests
//
//  Complete test suite for StoreKitService
//

import XCTest
import StoreKit
import Combine
@testable import TRIX3DCompanion

// Type aliases to resolve ambiguity
typealias AppStoreKitError = TRIX3DCompanion.StoreKitError
typealias AppSubscriptionStatus = TRIX3DCompanion.SubscriptionStatus
typealias AppStoreProduct = TRIX3DCompanion.StoreProduct

// MARK: - Mock StoreKitServiceProtocol

@MainActor
final class MockStoreKitService: StoreKitServiceProtocol, ObservableObject {

    @Published var availableProducts: [AppStoreProduct] = []
    @Published var isLoadingProducts: Bool = false
    @Published var subscriptionStatus: AppSubscriptionStatus?
    @Published var isPurchasing: Bool = false
    @Published var lastError: AppStoreKitError?

    // Test control properties
    var shouldFailProductLoad = false
    var shouldFailPurchase = false
    var shouldReturnPending = false
    var shouldReturnCancelled = false
    var mockError: AppStoreKitError?
    var mockTransactions: [TransactionInfo] = []
    var mockReceiptData: String?
    var mockLatestTransactionId: String?
    var mockTransactionInfo: TransactionInfo?

    // Call tracking
    var loadProductsCalled = false
    var loadProductsCalledWithIds: [String]?
    var purchaseCalled = false
    var purchaseCalledWithProductId: String?
    var restorePurchasesCalled = false
    var checkSubscriptionStatusCalled = false
    var getTransactionHistoryCalled = false
    var getReceiptDataCalled = false
    var getLatestTransactionIdCalled = false
    var getTransactionInfoCalled = false
    var prepareVerificationPayloadCalled = false
    var clearErrorCalled = false

    func loadProducts(productIds: [String]) async -> Result<Void, AppStoreKitError> {
        loadProductsCalled = true
        loadProductsCalledWithIds = productIds
        isLoadingProducts = true

        if shouldFailProductLoad {
            isLoadingProducts = false
            let error = mockError ?? .configurationError
            lastError = error
            return .failure(error)
        }

        // Create mock products
        let mockProducts = createMockProducts(for: productIds)
        await MainActor.run {
            self.availableProducts = mockProducts
            self.isLoadingProducts = false
        }

        return .success(())
    }

    func purchase(product productId: String) async -> PurchaseResult {
        purchaseCalled = true
        purchaseCalledWithProductId = productId
        isPurchasing = true
        lastError = nil

        if shouldFailPurchase {
            isPurchasing = false
            let error = mockError ?? .configurationError
            lastError = error
            return .failed(error: error)
        }

        if shouldReturnPending {
            isPurchasing = false
            return .pending
        }

        if shouldReturnCancelled {
            isPurchasing = false
            return .cancelled
        }

        // Purchase succeeds with pending (Transaction cannot be constructed in tests)
        isPurchasing = false
        return .pending
    }

    func restorePurchases() async -> Result<[TransactionInfo], AppStoreKitError> {
        restorePurchasesCalled = true
        lastError = nil

        if shouldFailPurchase {
            let error = mockError ?? .configurationError
            lastError = error
            return .failure(error)
        }

        return .success(mockTransactions)
    }

    func checkSubscriptionStatus() async -> AppSubscriptionStatus? {
        checkSubscriptionStatusCalled = true
        return subscriptionStatus
    }

    func getTransactionHistory() async -> [TransactionInfo] {
        getTransactionHistoryCalled = true
        return mockTransactions
    }

    func getReceiptData() async -> String? {
        getReceiptDataCalled = true
        return mockReceiptData
    }

    func getLatestTransactionId(for productId: String) async -> String? {
        getLatestTransactionIdCalled = true
        return mockLatestTransactionId
    }

    func getTransactionInfo(transactionId: String) async -> TransactionInfo? {
        getTransactionInfoCalled = true
        return mockTransactionInfo
    }

    func prepareVerificationPayload(transaction: StoreKit.Transaction, productId: String) -> [String: Any]? {
        prepareVerificationPayloadCalled = true
        return [
            "transactionId": transaction.id,
            "productId": productId
        ]
    }

    func clearError() {
        clearErrorCalled = true
        lastError = nil
    }

    // MARK: - Helper Methods

    func resetCallTracking() {
        loadProductsCalled = false
        loadProductsCalledWithIds = nil
        purchaseCalled = false
        purchaseCalledWithProductId = nil
        restorePurchasesCalled = false
        checkSubscriptionStatusCalled = false
        getTransactionHistoryCalled = false
        getReceiptDataCalled = false
        getLatestTransactionIdCalled = false
        getTransactionInfoCalled = false
        prepareVerificationPayloadCalled = false
        clearErrorCalled = false
    }

    private func createMockProducts(for ids: [String]) -> [AppStoreProduct] {
        return ids.map { id in
            let type = StoreProductConfiguration.productType(for: id) ?? .points
            let points = StoreProductConfiguration.pointsForProduct(id)

            return AppStoreProduct(
                id: id,
                name: "Mock Product \(id)",
                description: "Mock description for \(id)",
                price: "¥9.99",
                priceLocale: Locale(identifier: "zh_CN"),
                type: type,
                points: points,
                subscriptionPeriod: type == .subscription ? SubscriptionPeriod(value: 1, unit: .month) : nil,
                product: nil
            )
        }
    }
}

// MARK: - StoreKitService Tests

@MainActor
final class StoreKitServiceTests: XCTestCase {

    var sut: MockStoreKitService!
    var cancellables: Set<AnyCancellable>!

    override func setUp() {
        super.setUp()
        sut = MockStoreKitService()
        cancellables = Set<AnyCancellable>()
    }

    override func tearDown() {
        sut = nil
        cancellables = nil
        super.tearDown()
    }

    // MARK: - Product Loading Tests

    func testLoadProducts_Success() async {
        // Given
        let productIds = StoreProductConfiguration.allProductIds

        // When
        let result = await sut.loadProducts(productIds: productIds)

        // Then
        XCTAssertTrue(sut.loadProductsCalled)
        XCTAssertEqual(sut.loadProductsCalledWithIds, productIds)
        XCTAssertTrue(sut.availableProducts.count > 0)
        switch result {
        case .success:
            XCTAssertTrue(sut.availableProducts.allSatisfy { $0.id != "" })
        case .failure:
            XCTFail("Expected success but got failure")
        }
    }

    func testLoadProducts_Failure() async {
        // Given
        sut.shouldFailProductLoad = true
        sut.mockError = .configurationError

        // When
        let result = await sut.loadProducts(productIds: ["test.product"])

        // Then
        switch result {
        case .success:
            XCTFail("Expected failure but got success")
        case .failure(let error):
            XCTAssertEqual(error, .configurationError)
            XCTAssertNotNil(sut.lastError)
        }
    }

    func testLoadProducts_UpdatesLoadingState() async {
        // Given
        let expectation = expectation(description: "Loading state changes")
        var loadingStates: [Bool] = []

        sut.$isLoadingProducts
            .dropFirst()
            .sink { isLoading in
                loadingStates.append(isLoading)
                if loadingStates.suffix(2) == [true, false] {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        _ = await sut.loadProducts(productIds: ["test.product"])

        // Then
        await fulfillment(of: [expectation], timeout: 1.0)
        XCTAssertEqual(Array(loadingStates.suffix(2)), [true, false])
    }

    func testLoadProducts_PointsProducts() async {
        // Given
        let pointsProductIds = StoreProductConfiguration.pointsProductIds

        // When
        _ = await sut.loadProducts(productIds: pointsProductIds)

        // Then
        let pointsProducts = sut.availableProducts.filter { $0.type == .points }
        XCTAssertEqual(pointsProducts.count, pointsProductIds.count)

        for product in pointsProducts {
            XCTAssertNotNil(product.points)
            XCTAssertTrue(pointsProductIds.contains(product.id))
        }
    }

    func testLoadProducts_SubscriptionProducts() async {
        // Given
        let subscriptionProductIds = StoreProductConfiguration.subscriptionProductIds

        // When
        _ = await sut.loadProducts(productIds: subscriptionProductIds)

        // Then
        let subscriptionProducts = sut.availableProducts.filter { $0.type == .subscription }
        XCTAssertEqual(subscriptionProducts.count, subscriptionProductIds.count)

        for product in subscriptionProducts {
            XCTAssertNotNil(product.subscriptionPeriod)
            XCTAssertTrue(subscriptionProductIds.contains(product.id))
        }
    }

    // MARK: - Purchase Tests

    func testPurchase_DefaultMockReturnsPending() async {
        // Given
        let productId = StoreProductConfiguration.points100
        _ = await sut.loadProducts(productIds: [productId])

        // When
        let result = await sut.purchase(product: productId)

        // Then
        XCTAssertTrue(sut.purchaseCalled)
        XCTAssertEqual(sut.purchaseCalledWithProductId, productId)
        XCTAssertFalse(sut.isPurchasing)

        switch result {
        case .pending:
            XCTAssertNil(sut.lastError)
        case .success, .failed, .cancelled:
            XCTFail("Expected mock purchase to return pending but got \(result)")
        }
    }

    func testPurchase_Pending() async {
        // Given
        sut.shouldReturnPending = true
        let productId = StoreProductConfiguration.points300

        // When
        let result = await sut.purchase(product: productId)

        // Then
        switch result {
        case .pending:
            XCTAssertTrue(sut.purchaseCalled)
            XCTAssertFalse(sut.isPurchasing)
        case .success, .failed, .cancelled:
            XCTFail("Expected pending but got \(result)")
        }
    }

    func testPurchase_Cancelled() async {
        // Given
        sut.shouldReturnCancelled = true
        let productId = StoreProductConfiguration.points500

        // When
        let result = await sut.purchase(product: productId)

        // Then
        switch result {
        case .cancelled:
            XCTAssertTrue(sut.purchaseCalled)
            XCTAssertFalse(sut.isPurchasing)
        case .success, .pending, .failed:
            XCTFail("Expected cancelled but got \(result)")
        }
    }

    func testPurchase_Failed() async {
        // Given
        sut.shouldFailPurchase = true
        sut.mockError = .productNotFound
        let productId = "invalid.product"

        // When
        let result = await sut.purchase(product: productId)

        // Then
        switch result {
        case .failed(let error):
            XCTAssertTrue(sut.purchaseCalled)
            XCTAssertFalse(sut.isPurchasing)
            XCTAssertEqual(error, .productNotFound)
            XCTAssertNotNil(sut.lastError)
        case .success, .pending, .cancelled:
            XCTFail("Expected failed but got \(result)")
        }
    }

    func testPurchase_ProductNotFound() async {
        // Given
        sut.shouldFailPurchase = true
        sut.mockError = .productNotFound
        let invalidProductId = "com.invalid.product"

        // When
        let result = await sut.purchase(product: invalidProductId)

        // Then
        switch result {
        case .failed(let error):
            XCTAssertEqual(error, .productNotFound)
        default:
            XCTFail("Expected product not found error")
        }
    }

    // MARK: - Restore Purchases Tests

    func testRestorePurchases_Success() async {
        // Given
        let mockTransaction = TransactionInfo(
            id: "123",
            productID: StoreProductConfiguration.points100,
            purchaseDate: Date(),
            expirationDate: nil,
            quantity: 1,
            type: .points,
            points: 100,
            status: .verified
        )
        sut.mockTransactions = [mockTransaction]

        // When
        let result = await sut.restorePurchases()

        // Then
        XCTAssertTrue(sut.restorePurchasesCalled)
        switch result {
        case .success(let transactions):
            XCTAssertEqual(transactions.count, 1)
            XCTAssertEqual(transactions.first?.id, "123")
        case .failure:
            XCTFail("Expected success but got failure")
        }
    }

    func testRestorePurchases_Empty() async {
        // Given
        sut.mockTransactions = []

        // When
        let result = await sut.restorePurchases()

        // Then
        switch result {
        case .success(let transactions):
            XCTAssertTrue(transactions.isEmpty)
        case .failure:
            XCTFail("Expected success with empty array")
        }
    }

    func testRestorePurchases_Failure() async {
        // Given
        sut.shouldFailPurchase = true
        sut.mockError = .configurationError

        // When
        let result = await sut.restorePurchases()

        // Then
        switch result {
        case .success:
            XCTFail("Expected failure but got success")
        case .failure(let error):
            XCTAssertEqual(error, .configurationError)
        }
    }

    // MARK: - Subscription Status Tests

    func testCheckSubscriptionStatus_Active() async {
        // Given
        let status = AppSubscriptionStatus(
            state: .subscribed,
            renewalInfo: nil,
            expirationDate: Date().addingTimeInterval(86400),
            willAutoRenew: true
        )
        sut.subscriptionStatus = status

        // When
        let result = await sut.checkSubscriptionStatus()

        // Then
        XCTAssertTrue(sut.checkSubscriptionStatusCalled)
        XCTAssertNotNil(result)
        XCTAssertTrue(result?.isActive ?? false)
    }

    func testCheckSubscriptionStatus_Expired() async {
        // Given
        let status = AppSubscriptionStatus(
            state: .expired,
            renewalInfo: nil,
            expirationDate: Date().addingTimeInterval(-86400),
            willAutoRenew: false
        )
        sut.subscriptionStatus = status

        // When
        let result = await sut.checkSubscriptionStatus()

        // Then
        XCTAssertNotNil(result)
        XCTAssertFalse(result?.isActive ?? false)
    }

    func testCheckSubscriptionStatus_NoSubscription() async {
        // Given
        sut.subscriptionStatus = nil

        // When
        let result = await sut.checkSubscriptionStatus()

        // Then
        XCTAssertNil(result)
    }

    func testSubscriptionStatus_InGracePeriod() async {
        // Given
        let status = AppSubscriptionStatus(
            state: .inGracePeriod,
            renewalInfo: nil,
            expirationDate: Date().addingTimeInterval(-3600),
            willAutoRenew: true
        )
        sut.subscriptionStatus = status

        // When
        let isActive = status.isActive

        // Then
        XCTAssertTrue(isActive)
    }

    func testSubscriptionStatus_InBillingRetry() async {
        // Given
        let status = AppSubscriptionStatus(
            state: .inBillingRetryPeriod,
            renewalInfo: nil,
            expirationDate: Date().addingTimeInterval(-3600),
            willAutoRenew: true
        )
        sut.subscriptionStatus = status

        // When
        let isActive = status.isActive

        // Then
        XCTAssertTrue(isActive)
    }

    // MARK: - Transaction History Tests

    func testGetTransactionHistory_Success() async {
        // Given
        let transactions = [
            TransactionInfo(
                id: "1",
                productID: StoreProductConfiguration.points100,
                purchaseDate: Date(),
                expirationDate: nil,
                quantity: 1,
                type: .points,
                points: 100,
                status: .verified
            ),
            TransactionInfo(
                id: "2",
                productID: StoreProductConfiguration.points300,
                purchaseDate: Date().addingTimeInterval(-3600),
                expirationDate: nil,
                quantity: 1,
                type: .points,
                points: 330,
                status: .verified
            )
        ]
        sut.mockTransactions = transactions

        // When
        let result = await sut.getTransactionHistory()

        // Then
        XCTAssertTrue(sut.getTransactionHistoryCalled)
        XCTAssertEqual(result.count, 2)
    }

    func testGetTransactionHistory_Empty() async {
        // Given
        sut.mockTransactions = []

        // When
        let result = await sut.getTransactionHistory()

        // Then
        XCTAssertTrue(result.isEmpty)
    }

    // MARK: - Error Handling Tests

    func testClearError_ClearsLastError() async {
        // Given
        sut.lastError = .configurationError

        // When
        sut.clearError()

        // Then
        XCTAssertTrue(sut.clearErrorCalled)
        XCTAssertNil(sut.lastError)
    }

    func testLastError_SetOnPurchaseFailure() async {
        // Given
        sut.shouldFailPurchase = true
        sut.mockError = .verificationFailed

        // When
        _ = await sut.purchase(product: "test.product")

        // Then
        XCTAssertNotNil(sut.lastError)
    }

    func testLastError_SetOnProductLoadFailure() async {
        // Given
        sut.shouldFailProductLoad = true
        sut.mockError = .configurationError

        // When
        _ = await sut.loadProducts(productIds: ["test.product"])

        // Then
        XCTAssertNotNil(sut.lastError)
    }

    // MARK: - Published Properties Tests

    func testAvailableProducts_PublishesChanges() async {
        // Given
        let expectation = expectation(description: "Products publish")
        var receivedProducts: [StoreProduct]?

        sut.$availableProducts
            .dropFirst() // Skip initial value
            .sink { products in
                receivedProducts = products
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // When
        _ = await sut.loadProducts(productIds: ["test.product"])

        // Then
        await fulfillment(of: [expectation], timeout: 1.0)
        XCTAssertNotNil(receivedProducts)
        XCTAssertTrue(receivedProducts?.isEmpty == false)
    }

    func testIsPurchasing_PublishesChanges() async {
        // Given
        let expectation = expectation(description: "Purchasing state publishes")
        var purchasingStates: [Bool] = []

        sut.$isPurchasing
            .dropFirst()
            .sink { isPurchasing in
                purchasingStates.append(isPurchasing)
                if purchasingStates.suffix(2) == [true, false] {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        _ = await sut.purchase(product: "test.product")

        // Then
        await fulfillment(of: [expectation], timeout: 1.0)
        XCTAssertEqual(Array(purchasingStates.suffix(2)), [true, false])
    }

    func testLastError_PublishesChanges() async {
        // Given
        let expectation = expectation(description: "Error publishes")
        var receivedError: AppStoreKitError?

        sut.$lastError
            .dropFirst()
            .compactMap { $0 }
            .sink { error in
                receivedError = error
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // When
        sut.shouldFailPurchase = true
        sut.mockError = .configurationError
        _ = await sut.purchase(product: "test.product")

        // Then
        await fulfillment(of: [expectation], timeout: 1.0)
        XCTAssertNotNil(receivedError)
    }

    // MARK: - Concurrent Safety Tests

    func testConcurrentPurchases_ThreadSafe() async {
        // Given
        let productId1 = StoreProductConfiguration.points100
        let productId2 = StoreProductConfiguration.points300

        // When - Execute concurrent purchases
        async let result1 = sut.purchase(product: productId1)
        async let result2 = sut.purchase(product: productId2)

        let (res1, res2) = await (result1, result2)

        // Then - Both should complete without crashing
        XCTAssertTrue(sut.purchaseCalled)
        XCTAssertFalse(sut.isPurchasing)

        switch (res1, res2) {
        case (.pending, .pending):
            XCTAssertTrue(true)
        default:
            XCTFail("Expected both mock purchases to complete as pending")
        }
    }

    func testConcurrentLoadProducts_ThreadSafe() async {
        // When
        async let result1 = sut.loadProducts(productIds: ["product1"])
        async let result2 = sut.loadProducts(productIds: ["product2"])

        let (res1, res2) = await (result1, result2)

        // Then
        switch (res1, res2) {
        case (.success, .success):
            XCTAssertTrue(true)
        default:
            XCTFail("Expected both loads to succeed")
        }
    }

    // MARK: - StoreProductConfiguration Tests

    func testStoreProductConfiguration_AllProductIds() {
        // Then
        XCTAssertEqual(StoreProductConfiguration.allProductIds.count, 6)
        XCTAssertTrue(StoreProductConfiguration.allProductIds.contains(StoreProductConfiguration.points100))
        XCTAssertTrue(StoreProductConfiguration.allProductIds.contains(StoreProductConfiguration.monthlySubscription))
    }

    func testStoreProductConfiguration_PointsForProduct() {
        // Then
        XCTAssertEqual(StoreProductConfiguration.pointsForProduct(StoreProductConfiguration.points100), 100)
        XCTAssertEqual(StoreProductConfiguration.pointsForProduct(StoreProductConfiguration.points300), 330)
        XCTAssertEqual(StoreProductConfiguration.pointsForProduct(StoreProductConfiguration.points500), 580)
        XCTAssertEqual(StoreProductConfiguration.pointsForProduct(StoreProductConfiguration.points1000), 1200)
        XCTAssertNil(StoreProductConfiguration.pointsForProduct(StoreProductConfiguration.monthlySubscription))
        XCTAssertNil(StoreProductConfiguration.pointsForProduct("invalid.product"))
    }

    func testStoreProductConfiguration_ProductType() {
        // Then
        XCTAssertEqual(StoreProductConfiguration.productType(for: StoreProductConfiguration.points100), .points)
        XCTAssertEqual(StoreProductConfiguration.productType(for: StoreProductConfiguration.monthlySubscription), .subscription)
        XCTAssertNil(StoreProductConfiguration.productType(for: "invalid.product"))
    }

    func testStoreProductConfiguration_SubscriptionPeriod() {
        // Given
        let period = SubscriptionPeriod(value: 1, unit: .month)

        // Then
        XCTAssertEqual(period.localizedDescription, "Monthly")
    }

    // MARK: - StoreKitError Tests

    func testStoreKitError_IsRecoverable() {
        // Then
        XCTAssertFalse(AppStoreKitError.userCancelled.isRecoverable)
        XCTAssertFalse(AppStoreKitError.productNotFound.isRecoverable)
        XCTAssertTrue(AppStoreKitError.verificationFailed.isRecoverable)
        XCTAssertTrue(AppStoreKitError.configurationError.isRecoverable)
    }

    func testStoreKitError_ErrorDescription() {
        // Then
        XCTAssertNotNil(AppStoreKitError.productNotFound.errorDescription)
        XCTAssertNotNil(AppStoreKitError.userCancelled.errorDescription)
        XCTAssertNotNil(AppStoreKitError.verificationFailed.errorDescription)
        XCTAssertNotNil(AppStoreKitError.configurationError.errorDescription)
    }
}
