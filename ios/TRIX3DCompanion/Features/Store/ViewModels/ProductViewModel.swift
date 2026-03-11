//
//  ProductViewModel.swift
//  TRIX3DCompanion
//
//  Product Detail ViewModel - manages individual product state
//

import Foundation
import Combine
import StoreKit

// MARK: - Product ViewModel

/// Product detail view model for individual product information and purchase
@MainActor
final class ProductViewModel: ObservableObject {

    // MARK: - Published Properties

    /// Product being viewed
    @Published var product: StoreProduct

    /// Whether currently purchasing
    @Published var isPurchasing: Bool = false

    /// Purchase result state
    @Published var purchaseState: PurchaseState = .idle

    /// Error message to display
    @Published var errorMessage: String?

    /// Whether to show payment result
    @Published var showPaymentResult: Bool = false

    /// Current user points balance for comparison
    @Published var currentPoints: Int = 0

    // MARK: - Dependencies

    private let storeKitService: any StoreKitServiceProtocol
    private let paymentService: any PaymentServiceProtocol
    private let pointsService: any PointsServiceProtocol
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Purchase State

    enum PurchaseState: Equatable {
        case idle
        case purchasing
        case success
        case pending
        case failed
        case cancelled

        static func == (lhs: PurchaseState, rhs: PurchaseState) -> Bool {
            switch (lhs, rhs) {
            case (.idle, .idle),
                 (.purchasing, .purchasing),
                 (.success, .success),
                 (.pending, .pending),
                 (.failed, .failed),
                 (.cancelled, .cancelled):
                return true
            default:
                return false
            }
        }
    }

    // MARK: - Initialization

    /// Initialize ProductViewModel
    /// - Parameters:
    ///   - product: Product to display
    ///   - storeKitService: StoreKit service dependency
    ///   - paymentService: Payment service dependency
    ///   - pointsService: Points service dependency
    init(
        product: StoreProduct,
        storeKitService: (any StoreKitServiceProtocol)? = nil,
        paymentService: (any PaymentServiceProtocol)? = nil,
        pointsService: (any PointsServiceProtocol)? = nil
    ) {
        self.product = product
        self.storeKitService = storeKitService ?? StoreKitService.shared
        self.paymentService = paymentService ?? PaymentService.shared
        self.pointsService = pointsService ?? PointsService.shared

        // Load current points
        Task {
            await loadCurrentPoints()
        }

        // Setup bindings
        setupBindings()
    }

    // MARK: - Setup

    /// Setup Combine bindings
    private func setupBindings() {
        // Note: isPurchasing and balance are private(set) in their respective services
        // So we can't use $isPurchasing and $balance here.
        // The isPurchasing state is managed locally in the purchase() method
        // The currentPoints is loaded via loadCurrentPoints() which is called in init
    }

    // MARK: - Public Methods

    /// Purchase the current product
    func purchase() async {
        purchaseState = .purchasing
        isPurchasing = true
        errorMessage = nil

        switch product.type {
        case .points:
            await purchasePoints()

        case .subscription:
            await purchaseSubscription()
        }
    }

    /// Load current points balance
    func loadCurrentPoints() async {
        if let balance = await pointsService.getBalance() {
            currentPoints = balance.totalPoints
        }
    }

    /// Reset purchase state
    func resetState() {
        purchaseState = .idle
        isPurchasing = false
        errorMessage = nil
        showPaymentResult = false
    }

    /// Clear error message
    func clearError() {
        errorMessage = nil
        storeKitService.clearError()
        paymentService.clearError()
    }

    // MARK: - Product Information

    /// Get product display name
    var displayName: String {
        product.name
    }

    /// Get product description
    var productDescription: String {
        product.description
    }

    /// Get product price
    var productPrice: String {
        product.price
    }

    /// Get product type
    var productType: ProductType {
        product.type
    }

    /// Get points value if applicable
    var pointsValue: Int? {
        product.points
    }

    /// Get subscription period if applicable
    var subscriptionPeriod: SubscriptionPeriod? {
        product.subscriptionPeriod
    }

    /// Check if product is on sale (has bonus points)
    var isOnSale: Bool {
        guard product.type == .points,
              product.points != nil else { return false }

        // Check if bonus points are included
        switch product.id {
        case StoreProductConfiguration.points300,
             StoreProductConfiguration.points500,
             StoreProductConfiguration.points1000:
            return true
        default:
            return false
        }
    }

    /// Get bonus points amount
    var bonusPoints: Int? {
        guard isOnSale, product.points != nil else { return nil }

        switch product.id {
        case StoreProductConfiguration.points300:
            return 30
        case StoreProductConfiguration.points500:
            return 80
        case StoreProductConfiguration.points1000:
            return 200
        default:
            return nil
        }
    }

    /// Calculate value per yuan
    var valuePerYuan: Double? {
        guard let points = product.points else { return nil }

        // Parse price from display price (e.g., "¥6.00")
        let priceString = product.price.filter { "0123456789.".contains($0) }
        guard let price = Double(priceString), price > 0 else { return nil }

        return Double(points) / price
    }

    /// Get best value indicator
    var isBestValue: Bool {
        // This would be calculated by comparing with other products
        // For now, mark 1000 points package as best value
        product.id == StoreProductConfiguration.points1000
    }

    // MARK: - Private Methods

    /// Purchase points product
    private func purchasePoints() async {
        guard let points = product.points else {
            purchaseState = .failed
            errorMessage = "Invalid product configuration"
            return
        }

        let result = await paymentService.purchasePoints(
            productId: product.id,
            points: points
        )

        handlePaymentResult(result)
    }

    /// Purchase subscription product
    private func purchaseSubscription() async {
        let result = await paymentService.subscribe(productId: product.id)

        handlePaymentResult(result)
    }

    /// Handle payment result
    /// - Parameter result: Payment result
    private func handlePaymentResult(_ result: PaymentResult) {
        switch result {
        case .success:
            purchaseState = .success
            showPaymentResult = true

        case .pending:
            purchaseState = .pending
            showPaymentResult = true

        case .failed(let error):
            purchaseState = .failed
            errorMessage = error.errorDescription

        case .cancelled:
            purchaseState = .cancelled
        }

        isPurchasing = false
    }
}

// MARK: - Product Information Helpers

extension ProductViewModel {

    /// Get features list for the product
    var features: [String] {
        switch product.type {
        case .points:
            return pointsFeatures

        case .subscription:
            return subscriptionFeatures
        }
    }

    private var pointsFeatures: [String] {
        var features: [String] = []

        if let points = product.points {
            features.append("\(points) Points")
        }

        if let bonus = bonusPoints {
            features.append("Bonus +\(bonus) Points")
        }

        features.append("Instant Delivery")
        features.append("No Expiration")

        return features
    }

    private var subscriptionFeatures: [String] {
        return [
            "Unlimited Access",
            "Premium Features",
            "Ad-Free Experience",
            "Priority Support",
            "Exclusive Content"
        ]
    }

    /// Get benefit description
    var benefitDescription: String {
        switch product.type {
        case .points:
            if let bonus = bonusPoints {
                return "Get \(bonus) bonus points with this pack!"
            }
            return "Purchase points to unlock premium features"

        case .subscription:
            return "Subscribe for unlimited access to all features"
        }
    }

    /// Get warning text if applicable
    var warningText: String? {
        switch product.type {
        case .points:
            return nil

        case .subscription:
            return "Subscription auto-renews unless cancelled. Manage in Settings."
        }
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension ProductViewModel {
    /// Create preview view model
    static func preview(product: StoreProduct) -> ProductViewModel {
        ProductViewModel(product: product)
    }

    /// Create mock product for preview
    static func mockPointsProduct() -> StoreProduct {
        StoreProduct(
            id: StoreProductConfiguration.points500,
            name: "580 Points Pack",
            description: "Best value for regular users",
            price: "¥28.00",
            priceLocale: Locale(identifier: "zh_CN"),
            type: .points,
            points: 580,
            subscriptionPeriod: nil,
            product: Product.mock(id: StoreProductConfiguration.points500)
        )
    }

    /// Create mock subscription for preview
    static func mockSubscriptionProduct() -> StoreProduct {
        StoreProduct(
            id: StoreProductConfiguration.monthlySubscription,
            name: "Monthly Premium",
            description: "Full access for one month",
            price: "¥12.00",
            priceLocale: Locale(identifier: "zh_CN"),
            type: .subscription,
            points: nil,
            subscriptionPeriod: SubscriptionPeriod(value: 1, unit: .month),
            product: Product.mock(id: StoreProductConfiguration.monthlySubscription)
        )
    }
}
#endif
