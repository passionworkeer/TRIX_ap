//
//  PaymentViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for PaymentViewModel
//

import XCTest
import Combine
import StoreKit
@testable import TRIX3DCompanion

// File-local aliases to avoid StoreKit symbol ambiguity in the test target.
typealias PaymentVMSubscriptionStatus = TRIX3DCompanion.SubscriptionStatus
typealias PaymentVMStoreKitError = TRIX3DCompanion.StoreKitError

/// Unit tests for PaymentViewModel
@MainActor
final class PaymentViewModelTests: XCTestCase {

    // MARK: - Properties

    var paymentViewModel: PaymentViewModel!
    var mockPaymentService: PaymentViewModelTestsMockPaymentService!
    var mockStoreKitService: PaymentViewModelTestsMockStoreKitService!
    var mockPointsService: PaymentViewModelTestsMockPointsService!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        mockPaymentService = PaymentViewModelTestsMockPaymentService()
        mockStoreKitService = PaymentViewModelTestsMockStoreKitService()
        mockPointsService = PaymentViewModelTestsMockPointsService()

        paymentViewModel = PaymentViewModel(
            paymentService: mockPaymentService,
            storeKitService: mockStoreKitService,
            pointsService: mockPointsService
        )
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        paymentViewModel = nil
        mockPaymentService = nil
        mockStoreKitService = nil
        mockPointsService = nil
        cancellables = nil
    }

    // MARK: - Payment Flow State Tests

    func test_initialState_isIdle() {
        // Assert
        XCTAssertNotNil(paymentViewModel.paymentState)
        if case .idle = paymentViewModel.paymentState {
            // Success
        } else {
            XCTFail("Initial state should be idle")
        }
    }

    func test_startPayment_setsSelectingProductState() {
        // Arrange
        let product = createMockProduct()

        // Act
        paymentViewModel.startPayment(for: product)

        // Assert
        if case .selectingProduct = paymentViewModel.paymentState {
            // Success
        } else {
            XCTFail("State should be selectingProduct after startPayment")
        }
        XCTAssertEqual(paymentViewModel.selectedProduct?.id, product.id)
    }

    func test_confirmPurchase_pointsProduct_success() async throws {
        // Arrange
        let product = createMockPointsProduct()
        mockPaymentService.setMockPurchaseSuccess()
        paymentViewModel.startPayment(for: product)

        // Act
        await paymentViewModel.confirmPurchase()

        // Assert
        if case .success = paymentViewModel.paymentState {
            // Success
        } else {
            XCTFail("State should be success after successful purchase")
        }
        XCTAssertEqual(mockPaymentService.purchasePointsCallCount, 1)
        XCTAssertTrue(paymentViewModel.showResult)
    }

    func test_confirmPurchase_subscriptionProduct_success() async throws {
        // Arrange
        let product = createMockSubscriptionProduct()
        mockPaymentService.setMockSubscribeSuccess()
        paymentViewModel.startPayment(for: product)

        // Act
        await paymentViewModel.confirmPurchase()

        // Assert
        if case .success = paymentViewModel.paymentState {
            // Success
        } else {
            XCTFail("State should be success after successful subscription")
        }
        XCTAssertEqual(mockPaymentService.subscribeCallCount, 1)
    }

    func test_confirmPurchase_pendingState() async throws {
        // Arrange
        let product = createMockPointsProduct()
        mockPaymentService.setMockPurchasePending()
        paymentViewModel.startPayment(for: product)

        // Act
        await paymentViewModel.confirmPurchase()

        // Assert
        if case .pending = paymentViewModel.paymentState {
            // Success
        } else {
            XCTFail("State should be pending when purchase is pending")
        }
        XCTAssertNotNil(paymentViewModel.currentOrder)
    }

    func test_confirmPurchase_failedState() async throws {
        // Arrange
        let product = createMockPointsProduct()
        mockPaymentService.setMockPurchaseFailed(error: .paymentFailed(underlying: nil))
        paymentViewModel.startPayment(for: product)

        // Act
        await paymentViewModel.confirmPurchase()

        // Assert
        if case .failed = paymentViewModel.paymentState {
            // Success
        } else {
            XCTFail("State should be failed when purchase fails")
        }
        XCTAssertNotNil(paymentViewModel.errorMessage)
    }

    func test_confirmPurchase_cancelledState() async throws {
        // Arrange
        let product = createMockPointsProduct()
        mockPaymentService.setMockPurchaseCancelled()
        paymentViewModel.startPayment(for: product)

        // Act
        await paymentViewModel.confirmPurchase()

        // Assert
        if case .cancelled = paymentViewModel.paymentState {
            // Success
        } else {
            XCTFail("State should be cancelled when user cancels")
        }
    }

    func test_confirmPurchase_noProductSelected_showsError() async throws {
        // Act
        await paymentViewModel.confirmPurchase()

        // Assert
        XCTAssertNotNil(paymentViewModel.errorMessage)
        if case .failed = paymentViewModel.paymentState {
            // Success
        } else {
            XCTFail("State should be failed when no product selected")
        }
    }

    // MARK: - Cancel Payment Tests

    func test_cancelPayment_setsCancelledState() {
        // Arrange
        let product = createMockPointsProduct()
        paymentViewModel.startPayment(for: product)

        // Act
        paymentViewModel.cancelPayment()

        // Assert
        if case .cancelled = paymentViewModel.paymentState {
            // Success
        } else {
            XCTFail("State should be cancelled after cancelPayment")
        }
        XCTAssertNil(paymentViewModel.selectedProduct)
        XCTAssertNil(paymentViewModel.currentOrder)
    }

    func test_cancelPayment_withPendingOrder_cancelsOrder() async throws {
        // Arrange
        let product = createMockPointsProduct()
        let order = mockPaymentService.createMockOrder(status: .pending)
        mockPaymentService.setMockPurchasePending(order: order)
        paymentViewModel.startPayment(for: product)
        await paymentViewModel.confirmPurchase()

        // Act
        paymentViewModel.cancelPayment()
        try await Task.sleep(nanoseconds: 100_000_000)

        // Assert
        XCTAssertEqual(mockPaymentService.cancelOrderCallCount, 1)
    }

    // MARK: - Retry Payment Tests

    func test_retryPayment_retriesPurchase() async throws {
        // Arrange
        let product = createMockPointsProduct()
        mockPaymentService.setMockPurchaseFailed(error: .paymentFailed(underlying: nil))
        paymentViewModel.startPayment(for: product)
        await paymentViewModel.confirmPurchase()

        // Reset for success on retry
        mockPaymentService.setMockPurchaseSuccess()

        // Act
        await paymentViewModel.retryPayment()

        // Assert
        XCTAssertEqual(mockPaymentService.purchasePointsCallCount, 2)
        if case .success = paymentViewModel.paymentState {
            // Success
        } else {
            XCTFail("State should be success after retry")
        }
    }

    // MARK: - Payment Method Tests

    func test_selectPaymentMethod_updatesPaymentMethod() {
        // Act
        paymentViewModel.selectPaymentMethod(.wechatPay)

        // Assert
        XCTAssertEqual(paymentViewModel.paymentMethod, .wechatPay)
    }

    func test_isPaymentMethodAvailable_returnsCorrectValue() {
        // Arrange
        paymentViewModel.availablePaymentMethods = [.applePay, .wechatPay]

        // Assert
        XCTAssertTrue(paymentViewModel.isPaymentMethodAvailable(.applePay))
        XCTAssertTrue(paymentViewModel.isPaymentMethodAvailable(.wechatPay))
        XCTAssertFalse(paymentViewModel.isPaymentMethodAvailable(.alipay))
    }

    // MARK: - Order History Tests

    func test_loadOrderHistory_loadsOrders() async throws {
        // Arrange
        let mockOrders = [
            mockPaymentService.createMockOrder(),
            mockPaymentService.createMockOrder(productId: "com.trix3d.points.300", points: 330)
        ]
        mockPaymentService.setMockOrderHistory(mockOrders)
        let initialCallCount = mockPaymentService.getOrderHistoryCallCount

        // Act
        await paymentViewModel.loadOrderHistory()

        // Assert
        XCTAssertEqual(paymentViewModel.orderHistory.count, 2)
        XCTAssertEqual(mockPaymentService.getOrderHistoryCallCount, initialCallCount + 1)
    }

    func test_getOrderDetails_returnsOrder() async throws {
        // Arrange
        let order = mockPaymentService.createMockOrder()
        mockPaymentService.mockOrder = order

        // Act
        let result = await paymentViewModel.getOrderDetails(orderId: order.id)

        // Assert
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.id, order.id)
    }

    // MARK: - State Helper Tests

    func test_isProcessing_returnsTrueWhenProcessing() {
        // Arrange
        paymentViewModel.paymentState = .processing

        // Assert
        XCTAssertTrue(paymentViewModel.isProcessing)
    }

    func test_isSuccess_returnsTrueWhenSuccess() {
        // Arrange
        let order = mockPaymentService.createMockOrder()
        paymentViewModel.paymentState = .success(order: order)

        // Assert
        XCTAssertTrue(paymentViewModel.isSuccess)
    }

    func test_isPending_returnsTrueWhenPending() {
        // Arrange
        let order = mockPaymentService.createMockOrder(status: .pending)
        paymentViewModel.paymentState = .pending(order: order)

        // Assert
        XCTAssertTrue(paymentViewModel.isPending)
    }

    func test_isFailed_returnsTrueWhenFailed() {
        // Arrange
        paymentViewModel.paymentState = .failed(error: "Test error")

        // Assert
        XCTAssertTrue(paymentViewModel.isFailed)
    }

    func test_successOrder_returnsOrderWhenSuccess() {
        // Arrange
        let order = mockPaymentService.createMockOrder()
        paymentViewModel.paymentState = .success(order: order)

        // Assert
        XCTAssertNotNil(paymentViewModel.successOrder)
        XCTAssertEqual(paymentViewModel.successOrder?.id, order.id)
    }

    func test_pendingOrder_returnsOrderWhenPending() {
        // Arrange
        let order = mockPaymentService.createMockOrder(status: .pending)
        paymentViewModel.paymentState = .pending(order: order)

        // Assert
        XCTAssertNotNil(paymentViewModel.pendingOrder)
        XCTAssertEqual(paymentViewModel.pendingOrder?.id, order.id)
    }

    // MARK: - Clear Error Tests

    func test_clearError_clearsErrorMessage() {
        // Arrange
        paymentViewModel.errorMessage = "Test error"

        // Act
        paymentViewModel.clearError()

        // Assert
        XCTAssertNil(paymentViewModel.errorMessage)
    }

    // MARK: - Reset Flow Tests

    func test_resetFlow_resetsToIdle() {
        // Arrange
        let product = createMockPointsProduct()
        paymentViewModel.startPayment(for: product)
        paymentViewModel.showResult = true
        paymentViewModel.errorMessage = "Test error"

        // Act
        paymentViewModel.resetFlow()

        // Assert
        if case .idle = paymentViewModel.paymentState {
            // Success
        } else {
            XCTFail("State should be idle after reset")
        }
        XCTAssertNil(paymentViewModel.selectedProduct)
        XCTAssertNil(paymentViewModel.currentOrder)
        XCTAssertNil(paymentViewModel.errorMessage)
        XCTAssertFalse(paymentViewModel.showResult)
    }

    // MARK: - Computed Properties Tests

    func test_paymentSummary_returnsCorrectSummary() {
        // Arrange
        let product = createMockPointsProduct()
        paymentViewModel.startPayment(for: product)

        // Assert
        XCTAssertEqual(paymentViewModel.paymentSummary, localizedPaymentString("store.summary.purchase.points"))
    }

    func test_totalAmount_returnsProductPrice() {
        // Arrange
        let product = createMockPointsProduct()
        paymentViewModel.startPayment(for: product)

        // Assert
        XCTAssertEqual(paymentViewModel.totalAmount, product.price)
    }

    func test_paymentMethodDisplayName_returnsCorrectName() {
        // Act
        paymentViewModel.paymentMethod = .applePay

        // Assert
        XCTAssertEqual(paymentViewModel.paymentMethodDisplayName, "Apple Pay")
    }

    func test_confirmationMessage_returnsCorrectMessage() {
        // Arrange
        let product = createMockPointsProduct()
        paymentViewModel.startPayment(for: product)

        // Assert
        XCTAssertNotNil(paymentViewModel.confirmationMessage)
        XCTAssertTrue(paymentViewModel.confirmationMessage.contains(product.price))
    }

    // MARK: - Helper Methods

    private func createMockProduct() -> StoreProduct {
        ProductViewModel.mockPointsProduct()
    }

    private func createMockPointsProduct(
        id: String = "com.trix3d.points.500",
        points: Int = 580
    ) -> StoreProduct {
        // Create a simple mock product for testing
        // Note: In real implementation, this would need a real Product object
        // For testing purposes, we'll use the PaymentViewModel's mock helpers
        return ProductViewModel.mockPointsProduct()
    }

    private func createMockSubscriptionProduct(
        id: String = "com.trix3d.subscription.monthly"
    ) -> StoreProduct {
        return ProductViewModel.mockSubscriptionProduct()
    }

    private func localizedPaymentString(_ key: String) -> String {
        NSLocalizedString(key, comment: "")
    }
}

// MARK: - Local Mocks

@MainActor
final class PaymentViewModelTestsMockPaymentService: PaymentServiceProtocol {

    @Published private(set) var pendingAppOrders: [AppOrder] = []
    @Published private(set) var completedAppOrders: [AppOrder] = []
    @Published private(set) var isProcessing: Bool = false
    @Published private(set) var lastError: PaymentError?

    var mockPurchaseResult: PaymentResult?
    var mockSubscribeResult: PaymentResult?
    var mockVerifyResult: Result<AppOrder, PaymentError>?
    var mockOrderHistory: [AppOrder] = []
    var mockOrder: AppOrder?

    var purchasePointsCallCount = 0
    var subscribeCallCount = 0
    var verifyReceiptCallCount = 0
    var getOrderCallCount = 0
    var getOrderHistoryCallCount = 0
    var cancelOrderCallCount = 0

    func purchasePoints(productId: String, points: Int) async -> PaymentResult {
        purchasePointsCallCount += 1
        isProcessing = true
        defer { isProcessing = false }

        if let result = mockPurchaseResult {
            syncOrders(from: result)
            return result
        }

        let order = createMockOrder(productId: productId, points: points)
        completedAppOrders.insert(order, at: 0)
        return .success(order: order)
    }

    func subscribe(productId: String) async -> PaymentResult {
        subscribeCallCount += 1
        isProcessing = true
        defer { isProcessing = false }

        if let result = mockSubscribeResult {
            syncOrders(from: result)
            return result
        }

        let order = createMockSubscriptionOrder(productId: productId)
        completedAppOrders.insert(order, at: 0)
        return .success(order: order)
    }

    func verifyReceipt(
        transactionId: String,
        productId: String,
        receiptData: String?
    ) async -> Result<AppOrder, PaymentError> {
        verifyReceiptCallCount += 1
        if let result = mockVerifyResult {
            return result
        }
        return .success(createMockOrder(productId: productId, points: nil))
    }

    func getAppOrder(orderId: String) async -> AppOrder? {
        getOrderCallCount += 1
        if let order = mockOrder {
            return order
        }
        return completedAppOrders.first(where: { $0.id == orderId }) ??
            pendingAppOrders.first(where: { $0.id == orderId })
    }

    func getAppOrderHistory(limit: Int, offset: Int) async -> [AppOrder] {
        getOrderHistoryCallCount += 1
        let history = mockOrderHistory.isEmpty ? completedAppOrders : mockOrderHistory
        return Array(history.dropFirst(offset).prefix(limit))
    }

    func cancelAppOrder(orderId: String) async -> Result<Void, PaymentError> {
        cancelOrderCallCount += 1
        if let index = pendingAppOrders.firstIndex(where: { $0.id == orderId }) {
            pendingAppOrders.remove(at: index)
            return .success(())
        }
        return .failure(.orderNotFound)
    }

    func getSubscription() async -> PaymentSubscriptionStatus {
        PaymentSubscriptionStatus(
            isActive: false,
            tier: nil,
            productId: nil,
            expiresAt: nil,
            willAutoRenew: false,
            startedAt: nil,
            updatedAt: nil
        )
    }

    func restorePurchases() async -> Result<[AppOrder], PaymentError> {
        .success([])
    }

    func clearError() {
        lastError = nil
    }

    func setMockPurchaseSuccess(order: AppOrder? = nil) {
        mockPurchaseResult = .success(order: order ?? createMockOrder())
    }

    func setMockPurchasePending(order: AppOrder? = nil) {
        mockPurchaseResult = .pending(order: order ?? createMockOrder(status: .pending))
    }

    func setMockPurchaseFailed(error: PaymentError = .paymentFailed(underlying: nil)) {
        mockPurchaseResult = .failed(error: error)
        lastError = error
    }

    func setMockPurchaseCancelled() {
        mockPurchaseResult = .cancelled
    }

    func setMockSubscribeSuccess(order: AppOrder? = nil) {
        mockSubscribeResult = .success(order: order ?? createMockSubscriptionOrder())
    }

    func setMockOrderHistory(_ orders: [AppOrder]) {
        mockOrderHistory = orders
    }

    func createMockOrder(
        productId: String = "com.trix3d.points.500",
        points: Int? = 580,
        status: AppPaymentStatus = .completed
    ) -> AppOrder {
        AppOrder(
            id: UUID().uuidString,
            userId: "test-user",
            productId: productId,
            productType: .points,
            amount: 28.0,
            currency: "CNY",
            status: status,
            paymentMethod: .applePay,
            transactionId: "txn_\(UUID().uuidString)",
            points: points,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    func createMockSubscriptionOrder(
        productId: String = "com.trix3d.subscription.monthly",
        status: AppPaymentStatus = .completed
    ) -> AppOrder {
        AppOrder(
            id: UUID().uuidString,
            userId: "test-user",
            productId: productId,
            productType: .subscription,
            amount: 12.0,
            currency: "CNY",
            status: status,
            paymentMethod: .applePay,
            transactionId: "txn_\(UUID().uuidString)",
            points: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    private func syncOrders(from result: PaymentResult) {
        switch result {
        case .success(let order):
            completedAppOrders.append(order)
        case .pending(let order):
            pendingAppOrders.append(order)
        case .failed, .cancelled:
            break
        }
    }
}

@MainActor
final class PaymentViewModelTestsMockStoreKitService: StoreKitServiceProtocol {
    @Published var availableProducts: [StoreProduct] = []
    @Published var isLoadingProducts: Bool = false
    @Published var subscriptionStatus: PaymentVMSubscriptionStatus?
    @Published var isPurchasing: Bool = false
    @Published var lastError: PaymentVMStoreKitError?

    func loadProducts(productIds: [String]) async -> Result<Void, PaymentVMStoreKitError> {
        .success(())
    }

    func purchase(product productId: String) async -> PurchaseResult {
        .cancelled
    }

    func restorePurchases() async -> Result<[TransactionInfo], PaymentVMStoreKitError> {
        .success([])
    }

    func checkSubscriptionStatus() async -> PaymentVMSubscriptionStatus? {
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
        nil
    }

    func prepareVerificationPayload(transaction: StoreKit.Transaction, productId: String) -> [String: Any]? {
        nil
    }

    func clearError() {}
}

@MainActor
final class PaymentViewModelTestsMockPointsService: PointsServiceProtocol {
    @Published var balance: PointsBalance?
    @Published var transactions: [PointsTransactionDetail] = []
    @Published var isLoading: Bool = false
    @Published var isSyncing: Bool = false
    @Published var lastError: PointsError?

    func refreshPoints() async -> Result<PointsBalance, PointsError> {
        .success(balance ?? PointsBalance(
            totalPoints: 1000,
            availablePoints: 1000,
            pendingPoints: 0,
            level: 1,
            todayEarned: 0,
            weekEarned: 0,
            totalTransactions: 0,
            updatedAt: Date()
        ))
    }

    func getBalance() async -> PointsBalance? {
        balance
    }

    func loadHistory(filter: PointsHistoryFilter?) async -> Result<[PointsTransactionDetail], PointsError> {
        .success([])
    }

    func addPoints(_ points: Int, description: String, metadata: [String: String]?) async -> PointsResult {
        .success(balance: balance ?? PointsBalance(
            totalPoints: 1000,
            availablePoints: 1000,
            pendingPoints: 0,
            level: 1,
            todayEarned: 0,
            weekEarned: 0,
            totalTransactions: 0,
            updatedAt: Date()
        ))
    }

    func deductPoints(_ points: Int, description: String, metadata: [String: String]?) async -> PointsResult {
        .success(balance: balance ?? PointsBalance(
            totalPoints: 1000,
            availablePoints: 1000,
            pendingPoints: 0,
            level: 1,
            todayEarned: 0,
            weekEarned: 0,
            totalTransactions: 0,
            updatedAt: Date()
        ))
    }

    func syncWithServer() async -> Result<Void, PointsError> {
        .success(())
    }

    func clearError() {}
}
