//
//  PaymentServiceProtocol.swift
//  TRIX3DCompanion
//
//  Protocol defining payment service interface for unified payment management
//

import Foundation

// MARK: - Payment Types

/// Payment method types
enum PaymentMethod: String, CaseIterable {
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

/// Payment status
enum PaymentStatus: String, Equatable {
    case pending = "pending"
    case processing = "processing"
    case completed = "completed"
    case failed = "failed"
    case cancelled = "cancelled"
    case refunded = "refunded"
}

/// Order information
struct Order: Identifiable, Codable, Equatable {
    let id: String
    let userId: String
    let productId: String
    let productType: ProductType
    let amount: Double
    let currency: String
    let status: PaymentStatus
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
enum PaymentResult: Equatable {
    case success(order: Order)
    case pending(order: Order)
    case failed(error: PaymentError)
    case cancelled
}

/// Payment errors
enum PaymentError: Error, LocalizedError {
    case invalidProduct
    case paymentFailed(underlying: Error?)
    case verificationFailed
    case insufficientBalance
    case networkError
    case userCancelled
    case orderNotFound
    case serverError(message: String)
    case unknown(Error?)

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
            return "Order not found"
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

/// Points transaction
struct PointsTransaction: Identifiable, Codable {
    let id: String
    let userId: String
    let pointsChange: Int
    let balanceAfter: Int
    let type: String
    let description: String
    let orderId: String?
    let createdAt: Date
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
    var pendingOrders: [Order] { get }

    /// Completed orders
    var completedOrders: [Order] { get }

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
    ) async -> Result<Order, PaymentError>

    /// Get order details
    /// - Parameter orderId: Order ID
    /// - Returns: Order or nil if not found
    func getOrder(orderId: String) async -> Order?

    /// Get order history
    /// - Parameters:
    ///   - limit: Number of orders to retrieve
    ///   - offset: Pagination offset
    /// - Returns: Array of orders
    func getOrderHistory(limit: Int, offset: Int) async -> [Order]

    /// Cancel pending order
    /// - Parameter orderId: Order ID to cancel
    /// - Returns: Result indicating success or failure
    func cancelOrder(orderId: String) async -> Result<Void, PaymentError>

    /// Get current subscription status
    /// - Returns: Subscription status information
    func getSubscription() async -> PaymentSubscriptionStatus

    /// Restore previous purchases
    /// - Returns: Result with restored orders or error
    func restorePurchases() async -> Result<[Order], PaymentError>

    /// Clear error state
    func clearError()
}

// MARK: - Order Status Update

/// Order update notification
struct OrderUpdate: Identifiable, Equatable {
    let orderId: String
    let status: PaymentStatus
    let timestamp: Date
}
