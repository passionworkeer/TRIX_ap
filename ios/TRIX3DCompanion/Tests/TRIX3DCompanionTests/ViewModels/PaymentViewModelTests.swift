//
//  PaymentViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for PaymentViewModel
//

import XCTest
import Combine
@testable import TRIX3DCompanion

/// Unit tests for PaymentViewModel
final class PaymentViewModelTests: XCTestCase {

    // MARK: - Properties

    var paymentViewModel: PaymentViewModel!
    var mockPaymentService: MockPaymentService!
    var mockStoreKitService: MockStoreKitService!
    var mockPointsService: MockPointsService!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        mockPaymentService = MockPaymentService()
        mockStoreKitService = MockStoreKitService()
        mockPointsService = MockPointsService()

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

        // Act
        await paymentViewModel.loadOrderHistory()

        // Assert
        XCTAssertEqual(paymentViewModel.orderHistory.count, 2)
        XCTAssertEqual(mockPaymentService.getOrderHistoryCallCount, 1)
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
        XCTAssertTrue(paymentViewModel.paymentSummary.contains("Points"))
    }

    func test_totalAmount_returnsProductPrice() {
        // Arrange
        let product = createMockPointsProduct()
        paymentViewModel.startPayment(for: product)

        // Assert
        XCTAssertNotNil(paymentViewModel.totalAmount)
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
        XCTAssertTrue(paymentViewModel.confirmationMessage.contains("Confirm"))
    }

    // MARK: - Helper Methods

    private func createMockProduct() -> StoreProduct {
        fatalError("Use createMockPointsProduct or createMockSubscriptionProduct")
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
}
