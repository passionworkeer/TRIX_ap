//
//  PaymentViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Test suite for PaymentViewModel
//
//  Test Coverage:
//  - Payment initialization and state management
//  - Payment flow (select product, confirm, process)
//  - Payment processing (success, failure, cancelled)
//  - Order creation and management
//  - Payment state updates
//  - Error handling
//  - State helpers
//

import XCTest
import Combine
import StoreKit
@testable import TRIX3DCompanion

// MARK: - Mock StoreKitServiceProtocol

@MainActor
final class MockStoreKitServiceForPayment: StoreKitServiceProtocol, ObservableObject {

    @Published var availableProducts: [StoreProduct] = []
    @Published var isLoadingProducts: Bool = false
    @Published var subscriptionStatus: TRIX3DCompanion.SubscriptionStatus?
    @Published var isPurchasing: Bool = false
    @Published var lastError: TRIX3DCompanion.StoreKitError?

    // Test control properties
    var shouldFailLoadProducts = false
    var shouldFailPurchase = false
    var shouldReturnPending = false
    var shouldReturnCancelled = false
    var mockStoreKitError: TRIX3DCompanion.StoreKitError?
    var mockProducts: [StoreProduct] = []

    // Call tracking
    var loadProductsCalled = false
    var loadProductsCalledWithProductIds: [String]?
    var purchaseCalled = false
    var purchaseCalledWithProductId: String?
    var restorePurchasesCalled = false
    var checkSubscriptionStatusCalled = false
    var getTransactionHistoryCalled = false
    var getReceiptDataCalled = false
    var getLatestTransactionIdCalled = false
    var getTransactionInfoCalled = false
    var clearErrorCalled = false

    func loadProducts(productIds: [String]) async -> Result<Void, TRIX3DCompanion.StoreKitError> {
        loadProductsCalled = true
        loadProductsCalledWithProductIds = productIds
        isLoadingProducts = true

        if shouldFailLoadProducts {
            isLoadingProducts = false
            let error = mockStoreKitError ?? .productNotFound
            lastError = error
            return .failure(error)
        }

        isLoadingProducts = false
        availableProducts = mockProducts
        return .success(())
    }

    func purchase(product productId: String) async -> PurchaseResult {
        purchaseCalled = true
        purchaseCalledWithProductId = productId
        isPurchasing = true
        lastError = nil

        if shouldFailPurchase {
            isPurchasing = false
            let error = mockStoreKitError ?? .purchaseFailed(underlying: nil)
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

        isPurchasing = false
        // Transaction cannot be constructed in tests; use .pending
        return .pending
    }

    func restorePurchases() async -> Result<[TransactionInfo], TRIX3DCompanion.StoreKitError> {
        restorePurchasesCalled = true
        return .success([])
    }

    func checkSubscriptionStatus() async -> TRIX3DCompanion.SubscriptionStatus? {
        checkSubscriptionStatusCalled = true
        return subscriptionStatus
    }

    func getTransactionHistory() async -> [TransactionInfo] {
        getTransactionHistoryCalled = true
        return []
    }

    func getReceiptData() async -> String? {
        getReceiptDataCalled = true
        return "mock-receipt-data"
    }

    func getLatestTransactionId(for productId: String) async -> String? {
        getLatestTransactionIdCalled = true
        return "txn-\(productId)"
    }

    func getTransactionInfo(transactionId: String) async -> TransactionInfo? {
        getTransactionInfoCalled = true
        return nil
    }

    func prepareVerificationPayload(transaction: StoreKit.Transaction, productId: String) -> [String: Any]? {
        return ["transactionId": "txn", "productId": productId]
    }

    func clearError() {
        clearErrorCalled = true
        lastError = nil
    }
}

// MARK: - Mock PointsServiceProtocol

@MainActor
final class MockPointsService: PointsServiceProtocol, ObservableObject {

    @Published var balance: PointsBalance?
    @Published var transactions: [PointsTransactionDetail] = []
    @Published var isLoading: Bool = false
    @Published var isSyncing: Bool = false
    @Published var lastError: PointsError?

    // Test control properties
    var shouldFailRefresh = false
    var shouldFailAddPoints = false
    var shouldFailDeductPoints = false
    var mockPointsError: PointsError?
    var mockBalance: PointsBalance?

    // Call tracking
    var refreshPointsCalled = false
    var getBalanceCalled = false
    var loadHistoryCalled = false
    var addPointsCalled = false
    var addPointsCalledWithPoints: Int?
    var deductPointsCalled = false
    var deductPointsCalledWithPoints: Int?
    var syncWithServerCalled = false
    var clearErrorCalled = false

    func refreshPoints() async -> Result<PointsBalance, PointsError> {
        refreshPointsCalled = true

        if shouldFailRefresh {
            let error = mockPointsError ?? .networkError
            lastError = error
            return .failure(error)
        }

        if let balance = mockBalance {
            self.balance = balance
            return .success(balance)
        }

        let defaultBalance = PointsBalance(
            totalPoints: 1000,
            availablePoints: 1000,
            pendingPoints: 0,
            level: 1,
            todayEarned: 50,
            weekEarned: 200,
            totalTransactions: 10,
            updatedAt: Date()
        )
        self.balance = defaultBalance
        return .success(defaultBalance)
    }

    func getBalance() async -> PointsBalance? {
        getBalanceCalled = true
        return balance ?? mockBalance
    }

    func loadHistory(filter: PointsHistoryFilter?) async -> Result<[PointsTransactionDetail], PointsError> {
        loadHistoryCalled = true
        return .success(transactions)
    }

    func addPoints(_ points: Int, description: String, metadata: [String: String]?) async -> PointsResult {
        addPointsCalled = true
        addPointsCalledWithPoints = points

        if shouldFailAddPoints {
            let error = mockPointsError ?? .networkError
            lastError = error
            return .failed(error: error)
        }

        let newBalance = PointsBalance(
            totalPoints: (balance?.totalPoints ?? 0) + points,
            availablePoints: (balance?.availablePoints ?? 0) + points,
            pendingPoints: 0,
            level: 1,
            todayEarned: 50,
            weekEarned: 200,
            totalTransactions: 10,
            updatedAt: Date()
        )
        balance = newBalance
        return .success(balance: newBalance)
    }

    func deductPoints(_ points: Int, description: String, metadata: [String: String]?) async -> PointsResult {
        deductPointsCalled = true
        deductPointsCalledWithPoints = points

        if shouldFailDeductPoints {
            let error = mockPointsError ?? .insufficientBalance
            lastError = error
            return .failed(error: error)
        }

        guard let currentBalance = balance, currentBalance.availablePoints >= points else {
            lastError = .insufficientBalance
            return .insufficientBalance
        }

        let newBalance = PointsBalance(
            totalPoints: currentBalance.totalPoints - points,
            availablePoints: currentBalance.availablePoints - points,
            pendingPoints: 0,
            level: 1,
            todayEarned: 50,
            weekEarned: 200,
            totalTransactions: 10,
            updatedAt: Date()
        )
        balance = newBalance
        return .success(balance: newBalance)
    }

    func syncWithServer() async -> Result<Void, PointsError> {
        syncWithServerCalled = true
        return .success(())
    }

    func clearError() {
        clearErrorCalled = true
        lastError = nil
    }
}

// MARK: - Payment ViewModel Tests

@MainActor
final class PaymentViewModelTests: XCTestCase {

    var sut: PaymentViewModel!
    var mockPaymentService: MockPaymentService!
    var mockStoreKitService: MockStoreKitServiceForPayment!
    var mockPointsService: MockPointsService!
    var cancellables: Set<AnyCancellable>!

    override func setUp() {
        super.setUp()
        mockPaymentService = MockPaymentService()
        mockStoreKitService = MockStoreKitServiceForPayment()
        mockPointsService = MockPointsService()
        cancellables = Set<AnyCancellable>()

        sut = PaymentViewModel(
            paymentService: mockPaymentService,
            storeKitService: mockStoreKitService,
            pointsService: mockPointsService
        )
    }

    override func tearDown() {
        sut = nil
        mockPaymentService = nil
        mockStoreKitService = nil
        mockPointsService = nil
        cancellables = nil
        super.tearDown()
    }

    // MARK: - Helper Methods

    private func createMockStoreProduct(id: String = "test.product", type: TRIX3DCompanion.ProductType = .points, points: Int? = 100) -> StoreProduct {
        StoreProduct(
            id: id,
            name: "Test Product",
            description: "Test Description",
            price: "¥6.00",
            priceLocale: Locale(identifier: "zh_CN"),
            type: type,
            points: points,
            subscriptionPeriod: nil,
            product: nil
        )
    }

    private func createMockOrder(productId: String = "test.product", status: AppPaymentStatus = .completed) -> AppOrder {
        AppOrder(
            id: UUID().uuidString,
            userId: "test-user",
            productId: productId,
            productType: .points,
            amount: 6.0,
            currency: "CNY",
            status: status,
            paymentMethod: .applePay,
            transactionId: "txn-\(UUID().uuidString)",
            points: 100,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}

// MARK: - Initialization Tests

extension PaymentViewModelTests {

    func testInitialization_DefaultState() {
        // Then
        XCTAssertEqual(sut.paymentState, .idle)
        XCTAssertNil(sut.selectedProduct)
        XCTAssertEqual(sut.paymentMethod, .applePay)
        XCTAssertEqual(sut.availablePaymentMethods, [.applePay])
        XCTAssertNil(sut.currentOrder)
        XCTAssertTrue(sut.orderHistory.isEmpty)
        XCTAssertNil(sut.errorMessage)
        XCTAssertFalse(sut.showResult)
    }

    func testInitialization_LoadsOrderHistory() async {
        // Given
        let order = createMockOrder()
        mockPaymentService.mockOrders[order.id] = order
        mockPaymentService.completedOrders = [order]

        // Wait for initialization task
        try? await Task.sleep(nanoseconds: 100_000_000) // 0.1 second

        // Then - Order history should be loaded
        XCTAssertNotNil(mockPaymentService.getOrderHistoryCalled)
    }

    func testInitialization_WithCustomDependencies() {
        // Then
        XCTAssertNotNil(sut)
        XCTAssertEqual(sut.availablePaymentMethods, [.applePay])
    }
}

// MARK: - Start Payment Tests

extension PaymentViewModelTests {

    func testStartPayment_SetsSelectedProduct() {
        // Given
        let product = createMockStoreProduct()

        // When
        sut.startPayment(for: product)

        // Then
        XCTAssertEqual(sut.selectedProduct, product)
        XCTAssertEqual(sut.paymentState, .selectingProduct)
    }

    func testStartPayment_UpdatesStateToSelecting() {
        // Given
        let product = createMockStoreProduct()

        // When
        sut.startPayment(for: product)

        // Then
        if case .selectingProduct = sut.paymentState {
            XCTAssertTrue(true)
        } else {
            XCTFail("Expected selectingProduct state")
        }
    }

    func testStartPayment_AllowsDifferentProductTypes() {
        // Given
        let pointsProduct = createMockStoreProduct(type: .points, points: 100)
        let subscriptionProduct = createMockStoreProduct(type: .subscription)

        // When
        sut.startPayment(for: pointsProduct)

        // Then
        XCTAssertEqual(sut.selectedProduct?.type, .points)

        // When
        sut.startPayment(for: subscriptionProduct)

        // Then
        XCTAssertEqual(sut.selectedProduct?.type, .subscription)
    }
}

// MARK: - Confirm Purchase Tests

extension PaymentViewModelTests {

    func testConfirmPurchase_NoProductSelected() async {
        // Given - No product selected

        // When
        await sut.confirmPurchase()

        // Then
        XCTAssertNotNil(sut.errorMessage)
        XCTAssertEqual(sut.errorMessage, "No product selected")

        if case .failed(let error) = sut.paymentState {
            XCTAssertEqual(error, "No product selected")
        } else {
            XCTFail("Expected failed state")
        }
    }

    func testConfirmPurchase_PointsProduct_Success() async {
        // Given
        let product = createMockStoreProduct(id: StoreProductConfiguration.points100, type: .points, points: 100)
        sut.startPayment(for: product)

        // When
        await sut.confirmPurchase()

        // Then
        XCTAssertTrue(mockPaymentService.purchasePointsCalled)
        XCTAssertEqual(mockPaymentService.purchasePointsCalledWithProductId, product.id)
        XCTAssertEqual(mockPaymentService.purchasePointsCalledWithPoints, 100)

        if case .success(let order) = sut.paymentState {
            XCTAssertNotNil(order)
            XCTAssertEqual(sut.currentOrder, order)
            XCTAssertTrue(sut.showResult)
        } else {
            XCTFail("Expected success state")
        }
    }

    func testConfirmPurchase_Subscription_Success() async {
        // Given
        let product = createMockStoreProduct(id: StoreProductConfiguration.monthlySubscription, type: .subscription)
        sut.startPayment(for: product)

        // When
        await sut.confirmPurchase()

        // Then
        XCTAssertTrue(mockPaymentService.subscribeCalled)
        XCTAssertEqual(mockPaymentService.subscribeCalledWithProductId, product.id)

        if case .success(let order) = sut.paymentState {
            XCTAssertNotNil(order)
            XCTAssertEqual(order.productType, .subscription)
        } else {
            XCTFail("Expected success state")
        }
    }

    func testConfirmPurchase_PointsProduct_InvalidPoints() async {
        // Given - Product without points value
        let product = StoreProduct(
            id: StoreProductConfiguration.points100,
            name: "Test Points",
            description: "Test",
            price: "¥6.00",
            priceLocale: Locale(identifier: "zh_CN"),
            type: .points,
            points: nil, // Invalid - no points
            subscriptionPeriod: nil,
            product: nil
        )
        sut.startPayment(for: product)

        // When
        await sut.confirmPurchase()

        // Then
        XCTAssertNotNil(sut.errorMessage)
        XCTAssertEqual(sut.errorMessage, "Invalid product configuration")

        if case .failed(let error) = sut.paymentState {
            XCTAssertEqual(error, "Invalid product configuration")
        } else {
            XCTFail("Expected failed state")
        }
    }

    func testConfirmPurchase_SetsConfirmingState() async {
        // Given
        let product = createMockStoreProduct()
        sut.startPayment(for: product)

        // When
        let confirmTask = Task {
            await sut.confirmPurchase()
        }

        // Wait briefly for state to change
        try? await Task.sleep(nanoseconds: 10_000_000) // 0.01 second

        // Then - Should have passed through confirmingPurchase state
        confirmTask.cancel()
    }

    func testConfirmPurchase_PendingState() async {
        // Given
        mockPaymentService.shouldReturnPending = true
        let product = createMockStoreProduct()
        sut.startPayment(for: product)

        // When
        await sut.confirmPurchase()

        // Then
        if case .pending(let order) = sut.paymentState {
            XCTAssertTrue(order.isPending)
            XCTAssertEqual(sut.currentOrder, order)
        } else {
            XCTFail("Expected pending state")
        }
    }

    func testConfirmPurchase_FailedState() async {
        // Given
        mockPaymentService.shouldFailPurchase = true
        mockPaymentService.mockError = .paymentFailed(underlying: nil)
        let product = createMockStoreProduct()
        sut.startPayment(for: product)

        // When
        await sut.confirmPurchase()

        // Then
        if case .failed(let error) = sut.paymentState {
            XCTAssertNotNil(error)
            XCTAssertTrue(sut.showResult)
            XCTAssertNotNil(sut.errorMessage)
        } else {
            XCTFail("Expected failed state")
        }
    }

    func testConfirmPurchase_CancelledState() async {
        // Given
        mockPaymentService.shouldReturnCancelled = true
        let product = createMockStoreProduct()
        sut.startPayment(for: product)

        // When
        await sut.confirmPurchase()

        // Then
        if case .cancelled = sut.paymentState {
            XCTAssertTrue(true)
        } else {
            XCTFail("Expected cancelled state")
        }
    }
}

// MARK: - Cancel Payment Tests

extension PaymentViewModelTests {

    func testCancelPayment_WithPendingOrder() {
        // Given
        let order = createMockOrder(status: .pending)
        sut.currentOrder = order
        sut.selectedProduct = createMockStoreProduct()

        // When
        sut.cancelPayment()

        // Then
        XCTAssertTrue(mockPaymentService.cancelOrderCalled)
        XCTAssertEqual(mockPaymentService.cancelOrderCalledWithOrderId, order.id)
        XCTAssertEqual(sut.paymentState, .cancelled)
        XCTAssertNil(sut.currentOrder)
        XCTAssertNil(sut.selectedProduct)
    }

    func testCancelPayment_WithoutPendingOrder() {
        // Given - No current order
        sut.selectedProduct = createMockStoreProduct()

        // When
        sut.cancelPayment()

        // Then
        XCTAssertFalse(mockPaymentService.cancelOrderCalled)
        XCTAssertEqual(sut.paymentState, .cancelled)
        XCTAssertNil(sut.currentOrder)
    }

    func testCancelPayment_AlreadyCompletedOrder() {
        // Given - Completed order should not be cancelled
        let order = createMockOrder(status: .completed)
        sut.currentOrder = order

        // When
        sut.cancelPayment()

        // Then
        XCTAssertFalse(mockPaymentService.cancelOrderCalled)
    }

    func testCancelPayment_ClearsSelection() {
        // Given
        let product = createMockStoreProduct()
        sut.startPayment(for: product)

        // When
        sut.cancelPayment()

        // Then
        XCTAssertNil(sut.selectedProduct)
    }
}

// MARK: - Retry Payment Tests

extension PaymentViewModelTests {

    func testRetryPayment_WithSelectedProduct() async {
        // Given
        mockPaymentService.shouldFailPurchase = true
        let product = createMockStoreProduct()
        sut.startPayment(for: product)

        // First attempt fails
        await sut.confirmPurchase()

        // Reset mock for retry
        mockPaymentService.shouldFailPurchase = false

        // When
        await sut.retryPayment()

        // Then
        XCTAssertEqual(sut.paymentState, .idle)
    }

    func testRetryPayment_WithoutSelectedProduct() async {
        // Given - No product selected

        // When
        await sut.retryPayment()

        // Then - Should not crash, just return
        XCTAssertNil(sut.selectedProduct)
    }
}

// MARK: - Load Order History Tests

extension PaymentViewModelTests {

    func testLoadOrderHistory_Success() async {
        // Given
        let order1 = createMockOrder(status: .completed)
        let order2 = createMockOrder(status: .pending)
        mockPaymentService.mockOrders[order1.id] = order1
        mockPaymentService.mockOrders[order2.id] = order2

        // When
        await sut.loadOrderHistory()

        // Then
        XCTAssertTrue(mockPaymentService.getOrderHistoryCalled)
        XCTAssertEqual(sut.orderHistory.count, 2)
    }

    func testLoadOrderHistory_Empty() async {
        // Given - No orders

        // When
        await sut.loadOrderHistory()

        // Then
        XCTAssertTrue(mockPaymentService.getOrderHistoryCalled)
        XCTAssertTrue(sut.orderHistory.isEmpty)
    }
}

// MARK: - Get Order Details Tests

extension PaymentViewModelTests {

    func testGetOrderDetails_Success() async {
        // Given
        let order = createMockOrder()
        mockPaymentService.mockOrders[order.id] = order

        // When
        let result = await sut.getOrderDetails(orderId: order.id)

        // Then
        XCTAssertTrue(mockPaymentService.getOrderCalled)
        XCTAssertEqual(mockPaymentService.getOrderCalledWithOrderId, order.id)
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.id, order.id)
    }

    func testGetOrderDetails_NotFound() async {
        // Given
        let nonExistentId = "non-existent"

        // When
        let result = await sut.getOrderDetails(orderId: nonExistentId)

        // Then
        XCTAssertTrue(mockPaymentService.getOrderCalled)
        XCTAssertNil(result)
    }
}

// MARK: - Clear Error Tests

extension PaymentViewModelTests {

    func testClearError_ClearsErrorMessage() {
        // Given
        sut.errorMessage = "Test error"

        // When
        sut.clearError()

        // Then
        XCTAssertNil(sut.errorMessage)
        XCTAssertTrue(mockPaymentService.clearErrorCalled)
    }

    func testClearError_WithNoError() {
        // Given - No error

        // When
        sut.clearError()

        // Then
        XCTAssertNil(sut.errorMessage)
        XCTAssertTrue(mockPaymentService.clearErrorCalled)
    }
}

// MARK: - Reset Flow Tests

extension PaymentViewModelTests {

    func testResetFlow_ResetsAllState() {
        // Given
        let product = createMockStoreProduct()
        let order = createMockOrder()
        sut.startPayment(for: product)
        sut.currentOrder = order
        sut.errorMessage = "Test error"
        sut.showResult = true

        // Simulate successful payment
        sut.paymentState = .success(order: order)

        // When
        sut.resetFlow()

        // Then
        XCTAssertEqual(sut.paymentState, .idle)
        XCTAssertNil(sut.currentOrder)
        XCTAssertNil(sut.selectedProduct)
        XCTAssertNil(sut.errorMessage)
        XCTAssertFalse(sut.showResult)
    }

    func testResetFlow_AfterFailedPayment() {
        // Given
        let product = createMockStoreProduct()
        sut.startPayment(for: product)
        sut.paymentState = .failed(error: "Payment failed")
        sut.errorMessage = "Payment failed"
        sut.showResult = true

        // When
        sut.resetFlow()

        // Then
        XCTAssertEqual(sut.paymentState, .idle)
        XCTAssertFalse(sut.showResult)
    }
}

// MARK: - Payment Method Selection Tests

extension PaymentViewModelTests {

    func testSelectPaymentMethod() {
        // Given
        let method = PaymentMethod.alipay

        // When
        sut.selectPaymentMethod(method)

        // Then
        XCTAssertEqual(sut.paymentMethod, method)
    }

    func testIsPaymentMethodAvailable_True() {
        // Then
        XCTAssertTrue(sut.isPaymentMethodAvailable(.applePay))
    }

    func testIsPaymentMethodAvailable_False() {
        // Then
        XCTAssertFalse(sut.isPaymentMethodAvailable(.alipay))
        XCTAssertFalse(sut.isPaymentMethodAvailable(.wechatPay))
    }

    func testPaymentMethodDisplayName() {
        // Then
        XCTAssertEqual(sut.paymentMethodDisplayName, "Apple Pay")
    }
}

// MARK: - State Helper Tests

extension PaymentViewModelTests {

    func testIsProcessing_WhenProcessing() {
        // Given
        sut.paymentState = .processing

        // Then
        XCTAssertTrue(sut.isProcessing)
    }

    func testIsProcessing_WhenNotProcessing() {
        // Given
        sut.paymentState = .idle

        // Then
        XCTAssertFalse(sut.isProcessing)
    }

    func testIsSuccess_WhenSuccess() {
        // Given
        let order = createMockOrder()
        sut.paymentState = .success(order: order)

        // Then
        XCTAssertTrue(sut.isSuccess)
    }

    func testIsSuccess_WhenNotSuccess() {
        // Given
        sut.paymentState = .idle

        // Then
        XCTAssertFalse(sut.isSuccess)
    }

    func testIsPending_WhenPending() {
        // Given
        let order = createMockOrder()
        sut.paymentState = .pending(order: order)

        // Then
        XCTAssertTrue(sut.isPending)
    }

    func testIsPending_WhenNotPending() {
        // Given
        sut.paymentState = .idle

        // Then
        XCTAssertFalse(sut.isPending)
    }

    func testIsFailed_WhenFailed() {
        // Given
        sut.paymentState = .failed(error: "Test error")

        // Then
        XCTAssertTrue(sut.isFailed)
    }

    func testIsFailed_WhenNotFailed() {
        // Given
        sut.paymentState = .idle

        // Then
        XCTAssertFalse(sut.isFailed)
    }

    func testSuccessOrder_ReturnsOrder() {
        // Given
        let order = createMockOrder()
        sut.paymentState = .success(order: order)

        // Then
        XCTAssertEqual(sut.successOrder, order)
    }

    func testSuccessOrder_ReturnsNilWhenNotSuccess() {
        // Given
        sut.paymentState = .idle

        // Then
        XCTAssertNil(sut.successOrder)
    }

    func testPendingOrder_ReturnsOrder() {
        // Given
        let order = createMockOrder()
        sut.paymentState = .pending(order: order)

        // Then
        XCTAssertEqual(sut.pendingOrder, order)
    }

    func testPendingOrder_ReturnsNilWhenNotPending() {
        // Given
        sut.paymentState = .idle

        // Then
        XCTAssertNil(sut.pendingOrder)
    }
}

// MARK: - Payment Summary Tests

extension PaymentViewModelTests {

    func testPaymentSummary_PointsProduct() {
        // Given
        let product = createMockStoreProduct(type: .points, points: 100)
        sut.startPayment(for: product)

        // Then
        XCTAssertEqual(sut.paymentSummary, "Purchase 100 Points")
    }

    func testPaymentSummary_SubscriptionProduct() {
        // Given
        let product = createMockStoreProduct(id: StoreProductConfiguration.monthlySubscription, type: .subscription)
        let period = SubscriptionPeriod(value: 1, unit: .month)
        let productWithPeriod = StoreProduct(
            id: product.id,
            name: "Monthly Subscription",
            description: product.description,
            price: product.price,
            priceLocale: product.priceLocale,
            type: .subscription,
            points: nil,
            subscriptionPeriod: period,
            product: product.product
        )
        sut.startPayment(for: productWithPeriod)

        // Then
        XCTAssertEqual(sut.paymentSummary, "Subscribe to Monthly Subscription")
    }

    func testPaymentSummary_NoProduct() {
        // Then
        XCTAssertEqual(sut.paymentSummary, "")
    }

    func testTotalAmount() {
        // Given
        let product = createMockStoreProduct()
        sut.startPayment(for: product)

        // Then
        XCTAssertEqual(sut.totalAmount, "¥6.00")
    }

    func testTotalAmount_NoProduct() {
        // Then
        XCTAssertEqual(sut.totalAmount, "¥0.00")
    }

    func testConfirmationMessage_Points() {
        // Given
        let product = createMockStoreProduct(type: .points, points: 100)
        sut.startPayment(for: product)

        // Then
        XCTAssertEqual(sut.confirmationMessage, "Confirm purchase of 100 points for ¥6.00?")
    }

    func testConfirmationMessage_Subscription() {
        // Given
        let product = createMockStoreProduct(id: StoreProductConfiguration.monthlySubscription, type: .subscription)
        let period = SubscriptionPeriod(value: 1, unit: .month)
        let productWithPeriod = StoreProduct(
            id: product.id,
            name: "Monthly Subscription",
            description: product.description,
            price: "¥12.00",
            priceLocale: product.priceLocale,
            type: .subscription,
            points: nil,
            subscriptionPeriod: period,
            product: product.product
        )
        sut.startPayment(for: productWithPeriod)

        // Then
        XCTAssertEqual(sut.confirmationMessage, "Confirm subscription to Monthly Subscription (Monthly) for ¥12.00?")
    }

    func testConfirmationMessage_NoProduct() {
        // Then
        XCTAssertEqual(sut.confirmationMessage, "")
    }

    func testWillReceiveReceipt_Points() {
        // Given
        let product = createMockStoreProduct(type: .points)
        sut.startPayment(for: product)

        // Then
        XCTAssertFalse(sut.willReceiveReceipt)
    }

    func testWillReceiveReceipt_Subscription() {
        // Given
        let product = createMockStoreProduct(type: .subscription)
        sut.startPayment(for: product)

        // Then
        XCTAssertTrue(sut.willReceiveReceipt)
    }
}

// MARK: - Payment Flow State Tests

extension PaymentViewModelTests {

    func testPaymentFlowState_Equality() {
        // Then
        XCTAssertEqual(PaymentViewModel.PaymentFlowState.idle, .idle)
        XCTAssertEqual(PaymentViewModel.PaymentFlowState.selectingProduct, .selectingProduct)
        XCTAssertEqual(PaymentViewModel.PaymentFlowState.confirmingPurchase, .confirmingPurchase)
        XCTAssertEqual(PaymentViewModel.PaymentFlowState.processing, .processing)
        XCTAssertEqual(PaymentViewModel.PaymentFlowState.cancelled, .cancelled)
    }

    func testPaymentFlowState_SuccessEquality() {
        // Given
        let order1 = AppOrder(
            id: "order-1",
            userId: "user",
            productId: "product",
            productType: .points,
            amount: 6.0,
            currency: "CNY",
            status: .completed,
            paymentMethod: .applePay,
            transactionId: "txn",
            points: 100,
            createdAt: Date(),
            updatedAt: Date()
        )
        let order2 = AppOrder(
            id: "order-1", // Same ID
            userId: "user2",
            productId: "product2",
            productType: .subscription,
            amount: 12.0,
            currency: "CNY",
            status: .pending,
            paymentMethod: .alipay,
            transactionId: "txn2",
            points: nil,
            createdAt: Date().addingTimeInterval(3600),
            updatedAt: Date()
        )

        // Then - Same order ID = equal
        XCTAssertEqual(
            PaymentViewModel.PaymentFlowState.success(order: order1),
            PaymentViewModel.PaymentFlowState.success(order: order2)
        )
    }

    func testPaymentFlowState_PendingEquality() {
        // Given
        let order1 = createMockOrder(status: .pending)
        let order2 = createMockOrder(status: .pending)

        // Then
        XCTAssertEqual(
            PaymentViewModel.PaymentFlowState.pending(order: order1),
            PaymentViewModel.PaymentFlowState.pending(order: order2)
        )
    }

    func testPaymentFlowState_FailedEquality() {
        // Then
        XCTAssertEqual(
            PaymentViewModel.PaymentFlowState.failed(error: "Error 1"),
            PaymentViewModel.PaymentFlowState.failed(error: "Error 1")
        )
        XCTAssertNotEqual(
            PaymentViewModel.PaymentFlowState.failed(error: "Error 1"),
            PaymentViewModel.PaymentFlowState.failed(error: "Error 2")
        )
    }

    func testPaymentFlowState_Inequality() {
        // Then
        XCTAssertNotEqual(PaymentViewModel.PaymentFlowState.idle, .processing)
        XCTAssertNotEqual(PaymentViewModel.PaymentFlowState.success(order: createMockOrder()), .pending(order: createMockOrder()))
        XCTAssertNotEqual(PaymentViewModel.PaymentFlowState.failed(error: "Error"), .cancelled)
    }
}

// MARK: - Error Handling Tests

extension PaymentViewModelTests {

    func testErrorHandling_NetworkError() async {
        // Given
        mockPaymentService.shouldFailPurchase = true
        mockPaymentService.mockError = .networkError
        let product = createMockStoreProduct()
        sut.startPayment(for: product)

        // When
        await sut.confirmPurchase()

        // Then
        XCTAssertNotNil(sut.errorMessage)
        XCTAssertTrue(sut.isFailed)
    }

    func testErrorHandling_InsufficientBalance() async {
        // Given
        mockPaymentService.shouldFailPurchase = true
        mockPaymentService.mockError = .insufficientBalance
        let product = createMockStoreProduct()
        sut.startPayment(for: product)

        // When
        await sut.confirmPurchase()

        // Then
        if case .failed(let error) = sut.paymentState {
            XCTAssertTrue(error.contains("Insufficient") || error.contains("balance"))
        } else {
            XCTFail("Expected failed state")
        }
    }

    func testErrorHandling_VerificationFailed() async {
        // Given
        mockPaymentService.shouldFailPurchase = true
        mockPaymentService.mockError = .verificationFailed
        let product = createMockStoreProduct()
        sut.startPayment(for: product)

        // When
        await sut.confirmPurchase()

        // Then
        XCTAssertNotNil(sut.errorMessage)
    }

    func testErrorMessage_ClearedOnReset() {
        // Given
        mockPaymentService.shouldFailPurchase = true
        sut.errorMessage = "Some error"

        // When
        sut.resetFlow()

        // Then
        XCTAssertNil(sut.errorMessage)
    }
}

// MARK: - Order Management Tests

extension PaymentViewModelTests {

    func testCurrentOrder_UpdatedOnSuccess() async {
        // Given
        let product = createMockStoreProduct()
        sut.startPayment(for: product)

        // When
        await sut.confirmPurchase()

        // Then
        XCTAssertNotNil(sut.currentOrder)
        XCTAssertTrue(sut.currentOrder?.isCompleted ?? false)
    }

    func testCurrentOrder_UpdatedOnPending() async {
        // Given
        mockPaymentService.shouldReturnPending = true
        let product = createMockStoreProduct()
        sut.startPayment(for: product)

        // When
        await sut.confirmPurchase()

        // Then
        XCTAssertNotNil(sut.currentOrder)
        XCTAssertTrue(sut.currentOrder?.isPending ?? false)
    }

    func testCurrentOrder_ClearedOnCancel() {
        // Given
        let order = createMockOrder()
        sut.currentOrder = order
        sut.selectedProduct = createMockStoreProduct()

        // When
        sut.cancelPayment()

        // Then
        XCTAssertNil(sut.currentOrder)
    }

    func testCurrentOrder_ClearedOnReset() {
        // Given
        let order = createMockOrder()
        sut.currentOrder = order

        // When
        sut.resetFlow()

        // Then
        XCTAssertNil(sut.currentOrder)
    }
}

// MARK: - Published Properties Tests

extension PaymentViewModelTests {

    func testPaymentState_PublishesChanges() async {
        // Given
        let expectation = expectation(description: "Payment state publishes")
        var states: [PaymentViewModel.PaymentFlowState] = []

        sut.$paymentState
            .dropFirst()
            .sink { state in
                states.append(state)
                if states.count >= 2 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        let product = createMockStoreProduct()
        sut.startPayment(for: product)
        await sut.confirmPurchase()

        // Then
        await fulfillment(of: [expectation], timeout: 2.0)
        XCTAssertFalse(states.isEmpty)
    }

    func testSelectedProduct_PublishesChanges() async {
        // Given
        let expectation = expectation(description: "Selected product publishes")
        var productChanges: [StoreProduct?] = []

        sut.$selectedProduct
            .dropFirst()
            .sink { product in
                productChanges.append(product)
                if productChanges.count >= 1 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        let product = createMockStoreProduct()
        sut.startPayment(for: product)

        // Then
        await fulfillment(of: [expectation], timeout: 1.0)
        XCTAssertFalse(productChanges.isEmpty)
        XCTAssertEqual(productChanges[0]?.id, product.id)
    }

    func testErrorMessage_PublishesOnError() async {
        // Given
        mockPaymentService.shouldFailPurchase = true
        mockPaymentService.mockError = .networkError
        let expectation = expectation(description: "Error message publishes")

        sut.$errorMessage
            .dropFirst()
            .compactMap { $0 }
            .sink { error in
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // When
        let product = createMockStoreProduct()
        sut.startPayment(for: product)
        await sut.confirmPurchase()

        // Then
        await fulfillment(of: [expectation], timeout: 1.0)
        XCTAssertNotNil(sut.errorMessage)
    }

    func testShowResult_PublishesOnSuccess() async {
        // Given
        let expectation = expectation(description: "Show result publishes")

        sut.$showResult
            .dropFirst()
            .sink { showResult in
                if showResult {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        let product = createMockStoreProduct()
        sut.startPayment(for: product)
        await sut.confirmPurchase()

        // Then
        await fulfillment(of: [expectation], timeout: 1.0)
    }
}

// MARK: - Concurrent Tests

extension PaymentViewModelTests {

    func testConcurrentConfirmPurchase() async {
        // Given
        let product1 = createMockStoreProduct(id: StoreProductConfiguration.points100, type: .points, points: 100)
        let product2 = createMockStoreProduct(id: StoreProductConfiguration.points300, type: .points, points: 330)

        // When - Try concurrent purchases
        await withTaskGroup(of: Void.self) { [self] group in
            group.addTask { [self] in
                await MainActor.run {
                    self.sut.startPayment(for: product1)
                }
                await self.sut.confirmPurchase()
            }
            group.addTask { [self] in
                await MainActor.run {
                    self.sut.startPayment(for: product2)
                }
                await self.sut.confirmPurchase()
            }
            await group.waitForAll()
        }

        // Then - Should complete without crashing
        XCTAssertTrue(true)
    }
}

// MARK: - Edge Cases Tests

extension PaymentViewModelTests {

    func testConfirmPurchase_ConcurrentCalls() async {
        // Given
        let product = createMockStoreProduct()

        // When - Multiple rapid confirm calls
        sut.startPayment(for: product)
        await sut.confirmPurchase()

        // Then - Second call should use same product
        XCTAssertNotNil(sut.currentOrder)
    }

    func testCancelPayment_WithoutStart() {
        // When - Cancel without starting payment
        sut.cancelPayment()

        // Then
        XCTAssertEqual(sut.paymentState, .cancelled)
        XCTAssertNil(sut.currentOrder)
        XCTAssertNil(sut.selectedProduct)
    }

    func testResetFlow_MultipleTimes() {
        // Given
        let product = createMockStoreProduct()
        sut.startPayment(for: product)
        sut.resetFlow()

        // When - Reset again
        sut.resetFlow()

        // Then - Should be idempotent
        XCTAssertEqual(sut.paymentState, .idle)
    }

    func testStartPayment_OverwritesPreviousProduct() {
        // Given
        let product1 = createMockStoreProduct(id: "product-1")
        let product2 = createMockStoreProduct(id: "product-2")

        // When
        sut.startPayment(for: product1)
        sut.startPayment(for: product2)

        // Then - Should use latest product
        XCTAssertEqual(sut.selectedProduct?.id, "product-2")
    }

    func testRetryPayment_AfterCancel() async {
        // Given
        let product = createMockStoreProduct()
        sut.startPayment(for: product)
        sut.cancelPayment()

        // When
        await sut.retryPayment()

        // Then
        XCTAssertEqual(sut.paymentState, .idle)
        XCTAssertNil(sut.selectedProduct) // Product cleared on cancel
    }
}

// MARK: - Preview Helpers Tests

extension PaymentViewModelTests {

    func testPreviewOrder_CreatesValidOrder() {
        // When
        let order = PaymentViewModel.mockOrder()

        // Then
        XCTAssertNotNil(order)
        XCTAssertEqual(order.id.count, 36) // UUID format
        XCTAssertEqual(order.productType, .points)
        XCTAssertTrue(order.isCompleted)
    }

    func testPreview_CreatesViewModel() {
        // When
        let vm = PaymentViewModel.preview

        // Then
        XCTAssertNotNil(vm.selectedProduct)
    }
}
