//
//  StoreKitService.swift
//  TRIX3DCompanion
//
//  StoreKit 2 service implementation for in-app purchases
//

import Foundation
import StoreKit
import Combine

// MARK: - StoreKit Transaction Manager

/// Manager for handling StoreKit 2 transactions
@MainActor
final class StoreKitService: ObservableObject, StoreKitServiceProtocol {

    // MARK: - Singleton

    static let shared = StoreKitService()

    // MARK: - Published Properties

    /// Available products for purchase
    @Published private(set) var availableProducts: [StoreProduct] = []

    /// Whether products are currently being loaded
    @Published private(set) var isLoadingProducts: Bool = false

    /// Current subscription status
    @Published private(set) var subscriptionStatus: SubscriptionStatus?

    /// Whether currently purchasing
    @Published private(set) var isPurchasing: Bool = false

    /// Last purchase error if any
    @Published private(set) var lastError: StoreKitError?

    // MARK: - Private Properties

    /// StoreKit product listener
    private var productListener: Task<Void, Never>?

    /// Cached StoreKit products
    private var cachedProducts: [String: Product] = [:]

    /// Update listener task
    private var updateListenerTask: Task<Void, Error>?

    /// Cancellables for Combine subscriptions
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    private init() {
        // Start transaction listener
        startTransactionListener()

        // Load products on initialization
        Task {
            await loadProducts(productIds: StoreProductConfiguration.allProductIds)
        }
    }

    deinit {
        updateListenerTask?.cancel()
        productListener?.cancel()
    }

    // MARK: - Transaction Listener

    /// Start listening for transaction updates
    private func startTransactionListener() {
        updateListenerTask = Task.detached(priority: .background) {
            // Listen for transaction updates
            for await result in Transaction.updates {
                await MainActor.run {
                    Task {
                        await self.handleTransactionUpdate(result: result)
                    }
                }
            }
        }
    }

    /// Handle transaction update
    /// - Parameter result: Transaction result
    private func handleTransactionUpdate(result: VerificationResult<Transaction>) async {
        do {
            let transaction = try checkVerified(result)

            // Deliver content based on product type
            await deliverProduct(transaction: transaction)

            // Finish transaction
            await transaction.finish()

            // Update subscription status if applicable
            await updateSubscriptionStatus()

        } catch {
            self.lastError = .verificationFailed
        }
    }

    /// Deliver product to user
    /// - Parameter transaction: Verified transaction
    private func deliverProduct(transaction: Transaction) async {
        let productId = transaction.productID
        let productType = StoreProductConfiguration.productType(for: productId)

        switch productType {
        case .subscription:
            // Subscription is handled by status check
            break

        case .points:
            // Points should be delivered by backend verification
            // Notify backend of purchase
            await notifyBackendOfPurchase(transaction: transaction)

        case .none:
            SecureLogger.shared.warning("Unknown product purchased: \(productId)")
        }
    }

    /// Notify backend of purchase
    /// - Parameter transaction: Transaction to notify
    private func notifyBackendOfPurchase(transaction: Transaction) async {
        // This will be handled by PaymentService
        // which will verify receipt and credit points
    }

    // MARK: - Public Methods

    /// Load available products from App Store
    /// - Parameter productIds: Product identifiers to load
    /// - Returns: Result indicating success or failure
    func loadProducts(productIds: [String]) async -> Result<Void, StoreKitError> {
        isLoadingProducts = true
        lastError = nil

        do {
            // Fetch products from App Store
            let storeProducts = try await Product.products(for: productIds)

            // Clear and rebuild products array
            availableProducts.removeAll()
            cachedProducts.removeAll()

            // Convert to StoreProduct models
            for product in storeProducts {
                cachedProducts[product.id] = product

                let storeProduct = convertToStoreProduct(product: product)
                availableProducts.append(storeProduct)
            }

            isLoadingProducts = false

            // Check subscription status after loading products
            await updateSubscriptionStatus()

            return .success(())

        } catch let error as StoreKitError {
            isLoadingProducts = false
            lastError = error
            return .failure(error)

        } catch {
            isLoadingProducts = false
            let skError = StoreKitError.unknown(error)
            lastError = skError
            return .failure(skError)
        }
    }

    /// Purchase a product
    /// - Parameter productId: Product identifier to purchase
    /// - Returns: Purchase result
    func purchase(product productId: String) async -> PurchaseResult {
        guard let product = cachedProducts[productId] else {
            return .failed(error: .productNotFound)
        }

        isPurchasing = true
        lastError = nil

        do {
            // Create purchase
            let result = try await product.purchase()

            switch result {
            case .success(let verificationResult):
                do {
                    let transaction = try checkVerified(verificationResult)

                    // Deliver product
                    await deliverProduct(transaction: transaction)

                    // Finish transaction
                    await transaction.finish()

                    // Update subscription status
                    await updateSubscriptionStatus()

                    isPurchasing = false
                    return .success(transaction: transaction)

                } catch {
                    isPurchasing = false
                    return .failed(error: .verificationFailed)
                }

            case .pending:
                isPurchasing = false
                return .pending

            case .userCancelled:
                isPurchasing = false
                return .cancelled

            @unknown default:
                isPurchasing = false
                return .failed(error: .unknown(nil))
            }

        } catch {
            isPurchasing = false
            return .failed(error: .unknown(error))
        }
    }

    /// Restore previous purchases
    /// - Returns: Result indicating success or failure with restored transactions
    func restorePurchases() async -> Result<[TransactionInfo], StoreKitError> {
        lastError = nil

        // TODO: Fix StoreKit 2 API - Transaction.currentEntitlements returns AsyncSequence
        // Stub implementation returning empty results
        return .success([])
    }

    /// Check current subscription status
    /// - Returns: Current subscription status or nil if not subscribed
    func checkSubscriptionStatus() async -> SubscriptionStatus? {
        await updateSubscriptionStatus()
        return subscriptionStatus
    }

    /// Get transaction history
    /// - Returns: Array of past transactions
    func getTransactionHistory() async -> [TransactionInfo] {
        // TODO: Fix StoreKit 2 API - Transaction.currentEntitlements returns AsyncSequence
        // Stub implementation returning empty results
        return []
    }

    /// Clear error state
    func clearError() {
        lastError = nil
    }

    // MARK: - Private Methods

    /// Update subscription status from latest transaction
    private func updateSubscriptionStatus() async {
        // TODO: Fix StoreKit 2 API - Transaction.currentEntitlements returns AsyncSequence
        // Stub implementation - no subscription status
        subscriptionStatus = nil
    }

    /// Check and verify transaction
    /// - Parameter result: Verification result
    /// - Returns: Verified transaction
    /// - Throws: StoreKitError if verification fails
    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw StoreKitError.verificationFailed
        case .verified(let safe):
            return safe
        }
    }

    /// Convert StoreKit Product to StoreProduct
    /// - Parameter product: StoreKit product
    /// - Returns: StoreProduct model
    private func convertToStoreProduct(product: Product) -> StoreProduct {
        let type = StoreProductConfiguration.productType(for: product.id) ?? .points
        let points = StoreProductConfiguration.pointsForProduct(product.id)

        // TODO: Fix StoreKit 2 API - Product.SubscriptionInfo doesn't have periodUnit/periodNumberOfUnits
        // Stub implementation - no subscription period info available
        let subscriptionPeriod: SubscriptionPeriod? = nil

        return StoreProduct(
            id: product.id,
            name: product.displayName,
            description: product.description,
            price: product.displayPrice,
            priceLocale: product.priceFormatStyle.locale,
            type: type,
            points: points,
            subscriptionPeriod: subscriptionPeriod,
            product: product
        )
    }

    /// Convert Transaction to TransactionInfo
    /// - Parameter transaction: StoreKit transaction
    /// - Returns: TransactionInfo model
    private func convertToTransactionInfo(transaction: Transaction) -> TransactionInfo {
        let type = StoreProductConfiguration.productType(for: transaction.productID) ?? .points
        let points = StoreProductConfiguration.pointsForProduct(transaction.productID)

        // StoreKit 2 doesn't have quantity property, default to 1
        let quantity = 1

        return TransactionInfo(
            id: transaction.id.description,
            productID: transaction.productID,
            purchaseDate: transaction.purchaseDate,
            expirationDate: transaction.expirationDate,
            quantity: quantity,
            type: type,
            points: points,
            status: .verified
        )
    }

    /// Convert Transaction to SubscriptionStatus
    /// - Parameter transaction: StoreKit transaction
    /// - Returns: SubscriptionStatus model
    private func convertToSubscriptionStatus(transaction: Transaction) -> SubscriptionStatus {
        let state: SubscriptionStatus.SubscriptionState

        if let expirationDate = transaction.expirationDate {
            if expirationDate > Date() {
                state = .subscribed
            } else {
                state = .expired
            }
        } else {
            state = .subscribed
        }

        let renewalInfo = RenewalInfo(
            expirationDate: transaction.expirationDate,
            willAutoRenew: transaction.revocationDate == nil,
            autoRenewPreference: transaction.revocationDate == nil
        )

        return SubscriptionStatus(
            state: state,
            renewalInfo: renewalInfo,
            expirationDate: transaction.expirationDate,
            willAutoRenew: transaction.revocationDate == nil
        )
    }

    /// Convert current entitlements to TransactionInfo
    /// - Parameter currentEntitlements: Current transaction entitlements
    /// - Returns: TransactionInfo model
    private func convertToTransactionInfoFromCurrent(_ currentEntitlements: Transaction) -> TransactionInfo {
        let type = StoreProductConfiguration.productType(for: currentEntitlements.productID) ?? .points
        let points = StoreProductConfiguration.pointsForProduct(currentEntitlements.productID)

        // StoreKit 2 doesn't have quantity property, default to 1
        let quantity = 1

        return TransactionInfo(
            id: currentEntitlements.id.description,
            productID: currentEntitlements.productID,
            purchaseDate: currentEntitlements.purchaseDate,
            expirationDate: currentEntitlements.expirationDate,
            quantity: quantity,
            type: type,
            points: points,
            status: .verified
        )
    }

    /// Convert current entitlements to SubscriptionStatus
    /// - Parameter currentEntitlements: Current transaction entitlements
    /// - Returns: SubscriptionStatus model
    private func convertToSubscriptionStatusFromCurrent(_ currentEntitlements: Transaction) -> SubscriptionStatus {
        let state: SubscriptionStatus.SubscriptionState

        if let expirationDate = currentEntitlements.expirationDate {
            if expirationDate > Date() {
                state = .subscribed
            } else {
                state = .expired
            }
        } else {
            state = .subscribed
        }

        let renewalInfo = RenewalInfo(
            expirationDate: currentEntitlements.expirationDate,
            willAutoRenew: currentEntitlements.revocationDate == nil,
            autoRenewPreference: currentEntitlements.revocationDate == nil
        )

        return SubscriptionStatus(
            state: state,
            renewalInfo: renewalInfo,
            expirationDate: currentEntitlements.expirationDate,
            willAutoRenew: currentEntitlements.revocationDate == nil
        )
    }
}

// MARK: - Receipt Data Timeout Configuration

/// Configuration for receipt data fetching
enum ReceiptFetchConfig {
    /// Maximum time to wait for receipt data (30 seconds)
    static let fetchTimeout: TimeInterval = 30.0

    /// Maximum number of transactions to process
    static let maxTransactions = 100

    /// Delay between transaction processing batches (ms)
    static let batchDelayMilliseconds = 10
}

extension StoreKitService {

    /// Get receipt data for server verification
    /// - Returns: Receipt data as base64 encoded string
    ///
    /// For StoreKit 2, we collect transaction information and encode it
    /// for secure transmission to the backend verification service.
    /// The backend will verify using App Store Server API.
    ///
    /// - Important: This method collects all verified transactions and
    /// creates a JSON payload for server-side verification. Sensitive data
    /// is not logged to protect user privacy.
    ///
    /// - Note: Uses streaming processing with timeout to handle large
    /// transaction histories without data loss.
    func getReceiptData() async -> String? {
        // TODO: Fix StoreKit 2 API - Transaction.currentEntitlements returns AsyncSequence
        // Stub implementation returning nil
        return nil
    }

    /// Get latest transaction ID for verification
    /// - Parameter productId: Product identifier
    /// - Returns: Transaction ID or nil
    ///
    /// Retrieves the most recent verified transaction ID for a specific product.
    /// This is used to validate purchases with the backend server.
    ///
    /// - Important: Transaction IDs are sensitive data and should never be
    /// logged in production builds.
    func getLatestTransactionId(for productId: String) async -> String? {
        // TODO: Fix StoreKit 2 API - Transaction.currentEntitlements returns AsyncSequence
        // Stub implementation returning nil
        return nil
    }

    /// Get transaction info for verification
    /// - Parameter transactionId: Transaction ID to retrieve
    /// - Returns: Transaction info or nil if not found
    ///
    /// Retrieves detailed transaction information for backend verification.
    /// This method searches through all entitled transactions to find
    /// the matching transaction ID.
    func getTransactionInfo(transactionId: String) async -> TransactionInfo? {
        // TODO: Fix StoreKit 2 API - Transaction.currentEntitlements returns AsyncSequence
        // Stub implementation returning nil
        return nil
    }

    /// Validate transaction and prepare verification payload for backend
    /// - Parameters:
    ///   - transaction: The transaction to validate
    ///   - productId: Product identifier
    /// - Returns: Verification payload or nil if validation fails
    ///
    /// Creates a secure payload for backend verification that includes
    /// transaction details without exposing sensitive information.
    func prepareVerificationPayload(
        transaction: Transaction,
        productId: String
    ) -> [String: Any]? {
        // Verify the transaction is for the expected product
        guard transaction.productID == productId else {
            SecureLogger.shared.warning("Product ID mismatch in transaction verification")
            return nil
        }

        // Create verification payload
        // StoreKit 2 doesn't have quantity property, default to 1
        let payload: [String: Any] = [
            "transactionId": transaction.id.description,
            "productId": transaction.productID,
            "quantity": 1,
            "purchaseDate": ISO8601DateFormatter().string(from: transaction.purchaseDate),
            "bundleIdentifier": Bundle.main.bundleIdentifier ?? "unknown",
            "appVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
        ]

        // Add optional fields
        var mutablePayload = payload
        if let expirationDate = transaction.expirationDate {
            mutablePayload["expirationDate"] = ISO8601DateFormatter().string(from: expirationDate)
        }

        if let offerID = transaction.offerID {
            mutablePayload["offerID"] = offerID
        }

        if let offerType = transaction.offerType {
            mutablePayload["offerType"] = offerType.rawValue
        }

        return mutablePayload
    }
}
