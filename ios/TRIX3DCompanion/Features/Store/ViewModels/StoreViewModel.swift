//
//  StoreViewModel.swift
//  TRIX3DCompanion
//
//  Store ViewModel - manages store state and product listings
//

import Foundation
import Combine
import StoreKit

// MARK: - Store ViewModel

/// Store view model managing products, subscription status, and user points
@MainActor
final class StoreViewModel: ObservableObject {

    // MARK: - Published Properties

    /// Available points products
    @Published var pointsProducts: [StoreProduct] = []

    /// Available subscription products
    @Published var subscriptionProducts: [StoreProduct] = []

    /// Current user points balance
    @Published var userPoints: Int = 0

    /// Current subscription status
    @Published var subscriptionStatus: SubscriptionStatus?

    /// Whether currently loading products
    @Published var isLoadingProducts: Bool = false

    /// Whether currently processing purchase
    @Published var isPurchasing: Bool = false

    /// Error message to display
    @Published var errorMessage: String?

    /// Whether to show subscription view
    @Published var showSubscription: Bool = false

    /// Whether to show points purchase view
    @Published var showPointsPurchase: Bool = false

    /// Selected product for purchase
    @Published var selectedProduct: StoreProduct?

    // MARK: - Dependencies

    private let storeKitService: any StoreKitServiceProtocol
    private let pointsService: any PointsServiceProtocol
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    /// Initialize StoreViewModel
    /// - Parameters:
    ///   - storeKitService: StoreKit service dependency
    ///   - pointsService: Points service dependency
    init(
        storeKitService: (any StoreKitServiceProtocol)? = nil,
        pointsService: (any PointsServiceProtocol)? = nil
    ) {
        self.storeKitService = storeKitService ?? StoreKitService.shared
        self.pointsService = pointsService ?? PointsService.shared

        // Load products on initialization
        Task {
            await loadProducts()
        }

        // Setup bindings
        setupBindings()
    }

    // MARK: - Setup

    /// Setup Combine bindings
    private func setupBindings() {
        // Note: Services don't expose @Published properties via protocols
        // Instead, we manually sync state when loading data
    }

    // MARK: - Public Methods

    /// Load available products
    func loadProducts() async {
        isLoadingProducts = true

        let result = await storeKitService.loadProducts(
            productIds: StoreProductConfiguration.allProductIds
        )

        // Sync state from services
        categorizeProducts(storeKitService.availableProducts)
        subscriptionStatus = storeKitService.subscriptionStatus
        isLoadingProducts = storeKitService.isLoadingProducts

        if case .failure(let error) = result {
            errorMessage = error.errorDescription
        }
    }

    /// Refresh points balance
    func refreshPoints() async {
        let result = await pointsService.refreshPoints()

        // Sync balance from service
        if let balance = pointsService.balance {
            userPoints = balance.totalPoints
        }

        if case .failure(let error) = result {
            errorMessage = error.errorDescription
        }
    }

    /// Check subscription status
    func checkSubscriptionStatus() async {
        let status = await storeKitService.checkSubscriptionStatus()
        subscriptionStatus = status
    }

    /// Select product for purchase
    /// - Parameter product: Product to purchase
    func selectProduct(_ product: StoreProduct) {
        selectedProduct = product

        switch product.type {
        case .subscription:
            showSubscription = true
        case .points:
            showPointsPurchase = true
        }
    }

    /// Clear error message
    func clearError() {
        errorMessage = nil
        storeKitService.clearError()
        pointsService.clearError()
    }

    /// Format points for display
    /// - Parameter points: Points to format
    /// - Returns: Formatted points string
    func formatPoints(_ points: Int) -> String {
        PointsCalculator.formatPoints(points)
    }

    /// Get best value product (most points per currency)
    /// - Returns: Best value points product or nil
    func getBestValueProduct() -> StoreProduct? {
        let pointsProducts = self.pointsProducts.filter { $0.points != nil }
        guard !pointsProducts.isEmpty else { return nil }

        // Calculate points per yuan for each product
        let best = pointsProducts.max { product1, product2 in
            guard let points1 = product1.points,
                  let points2 = product2.points else { return false }

            // Parse price from display price (e.g., "¥6.00")
            let price1 = Double(product1.price.filter { "0123456789.".contains($0) }) ?? 0
            let price2 = Double(product2.price.filter { "0123456789.".contains($0) }) ?? 0

            let value1 = Double(points1) / price1
            let value2 = Double(points2) / price2

            return value1 < value2
        }

        return best
    }

    /// Get popular product (most purchased)
    /// - Returns: Popular points product or nil
    func getPopularProduct() -> StoreProduct? {
        // Return the 500 points package as popular
        return pointsProducts.first { $0.points == 580 }
    }

    /// Check if user has active subscription
    /// - Returns: True if subscribed
    var hasActiveSubscription: Bool {
        subscriptionStatus?.isActive ?? false
    }

    /// Get subscription expiry date
    /// - Returns: Expiry date or nil
    var subscriptionExpiryDate: Date? {
        subscriptionStatus?.expirationDate
    }

    /// Get subscription renewal status
    /// - Returns: True if will auto-renew
    var willAutoRenew: Bool {
        subscriptionStatus?.willAutoRenew ?? false
    }

    // MARK: - Private Methods

    /// Categorize products into points and subscriptions
    /// - Parameter products: All available products
    private func categorizeProducts(_ products: [StoreProduct]) {
        pointsProducts = products.filter { $0.type == .points }
        subscriptionProducts = products.filter { $0.type == .subscription }
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension StoreViewModel {
    /// Create preview view model with sample data
    static var preview: StoreViewModel {
        let vm = StoreViewModel()

        // Add sample products
        vm.pointsProducts = [
            StoreProduct(
                id: StoreProductConfiguration.points100,
                name: "100 Points",
                description: "Starter pack",
                price: "¥6.00",
                priceLocale: Locale(identifier: "zh_CN"),
                type: .points,
                points: 100,
                subscriptionPeriod: nil,
                product: nil
            ),
            StoreProduct(
                id: StoreProductConfiguration.points300,
                name: "330 Points",
                description: "Bonus 30 points",
                price: "¥18.00",
                priceLocale: Locale(identifier: "zh_CN"),
                type: .points,
                points: 330,
                subscriptionPeriod: nil,
                product: nil
            )
        ]

        vm.subscriptionProducts = [
            StoreProduct(
                id: StoreProductConfiguration.monthlySubscription,
                name: "Monthly Premium",
                description: "Access all features",
                price: "¥12.00",
                priceLocale: Locale(identifier: "zh_CN"),
                type: .subscription,
                points: nil,
                subscriptionPeriod: SubscriptionPeriod(value: 1, unit: .month),
                product: nil
            )
        ]

        vm.userPoints = 150

        return vm
    }
}
#endif
