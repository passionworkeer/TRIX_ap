//
//  PaymentServiceProtocol.swift
//  TRIX3DCompanion
//
//  Protocol defining payment service interface for unified payment management
//

import Foundation
// import TRIX3DCompanionCore

// MARK: - Payment Types

/// Payment method types
enum PaymentMethod: String, CaseIterable, Codable {
    case applePay = "apple_pay"
    case wechatPay = "wechat_pay"
    case alipay = "alipay"

    var displayName: String {
        switch self {
        case .applePay:
            return "Apple Pay"
        case .wechatPay:
            return "WeChat Pay"
        case .alipay:
            return "Alipay"
        }
    }

    var iconName: String {
        switch self {
        case .applePay:
            return "applelogo"
        case .wechatPay:
            return "message.fill"
        case .alipay:
            return "yensign.circle.fill"
        }
    }
}

/// Payment status (renamed to avoid conflict with APIEndpoints)
enum AppPaymentStatus: String, Equatable {
    case pending = "pending"
    case processing = "processing"
    case completed = "completed"
    case failed = "failed"
    case cancelled = "cancelled"
    case refunded = "refunded"
}

/// AppOrder information
struct AppOrder: Identifiable, Equatable {
    let id: String
    let userId: String
    let productId: String
    let productType: ProductType
    let amount: Double
    let currency: String
    let status: AppPaymentStatus
    let paymentMethod: PaymentMethod
    let transactionId: String?
    let points: Int?
    let createdAt: Date
    let updatedAt: Date

    var isCompleted: Bool {
        status == .completed
    }

    var isPending: Bool {
        status == .pending || status == .processing
    }

    var isFailed: Bool {
        status == .failed || status == .cancelled
    }
}

/// Payment result
enum PaymentResult {
    case success(order: AppOrder)
    case pending(order: AppOrder)
    case failed(error: PaymentError)
    case cancelled
}

/// Payment errors
enum PaymentError: Error, LocalizedError, Equatable {
    case invalidProduct
    case paymentFailed(underlying: Error?)
    case verificationFailed
    case insufficientBalance
    case networkError
    case userCancelled
    case orderNotFound
    case serverError(message: String)
    case unknown(Error?)

    static func == (lhs: PaymentError, rhs: PaymentError) -> Bool {
        switch (lhs, rhs) {
        case (.invalidProduct, .invalidProduct),
             (.verificationFailed, .verificationFailed),
             (.insufficientBalance, .insufficientBalance),
             (.networkError, .networkError),
             (.userCancelled, .userCancelled),
             (.orderNotFound, .orderNotFound):
            return true
        case (.paymentFailed, .paymentFailed),
             (.serverError, .serverError),
             (.unknown, .unknown):
            return true
        default:
            return false
        }
    }

    var errorDescription: String? {
        switch self {
        case .invalidProduct:
            return "Invalid product selected"
        case .paymentFailed(let error):
            return "Payment failed: \(error?.localizedDescription ?? "Unknown error")"
        case .verificationFailed:
            return "Payment verification failed"
        case .insufficientBalance:
            return "Insufficient balance"
        case .networkError:
            return "Network error. Please check your connection"
        case .userCancelled:
            return "Payment cancelled"
        case .orderNotFound:
            return "AppOrder not found"
        case .serverError(let message):
            return message
        case .unknown(let error):
            return error?.localizedDescription ?? "An unknown error occurred"
        }
    }

    var isRecoverable: Bool {
        switch self {
        case .userCancelled, .invalidProduct, .orderNotFound:
            return false
        default:
            return true
        }
    }
}

/// Points purchase request
struct PointsPurchaseRequest: Codable {
    let productId: String
    let points: Int
    let amount: Double
    let currency: String
    let transactionId: String?
    let receiptData: String?
}

/// Points purchase response
struct PointsPurchaseResponse: Codable {
    let orderId: String
    let pointsAdded: Int
    let totalPoints: Int
    let transaction: PointsTransaction?
}

// MARK: - Subscription Types

/// Subscription status information
struct PaymentSubscriptionStatus: Equatable {
    let isActive: Bool
    let tier: String?
    let productId: String?
    let expiresAt: Date?
    let willAutoRenew: Bool
    let startedAt: Date?
    let updatedAt: Date?
}

// MARK: - Payment Service Protocol

/// Protocol defining payment service interface
@MainActor
protocol PaymentServiceProtocol: ObservableObject {

    /// Current pending orders
    var pendingAppOrders: [AppOrder] { get }

    /// Completed orders
    var completedAppOrders: [AppOrder] { get }

    /// Whether currently processing payment
    var isProcessing: Bool { get }

    /// Last payment error if any
    var lastError: PaymentError? { get }

    /// Purchase points using in-app purchase
    /// - Parameters:
    ///   - productId: Product identifier
    ///   - points: Points amount
    /// - Returns: Payment result
    func purchasePoints(productId: String, points: Int) async -> PaymentResult

    /// Subscribe to membership
    /// - Parameter productId: Subscription product identifier
    /// - Returns: Payment result
    func subscribe(productId: String) async -> PaymentResult

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
    ) async -> Result<AppOrder, PaymentError>

    /// Get order details
    /// - Parameter orderId: AppOrder ID
    /// - Returns: AppOrder or nil if not found
    func getAppOrder(orderId: String) async -> AppOrder?

    /// Get order history
    /// - Parameters:
    ///   - limit: Number of orders to retrieve
    ///   - offset: Pagination offset
    /// - Returns: Array of orders
    func getAppOrderHistory(limit: Int, offset: Int) async -> [AppOrder]

    /// Cancel pending order
    /// - Parameter orderId: AppOrder ID to cancel
    /// - Returns: Result indicating success or failure
    func cancelAppOrder(orderId: String) async -> Result<Void, PaymentError>

    /// Get current subscription status
    /// - Returns: Subscription status information
    func getSubscription() async -> PaymentSubscriptionStatus

    /// Restore previous purchases
    /// - Returns: Result with restored orders or error
    func restorePurchases() async -> Result<[AppOrder], PaymentError>

    /// Clear error state
    func clearError()
}

// MARK: - AppOrder Status Update

/// AppOrder update notification
struct AppOrderUpdate: Identifiable, Equatable {
    let id: String
    let orderId: String
    let status: AppPaymentStatus
    let timestamp: Date
}

// MARK: - Type Aliases for API Responses

/// Type alias for order details response (from API layer)
typealias AppOrderDetailsResponse = OrderDetailsResponse

/// Type alias for orders list response (from API layer)
typealias AppOrdersListResponse = OrdersListResponse

// MARK: - Order to AppOrder Conversion

extension OrderDetailsResponse {
    /// Convert to AppOrder
    func toAppOrder() -> AppOrder {
        // Map ProductType from string to proper enum
        let productType: ProductType
        if let pt = ProductType(rawValue: self.productId) {
            productType = pt
        } else {
            productType = .points
        }

        // Map PaymentMethod from string (default to apple_pay)
        let paymentMethod: PaymentMethod
        if let pm = PaymentMethod(rawValue: "apple_pay") {
            paymentMethod = pm
        } else {
            paymentMethod = .applePay
        }

        return AppOrder(
            id: self.id,
            userId: self.userId,
            productId: self.productId,
            productType: productType,
            amount: self.amount,
            currency: self.currency,
            status: self.status.toAppPaymentStatus(),
            paymentMethod: paymentMethod,
            transactionId: self.transactionId,
            points: self.points,
            createdAt: self.createdAt,
            updatedAt: self.updatedAt
        )
    }
}

// MARK: - PaymentStatus to AppPaymentStatus Conversion

extension PaymentStatus {
    /// Convert API PaymentStatus to AppPaymentStatus
    func toAppPaymentStatus() -> AppPaymentStatus {
        switch self {
        case .pending:
            return .pending
        case .processing:
            return .processing
        case .completed:
            return .completed
        case .failed:
            return .failed
        case .cancelled:
            return .cancelled
        case .refunded:
            return .refunded
        }
    }
}

extension AppPaymentStatus {
    /// Convert AppPaymentStatus to API PaymentStatus
    func toPaymentStatus() -> PaymentStatus {
        switch self {
        case .pending:
            return .pending
        case .processing:
            return .processing
        case .completed:
            return .completed
        case .failed:
            return .failed
        case .cancelled:
            return .cancelled
        case .refunded:
            return .refunded
        }
    }
}

// MARK: - ProductType String Raw Value

extension ProductType {
    /// Get raw value string for ProductType
    var rawValue: String {
        switch self {
        case .points:
            return "points"
        case .subscription:
            return "subscription"
        }
    }

    /// Initialize from raw string
    init?(rawValue: String) {
        switch rawValue {
        case "points":
            self = .points
        case "subscription":
            self = .subscription
        default:
            // Try to detect from product ID prefix
            if rawValue.hasPrefix("points_") || rawValue.contains("points") {
                self = .points
            } else if rawValue.hasPrefix("sub_") || rawValue.contains("subscription") {
                self = .subscription
            } else {
                return nil
            }
        }
    }
}

// MARK: - PaymentMethod String Raw Value

extension PaymentMethod {
    /// Get raw value string for PaymentMethod
    var rawValue: String {
        switch self {
        case .applePay:
            return "apple_pay"
        case .wechatPay:
            return "wechat_pay"
        case .alipay:
            return "alipay"
        }
    }

    /// Initialize from raw string
    init?(rawValue: String) {
        switch rawValue {
        case "apple_pay":
            self = .applePay
        case "wechat_pay":
            self = .wechatPay
        case "alipay":
            self = .alipay
        default:
            return nil
        }
    }
}
