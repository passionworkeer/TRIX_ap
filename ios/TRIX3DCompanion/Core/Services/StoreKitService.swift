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
            print("Unknown product purchased: \(productId)")
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

// MARK: - Receipt Verification

extension StoreKitService {

    /// Get receipt data for server verification
    /// - Returns: Receipt data as base64 encoded string
    func getReceiptData() -> String? {
        // For StoreKit 2, we use the transaction ID
        // The backend will verify using App Store Server API
        return nil
    }

    /// Get latest transaction ID for verification
    /// - Parameter productId: Product identifier
    /// - Returns: Transaction ID or nil
    func getLatestTransactionId(for productId: String) -> String? {
        // Get latest transaction for this product
        return nil
    }
}
