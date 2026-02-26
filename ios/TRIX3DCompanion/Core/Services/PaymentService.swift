//
//  PaymentService.swift
//  TRIX3DCompanion
//
//  Payment service implementation for unified payment management
//

import Foundation
import Combine

// MARK: - Payment Service

/// Main payment service handling all payment operations
@MainActor
final class PaymentService: ObservableObject, PaymentServiceProtocol {

    // MARK: - Singleton

    static let shared = PaymentService()

    // MARK: - Published Properties

    /// Current pending orders
    @Published private(set) var pendingOrders: [Order] = []

    /// Completed orders
    @Published private(set) var completedOrders: [Order] = []

    /// Whether currently processing payment
    @Published private(set) var isProcessing: Bool = false

    /// Last payment error if any
    @Published private(set) var lastError: PaymentError?

    // MARK: - Dependencies

    private let storeKitService: StoreKitServiceProtocol
    private let pointsService: PointsServiceProtocol
    private let apiClient: APIClient

    // MARK: - Private Properties

    /// Cached orders
    private var cachedOrders: [String: Order] = [:]

    /// Cancellables for Combine subscriptions
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    /// Initialize with dependencies
    /// - Parameters:
    ///   - storeKitService: StoreKit service instance
    ///   - pointsService: Points service instance
    ///   - apiClient: API client instance
    init(
        storeKitService: StoreKitServiceProtocol = StoreKitService.shared,
        pointsService: PointsServiceProtocol = PointsService.shared,
        apiClient: APIClient = .shared
    ) {
        self.storeKitService = storeKitService
        self.pointsService = pointsService
        self.apiClient = apiClient

        // Load order history
        Task {
            await loadOrderHistory()
        }

        // Setup observation of store kit errors
        setupBindings()
    }

    // MARK: - Setup

    /// Setup Combine bindings
    private func setupBindings() {
        // Observe store kit errors
        (storeKitService as? StoreKitService)?.$lastError
            .compactMap { $0 }
            .sink { [weak self] error in
                self?.handleStoreKitError(error)
            }
            .store(in: &cancellables)
    }

    /// Handle StoreKit errors
    /// - Parameter error: StoreKit error
    private func handleStoreKitError(_ error: StoreKitError) {
        // Map StoreKit error to PaymentError
        let paymentError: PaymentError
        switch error {
        case .userCancelled:
            paymentError = .userCancelled
        case .productNotFound:
            paymentError = .invalidProduct
        case .verificationFailed:
            paymentError = .verificationFailed
        default:
            paymentError = .paymentFailed(underlying: error)
        }
        lastError = paymentError
    }

    // MARK: - Public Methods

    /// Purchase points using in-app purchase
    /// - Parameters:
    ///   - productId: Product identifier
    ///   - points: Points amount
    /// - Returns: Payment result
    func purchasePoints(productId: String, points: Int) async -> PaymentResult {
        isProcessing = true
        lastError = nil

        // Purchase through StoreKit
        let purchaseResult = await storeKitService.purchase(product: productId)

        switch purchaseResult {
        case .success(let transaction):
            // Verify with backend
            let verificationResult = await verifyReceipt(
                transactionId: transaction.id.description,
                productId: productId,
                receiptData: nil
            )

            switch verificationResult {
            case .success(let order):
                isProcessing = false
                return .success(order: order)

            case .failure(let error):
                isProcessing = false
                return .failed(error: error)
            }

        case .pending:
            isProcessing = false
            // Create pending order
            let order = createPendingOrder(productId: productId, points: points)
            return .pending(order: order)

        case .failed(let error):
            isProcessing = false
            return .failed(error: .paymentFailed(underlying: error))

        case .cancelled:
            isProcessing = false
            return .cancelled
        }
    }

    /// Subscribe to membership
    /// - Parameter productId: Subscription product identifier
    /// - Returns: Payment result
    func subscribe(productId: String) async -> PaymentResult {
        isProcessing = true
        lastError = nil

        // Purchase through StoreKit
        let purchaseResult = await storeKitService.purchase(product: productId)

        switch purchaseResult {
        case .success(let transaction):
            // Verify with backend
            let verificationResult = await verifyReceipt(
                transactionId: transaction.id.description,
                productId: productId,
                receiptData: nil
            )

            switch verificationResult {
            case .success(let order):
                isProcessing = false
                return .success(order: order)

            case .failure(let error):
                isProcessing = false
                return .failed(error: error)
            }

        case .pending:
            isProcessing = false
            // Create pending order for subscription
            let order = createPendingSubscriptionOrder(productId: productId)
            return .pending(order: order)

        case .failed(let error):
            isProcessing = false
            return .failed(error: .paymentFailed(underlying: error))

        case .cancelled:
            isProcessing = false
            return .cancelled
        }
    }

    /// Verify receipt with backend
    /// - Parameters:
    ///   - transactionId: Transaction ID
    ///   - productId: Product ID
    ///   - receiptData: Receipt data if available
    /// - Returns: Result with order information
    func verifyReceipt(
        transactionId: String,
        productId: String,
        receiptData: String?
    ) async -> Result<Order, PaymentError> {
        lastError = nil

        do {
            // Determine product type and points
            guard let productType = StoreProductConfiguration.productType(for: productId) else {
                return .failure(.invalidProduct)
            }

            let points = StoreProductConfiguration.pointsForProduct(productId)
            let price = getPriceForProduct(productId)

            // Create verification request
            let request = PointsPurchaseRequest(
                productId: productId,
                points: points ?? 0,
                amount: price,
                currency: "CNY",
                transactionId: transactionId,
                receiptData: receiptData
            )

            // Call backend API
            let response: PointsPurchaseResponse = try await apiClient.post(
                .paymentVerify,
                body: request
            )

            // Create order from response
            let order = Order(
                id: response.orderId,
                userId: AuthService.shared.currentUser?.id ?? "",
                productId: productId,
                productType: productType,
                amount: price,
                currency: "CNY",
                status: .completed,
                paymentMethod: .applePay,
                transactionId: transactionId,
                points: points,
                createdAt: Date(),
                updatedAt: Date()
            )

            // Cache and update orders
            cachedOrders[order.id] = order
            updateOrdersArrays()

            // Refresh points
            await pointsService.refreshPoints()

            return .success(order)

        } catch let error as NetworkError {
            let paymentError = mapNetworkError(error)
            lastError = paymentError
            return .failure(paymentError)

        } catch {
            let paymentError = PaymentError.unknown(error)
            lastError = paymentError
            return .failure(paymentError)
        }
    }

    /// Get order details
    /// - Parameter orderId: Order ID
    /// - Returns: Order or nil if not found
    func getOrder(orderId: String) async -> Order? {
        // Check cache first
        if let cached = cachedOrders[orderId] {
            return cached
        }

        // Fetch from server
        do {
            let order: Order = try await apiClient.get(.paymentOrder(orderId: orderId))
            cachedOrders[orderId] = order
            return order
        } catch {
            return nil
        }
    }

    /// Get order history
    /// - Parameters:
    ///   - limit: Number of orders to retrieve
    ///   - offset: Pagination offset
    /// - Returns: Array of orders
    func getOrderHistory(limit: Int = 50, offset: Int = 0) async -> [Order] {
        // Return cached orders sorted by date
        return Array(cachedOrders.values)
            .sorted { $0.createdAt > $1.createdAt }
            .prefix(limit)
            .map { $0 }
    }

    /// Cancel pending order
    /// - Parameter orderId: Order ID to cancel
    /// - Returns: Result indicating success or failure
    func cancelOrder(orderId: String) async -> Result<Void, PaymentError> {
        lastError = nil

        guard let order = cachedOrders[orderId], order.isPending else {
            return .failure(.orderNotFound)
        }

        do {
            let _: EmptyResponse = try await apiClient.post(.paymentCancel(orderId: orderId))

            // Update local order
            var updatedOrder = order
            // Create cancelled version (would need mutable order)
            cachedOrders.removeValue(forKey: orderId)
            updateOrdersArrays()

            return .success(())

        } catch let error as NetworkError {
            let paymentError = mapNetworkError(error)
            lastError = paymentError
            return .failure(paymentError)

        } catch {
            let paymentError = PaymentError.unknown(error)
            lastError = paymentError
            return .failure(paymentError)
        }
    }

    /// Clear error state
    func clearError() {
        lastError = nil
    }

    // MARK: - Private Methods

    /// Load order history from server
    private func loadOrderHistory() async {
        do {
            let response: PaginatedResponse<Order> = try await apiClient.get(.paymentOrders)
            for order in response.data {
                cachedOrders[order.id] = order
            }
            updateOrdersArrays()
        } catch {
            // Silently fail - orders will be loaded when needed
        }
    }

    /// Update published order arrays
    private func updateOrdersArrays() {
        let allOrders = Array(cachedOrders.values)
            .sorted { $0.createdAt > $1.createdAt }

        pendingOrders = allOrders.filter { $0.isPending }
        completedOrders = allOrders.filter { $0.isCompleted }
    }

    /// Create pending order for points purchase
    /// - Parameters:
    ///   - productId: Product ID
    ///   - points: Points amount
    /// - Returns: Pending order
    private func createPendingOrder(productId: String, points: Int) -> Order {
        let orderId = UUID().uuidString
        let price = getPriceForProduct(productId)

        let order = Order(
            id: orderId,
            userId: AuthService.shared.currentUser?.id ?? "",
            productId: productId,
            productType: .points,
            amount: price,
            currency: "CNY",
            status: .pending,
            paymentMethod: .applePay,
            transactionId: nil,
            points: points,
            createdAt: Date(),
            updatedAt: Date()
        )

        cachedOrders[orderId] = order
        updateOrdersArrays()

        return order
    }

    /// Create pending order for subscription
    /// - Parameter productId: Product ID
    /// - Returns: Pending order
    private func createPendingSubscriptionOrder(productId: String) -> Order {
        let orderId = UUID().uuidString
        let price = getPriceForProduct(productId)

        let order = Order(
            id: orderId,
            userId: AuthService.shared.currentUser?.id ?? "",
            productId: productId,
            productType: .subscription,
            amount: price,
            currency: "CNY",
            status: .pending,
            paymentMethod: .applePay,
            transactionId: nil,
            points: nil,
            createdAt: Date(),
            updatedAt: Date()
        )

        cachedOrders[orderId] = order
        updateOrdersArrays()

        return order
    }

    /// Get price for product
    /// - Parameter productId: Product ID
    /// - Returns: Price in CNY
    private func getPriceForProduct(_ productId: String) -> Double {
        switch productId {
        case StoreProductConfiguration.points100:
            return 6.0
        case StoreProductConfiguration.points300:
            return 18.0
        case StoreProductConfiguration.points500:
            return 28.0
        case StoreProductConfiguration.points1000:
            return 50.0
        case StoreProductConfiguration.monthlySubscription:
            return 12.0
        case StoreProductConfiguration.yearlySubscription:
            return 98.0
        default:
            return 0.0
        }
    }

    /// Map network errors to payment errors
    /// - Parameter error: Network error
    /// - Returns: Payment error
    private func mapNetworkError(_ error: NetworkError) -> PaymentError {
        switch error {
        case .noConnection, .timeout:
            return .networkError
        case .unauthorized:
            return .verificationFailed
        case .custom(let message):
            return .serverError(message: message)
        default:
            return .unknown(error)
        }
    }
}

// MARK: - API Endpoints Extension

extension APIEndpoint {
    /// Payment verification endpoint
    static var paymentVerify: APIEndpoint {
        .custom(path: "/payment/verify", method: .post)
    }

    /// Get order details
    static func paymentOrder(orderId: String) -> APIEndpoint {
        .custom(path: "/payment/orders/\(orderId)", method: .get)
    }

    /// Get orders list
    static var paymentOrders: APIEndpoint {
        .custom(path: "/payment/orders", method: .get)
    }

    /// Cancel order
    static func paymentCancel(orderId: String) -> APIEndpoint {
        .custom(path: "/payment/orders/\(orderId)/cancel", method: .post)
    }

    /// Custom endpoint
    static func custom(path: String, method: HTTPMethod) -> APIEndpoint {
        let endpoint = APIEndpoint.authMe // placeholder
        return endpoint
    }
}
