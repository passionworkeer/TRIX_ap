//
//  MockPaymentService.swift
//  TRIX3DCompanionTests
//
//  Mock implementation of PaymentServiceProtocol for testing
//

import Foundation
import Combine
@testable import TRIX3DCompanion

/// Mock implementation of PaymentServiceProtocol for unit testing
@MainActor
final class MockPaymentService: PaymentServiceProtocol {

    // MARK: - Published Properties

    @Published private(set) var pendingOrders: [Order] = []
    @Published private(set) var completedOrders: [Order] = []
    @Published private(set) var isProcessing: Bool = false
    @Published private(set) var lastError: PaymentError?

    // MARK: - Mock Configuration

    var mockPurchaseResult: PaymentResult?
    var mockSubscribeResult: PaymentResult?
    var mockVerifyResult: Result<Order, PaymentError>?
    var mockOrderHistory: [Order] = []
    var mockOrder: Order?

    // Call tracking
    var purchasePointsCallCount: Int = 0
    var subscribeCallCount: Int = 0
    var verifyReceiptCallCount: Int = 0
    var getOrderCallCount: Int = 0
    var getOrderHistoryCallCount: Int = 0
    var cancelOrderCallCount: Int = 0
    var clearErrorCallCount: Int = 0

    // MARK: - Initialization

    init() {}

    // MARK: - PaymentServiceProtocol

    func purchasePoints(productId: String, points: Int) async -> PaymentResult {
        purchasePointsCallCount += 1
        isProcessing = true

        defer {
            isProcessing = false
        }

        if let result = mockPurchaseResult {
            if case .success(let order) = result {
                completedOrders.append(order)
            } else if case .pending(let order) = result {
                pendingOrders.append(order)
            }
            return result
        }

        // Default: return success
        let order = createMockOrder(productId: productId, points: points)
        completedOrders.append(order)
        return .success(order: order)
    }

    func subscribe(productId: String) async -> PaymentResult {
        subscribeCallCount += 1
        isProcessing = true

        defer {
            isProcessing = false
        }

        if let result = mockSubscribeResult {
            return result
        }

        // Default: return success
        let order = createMockSubscriptionOrder(productId: productId)
        completedOrders.append(order)
        return .success(order: order)
    }

    func verifyReceipt(transactionId: String, productId: String, receiptData: String?) async -> Result<Order, PaymentError> {
        verifyReceiptCallCount += 1

        if let result = mockVerifyResult {
            return result
        }

        // Default: return success
        let order = createMockOrder(productId: productId, points: nil)
        return .success(order)
    }

    func getOrder(orderId: String) async -> Order? {
        getOrderCallCount += 1

        if let order = mockOrder {
            return order
        }

        return completedOrders.first { $0.id == orderId } ?? pendingOrders.first { $0.id == orderId }
    }

    func getOrderHistory(limit: Int, offset: Int) async -> [Order] {
        getOrderHistoryCallCount += 1

        if !mockOrderHistory.isEmpty {
            return Array(mockOrderHistory.dropFirst(offset).prefix(limit))
        }

        return Array(completedOrders.dropFirst(offset).prefix(limit))
    }

    func cancelOrder(orderId: String) async -> Result<Void, PaymentError> {
        cancelOrderCallCount += 1

        if let index = pendingOrders.firstIndex(where: { $0.id == orderId }) {
            pendingOrders.remove(at: index)
            return .success(())
        }

        return .failure(.orderNotFound)
    }

    func clearError() {
        clearErrorCallCount += 1
        lastError = nil
    }

    // MARK: - Helper Methods

    func setMockPurchaseSuccess(order: Order? = nil) {
        mockPurchaseResult = .success(order: order ?? createMockOrder())
    }

    func setMockPurchasePending(order: Order? = nil) {
        mockPurchaseResult = .pending(order: order ?? createMockOrder())
    }

    func setMockPurchaseFailed(error: PaymentError = .paymentFailed(underlying: nil)) {
        mockPurchaseResult = .failed(error: error)
        lastError = error
    }

    func setMockPurchaseCancelled() {
        mockPurchaseResult = .cancelled
    }

    func setMockSubscribeSuccess(order: Order? = nil) {
        mockSubscribeResult = .success(order: order ?? createMockSubscriptionOrder())
    }

    func setMockOrderHistory(_ orders: [Order]) {
        mockOrderHistory = orders
    }

    func createMockOrder(
        productId: String = "com.trix3d.points.500",
        points: Int? = 580,
        status: PaymentStatus = .completed
    ) -> Order {
        Order(
            id: UUID().uuidString,
            userId: "test-user",
            productId: productId,
            productType: .points,
            amount: 28.0,
            currency: "CNY",
            status: status,
            paymentMethod: .applePay,
            transactionId: "txn_\(UUID().uuidString)",
            points: points,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    func createMockSubscriptionOrder(
        productId: String = "com.trix3d.subscription.monthly",
        status: PaymentStatus = .completed
    ) -> Order {
        Order(
            id: UUID().uuidString,
            userId: "test-user",
            productId: productId,
            productType: .subscription,
            amount: 12.0,
            currency: "CNY",
            status: status,
            paymentMethod: .applePay,
            transactionId: "txn_\(UUID().uuidString)",
            points: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    func resetCallCounts() {
        purchasePointsCallCount = 0
        subscribeCallCount = 0
        verifyReceiptCallCount = 0
        getOrderCallCount = 0
        getOrderHistoryCallCount = 0
        cancelOrderCallCount = 0
        clearErrorCallCount = 0
    }

    func reset() {
        resetCallCounts()
        pendingOrders = []
        completedOrders = []
        lastError = nil
        isProcessing = false
        mockPurchaseResult = nil
        mockSubscribeResult = nil
        mockVerifyResult = nil
        mockOrderHistory = []
        mockOrder = nil
    }
}
