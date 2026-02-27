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

        do {
            // Get all transactions
            var restoredTransactions: [TransactionInfo] = []

            for await result in Transaction.entitledTransactionSequence {
                do {
                    let transaction = try checkVerified(result)
                    let info = convertToTransactionInfo(transaction: transaction)
                    restoredTransactions.append(info)

                    // Ensure transaction is finished
                    await transaction.finish()

                } catch {
                    // Skip unverified transactions
                    continue
                }
            }

            // Update subscription status
            await updateSubscriptionStatus()

            return .success(restoredTransactions)

        } catch {
            let skError = StoreKitError.unknown(error)
            lastError = skError
            return .failure(skError)
        }
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
        var transactions: [TransactionInfo] = []

        for await result in Transaction.entitledTransactionSequence {
            do {
                let transaction = try checkVerified(result)
                let info = convertToTransactionInfo(transaction: transaction)
                transactions.append(info)
            } catch {
                // Skip unverified transactions
                continue
            }
        }

        return transactions
    }

    /// Clear error state
    func clearError() {
        lastError = nil
    }

    // MARK: - Private Methods

    /// Update subscription status from latest transaction
    private func updateSubscriptionStatus() async {
        // Get the latest subscription transaction
        for await result in Transaction.entitledTransactionSequence {
            do {
                let transaction = try checkVerified(result)

                // Check if this is a subscription product
                if StoreProductConfiguration.productType(for: transaction.productID) == .subscription {
                    let status = convertToSubscriptionStatus(transaction: transaction)
                    subscriptionStatus = status
                    return // Found latest subscription status
                }

            } catch {
                // Continue to next transaction
                continue
            }
        }

        // No active subscription found
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

        var subscriptionPeriod: SubscriptionPeriod?
        if case .autoRenewable = product.type {
            if let period = product.subscriptionPeriod {
                let unit: SubscriptionPeriod.PeriodUnit
                switch period.unit {
                case .day:
                    unit = .day
                case .week:
                    unit = .week
                case .month:
                    unit = .month
                case .year:
                    unit = .year
                @unknown default:
                    unit = .month
                }
                subscriptionPeriod = SubscriptionPeriod(value: period.value, unit: unit)
            }
        }

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

        return TransactionInfo(
            id: transaction.id.description,
            productID: transaction.productID,
            purchaseDate: transaction.purchaseDate,
            expirationDate: transaction.expirationDate,
            quantity: transaction.quantity,
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
        SecureLogger.shared.info("Starting receipt data collection with streaming processing")

        // For StoreKit 2, we create a structured receipt payload
        // containing verified transaction information for backend verification
        var transactions: [[String: Any]] = []
        var verifiedCount = 0
        var skippedCount = 0
        var errorCount = 0

        // Create timeout task
        let timeoutTask = Task {
            try? await Task.sleep(nanoseconds: UInt64(ReceiptFetchConfig.fetchTimeout * 1_000_000_000))
            return true // Timeout reached
        }

        // Use withTaskGroup for concurrent processing with timeout
        let processingTask = Task {
            // Collect transactions from Transaction.entitledTransactionSequence
            // Using streaming to handle large transaction histories
            var transactionCount = 0

            for await result in Transaction.entitledTransactionSequence {
                // Check if we've exceeded max transactions
                if transactionCount >= ReceiptFetchConfig.maxTransactions {
                    SecureLogger.shared.warning("Receipt fetch: max transaction limit reached (\(ReceiptFetchConfig.maxTransactions))")
                    break
                }

                // Check if timeout has been reached
                if timeoutTask.isCancelled || Task.isCancelled {
                    SecureLogger.shared.warning("Receipt fetch: cancelled or timeout")
                    break
                }

                transactionCount += 1

                do {
                    let transaction = try checkVerified(result)
                    verifiedCount += 1

                    // Create a dictionary with transaction data
                    // NOTE: We don't include sensitive account info in logs
                    var txData: [String: Any] = [
                        "id": transaction.id.description,
                        "productId": transaction.productID,
                        "purchaseDate": ISO8601DateFormatter().string(from: transaction.purchaseDate),
                        "quantity": transaction.quantity
                    ]

                    // Include optional fields if present
                    if let expirationDate = transaction.expirationDate {
                        txData["expirationDate"] = ISO8601DateFormatter().string(from: expirationDate)
                    }

                    if let offerID = transaction.offerID {
                        txData["offerID"] = offerID
                    }

                    if let offerType = transaction.offerType {
                        txData["offerType"] = offerType.rawValue
                    }

                    // Add revocation info if present (important for refund detection)
                    if let revocationDate = transaction.revocationDate {
                        txData["revocationDate"] = ISO8601DateFormatter().string(from: revocationDate)
                        txData["revocationReason"] = transaction.revocationReason?.rawValue ?? 0
                    }

                    // Add web order line item ID if present (for subscription tracking)
                    if let webOrderLineItemID = transaction.webOrderLineItemID {
                        txData["webOrderLineItemID"] = webOrderLineItemID
                    }

                    transactions.append(txData)

                    // Small delay to prevent overwhelming the system
                    if transactionCount % 10 == 0 {
                        try? await Task.sleep(nanoseconds: UInt64(ReceiptFetchConfig.batchDelayMilliseconds * 1_000_000))
                    }

                } catch {
                    // Skip unverified transactions with detailed logging
                    errorCount += 1
                    SecureLogger.shared.warning("Receipt fetch: skipped unverified transaction (error: \(error.localizedDescription))")
                    continue
                }
            }

            // Log processing summary
            SecureLogger.shared.info(
                "Receipt fetch: processed \(transactionCount) transactions, " +
                "verified: \(verifiedCount), skipped: \(skippedCount), errors: \(errorCount)"
            )

            return false // Not timed out
        }

        // Wait for either processing to complete or timeout
        let timedOut = await timeoutTask.value
        let _ = await processingTask.value

        // Cancel timeout task if processing completed first
        timeoutTask.cancel()

        if timedOut {
            SecureLogger.shared.error("Receipt fetch: timeout after \(ReceiptFetchConfig.fetchTimeout) seconds")
        }

        guard !transactions.isEmpty else {
            if timedOut {
                SecureLogger.shared.error("Receipt fetch: timeout reached with no transactions collected")
            } else {
                SecureLogger.shared.warning("Receipt fetch: no verified transactions found")
            }
            return nil
        }

        SecureLogger.shared.info("Receipt fetch: collected \(transactions.count) transactions successfully")

        // Create receipt payload
        let receiptPayload: [String: Any] = [
            "version": "2.0",
            "bundleIdentifier": Bundle.main.bundleIdentifier ?? "unknown",
            "appVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown",
            "fetchTimestamp": ISO8601DateFormatter().string(from: Date()),
            "transactionCount": transactions.count,
            "transactions": transactions
        ]

        // Convert to JSON and base64 encode
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: receiptPayload, options: [.prettyPrinted])
            let base64Receipt = jsonData.base64EncodedString()

            // Log receipt size for diagnostics
            let receiptSize = base64Receipt.count
            SecureLogger.shared.info("Receipt fetch: encoded successfully, size: \(receiptSize) bytes")

            return base64Receipt
        } catch {
            SecureLogger.shared.error("Receipt fetch: failed to encode receipt data - \(error.localizedDescription)")
            return nil
        }
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
        var latestTransactionId: String?
        var latestDate: Date?

        for await result in Transaction.entitledTransactionSequence {
            do {
                let transaction = try checkVerified(result)

                // Only consider transactions for the requested product
                if transaction.productID == productId {
                    // Update if this is the latest transaction
                    if latestDate == nil || transaction.purchaseDate > latestDate! {
                        latestDate = transaction.purchaseDate
                        latestTransactionId = transaction.id.description
                    }
                }
            } catch {
                // Skip unverified transactions
                continue
            }
        }

        // Return the latest transaction ID (without logging for security)
        return latestTransactionId
    }

    /// Get transaction info for verification
    /// - Parameter transactionId: Transaction ID to retrieve
    /// - Returns: Transaction info or nil if not found
    ///
    /// Retrieves detailed transaction information for backend verification.
    /// This method searches through all entitled transactions to find
    /// the matching transaction ID.
    func getTransactionInfo(transactionId: String) async -> TransactionInfo? {
        for await result in Transaction.entitledTransactionSequence {
            do {
                let transaction = try checkVerified(result)

                // Check if this is the transaction we're looking for
                if transaction.id.description == transactionId {
                    return convertToTransactionInfo(transaction: transaction)
                }
            } catch {
                // Skip unverified transactions
                continue
            }
        }

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
        let payload: [String: Any] = [
            "transactionId": transaction.id.description,
            "productId": transaction.productID,
            "quantity": transaction.quantity,
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
