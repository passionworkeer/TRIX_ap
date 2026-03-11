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
    @Published private(set) var pendingAppOrders: [AppOrder] = []

    /// Completed orders
    @Published private(set) var completedAppOrders: [AppOrder] = []

    /// Whether currently processing payment
    @Published private(set) var isProcessing: Bool = false

    /// Last payment error if any
    @Published private(set) var lastError: PaymentError?

    // MARK: - Dependencies

    private let storeKitService: any StoreKitServiceProtocol
    private let pointsService: any PointsServiceProtocol
    private let apiClient: APIClient

    // MARK: - Private Properties

    /// Cached orders
    private var cachedAppOrders: [String: AppOrder] = [:]

    /// Cancellables for Combine subscriptions
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    /// Initialize with dependencies
    /// - Parameters:
    ///   - storeKitService: StoreKit service instance
    ///   - pointsService: Points service instance
    ///   - apiClient: API client instance
    init(
        storeKitService: (any StoreKitServiceProtocol)? = nil,
        pointsService: (any PointsServiceProtocol)? = nil,
        apiClient: APIClient? = nil
    ) {
        self.storeKitService = storeKitService ?? StoreKitService.shared
        self.pointsService = pointsService ?? PointsService.shared
        self.apiClient = apiClient ?? .shared

        // Load order history
        Task {
            await loadAppOrderHistory()
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
            let order = createPendingAppOrder(productId: productId, points: points)
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
            let order = createPendingSubscriptionAppOrder(productId: productId)
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
    ) async -> Result<AppOrder, PaymentError> {
        lastError = nil

        do {
            // Determine product type and points
            guard let productType = StoreProductConfiguration.productType(for: productId) else {
                return .failure(.invalidProduct)
            }

            let price = getPriceForProduct(productId)

            // Call backend API to verify receipt
            let verificationRequest = ReceiptVerificationRequest(
                transactionId: transactionId,
                productId: productId,
                receiptData: receiptData,
                bundleIdentifier: Bundle.main.bundleIdentifier ?? "unknown",
                appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown",
                purchaseDate: ISO8601DateFormatter().string(from: Date()),
                expirationDate: nil
            )

            let response: ReceiptVerificationResponse = try await apiClient.verifyReceipt(verificationRequest)

            // Create order from response
            let order = AppOrder(
                id: response.orderId,
                userId: AuthService.shared.currentUser?.id ?? "",
                productId: productId,
                productType: productType,
                amount: price,
                currency: "CNY",
                status: response.status.toAppPaymentStatus(),
                paymentMethod: .applePay,
                transactionId: transactionId,
                points: response.pointsAdded,
                createdAt: Date(),
                updatedAt: Date()
            )

            // Cache and update orders
            cachedAppOrders[order.id] = order
            updateAppOrdersArrays()

            // Refresh points
            _ = await pointsService.refreshPoints()

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
    /// - Parameter orderId: AppOrder ID
    /// - Returns: AppOrder or nil if not found
    func getAppOrder(orderId: String) async -> AppOrder? {
        // Check cache first
        if let cached = cachedAppOrders[orderId] {
            return cached
        }

        // Fetch from server
        do {
            let response: OrderDetailsResponse = try await apiClient.getOrder(orderId: orderId)

            // Use the toAppOrder() conversion method
            let order = response.toAppOrder()

            cachedAppOrders[orderId] = order
            return order
        } catch {
            SecureLogger.shared.error("Failed to fetch order: \(orderId)")
            return nil
        }
    }

    /// Get order history
    /// - Parameters:
    ///   - limit: Number of orders to retrieve
    ///   - offset: Pagination offset
    /// - Returns: Array of orders
    func getAppOrderHistory(limit: Int = 50, offset: Int = 0) async -> [AppOrder] {
        // Return cached orders sorted by date
        return Array(cachedAppOrders.values)
            .sorted { $0.createdAt > $1.createdAt }
            .prefix(limit)
            .map { $0 }
    }

    /// Cancel pending order
    /// - Parameter orderId: AppOrder ID to cancel
    /// - Returns: Result indicating success or failure
    func cancelAppOrder(orderId: String) async -> Result<Void, PaymentError> {
        lastError = nil

        guard let order = cachedAppOrders[orderId], order.isPending else {
            return .failure(.orderNotFound)
        }

        do {
            try await apiClient.cancelOrder(orderId: orderId)

            // Remove from cache and update arrays
            cachedAppOrders.removeValue(forKey: orderId)
            updateAppOrdersArrays()

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

    /// Get current subscription status
    /// - Returns: Subscription status information
    func getSubscription() async -> PaymentSubscriptionStatus {
        do {
            let response: SubscriptionStatusResponse = try await apiClient.getSubscription()

            return PaymentSubscriptionStatus(
                isActive: response.isActive,
                tier: response.tier,
                productId: response.productId,
                expiresAt: response.expiresAt,
                willAutoRenew: response.willAutoRenew,
                startedAt: response.startedAt,
                updatedAt: response.updatedAt
            )
        } catch {
            SecureLogger.shared.error("Failed to get subscription status: \(error)")
            // Return inactive status on error
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
    }

    /// Restore previous purchases
    /// - Returns: Result with restored orders or error
    func restorePurchases() async -> Result<[AppOrder], PaymentError> {
        lastError = nil

        do {
            let response: RestorePurchasesResponse = try await apiClient.restorePurchases()

            // Process restored orders
            var restoredAppOrders: [AppOrder] = []
            for orderResponse in response.restoredOrders {
                let order = AppOrder(
                    id: orderResponse.id,
                    userId: orderResponse.userId,
                    productId: orderResponse.productId,
                    productType: StoreProductConfiguration.productType(for: orderResponse.productId) ?? .points,
                    amount: orderResponse.amount,
                    currency: orderResponse.currency,
                    status: orderResponse.status.toAppPaymentStatus(),
                    paymentMethod: .applePay,
                    transactionId: orderResponse.transactionId,
                    points: orderResponse.points,
                    createdAt: orderResponse.createdAt,
                    updatedAt: orderResponse.updatedAt
                )
                cachedAppOrders[order.id] = order
                restoredAppOrders.append(order)
            }

            updateAppOrdersArrays()

            // Refresh points after restore
            _ = await pointsService.refreshPoints()

            return .success(restoredAppOrders)

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

    // MARK: - Private Methods

    /// Load order history from server
    private func loadAppOrderHistory() async {
        do {
            let response: OrdersListResponse = try await apiClient.getOrders(page: 1, limit: 50)

            for orderResponse in response.orders {
                // Use the toAppOrder() conversion method
                let order = orderResponse.toAppOrder()
                cachedAppOrders[order.id] = order
            }
            updateAppOrdersArrays()
        } catch {
            // Silently fail - orders will be loaded when needed
            SecureLogger.shared.warning("Failed to load order history from server")
        }
    }

    /// Update published order arrays
    private func updateAppOrdersArrays() {
        let allAppOrders = Array(cachedAppOrders.values)
            .sorted { $0.createdAt > $1.createdAt }

        pendingAppOrders = allAppOrders.filter { $0.isPending }
        completedAppOrders = allAppOrders.filter { $0.isCompleted }
    }

    /// Create pending order for points purchase
    /// - Parameters:
    ///   - productId: Product ID
    ///   - points: Points amount
    /// - Returns: Pending order
    private func createPendingAppOrder(productId: String, points: Int) -> AppOrder {
        let orderId = UUID().uuidString
        let price = getPriceForProduct(productId)

        let order = AppOrder(
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

        cachedAppOrders[orderId] = order
        updateAppOrdersArrays()

        return order
    }

    /// Create pending order for subscription
    /// - Parameter productId: Product ID
    /// - Returns: Pending order
    private func createPendingSubscriptionAppOrder(productId: String) -> AppOrder {
        let orderId = UUID().uuidString
        let price = getPriceForProduct(productId)

        let order = AppOrder(
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

        cachedAppOrders[orderId] = order
        updateAppOrdersArrays()

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
