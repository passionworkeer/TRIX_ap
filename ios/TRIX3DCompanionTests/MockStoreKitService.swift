//
//  MockStoreKitService.swift
//  TRIX3DCompanionTests
//
//  Mock implementation of StoreKitServiceProtocol for testing
//

import Foundation
import Combine
@testable import TRIX3DCompanion

/// Mock implementation of StoreKitServiceProtocol for unit testing
@MainActor
final class MockStoreKitService: StoreKitServiceProtocol {

    // MARK: - Published Properties

    @Published private(set) var availableProducts: [StoreProduct] = []
    @Published private(set) var isLoadingProducts: Bool = false
    @Published private(set) var subscriptionStatus: SubscriptionStatus?
    @Published private(set) var isPurchasing: Bool = false
    @Published private(set) var lastError: StoreKitError?

    // MARK: - Mock Configuration

    var mockLoadProductsResult: Result<Void, StoreKitError>?
    var mockPurchaseResult: PurchaseResult?
    var mockRestoreResult: Result<[TransactionInfo], StoreKitError>?
    var mockSubscriptionStatus: SubscriptionStatus?
    var mockTransactionHistory: [TransactionInfo] = []

    // Call tracking
    var loadProductsCallCount: Int = 0
    var purchaseCallCount: Int = 0
    var restorePurchasesCallCount: Int = 0
    var checkSubscriptionStatusCallCount: Int = 0
    var getTransactionHistoryCallCount: Int = 0
    var clearErrorCallCount: Int = 0

    // MARK: - Initialization

    init() {}

    // MARK: - StoreKitServiceProtocol

    func loadProducts(productIds: [String]) async -> Result<Void, StoreKitError> {
        loadProductsCallCount += 1
        isLoadingProducts = true

        defer {
            isLoadingProducts = false
        }

        if let result = mockLoadProductsResult {
            return result
        }

        // Default: create mock products
        availableProducts = productIds.compactMap { createMockProduct(id: $0) }
        return .success(())
    }

    func purchase(product productId: String) async -> PurchaseResult {
        purchaseCallCount += 1
        isPurchasing = true

        defer {
            isPurchasing = false
        }

        if let result = mockPurchaseResult {
            return result
        }

        // Default: return success
        return .success(transaction: createMockTransaction(productId: productId))
    }

    func restorePurchases() async -> Result<[TransactionInfo], StoreKitError> {
        restorePurchasesCallCount += 1

        if let result = mockRestoreResult {
            return result
        }

        // Default: return empty array
        return .success(mockTransactionHistory)
    }

    func checkSubscriptionStatus() async -> SubscriptionStatus? {
        checkSubscriptionStatusCallCount += 1

        if let status = mockSubscriptionStatus {
            subscriptionStatus = status
            return status
        }

        return subscriptionStatus
    }

    func getTransactionHistory() async -> [TransactionInfo] {
        getTransactionHistoryCallCount += 1
        return mockTransactionHistory
    }

    func clearError() {
        clearErrorCallCount += 1
        lastError = nil
    }

    // MARK: - Helper Methods

    func setMockProducts(_ products: [StoreProduct]) {
        availableProducts = products
    }

    func setMockLoadProductsSuccess() {
        mockLoadProductsResult = .success(())
    }

    func setMockLoadProductsError(_ error: StoreKitError) {
        mockLoadProductsResult = .failure(error)
        lastError = error
    }

    func setMockPurchaseSuccess(productId: String = "test-product") {
        mockPurchaseResult = .success(transaction: createMockTransaction(productId: productId))
    }

    func setMockPurchasePending() {
        mockPurchaseResult = .pending
    }

    func setMockPurchaseFailed(_ error: StoreKitError = .purchaseFailed(underlying: nil)) {
        mockPurchaseResult = .failed(error: error)
        lastError = error
    }

    func setMockPurchaseCancelled() {
        mockPurchaseResult = .cancelled
    }

    func setMockSubscriptionActive() {
        mockSubscriptionStatus = SubscriptionStatus(
            state: .subscribed,
            renewalInfo: RenewalInfo(expirationDate: Date().addingTimeInterval(86400 * 30), willAutoRenew: true, autoRenewPreference: true),
            expirationDate: Date().addingTimeInterval(86400 * 30),
            willAutoRenew: true
        )
    }

    func setMockSubscriptionExpired() {
        mockSubscriptionStatus = SubscriptionStatus(
            state: .expired,
            renewalInfo: nil,
            expirationDate: Date().addingTimeInterval(-86400),
            willAutoRenew: false
        )
    }

    func createMockProduct(
        id: String = "com.trix3d.points.500",
        type: ProductType = .points,
        points: Int? = 580
    ) -> StoreProduct {
        // Note: In real tests, you'd need actual Product objects from StoreKit
        // This is a simplified mock for testing purposes
        fatalError("StoreProduct requires real Product object - use setMockProducts instead")
    }

    func createMockTransaction(productId: String = "test-product") -> Transaction {
        fatalError("Transaction cannot be created directly - use mock results instead")
    }

    func createMockTransactionInfo(
        id: String = "txn-1",
        productId: String = "com.trix3d.points.500",
        type: ProductType = .points,
        points: Int? = 580
    ) -> TransactionInfo {
        TransactionInfo(
            id: id,
            productID: productId,
            purchaseDate: Date(),
            expirationDate: nil,
            quantity: 1,
            type: type,
            points: points,
            status: .verified
        )
    }

    func resetCallCounts() {
        loadProductsCallCount = 0
        purchaseCallCount = 0
        restorePurchasesCallCount = 0
        checkSubscriptionStatusCallCount = 0
        getTransactionHistoryCallCount = 0
        clearErrorCallCount = 0
    }

    func reset() {
        resetCallCounts()
        availableProducts = []
        isLoadingProducts = false
        subscriptionStatus = nil
        isPurchasing = false
        lastError = nil
        mockLoadProductsResult = nil
        mockPurchaseResult = nil
        mockRestoreResult = nil
        mockSubscriptionStatus = nil
        mockTransactionHistory = []
    }
}
