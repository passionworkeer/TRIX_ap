//
//  PaymentViewModel.swift
//  TRIX3DCompanion
//
//  Payment ViewModel - manages payment flow and state
//

import Foundation
import Combine

// MARK: - Payment ViewModel

/// Payment view model managing payment flow and order tracking
@MainActor
final class PaymentViewModel: ObservableObject {

    // MARK: - Published Properties

    /// Current payment state
    @Published var paymentState: PaymentFlowState = .idle

    /// Selected product for purchase
    @Published var selectedProduct: StoreProduct?

    /// Current payment method
    @Published var paymentMethod: PaymentMethod = .applePay

    /// Available payment methods
    @Published var availablePaymentMethods: [PaymentMethod] = [.applePay]

    /// Current order being processed
    @Published var currentOrder: AppOrder?

    /// Order history
    @Published var orderHistory: [AppOrder] = []

    /// Error message to display
    @Published var errorMessage: String?

    /// Whether to show payment result
    @Published var showResult: Bool = false

    // MARK: - Payment Flow State

    enum PaymentFlowState: Equatable {
        case idle
        case selectingProduct
        case confirmingPurchase
        case processing
        case success(order: AppOrder)
        case pending(order: AppOrder)
        case failed(error: String)
        case cancelled

        static func == (lhs: PaymentFlowState, rhs: PaymentFlowState) -> Bool {
            switch (lhs, rhs) {
            case (.idle, .idle),
                 (.selectingProduct, .selectingProduct),
                 (.confirmingPurchase, .confirmingPurchase),
                 (.processing, .processing),
                 (.cancelled, .cancelled):
                return true
            case (.success(let lhsOrder), .success(let rhsOrder)):
                return lhsOrder.id == rhsOrder.id
            case (.pending(let lhsOrder), .pending(let rhsOrder)):
                return lhsOrder.id == rhsOrder.id
            case (.failed(let lhsError), .failed(let rhsError)):
                return lhsError == rhsError
            default:
                return false
            }
        }
    }

    // MARK: - Dependencies

    private let paymentService: any PaymentServiceProtocol
    private let storeKitService: any StoreKitServiceProtocol
    private let pointsService: any PointsServiceProtocol
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    /// Initialize PaymentViewModel
    /// - Parameters:
    ///   - paymentService: Payment service dependency
    ///   - storeKitService: StoreKit service dependency
    ///   - pointsService: Points service dependency
    init(
        paymentService: (any PaymentServiceProtocol)? = nil,
        storeKitService: (any StoreKitServiceProtocol)? = nil,
        pointsService: (any PointsServiceProtocol)? = nil
    ) {
        self.paymentService = paymentService ?? PaymentService.shared
        self.storeKitService = storeKitService ?? StoreKitService.shared
        self.pointsService = pointsService ?? PointsService.shared

        // Load order history
        Task {
            await loadOrderHistory()
        }

        // Setup bindings
        setupBindings()
    }

    // MARK: - Setup

    /// Setup Combine bindings
    private func setupBindings() {
        // Note: Protocol properties cannot be observed directly with $ prefix
        // We use Timer to periodically refresh order state instead
        // This is a workaround for observing protocol-based published properties

        // Observe processing state via Timer (every 2 seconds)
        Timer.publish(every: 2, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self = self else { return }
                Task { @MainActor in
                    // Refresh order history to check for updates
                    let history = await self.paymentService.getAppOrderHistory(limit: 50, offset: 0)
                    self.handleOrdersUpdate(history)
                }
            }
            .store(in: &cancellables)
    }

    /// Handle orders update from periodic refresh
    /// - Parameter orders: Updated orders list
    private func handleOrdersUpdate(_ orders: [AppOrder]) {
        let pendingOrders = orders.filter { $0.isPending }
        let completedOrders = orders.filter { $0.isCompleted }

        // Handle pending orders
        if let currentOrderId = currentOrder?.id,
           let updatedOrder = pendingOrders.first(where: { $0.id == currentOrderId }) {
            if updatedOrder.isCompleted {
                paymentState = .success(order: updatedOrder)
                showResult = true
            } else if updatedOrder.isFailed {
                paymentState = .failed(error: "Payment failed")
                showResult = true
            }
        }

        // Update completed orders
        orderHistory = completedOrders
    }

    // MARK: - Public Methods

    /// Start payment flow for product
    /// - Parameter product: Product to purchase
    func startPayment(for product: StoreProduct) {
        selectedProduct = product
        paymentState = .selectingProduct
    }

    /// Confirm and process purchase
    func confirmPurchase() async {
        guard let product = selectedProduct else {
            errorMessage = "No product selected"
            paymentState = .failed(error: "No product selected")
            return
        }

        paymentState = .confirmingPurchase

        // Process payment based on product type
        let result: PaymentResult

        switch product.type {
        case .points:
            guard let points = product.points else {
                errorMessage = "Invalid product configuration"
                paymentState = .failed(error: "Invalid product configuration")
                return
            }
            result = await paymentService.purchasePoints(productId: product.id, points: points)

        case .subscription:
            result = await paymentService.subscribe(productId: product.id)
        }

        handlePaymentResult(result)
    }

    /// Cancel current payment
    func cancelPayment() {
        if let order = currentOrder, order.isPending {
            Task {
                _ = await paymentService.cancelAppOrder(orderId: order.id)
            }
        }

        paymentState = .cancelled
        currentOrder = nil
        selectedProduct = nil
    }

    /// Retry failed payment
    func retryPayment() async {
        guard let product = selectedProduct else { return }

        // Reset state and retry
        paymentState = .idle
        await confirmPurchase()
    }

    /// Load order history
    func loadOrderHistory() async {
        let history = await paymentService.getAppOrderHistory(limit: 50, offset: 0)
        orderHistory = history
    }

    /// Get order details
    /// - Parameter orderId: Order ID to fetch
    /// - Returns: Order details or nil
    func getOrderDetails(orderId: String) async -> AppOrder? {
        return await paymentService.getAppOrder(orderId: orderId)
    }

    /// Clear error state
    func clearError() {
        errorMessage = nil
        paymentService.clearError()
    }

    /// Reset payment flow to idle state
    func resetFlow() {
        paymentState = .idle
        currentOrder = nil
        selectedProduct = nil
        errorMessage = nil
        showResult = false
    }

    // MARK: - Payment Method Selection

    /// Select payment method
    /// - Parameter method: Payment method to use
    func selectPaymentMethod(_ method: PaymentMethod) {
        paymentMethod = method
    }

    /// Check if payment method is available
    /// - Parameter method: Payment method to check
    /// - Returns: True if available
    func isPaymentMethodAvailable(_ method: PaymentMethod) -> Bool {
        return availablePaymentMethods.contains(method)
    }

    // MARK: - State Helpers

    /// Check if payment is in progress
    var isProcessing: Bool {
        if case .processing = paymentState {
            return true
        }
        return false
    }

    /// Check if payment was successful
    var isSuccess: Bool {
        if case .success = paymentState {
            return true
        }
        return false
    }

    /// Check if payment is pending
    var isPending: Bool {
        if case .pending = paymentState {
            return true
        }
        return false
    }

    /// Check if payment failed
    var isFailed: Bool {
        if case .failed = paymentState {
            return true
        }
        return false
    }

    /// Get success order if available
    var successOrder: AppOrder? {
        if case .success(let order) = paymentState {
            return order
        }
        return nil
    }

    /// Get pending order if available
    var pendingOrder: AppOrder? {
        if case .pending(let order) = paymentState {
            return order
        }
        return nil
    }

    // MARK: - Private Methods

    /// Handle payment result
    /// - Parameter result: Payment result from service
    private func handlePaymentResult(_ result: PaymentResult) {
        switch result {
        case .success(let order):
            paymentState = .success(order: order)
            currentOrder = order
            showResult = true

        case .pending(let order):
            paymentState = .pending(order: order)
            currentOrder = order

        case .failed(let error):
            paymentState = .failed(error: error.errorDescription ?? "Payment failed")
            errorMessage = error.errorDescription
            showResult = true

        case .cancelled:
            paymentState = .cancelled
        }
    }

    /// Handle pending orders updates
    /// - Parameter orders: Updated pending orders
    private func handlePendingOrders(_ orders: [AppOrder]) {
        // Check if current pending order has been updated
        if let currentOrderId = currentOrder?.id,
           let updatedOrder = orders.first(where: { $0.id == currentOrderId }) {

            if updatedOrder.isCompleted {
                paymentState = .success(order: updatedOrder)
                showResult = true
            } else if updatedOrder.isFailed {
                paymentState = .failed(error: "Payment failed")
                showResult = true
            }
        }
    }
}

// MARK: - Payment Confirmation Helpers

extension PaymentViewModel {

    /// Get payment summary text
    var paymentSummary: String {
        guard let product = selectedProduct else { return "" }

        switch product.type {
        case .points:
            if let points = product.points {
                return "Purchase \(points) Points"
            }
            return "Purchase Points"

        case .subscription:
            return "Subscribe to \(product.name)"
        }
    }

    /// Get total amount text
    var totalAmount: String {
        selectedProduct?.price ?? "¥0.00"
    }

    /// Get payment method display name
    var paymentMethodDisplayName: String {
        paymentMethod.displayName
    }

    /// Get confirmation message
    var confirmationMessage: String {
        guard let product = selectedProduct else { return "" }

        switch product.type {
        case .points:
            return "Confirm purchase of \(product.points ?? 0) points for \(product.price)?"

        case .subscription:
            if let period = product.subscriptionPeriod {
                return "Confirm subscription to \(product.name) (\(period.localizedDescription)) for \(product.price)?"
            }
            return "Confirm subscription to \(product.name) for \(product.price)?"
        }
    }

    /// Get receipt information
    var willReceiveReceipt: Bool {
        selectedProduct?.type == .subscription
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension PaymentViewModel {
    /// Create preview view model
    static var preview: PaymentViewModel {
        let vm = PaymentViewModel()
        vm.selectedProduct = ProductViewModel.mockPointsProduct()
        return vm
    }

    /// Create mock order for preview
    static func mockOrder() -> AppOrder {
        AppOrder(
            id: UUID().uuidString,
            userId: "user123",
            productId: StoreProductConfiguration.points500,
            productType: .points,
            amount: 28.0,
            currency: "CNY",
            status: .completed,
            paymentMethod: .applePay,
            transactionId: "txn_123",
            points: 580,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}
#endif
