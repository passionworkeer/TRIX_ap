//
//  StoreKitServiceProtocol.swift
//  TRIX3DCompanion
//
//  Protocol defining StoreKit 2 service interface for in-app purchases
//

import Foundation
import StoreKit

// MARK: - Product Types

/// In-app product type
enum ProductType: String, CaseIterable, Codable {
    case subscription = "subscription"
    case points = "points"
}

/// Product information
struct StoreProduct: Identifiable, Equatable {
    let id: String
    let name: String
    let description: String
    let price: String
    let priceLocale: Locale
    let type: ProductType
    let points: Int?
    let subscriptionPeriod: SubscriptionPeriod?
    let product: Product?

    /// Equality check based on ID
    static func == (lhs: StoreProduct, rhs: StoreProduct) -> Bool {
        lhs.id == rhs.id
    }
}

/// Subscription period information
struct SubscriptionPeriod: Equatable {
    let value: Int
    let unit: PeriodUnit

    enum PeriodUnit: String, Equatable {
        case day
        case week
        case month
        case year
    }

    var localizedDescription: String {
        switch unit {
        case .day:
            return value == 1 ? "Daily" : "\(value) Days"
        case .week:
            return value == 1 ? "Weekly" : "\(value) Weeks"
        case .month:
            return value == 1 ? "Monthly" : "\(value) Months"
        case .year:
            return value == 1 ? "Yearly" : "\(value) Years"
        }
    }
}

/// Subscription status information
struct SubscriptionStatus: Equatable {
    let state: SubscriptionState
    let renewalInfo: RenewalInfo?
    let expirationDate: Date?
    let willAutoRenew: Bool

    enum SubscriptionState: Equatable {
        case subscribed
        case expired
        case inBillingRetryPeriod
        case inGracePeriod
        case revoked
        case unknown
    }

    var isActive: Bool {
        switch state {
        case .subscribed, .inBillingRetryPeriod, .inGracePeriod:
            return true
        default:
            return false
        }
    }
}

/// Renewal information
struct RenewalInfo: Equatable {
    let expirationDate: Date?
    let willAutoRenew: Bool
    let autoRenewPreference: Bool?
}

/// Purchase result
enum PurchaseResult {
    case success(transaction: Transaction)
    case pending
    case failed(error: StoreKitError)
    case cancelled
}

/// StoreKit specific errors
enum StoreKitError: Error, LocalizedError, Equatable {
    case productNotFound
    case purchaseFailed(underlying: Error?)
    case verificationFailed
    case configurationError
    case userCancelled
    case unknown(Error?)

    static func == (lhs: StoreKitError, rhs: StoreKitError) -> Bool {
        switch (lhs, rhs) {
        case (.productNotFound, .productNotFound),
             (.verificationFailed, .verificationFailed),
             (.configurationError, .configurationError),
             (.userCancelled, .userCancelled):
            return true
        case (.purchaseFailed(let a), .purchaseFailed(let b)):
            return (a as NSError?)?.code == (b as NSError?)?.code
        case (.unknown(let a), .unknown(let b)):
            return (a as NSError?)?.code == (b as NSError?)?.code
        default:
            return false
        }
    }

    var errorDescription: String? {
        switch self {
        case .productNotFound:
            return "Product not found"
        case .purchaseFailed(let error):
            return "Purchase failed: \(error?.localizedDescription ?? "Unknown error")"
        case .verificationFailed:
            return "Failed to verify purchase"
        case .configurationError:
            return "Store configuration error"
        case .userCancelled:
            return "Purchase cancelled"
        case .unknown(let error):
            return error?.localizedDescription ?? "An unknown error occurred"
        }
    }

    var isRecoverable: Bool {
        switch self {
        case .userCancelled, .productNotFound:
            return false
        default:
            return true
        }
    }
}

/// Transaction information
struct TransactionInfo: Identifiable, Equatable {
    let id: String
    let productID: String
    let purchaseDate: Date
    let expirationDate: Date?
    let quantity: Int
    let type: ProductType
    let points: Int?
    let status: TransactionStatus

    enum TransactionStatus {
        case verified
        case unverified
        case failed
    }
}

// MARK: - StoreKit Service Protocol

/// Protocol defining StoreKit service interface
@MainActor
protocol StoreKitServiceProtocol: ObservableObject {

    /// Available products for purchase
    var availableProducts: [StoreProduct] { get }

    /// Whether products are currently being loaded
    var isLoadingProducts: Bool { get }

    /// Current subscription status
    var subscriptionStatus: SubscriptionStatus? { get }

    /// Whether currently purchasing
    var isPurchasing: Bool { get }

    /// Last purchase error if any
    var lastError: StoreKitError? { get }

    /// Load available products from App Store
    /// - Parameter productIds: Product identifiers to load
    /// - Returns: Result indicating success or failure
    func loadProducts(productIds: [String]) async -> Result<Void, StoreKitError>

    /// Purchase a product
    /// - Parameter productId: Product identifier to purchase
    /// - Returns: Purchase result
    func purchase(product productId: String) async -> PurchaseResult

    /// Restore previous purchases
    /// - Returns: Result indicating success or failure with restored transactions
    func restorePurchases() async -> Result<[TransactionInfo], StoreKitError>

    /// Check current subscription status
    /// - Returns: Current subscription status or nil if not subscribed
    func checkSubscriptionStatus() async -> SubscriptionStatus?

    /// Get transaction history
    /// - Returns: Array of past transactions
    func getTransactionHistory() async -> [TransactionInfo]

    /// Get receipt data for server verification
    /// - Returns: Receipt data as base64 encoded string
    ///
    /// Collects all verified transactions and creates a JSON payload
    /// for secure transmission to the backend verification service.
    /// The backend will verify using App Store Server API.
    ///
    /// - Important: Sensitive data is not logged to protect user privacy.
    func getReceiptData() async -> String?

    /// Get latest transaction ID for verification
    /// - Parameter productId: Product identifier
    /// - Returns: Transaction ID or nil
    ///
    /// Retrieves the most recent verified transaction ID for a specific product.
    /// Used to validate purchases with the backend server.
    ///
    /// - Important: Transaction IDs are sensitive and should not be logged.
    func getLatestTransactionId(for productId: String) async -> String?

    /// Get transaction info for verification
    /// - Parameter transactionId: Transaction ID to retrieve
    /// - Returns: Transaction info or nil if not found
    func getTransactionInfo(transactionId: String) async -> TransactionInfo?

    /// Prepare verification payload for backend
    /// - Parameters:
    ///   - transaction: The transaction to validate
    ///   - productId: Product identifier
    /// - Returns: Verification payload or nil if validation fails
    func prepareVerificationPayload(
        transaction: Transaction,
        productId: String
    ) -> [String: Any]?

    /// Clear error state
    func clearError()
}

// MARK: - Product Configuration

/// Product IDs configuration - MUST match App Store Connect
enum StoreProductConfiguration {
    // Subscription Products
    static let monthlySubscription = "com.trix3d.subscription.monthly"
    static let yearlySubscription = "com.trix3d.subscription.yearly"

    // Points Products
    static let points100 = "com.trix3d.points.100"
    static let points300 = "com.trix3d.points.300"
    static let points500 = "com.trix3d.points.500"
    static let points1000 = "com.trix3d.points.1000"

    /// All subscription product IDs
    static var subscriptionProductIds: [String] {
        [monthlySubscription, yearlySubscription]
    }

    /// All points product IDs
    static var pointsProductIds: [String] {
        [points100, points300, points500, points1000]
    }

    /// All product IDs
    static var allProductIds: [String] {
        subscriptionProductIds + pointsProductIds
    }

    /// Get points value for a product
    static func pointsForProduct(_ productId: String) -> Int? {
        switch productId {
        case points100: return 100
        case points300: return 330  // 300 + 30 bonus
        case points500: return 580  // 500 + 80 bonus
        case points1000: return 1200 // 1000 + 200 bonus
        default: return nil
        }
    }

    /// Get product type from product ID
    static func productType(for productId: String) -> ProductType? {
        if subscriptionProductIds.contains(productId) {
            return .subscription
        } else if pointsProductIds.contains(productId) {
            return .points
        }
        return nil
    }
}
