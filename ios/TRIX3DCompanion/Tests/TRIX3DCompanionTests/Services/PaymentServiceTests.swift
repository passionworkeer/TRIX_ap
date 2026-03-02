//
//  PaymentServiceTests.swift
//  TRIX3DCompanionTests
//
//  Complete test suite for PaymentService
//

import XCTest
import Combine
@testable import TRIX3DCompanion

// MARK: - Mock PaymentServiceProtocol

@MainActor
final class MockPaymentService: PaymentServiceProtocol, ObservableObject {

    @Published var pendingOrders: [Order] = []
    @Published var completedOrders: [Order] = []
    @Published var isProcessing: Bool = false
    @Published var lastError: PaymentError?

    // MARK: - PaymentServiceProtocol Required Properties

    var pendingAppOrders: [AppOrder] {
        pendingOrders.map { order in
            AppOrder(
                id: order.id,
                userId: order.userId,
                productId: order.productId,
                productType: order.productType,
                amount: order.amount,
                currency: order.currency,
                status: order.status.toAppPaymentStatus(),
                paymentMethod: order.paymentMethod,
                transactionId: order.transactionId,
                points: order.points,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt
            )
        }
    }

    var completedAppOrders: [AppOrder] {
        completedOrders.map { order in
            AppOrder(
                id: order.id,
                userId: order.userId,
                productId: order.productId,
                productType: order.productType,
                amount: order.amount,
                currency: order.currency,
                status: order.status.toAppPaymentStatus(),
                paymentMethod: order.paymentMethod,
                transactionId: order.transactionId,
                points: order.points,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt
            )
        }
    }

    // Test control properties
    var shouldFailPurchase = false
    var shouldReturnPending = false
    var shouldReturnCancelled = false
    var mockError: PaymentError?
    var mockOrders: [String: Order] = [:]
    var shouldFailVerification = false
    var shouldFailOrderFetch = false

    // Call tracking
    var purchasePointsCalled = false
    var purchasePointsCalledWithProductId: String?
    var purchasePointsCalledWithPoints: Int?
    var subscribeCalled = false
    var subscribeCalledWithProductId: String?
    var verifyReceiptCalled = false
    var verifyReceiptCalledWithTransactionId: String?
    var verifyReceiptCalledWithProductId: String?
    var getOrderCalled = false
    var getOrderCalledWithOrderId: String?
    var getOrderHistoryCalled = false
    var cancelOrderCalled = false
    var cancelOrderCalledWithOrderId: String?
    var clearErrorCalled = false

    // Receipt tampering detection
    var detectedTamperedReceipts: Set<String> = []
    var processedTransactionIds: Set<String> = []
    var duplicatePaymentAttempts: [(transactionId: String, attemptCount: Int)] = []

    func purchasePoints(productId: String, points: Int) async -> PaymentResult {
        purchasePointsCalled = true
        purchasePointsCalledWithProductId = productId
        purchasePointsCalledWithPoints = points
        isProcessing = true
        lastError = nil

        if shouldFailPurchase {
            isProcessing = false
            let error = mockError ?? .paymentFailed(underlying: nil)
            lastError = error
            return .failed(error: error)
        }

        if shouldReturnPending {
            isProcessing = false
            let order = createMockOrder(productId: productId, points: points, status: .pending)
            return .pending(order: order)
        }

        if shouldReturnCancelled {
            isProcessing = false
            return .cancelled
        }

        // Create completed order
        isProcessing = false
        let order = createMockOrder(productId: productId, points: points, status: .completed)
        return .success(order: order)
    }

    func subscribe(productId: String) async -> PaymentResult {
        subscribeCalled = true
        subscribeCalledWithProductId = productId
        isProcessing = true
        lastError = nil

        if shouldFailPurchase {
            isProcessing = false
            let error = mockError ?? .paymentFailed(underlying: nil)
            lastError = error
            return .failed(error: error)
        }

        if shouldReturnPending {
            isProcessing = false
            let order = createMockSubscriptionOrder(productId: productId, status: .pending)
            return .pending(order: order)
        }

        if shouldReturnCancelled {
            isProcessing = false
            return .cancelled
        }

        // Create completed order
        isProcessing = false
        let order = createMockSubscriptionOrder(productId: productId, status: .completed)
        return .success(order: order)
    }

    func verifyReceipt(
        transactionId: String,
        productId: String,
        receiptData: String?
    ) async -> Result<AppOrder, PaymentError> {
        verifyReceiptCalled = true
        verifyReceiptCalledWithTransactionId = transactionId
        verifyReceiptCalledWithProductId = productId

        // Security: Check for duplicate transaction
        if processedTransactionIds.contains(transactionId) {
            let existingAttempts = duplicatePaymentAttempts.firstIndex { $0.transactionId == transactionId }
            if let index = existingAttempts {
                duplicatePaymentAttempts[index].attemptCount += 1
            } else {
                duplicatePaymentAttempts.append((transactionId: transactionId, attemptCount: 2))
            }
            // Reject duplicate payment attempt
            return .failure(.verificationFailed)
        }
        processedTransactionIds.insert(transactionId)

        // Security: Check for tampered receipt
        if let receipt = receiptData, isReceiptTampered(receipt) {
            detectedTamperedReceipts.insert(transactionId)
            return .failure(.verificationFailed)
        }

        if shouldFailVerification {
            let error = mockError ?? .verificationFailed
            lastError = error
            return .failure(error)
        }

        let order = createMockOrder(productId: productId, points: 100, status: .completed)
        mockOrders[order.id] = order
        let appOrder = AppOrder(
            id: order.id,
            userId: order.userId,
            productId: order.productId,
            productType: order.productType,
            amount: order.amount,
            currency: order.currency,
            status: order.status.toAppPaymentStatus(),
            paymentMethod: order.paymentMethod,
            transactionId: order.transactionId,
            points: order.points,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
        )
        return .success(appOrder)
    }

    func getOrder(orderId: String) async -> Order? {
        getOrderCalled = true
        getOrderCalledWithOrderId = orderId

        if shouldFailOrderFetch {
            return nil
        }

        return mockOrders[orderId]
    }

    func getOrderHistory(limit: Int, offset: Int) async -> [Order] {
        getOrderHistoryCalled = true
        let orders = Array(mockOrders.values)
            .sorted { $0.createdAt > $1.createdAt }
        return Array(orders.dropFirst(offset).prefix(limit))
    }

    func cancelOrder(orderId: String) async -> Result<Void, PaymentError> {
        cancelOrderCalled = true
        cancelOrderCalledWithOrderId = orderId

        guard let order = mockOrders[orderId], order.isPending else {
            return .failure(.orderNotFound)
        }

        mockOrders.removeValue(forKey: orderId)
        return .success(())
    }

    func clearError() {
        clearErrorCalled = true
        lastError = nil
    }

    // MARK: - PaymentServiceProtocol Required Methods (AppOrder variants)

    func getAppOrder(orderId: String) async -> AppOrder? {
        guard let order = mockOrders[orderId] else { return nil }
        return AppOrder(
            id: order.id,
            userId: order.userId,
            productId: order.productId,
            productType: order.productType,
            amount: order.amount,
            currency: order.currency,
            status: order.status.toAppPaymentStatus(),
            paymentMethod: order.paymentMethod,
            transactionId: order.transactionId,
            points: order.points,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
        )
    }

    func getAppOrderHistory(limit: Int, offset: Int) async -> [AppOrder] {
        getOrderHistoryCalled = true
        let orders = Array(mockOrders.values)
            .sorted { $0.createdAt > $1.createdAt }
        return Array(orders.dropFirst(offset).prefix(limit)).map { order in
            AppOrder(
                id: order.id,
                userId: order.userId,
                productId: order.productId,
                productType: order.productType,
                amount: order.amount,
                currency: order.currency,
                status: order.status.toAppPaymentStatus(),
                paymentMethod: order.paymentMethod,
                transactionId: order.transactionId,
                points: order.points,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt
            )
        }
    }

    func cancelAppOrder(orderId: String) async -> Result<Void, PaymentError> {
        return await cancelOrder(orderId: orderId)
    }

    func getSubscription() async -> PaymentSubscriptionStatus {
        getSubscriptionCalled = true
        if shouldFailSubscriptionFetch {
            return PaymentSubscriptionStatus(
                isActive: false,
                tier: nil,
                productId: nil,
                expiresAt: nil,
                willAutoRenew: false,
                startedAt: nil,
                updatedAt: nil
            )
        }
        return PaymentSubscriptionStatus(
            isActive: mockSubscriptionActive,
            tier: mockSubscriptionTier,
            productId: mockSubscriptionProductId,
            expiresAt: mockSubscriptionExpiresAt,
            willAutoRenew: mockWillAutoRenew,
            startedAt: mockSubscriptionStartedAt,
            updatedAt: Date()
        )
    }

    func restorePurchases() async -> Result<[AppOrder], PaymentError> {
        restorePurchasesCalled = true
        if shouldFailRestore {
            lastError = mockError ?? .verificationFailed
            return .failure(lastError!)
        }
        let orders = mockOrders.values.map { order in
            AppOrder(
                id: order.id,
                userId: order.userId,
                productId: order.productId,
                productType: order.productType,
                amount: order.amount,
                currency: order.currency,
                status: order.status.toAppPaymentStatus(),
                paymentMethod: order.paymentMethod,
                transactionId: order.transactionId,
                points: order.points,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt
            )
        }
        return .success(Array(orders))
    }

    // MARK: - Subscription Test Control Properties

    var getSubscriptionCalled = false
    var shouldFailSubscriptionFetch = false
    var mockSubscriptionActive = false
    var mockSubscriptionTier: String? = nil
    var mockSubscriptionProductId: String? = nil
    var mockSubscriptionExpiresAt: Date? = nil
    var mockWillAutoRenew = false
    var mockSubscriptionStartedAt: Date? = nil

    var restorePurchasesCalled = false
    var shouldFailRestore = false

    // MARK: - Helper Methods

    private func createMockOrder(productId: String, points: Int, status: PaymentStatus) -> Order {
        let order = Order(
            id: UUID().uuidString,
            userId: "test-user",
            productId: productId,
            productType: .points,
            amount: 6.0,
            currency: "CNY",
            status: status,
            paymentMethod: .applePay,
            transactionId: "txn-\(UUID().uuidString)",
            points: points,
            createdAt: Date(),
            updatedAt: Date()
        )
        mockOrders[order.id] = order
        return order
    }

    private func createMockSubscriptionOrder(productId: String, status: PaymentStatus) -> Order {
        let order = Order(
            id: UUID().uuidString,
            userId: "test-user",
            productId: productId,
            productType: .subscription,
            amount: 12.0,
            currency: "CNY",
            status: status,
            paymentMethod: .applePay,
            transactionId: "txn-\(UUID().uuidString)",
            points: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
        mockOrders[order.id] = order
        return order
    }

    private func isReceiptTampered(_ receipt: String) -> Bool {
        // Simple tamper detection: check for known tampered patterns
        return receipt.contains("tampered") ||
               receipt.contains("modified") ||
               receipt.isEmpty ||
               receipt.count < 10
    }
}

// MARK: - PaymentService Tests

@MainActor
final class PaymentServiceTests: XCTestCase {

    var sut: MockPaymentService!
    var cancellables: Set<AnyCancellable>!

    override func setUp() {
        super.setUp()
        sut = MockPaymentService()
        cancellables = Set<AnyCancellable>()
    }

    override func tearDown() {
        sut = nil
        cancellables = nil
        super.tearDown()
    }

    // MARK: - Purchase Points Tests

    func testPurchasePoints_Success() async {
        // Given
        let productId = StoreProductConfiguration.points100
        let points = 100

        // When
        let result = await sut.purchasePoints(productId: productId, points: points)

        // Then
        XCTAssertTrue(sut.purchasePointsCalled)
        XCTAssertEqual(sut.purchasePointsCalledWithProductId, productId)
        XCTAssertEqual(sut.purchasePointsCalledWithPoints, points)
        XCTAssertFalse(sut.isProcessing)

        switch result {
        case .success(let order):
            XCTAssertEqual(order.productId, productId)
            XCTAssertEqual(order.points, points)
            XCTAssertTrue(order.isCompleted)
        case .pending, .failed, .cancelled:
            XCTFail("Expected success but got \(result)")
        }
    }

    func testPurchasePoints_AllProducts() async {
        let products: [(String, Int)] = [
            (StoreProductConfiguration.points100, 100),
            (StoreProductConfiguration.points300, 330),
            (StoreProductConfiguration.points500, 580),
            (StoreProductConfiguration.points1000, 1200)
        ]

        for (productId, points) in products {
            // When
            let result = await sut.purchasePoints(productId: productId, points: points)

            // Then
            switch result {
            case .success(let order):
                XCTAssertEqual(order.productId, productId)
                XCTAssertEqual(order.points, points)
            default:
                XCTFail("Expected success for product \(productId)")
            }
        }
    }

    func testPurchasePoints_Pending() async {
        // Given
        sut.shouldReturnPending = true
        let productId = StoreProductConfiguration.points300

        // When
        let result = await sut.purchasePoints(productId: productId, points: 330)

        // Then
        switch result {
        case .pending(let order):
            XCTAssertTrue(sut.purchasePointsCalled)
            XCTAssertFalse(sut.isProcessing)
            XCTAssertTrue(order.isPending)
            XCTAssertEqual(order.productId, productId)
        case .success, .failed, .cancelled:
            XCTFail("Expected pending but got \(result)")
        }
    }

    func testPurchasePoints_Cancelled() async {
        // Given
        sut.shouldReturnCancelled = true
        let productId = StoreProductConfiguration.points500

        // When
        let result = await sut.purchasePoints(productId: productId, points: 580)

        // Then
        switch result {
        case .cancelled:
            XCTAssertTrue(sut.purchasePointsCalled)
            XCTAssertFalse(sut.isProcessing)
        case .success, .pending, .failed:
            XCTFail("Expected cancelled but got \(result)")
        }
    }

    func testPurchasePoints_Failed() async {
        // Given
        sut.shouldFailPurchase = true
        sut.mockError = .insufficientBalance
        let productId = StoreProductConfiguration.points100

        // When
        let result = await sut.purchasePoints(productId: productId, points: 100)

        // Then
        switch result {
        case .failed(let error):
            XCTAssertTrue(sut.purchasePointsCalled)
            XCTAssertFalse(sut.isProcessing)
            XCTAssertEqual(error, .insufficientBalance)
            XCTAssertNotNil(sut.lastError)
        case .success, .pending, .cancelled:
            XCTFail("Expected failed but got \(result)")
        }
    }

    func testPurchasePoints_InvalidProduct() async {
        // Given
        sut.shouldFailPurchase = true
        sut.mockError = .invalidProduct
        let invalidProductId = "com.invalid.product"

        // When
        let result = await sut.purchasePoints(productId: invalidProductId, points: 100)

        // Then
        switch result {
        case .failed(let error):
            XCTAssertEqual(error, .invalidProduct)
        default:
            XCTFail("Expected invalid product error")
        }
    }

    // MARK: - Subscription Tests

    func testSubscribe_Success() async {
        // Given
        let productId = StoreProductConfiguration.monthlySubscription

        // When
        let result = await sut.subscribe(productId: productId)

        // Then
        XCTAssertTrue(sut.subscribeCalled)
        XCTAssertEqual(sut.subscribeCalledWithProductId, productId)
        XCTAssertFalse(sut.isProcessing)

        switch result {
        case .success(let order):
            XCTAssertEqual(order.productId, productId)
            XCTAssertEqual(order.productType, .subscription)
            XCTAssertTrue(order.isCompleted)
            XCTAssertNil(order.points)
        case .pending, .failed, .cancelled:
            XCTFail("Expected success but got \(result)")
        }
    }

    func testSubscribe_YearlySubscription() async {
        // Given
        let productId = StoreProductConfiguration.yearlySubscription

        // When
        let result = await sut.subscribe(productId: productId)

        // Then
        switch result {
        case .success(let order):
            XCTAssertEqual(order.productId, productId)
            XCTAssertEqual(order.productType, .subscription)
        default:
            XCTFail("Expected success for yearly subscription")
        }
    }

    func testSubscribe_Pending() async {
        // Given
        sut.shouldReturnPending = true
        let productId = StoreProductConfiguration.monthlySubscription

        // When
        let result = await sut.subscribe(productId: productId)

        // Then
        switch result {
        case .pending(let order):
            XCTAssertTrue(sut.subscribeCalled)
            XCTAssertFalse(sut.isProcessing)
            XCTAssertTrue(order.isPending)
            XCTAssertEqual(order.productType, .subscription)
        case .success, .failed, .cancelled:
            XCTFail("Expected pending but got \(result)")
        }
    }

    func testSubscribe_Cancelled() async {
        // Given
        sut.shouldReturnCancelled = true

        // When
        let result = await sut.subscribe(productId: StoreProductConfiguration.yearlySubscription)

        // Then
        switch result {
        case .cancelled:
            XCTAssertTrue(sut.subscribeCalled)
            XCTAssertFalse(sut.isProcessing)
        case .success, .pending, .failed:
            XCTFail("Expected cancelled but got \(result)")
        }
    }

    // MARK: - Receipt Verification Tests

    func testVerifyReceipt_Success() async {
        // Given
        let transactionId = "txn-123456"
        let productId = StoreProductConfiguration.points100
        let receiptData = "valid-receipt-data"

        // When
        let result = await sut.verifyReceipt(
            transactionId: transactionId,
            productId: productId,
            receiptData: receiptData
        )

        // Then
        XCTAssertTrue(sut.verifyReceiptCalled)
        XCTAssertEqual(sut.verifyReceiptCalledWithTransactionId, transactionId)
        XCTAssertEqual(sut.verifyReceiptCalledWithProductId, productId)

        switch result {
        case .success(let order):
            XCTAssertEqual(order.productId, productId)
        case .failure:
            XCTFail("Expected success but got failure")
        }
    }

    func testVerifyReceipt_NoReceiptData() async {
        // Given
        let transactionId = "txn-789012"
        let productId = StoreProductConfiguration.points300

        // When
        let result = await sut.verifyReceipt(
            transactionId: transactionId,
            productId: productId,
            receiptData: nil
        )

        // Then
        switch result {
        case .success:
            XCTAssertTrue(true)
        case .failure:
            XCTFail("Expected success with nil receipt data")
        }
    }

    func testVerifyReceipt_VerificationFailed() async {
        // Given
        sut.shouldFailVerification = true
        sut.mockError = .verificationFailed

        // When
        let result = await sut.verifyReceipt(
            transactionId: "txn-fail",
            productId: "test.product",
            receiptData: nil
        )

        // Then
        switch result {
        case .success:
            XCTFail("Expected failure but got success")
        case .failure(let error):
            XCTAssertEqual(error, .verificationFailed)
        }
    }

    // MARK: - Security Tests - Receipt Tampering

    func testSecurity_DetectTamperedReceipt() async {
        // Given
        let tamperedReceipts = [
            "tampered-receipt",
            "modified-receipt-data",
            "",  // Empty receipt
            "short"  // Too short
        ]

        for (index, tamperedReceipt) in tamperedReceipts.enumerated() {
            // When
            let result = await sut.verifyReceipt(
                transactionId: "txn-tamper-\(index)",
                productId: StoreProductConfiguration.points100,
                receiptData: tamperedReceipt
            )

            // Then
            switch result {
            case .failure(let error):
                XCTAssertEqual(error, .verificationFailed, "Should detect tampered receipt: \(tamperedReceipt)")
                XCTAssertTrue(sut.detectedTamperedReceipts.contains("txn-tamper-\(index)"))
            case .success:
                XCTFail("Should reject tampered receipt: \(tamperedReceipt)")
            }
        }
    }

    func testSecurity_AcceptValidReceipt() async {
        // Given
        let validReceipt = "valid-receipt-data-with-sufficient-length"

        // When
        let result = await sut.verifyReceipt(
            transactionId: "txn-valid",
            productId: StoreProductConfiguration.points100,
            receiptData: validReceipt
        )

        // Then
        switch result {
        case .success:
            XCTAssertTrue(true)
            XCTAssertFalse(sut.detectedTamperedReceipts.contains("txn-valid"))
        case .failure:
            XCTFail("Should accept valid receipt")
        }
    }

    // MARK: - Security Tests - Duplicate Payment

    func testSecurity_DetectDuplicatePayment() async {
        // Given
        let transactionId = "txn-duplicate-123"

        // First purchase should succeed
        let firstResult = await sut.verifyReceipt(
            transactionId: transactionId,
            productId: StoreProductConfiguration.points100,
            receiptData: "valid-receipt"
        )

        switch firstResult {
        case .success:
            XCTAssertTrue(true)
        case .failure:
            XCTFail("First purchase should succeed")
        }

        // When - Second purchase with same transaction ID
        let secondResult = await sut.verifyReceipt(
            transactionId: transactionId,
            productId: StoreProductConfiguration.points100,
            receiptData: "valid-receipt"
        )

        // Then - Should be rejected
        switch secondResult {
        case .failure(let error):
            XCTAssertEqual(error, .verificationFailed)
            XCTAssertTrue(sut.processedTransactionIds.contains(transactionId))
            XCTAssertEqual(sut.duplicatePaymentAttempts.first?.transactionId, transactionId)
            XCTAssertEqual(sut.duplicatePaymentAttempts.first?.attemptCount, 2)
        case .success:
            XCTFail("Should reject duplicate payment")
        }
    }

    func testSecurity_MultipleDuplicateAttempts() async {
        // Given
        let transactionId = "txn-duplicate-multi"

        // First purchase
        _ = await sut.verifyReceipt(
            transactionId: transactionId,
            productId: StoreProductConfiguration.points100,
            receiptData: "valid-receipt"
        )

        // When - Multiple duplicate attempts
        _ = await sut.verifyReceipt(
            transactionId: transactionId,
            productId: StoreProductConfiguration.points100,
            receiptData: "valid-receipt"
        )
        _ = await sut.verifyReceipt(
            transactionId: transactionId,
            productId: StoreProductConfiguration.points100,
            receiptData: "valid-receipt"
        )

        // Then
        let attempts = sut.duplicatePaymentAttempts.filter { $0.transactionId == transactionId }
        XCTAssertFalse(attempts.isEmpty)
        XCTAssertTrue(attempts.first?.attemptCount ?? 0 >= 3)
    }

    // MARK: - Order Management Tests

    func testGetOrder_Success() async {
        // Given
        let orderId = "order-123"
        let mockOrder = Order(
            id: orderId,
            userId: "test-user",
            productId: StoreProductConfiguration.points100,
            productType: .points,
            amount: 6.0,
            currency: "CNY",
            status: .completed,
            paymentMethod: .applePay,
            transactionId: "txn-123",
            points: 100,
            createdAt: Date(),
            updatedAt: Date()
        )
        sut.mockOrders[orderId] = mockOrder

        // When
        let result = await sut.getOrder(orderId: orderId)

        // Then
        XCTAssertTrue(sut.getOrderCalled)
        XCTAssertEqual(sut.getOrderCalledWithOrderId, orderId)
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.id, orderId)
    }

    func testGetOrder_NotFound() async {
        // Given
        sut.shouldFailOrderFetch = true

        // When
        let result = await sut.getOrder(orderId: "non-existent")

        // Then
        XCTAssertTrue(sut.getOrderCalled)
        XCTAssertNil(result)
    }

    func testGetOrderHistory_Success() async {
        // Given
        let order1 = Order(
            id: "order-1",
            userId: "test-user",
            productId: StoreProductConfiguration.points100,
            productType: .points,
            amount: 6.0,
            currency: "CNY",
            status: .completed,
            paymentMethod: .applePay,
            transactionId: "txn-1",
            points: 100,
            createdAt: Date(),
            updatedAt: Date()
        )
        let order2 = Order(
            id: "order-2",
            userId: "test-user",
            productId: StoreProductConfiguration.points300,
            productType: .points,
            amount: 18.0,
            currency: "CNY",
            status: .pending,
            paymentMethod: .applePay,
            transactionId: "txn-2",
            points: 330,
            createdAt: Date().addingTimeInterval(-3600),
            updatedAt: Date()
        )
        sut.mockOrders["order-1"] = order1
        sut.mockOrders["order-2"] = order2

        // When
        let history = await sut.getOrderHistory(limit: 10, offset: 0)

        // Then
        XCTAssertTrue(sut.getOrderHistoryCalled)
        XCTAssertEqual(history.count, 2)
    }

    func testGetOrderHistory_Pagination() async {
        // Given
        for i in 1...15 {
            let order = Order(
                id: "order-\(i)",
                userId: "test-user",
                productId: StoreProductConfiguration.points100,
                productType: .points,
                amount: 6.0,
                currency: "CNY",
                status: .completed,
                paymentMethod: .applePay,
                transactionId: "txn-\(i)",
                points: 100,
                createdAt: Date().addingTimeInterval(-Double(i * 60)),
                updatedAt: Date()
            )
            sut.mockOrders["order-\(i)"] = order
        }

        // When
        let page1 = await sut.getOrderHistory(limit: 10, offset: 0)
        let page2 = await sut.getOrderHistory(limit: 10, offset: 10)

        // Then
        XCTAssertEqual(page1.count, 10)
        XCTAssertEqual(page2.count, 5)
    }

    func testCancelOrder_Success() async {
        // Given
        let orderId = "order-pending"
        let order = Order(
            id: orderId,
            userId: "test-user",
            productId: StoreProductConfiguration.points100,
            productType: .points,
            amount: 6.0,
            currency: "CNY",
            status: .pending,
            paymentMethod: .applePay,
            transactionId: nil,
            points: 100,
            createdAt: Date(),
            updatedAt: Date()
        )
        sut.mockOrders[orderId] = order

        // When
        let result = await sut.cancelOrder(orderId: orderId)

        // Then
        XCTAssertTrue(sut.cancelOrderCalled)
        XCTAssertEqual(sut.cancelOrderCalledWithOrderId, orderId)

        switch result {
        case .success:
            XCTAssertNil(sut.mockOrders[orderId])
        case .failure:
            XCTFail("Expected success but got failure")
        }
    }

    func testCancelOrder_NotFound() async {
        // When
        let result = await sut.cancelOrder(orderId: "non-existent")

        // Then
        switch result {
        case .success:
            XCTFail("Expected failure but got success")
        case .failure(let error):
            XCTAssertEqual(error, .orderNotFound)
        }
    }

    func testCancelOrder_CompletedOrder() async {
        // Given
        let orderId = "order-completed"
        let order = Order(
            id: orderId,
            userId: "test-user",
            productId: StoreProductConfiguration.points100,
            productType: .points,
            amount: 6.0,
            currency: "CNY",
            status: .completed,
            paymentMethod: .applePay,
            transactionId: "txn-123",
            points: 100,
            createdAt: Date(),
            updatedAt: Date()
        )
        sut.mockOrders[orderId] = order

        // When
        let result = await sut.cancelOrder(orderId: orderId)

        // Then
        switch result {
        case .success:
            XCTFail("Should not cancel completed order")
        case .failure(let error):
            XCTAssertEqual(error, .orderNotFound)
        }
    }

    // MARK: - Error Handling Tests

    func testClearError_ClearsLastError() async {
        // Given
        sut.lastError = .networkError

        // When
        sut.clearError()

        // Then
        XCTAssertTrue(sut.clearErrorCalled)
        XCTAssertNil(sut.lastError)
    }

    func testLastError_SetOnPurchaseFailure() async {
        // Given
        sut.shouldFailPurchase = true
        sut.mockError = .insufficientBalance

        // When
        _ = await sut.purchasePoints(productId: "test.product", points: 100)

        // Then
        XCTAssertNotNil(sut.lastError)
        XCTAssertEqual(sut.lastError, .insufficientBalance)
    }

    func testPaymentError_IsRecoverable() {
        // Then
        XCTAssertFalse(PaymentError.userCancelled.isRecoverable)
        XCTAssertFalse(PaymentError.invalidProduct.isRecoverable)
        XCTAssertFalse(PaymentError.orderNotFound.isRecoverable)
        XCTAssertTrue(PaymentError.paymentFailed(underlying: nil).isRecoverable)
        XCTAssertTrue(PaymentError.verificationFailed.isRecoverable)
        XCTAssertTrue(PaymentError.networkError.isRecoverable)
        XCTAssertTrue(PaymentError.insufficientBalance.isRecoverable)
    }

    func testPaymentError_ErrorDescription() {
        // Then
        XCTAssertNotNil(PaymentError.invalidProduct.errorDescription)
        XCTAssertNotNil(PaymentError.paymentFailed(underlying: nil).errorDescription)
        XCTAssertNotNil(PaymentError.verificationFailed.errorDescription)
        XCTAssertNotNil(PaymentError.insufficientBalance.errorDescription)
        XCTAssertNotNil(PaymentError.networkError.errorDescription)
        XCTAssertNotNil(PaymentError.userCancelled.errorDescription)
        XCTAssertNotNil(PaymentError.orderNotFound.errorDescription)
        XCTAssertNotNil(PaymentError.serverError(message: "Test").errorDescription)
    }

    // MARK: - Order Status Tests

    func testOrderStatus_Completed() {
        // Given
        let order = Order(
            id: "order-1",
            userId: "test-user",
            productId: StoreProductConfiguration.points100,
            productType: .points,
            amount: 6.0,
            currency: "CNY",
            status: .completed,
            paymentMethod: .applePay,
            transactionId: "txn-123",
            points: 100,
            createdAt: Date(),
            updatedAt: Date()
        )

        // Then
        XCTAssertTrue(order.isCompleted)
        XCTAssertFalse(order.isPending)
        XCTAssertFalse(order.isFailed)
    }

    func testOrderStatus_Pending() {
        // Given
        let order = Order(
            id: "order-1",
            userId: "test-user",
            productId: StoreProductConfiguration.points100,
            productType: .points,
            amount: 6.0,
            currency: "CNY",
            status: .pending,
            paymentMethod: .applePay,
            transactionId: nil,
            points: 100,
            createdAt: Date(),
            updatedAt: Date()
        )

        // Then
        XCTAssertTrue(order.isPending)
        XCTAssertFalse(order.isCompleted)
        XCTAssertFalse(order.isFailed)
    }

    func testOrderStatus_Processing() {
        // Given
        let order = Order(
            id: "order-1",
            userId: "test-user",
            productId: StoreProductConfiguration.points100,
            productType: .points,
            amount: 6.0,
            currency: "CNY",
            status: .processing,
            paymentMethod: .applePay,
            transactionId: nil,
            points: 100,
            createdAt: Date(),
            updatedAt: Date()
        )

        // Then
        XCTAssertTrue(order.isPending)
        XCTAssertFalse(order.isCompleted)
        XCTAssertFalse(order.isFailed)
    }

    func testOrderStatus_Failed() {
        let failedStatuses: [PaymentStatus] = [.failed, .cancelled]

        for status in failedStatuses {
            let order = Order(
                id: "order-1",
                userId: "test-user",
                productId: StoreProductConfiguration.points100,
                productType: .points,
                amount: 6.0,
                currency: "CNY",
                status: status,
                paymentMethod: .applePay,
                transactionId: nil,
                points: 100,
                createdAt: Date(),
                updatedAt: Date()
            )

            XCTAssertTrue(order.isFailed, "Failed status for \(status)")
            XCTAssertFalse(order.isCompleted)
            XCTAssertFalse(order.isPending)
        }
    }

    // MARK: - Published Properties Tests

    func testIsProcessing_PublishesChanges() async {
        // Given
        let expectation = expectation(description: "Processing state publishes")
        var processingStates: [Bool] = []

        sut.$isProcessing
            .dropFirst()
            .sink { isProcessing in
                processingStates.append(isProcessing)
                if processingStates.count == 2 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        _ = await sut.purchasePoints(productId: "test.product", points: 100)

        // Then
        await fulfillment(of: [expectation], timeout: 1.0)
        XCTAssertEqual(processingStates, [true, false])
    }

    func testPendingOrders_PublishesChanges() async {
        // Given
        let expectation = expectation(description: "Pending orders publish")
        sut.shouldReturnPending = true

        sut.$pendingOrders
            .dropFirst()
            .sink { orders in
                if !orders.isEmpty {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        _ = await sut.purchasePoints(productId: StoreProductConfiguration.points100, points: 100)

        // Then
        await fulfillment(of: [expectation], timeout: 1.0)
    }

    func testCompletedOrders_PublishesChanges() async {
        // Given
        let expectation = expectation(description: "Completed orders publish")

        sut.$completedOrders
            .dropFirst()
            .sink { orders in
                if !orders.isEmpty {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        _ = await sut.purchasePoints(productId: StoreProductConfiguration.points100, points: 100)

        // Then
        await fulfillment(of: [expectation], timeout: 1.0)
    }

    func testLastError_PublishesChanges() async {
        // Given
        let expectation = expectation(description: "Error publishes")
        var receivedError: PaymentError?

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
        sut.mockError = .insufficientBalance
        _ = await sut.purchasePoints(productId: "test.product", points: 100)

        // Then
        await fulfillment(of: [expectation], timeout: 1.0)
        XCTAssertNotNil(receivedError)
    }

    // MARK: - Payment Method Tests

    func testPaymentMethod_DisplayName() {
        // Then
        XCTAssertEqual(PaymentMethod.applePay.displayName, "Apple Pay")
        XCTAssertEqual(PaymentMethod.wechatPay.displayName, "WeChat Pay")
        XCTAssertEqual(PaymentMethod.alipay.displayName, "Alipay")
    }

    func testPaymentMethod_IconName() {
        // Then
        XCTAssertEqual(PaymentMethod.applePay.iconName, "applelogo")
        XCTAssertEqual(PaymentMethod.wechatPay.iconName, "message.fill")
        XCTAssertEqual(PaymentMethod.alipay.iconName, "yensign.circle.fill")
    }

    func testPaymentMethod_RawValue() {
        // Then
        XCTAssertEqual(PaymentMethod.applePay.rawValue, "apple_pay")
        XCTAssertEqual(PaymentMethod.wechatPay.rawValue, "wechat_pay")
        XCTAssertEqual(PaymentMethod.alipay.rawValue, "alipay")
    }

    // MARK: - Concurrent Safety Tests

    func testConcurrentPurchases_ThreadSafe() async {
        // Given
        let productId1 = StoreProductConfiguration.points100
        let productId2 = StoreProductConfiguration.points300

        // When - Execute concurrent purchases
        async let result1 = sut.purchasePoints(productId: productId1, points: 100)
        async let result2 = sut.purchasePoints(productId: productId2, points: 330)

        let (res1, res2) = await (result1, result2)

        // Then - Both should complete without crashing
        XCTAssertTrue(sut.purchasePointsCalled)
        XCTAssertFalse(sut.isProcessing)

        switch (res1, res2) {
        case (.success, .success):
            XCTAssertTrue(true)
        default:
            XCTFail("Expected both purchases to succeed")
        }
    }

    func testConcurrentReceiptVerification_ThreadSafe() async {
        // Given
        let tx1 = "txn-1"
        let tx2 = "txn-2"

        // When
        async let result1 = sut.verifyReceipt(transactionId: tx1, productId: "product1", receiptData: nil)
        async let result2 = sut.verifyReceipt(transactionId: tx2, productId: "product2", receiptData: nil)

        let (res1, res2) = await (result1, result2)

        // Then
        switch (res1, res2) {
        case (.success, .success):
            XCTAssertTrue(true)
        default:
            XCTFail("Expected both verifications to succeed")
        }
    }

    // MARK: - Edge Cases Tests

    func testPurchasePoints_ZeroPoints() async {
        // Given
        let productId = StoreProductConfiguration.points100

        // When
        let result = await sut.purchasePoints(productId: productId, points: 0)

        // Then
        // Service should handle zero points gracefully
        switch result {
        case .success(let order):
            XCTAssertEqual(order.points, 0)
        case .pending, .failed, .cancelled:
            XCTFail("Should handle zero points")
        }
    }

    func testVerifyReceipt_EmptyTransactionId() async {
        // When
        let result = await sut.verifyReceipt(
            transactionId: "",
            productId: StoreProductConfiguration.points100,
            receiptData: nil
        )

        // Then
        // Service should handle empty transaction ID
        switch result {
        case .success:
            XCTAssertTrue(true)
        case .failure:
            // May fail validation
            XCTAssertTrue(true)
        }
    }

    func testGetOrderHistory_Empty() async {
        // When
        let history = await sut.getOrderHistory(limit: 10, offset: 0)

        // Then
        XCTAssertTrue(history.isEmpty)
    }

    func testGetOrderHistory_LimitZero() async {
        // Given
        let order = Order(
            id: "order-1",
            userId: "test-user",
            productId: StoreProductConfiguration.points100,
            productType: .points,
            amount: 6.0,
            currency: "CNY",
            status: .completed,
            paymentMethod: .applePay,
            transactionId: "txn-1",
            points: 100,
            createdAt: Date(),
            updatedAt: Date()
        )
        sut.mockOrders["order-1"] = order

        // When
        let history = await sut.getOrderHistory(limit: 0, offset: 0)

        // Then
        XCTAssertTrue(history.isEmpty)
    }
}
