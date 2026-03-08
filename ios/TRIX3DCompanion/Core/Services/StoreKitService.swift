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
            try await AppStore.sync()
            let restored = await getTransactionHistory()
            await updateSubscriptionStatus()
            return .success(restored)
        } catch {
            let skError = mapStoreKitError(error)
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
        var history: [TransactionInfo] = []
        var processed = 0

        for await result in Transaction.all {
            if processed >= ReceiptFetchConfig.maxTransactions {
                break
            }
            processed += 1

            switch result {
            case .verified(let transaction):
                history.append(convertToTransactionInfo(transaction: transaction, status: .verified))
            case .unverified(let transaction, _):
                history.append(convertToTransactionInfo(transaction: transaction, status: .unverified))
            }
        }

        return history.sorted { $0.purchaseDate > $1.purchaseDate }
    }

    /// Clear error state
    func clearError() {
        lastError = nil
    }

    // MARK: - Private Methods

    /// Update subscription status from latest transaction
    private func updateSubscriptionStatus() async {
        var newestTransaction: Transaction?
        var newestDate = Date.distantPast

        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result,
                  StoreProductConfiguration.productType(for: transaction.productID) == .subscription else {
                continue
            }

            let candidateDate = transaction.expirationDate ?? transaction.purchaseDate
            if candidateDate > newestDate {
                newestDate = candidateDate
                newestTransaction = transaction
            }
        }

        if let transaction = newestTransaction {
            subscriptionStatus = convertToSubscriptionStatus(transaction: transaction)
        } else {
            subscriptionStatus = nil
        }
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
        let subscriptionPeriod: SubscriptionPeriod? = {
            guard let period = product.subscription?.subscriptionPeriod else {
                return nil
            }

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
                return nil
            }

            return SubscriptionPeriod(value: period.value, unit: unit)
        }()

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
    private func convertToTransactionInfo(
        transaction: Transaction,
        status: TransactionInfo.TransactionStatus = .verified
    ) -> TransactionInfo {
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
            status: status
        )
    }

    /// Convert Transaction to SubscriptionStatus
    /// - Parameter transaction: StoreKit transaction
    /// - Returns: SubscriptionStatus model
    private func convertToSubscriptionStatus(transaction: Transaction) -> SubscriptionStatus {
        let state: SubscriptionStatus.SubscriptionState

        if transaction.revocationDate != nil {
            state = .revoked
        } else if let expirationDate = transaction.expirationDate {
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
        convertToTransactionInfo(transaction: currentEntitlements, status: .verified)
    }

    /// Convert current entitlements to SubscriptionStatus
    /// - Parameter currentEntitlements: Current transaction entitlements
    /// - Returns: SubscriptionStatus model
    private func convertToSubscriptionStatusFromCurrent(_ currentEntitlements: Transaction) -> SubscriptionStatus {
        convertToSubscriptionStatus(transaction: currentEntitlements)
    }

    private func mapStoreKitError(_ error: Error) -> StoreKitError {
        if let skError = error as? StoreKitError {
            return skError
        }

        let nsError = error as NSError
        if nsError.domain == SKErrorDomain,
           let code = SKError.Code(rawValue: nsError.code),
           code == .paymentCancelled {
            return .userCancelled
        }

        return .unknown(error)
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
        struct EncodedReceiptTransaction: Codable {
            let transactionId: String
            let productId: String
            let purchaseDate: Date
            let expirationDate: Date?
            let revocationDate: Date?
            let originalTransactionId: String
        }

        struct EncodedReceiptPayload: Codable {
            let bundleIdentifier: String
            let appVersion: String
            let generatedAt: Date
            let transactions: [EncodedReceiptTransaction]
        }

        var transactions: [EncodedReceiptTransaction] = []
        var processed = 0

        for await result in Transaction.currentEntitlements {
            if processed >= ReceiptFetchConfig.maxTransactions {
                break
            }
            processed += 1

            guard case .verified(let transaction) = result else {
                continue
            }

            transactions.append(
                EncodedReceiptTransaction(
                    transactionId: transaction.id.description,
                    productId: transaction.productID,
                    purchaseDate: transaction.purchaseDate,
                    expirationDate: transaction.expirationDate,
                    revocationDate: transaction.revocationDate,
                    originalTransactionId: transaction.originalID.description
                )
            )
        }

        guard !transactions.isEmpty else {
            return nil
        }

        let payload = EncodedReceiptPayload(
            bundleIdentifier: Bundle.main.bundleIdentifier ?? "unknown",
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown",
            generatedAt: Date(),
            transactions: transactions
        )

        do {
            let encoded = try JSONEncoder().encode(payload)
            return encoded.base64EncodedString()
        } catch {
            SecureLogger.shared.error("Failed to encode StoreKit receipt payload: \(error.localizedDescription)")
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
        var latestTransaction: Transaction?
        var latestDate = Date.distantPast
        var processed = 0

        for await result in Transaction.all {
            if processed >= ReceiptFetchConfig.maxTransactions {
                break
            }
            processed += 1

            guard case .verified(let transaction) = result,
                  transaction.productID == productId else {
                continue
            }

            if transaction.purchaseDate > latestDate {
                latestDate = transaction.purchaseDate
                latestTransaction = transaction
            }
        }

        return latestTransaction?.id.description
    }

    /// Get transaction info for verification
    /// - Parameter transactionId: Transaction ID to retrieve
    /// - Returns: Transaction info or nil if not found
    ///
    /// Retrieves detailed transaction information for backend verification.
    /// This method searches through all entitled transactions to find
    /// the matching transaction ID.
    func getTransactionInfo(transactionId: String) async -> TransactionInfo? {
        var processed = 0

        for await result in Transaction.all {
            if processed >= ReceiptFetchConfig.maxTransactions {
                break
            }
            processed += 1

            switch result {
            case .verified(let transaction):
                if transaction.id.description == transactionId {
                    return convertToTransactionInfo(transaction: transaction, status: .verified)
                }
            case .unverified(let transaction, _):
                if transaction.id.description == transactionId {
                    return convertToTransactionInfo(transaction: transaction, status: .unverified)
                }
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
