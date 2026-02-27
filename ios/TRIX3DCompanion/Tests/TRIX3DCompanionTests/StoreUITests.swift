//
//  StoreUITests.swift
//  TRIX3DCompanionTests
//
//  UI tests for Store purchase flow
//  Tests: Open Store, Display Products, Select Product, Purchase Confirmation, Handle Purchase Result, Order History
//

import XCTest
import SwiftUI
import Combine
@testable import TRIX3DCompanion

// MARK: - Accessibility Identifiers

/// Accessibility identifiers for Store UI testing
enum StoreAccessibilityIdentifiers {
    // Store View
    static let storeView = "storeView"
    static let pointsBalanceCard = "pointsBalanceCard"
    static let pointsTab = "pointsTab"
    static let subscriptionTab = "subscriptionTab"
    static let productList = "productList"

    // Product Card
    static func productCard(productId: String) -> String {
        "productCard-\(productId)"
    }

    // Product Detail View
    static let productDetailView = "productDetailView"
    static let productName = "productName"
    static let productPrice = "productPrice"
    static let productDescription = "productDescription"
    static let purchaseButton = "purchaseButton"
    static let closeButton = "closeButton"

    // Payment Result View
    static let paymentResultView = "paymentResultView"
    static let successIcon = "successIcon"
    static let failureIcon = "failureIcon"
    static let statusTitle = "statusTitle"
    static let doneButton = "doneButton"
    static let tryAgainButton = "tryAgainButton"

    // Order History
    static let orderHistoryView = "orderHistoryView"
    static let orderList = "orderList"
    static func orderItem(orderId: String) -> String {
        "orderItem-\(orderId)"
    }

    // Loading and Error States
    static let loadingOverlay = "loadingOverlay"
    static let errorAlert = "errorAlert"
    static let errorMessage = "errorMessage"
}

// MARK: - Mock Store Service

/// Mock StoreKit service for UI testing
@MainActor
final class MockStoreKitServiceForUI: StoreKitServiceProtocol, ObservableObject {

    @Published var availableProducts: [StoreProduct] = []
    @Published var isLoadingProducts: Bool = false
    @Published var subscriptionStatus: SubscriptionStatus?
    @Published var isPurchasing: Bool = false
    @Published var lastError: StoreKitError?

    // Test configuration
    var shouldSucceedLoadProducts = true
    var shouldSucceedPurchase = true
    var shouldSimulatePending = false
    var mockPurchaseDelay: UInt64 = 500_000_000 // 0.5 seconds

    // Call tracking
    var loadProductsCallCount = 0
    var purchaseCallCount = 0

    func loadProducts(productIds: [String]) async -> Result<Void, StoreKitError> {
        loadProductsCallCount += 1
        isLoadingProducts = true

        guard shouldSucceedLoadProducts else {
            isLoadingProducts = false
            lastError = .configurationError
            return .failure(.configurationError)
        }

        // Simulate network delay
        try? await Task.sleep(nanoseconds: 300_000_000)

        // Create mock products
        availableProducts = productIds.compactMap { productId -> StoreProduct? in
            guard let productType = StoreProductConfiguration.productType(for: productId) else {
                return nil
            }

            let points = StoreProductConfiguration.pointsForProduct(productId)
            let name: String
            let description: String
            let price: String

            switch productId {
            case StoreProductConfiguration.points100:
                name = "100 Points"
                description = "Starter pack"
                price = "¥6.00"
            case StoreProductConfiguration.points300:
                name = "330 Points"
                description = "Bonus 30 points"
                price = "¥18.00"
            case StoreProductConfiguration.points500:
                name = "580 Points"
                description = "Best value"
                price = "¥28.00"
            case StoreProductConfiguration.points1000:
                name = "1200 Points"
                description = "Maximum value"
                price = "¥50.00"
            case StoreProductConfiguration.monthlySubscription:
                name = "Monthly Premium"
                description = "Full access for one month"
                price = "¥12.00"
            case StoreProductConfiguration.yearlySubscription:
                name = "Yearly Premium"
                description = "Full access for one year"
                price = "¥120.00"
            default:
                return nil
            }

            return StoreProduct(
                id: productId,
                name: name,
                description: description,
                price: price,
                priceLocale: Locale(identifier: "zh_CN"),
                type: productType,
                points: points,
                subscriptionPeriod: productType == .subscription ? SubscriptionPeriod(value: 1, unit: .month) : nil,
                product: MockProductForUI()
            )
        }

        isLoadingProducts = false
        return .success(())
    }

    func purchase(product productId: String) async -> PurchaseResult {
        purchaseCallCount += 1
        isPurchasing = true

        guard shouldSucceedPurchase else {
            isPurchasing = false
            lastError = .productNotFound
            return .failed(error: .productNotFound)
        }

        if shouldSimulatePending {
            isPurchasing = false
            return .pending
        }

        // Simulate purchase delay
        try? await Task.sleep(nanoseconds: mockPurchaseDelay)

        isPurchasing = false

        // Create mock transaction
        let transaction = MockTransactionForUI(productID: productId)
        return .success(transaction: transaction)
    }

    func restorePurchases() async -> Result<[TransactionInfo], StoreKitError> {
        return .success([])
    }

    func checkSubscriptionStatus() async -> SubscriptionStatus? {
        return subscriptionStatus
    }

    func getTransactionHistory() async -> [TransactionInfo] {
        return []
    }

    func getReceiptData() async -> String? {
        return nil
    }

    func getLatestTransactionId(for productId: String) async -> String? {
        return nil
    }

    func getTransactionInfo(transactionId: String) async -> TransactionInfo? {
        return nil
    }

    func prepareVerificationPayload(transaction: Transaction, productId: String) -> [String: Any]? {
        return nil
    }

    func clearError() {
        lastError = nil
    }
}

// MARK: - Mock Product

final class MockProductForUI: Product {
    override var id: String { "mock.product" }
    override var displayName: String { "Mock Product" }
    override var description: String { "Mock Description" }
    override var displayPrice: String { "¥6.00" }
    override var priceFormatStyle: Style { Style() }
    override var type: ProductType { .points }
    override var subscriptionPeriod: Product.SubscriptionPeriod? { nil }
}

// MARK: - Mock Transaction

final class MockTransactionForUI: Transaction {
    let mockProductID: String
    let mockID: UInt64 = 123456789
    let mockPurchaseDate: Date = Date()

    init(productID: String) {
        self.mockProductID = productID
    }

    override var productID: String { mockProductID }
    override var id: UInt64 { mockID }
    override var purchaseDate: Date { mockPurchaseDate }
    override var expirationDate: Date? { nil }
    override var quantity: Int { 1 }
    override var revocationDate: Date? { nil }
    override var originalID: UInt64 { mockID }
}

// MARK: - Mock Points Service

@MainActor
final class MockPointsServiceForUI: PointsServiceProtocol, ObservableObject {

    @Published var balance: PointsBalance?
    @Published var transactions: [PointsTransactionDetail] = []
    @Published var isLoading: Bool = false
    @Published var isSyncing: Bool = false
    @Published var lastError: PointsError?

    // Test configuration
    var shouldSucceed = true
    var mockPoints: Int = 0

    func refreshPoints() async -> Result<PointsBalance, PointsError> {
        isLoading = true
        isSyncing = true

        guard shouldSucceed else {
            isLoading = false
            isSyncing = false
            lastError = .networkError
            return .failure(.networkError)
        }

        // Simulate network delay
        try? await Task.sleep(nanoseconds: 200_000_000)

        let newBalance = PointsBalance(
            totalPoints: mockPoints,
            availablePoints: mockPoints,
            pendingPoints: 0,
            level: mockPoints / 1000, // Simple level calculation
            todayEarned: 0,
            weekEarned: 0,
            totalTransactions: 0,
            updatedAt: Date()
        )

        balance = newBalance
        isLoading = false
        isSyncing = false
        return .success(newBalance)
    }

    func getBalance() async -> PointsBalance? {
        return balance
    }

    func loadHistory(filter: PointsHistoryFilter?) async -> Result<[PointsTransactionDetail], PointsError> {
        return .success(transactions)
    }

    func addPoints(_ points: Int, description: String, metadata: [String: String]?) async -> PointsResult {
        mockPoints += points
        let newBalance = PointsBalance(
            totalPoints: mockPoints,
            availablePoints: mockPoints,
            pendingPoints: 0,
            level: mockPoints / 1000,
            todayEarned: 0,
            weekEarned: 0,
            totalTransactions: 0,
            updatedAt: Date()
        )
        balance = newBalance
        return .success(balance: newBalance)
    }

    func deductPoints(_ points: Int, description: String, metadata: [String: String]?) async -> PointsResult {
        guard mockPoints >= points else {
            return .insufficientBalance
        }
        mockPoints -= points
        let newBalance = PointsBalance(
            totalPoints: mockPoints,
            availablePoints: mockPoints,
            pendingPoints: 0,
            level: mockPoints / 1000,
            todayEarned: 0,
            weekEarned: 0,
            totalTransactions: 0,
            updatedAt: Date()
        )
        balance = newBalance
        return .success(balance: newBalance)
    }

    func syncWithServer() async -> Result<Void, PointsError> {
        return .success(())
    }

    func clearError() {
        lastError = nil
    }
}

// MARK: - Mock Payment Service

@MainActor
final class MockPaymentServiceForUI: PaymentServiceProtocol, ObservableObject {

    @Published var isProcessing: Bool = false
    @Published var pendingOrders: [Order] = []
    @Published var completedOrders: [Order] = []
    @Published var lastError: PaymentError?

    // Test configuration
    var shouldSucceed = true
    var shouldSimulatePending = false
    var mockOrders: [Order] = []

    func purchasePoints(productId: String, points: Int) async -> PaymentResult {
        isProcessing = true

        // Simulate processing delay
        try? await Task.sleep(nanoseconds: 500_000_000)

        if shouldSimulatePending {
            let order = Order(
                id: UUID().uuidString,
                userId: "test-user",
                productId: productId,
                productType: .points,
                amount: 6.0,
                currency: "CNY",
                status: .pending,
                paymentMethod: .applePay,
                transactionId: nil,
                points: points,
                createdAt: Date(),
                updatedAt: Date()
            )
            isProcessing = false
            pendingOrders.append(order)
            return .pending(order: order)
        }

        guard shouldSucceed else {
            isProcessing = false
            lastError = .paymentFailed(underlying: nil)
            return .failed(error: .paymentFailed(underlying: nil))
        }

        let order = Order(
            id: UUID().uuidString,
            userId: "test-user",
            productId: productId,
            productType: .points,
            amount: 6.0,
            currency: "CNY",
            status: .completed,
            paymentMethod: .applePay,
            transactionId: "txn_\(UUID().uuidString.prefix(8))",
            points: points,
            createdAt: Date(),
            updatedAt: Date()
        )

        isProcessing = false
        completedOrders.insert(order, at: 0)
        return .success(order: order)
    }

    func subscribe(productId: String) async -> PaymentResult {
        isProcessing = true

        // Simulate processing delay
        try? await Task.sleep(nanoseconds: 500_000_000)

        let order = Order(
            id: UUID().uuidString,
            userId: "test-user",
            productId: productId,
            productType: .subscription,
            amount: 12.0,
            currency: "CNY",
            status: .completed,
            paymentMethod: .applePay,
            transactionId: "txn_\(UUID().uuidString.prefix(8))",
            points: nil,
            createdAt: Date(),
            updatedAt: Date()
        )

        isProcessing = false
        completedOrders.insert(order, at: 0)
        return .success(order: order)
    }

    func getOrder(orderId: String) async -> Order? {
        return mockOrders.first { $0.id == orderId }
    }

    func getOrderHistory(limit: Int, offset: Int) async -> [Order] {
        return Array(mockOrders.prefix(limit).dropFirst(offset))
    }

    func cancelOrder(orderId: String) async -> Result<Void, PaymentError> {
        return .success(())
    }

    func verifyReceipt(
        transactionId: String,
        productId: String,
        receiptData: String?
    ) async -> Result<Order, PaymentError> {
        guard let order = mockOrders.first else {
            return .failure(.orderNotFound)
        }
        return .success(order)
    }

    func clearError() {
        lastError = nil
    }
}

// MARK: - Store UI Tests

@MainActor
final class StoreUITests: XCTestCase {

    // MARK: - Properties

    var mockStoreKitService: MockStoreKitServiceForUI!
    var mockPointsService: MockPointsServiceForUI!
    var mockPaymentService: MockPaymentServiceForUI!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUp() {
        super.setUp()
        mockStoreKitService = MockStoreKitServiceForUI()
        mockPointsService = MockPointsServiceForUI()
        mockPaymentService = MockPaymentServiceForUI()
        cancellables = Set<AnyCancellable>()
    }

    override func tearDown() {
        mockStoreKitService = nil
        mockPointsService = nil
        mockPaymentService = nil
        cancellables = nil
        super.tearDown()
    }

    // MARK: - Test 1: Open Store View

    func testOpenStoreView_DisplaysStoreInterface() async {
        // Given
        let storeViewModel = createStoreViewModel()

        // When
        let productsLoaded = await loadProducts(for: storeViewModel)

        // Then
        XCTAssertTrue(productsLoaded, "Store view should display after loading")
        XCTAssertFalse(storeViewModel.pointsProducts.isEmpty, "Points products should be loaded")
    }

    // MARK: - Test 2: Display Product List

    func testDisplayProductList_ShowsAllProducts() async {
        // Given
        let storeViewModel = createStoreViewModel()

        // When
        _ = await loadProducts(for: storeViewModel)

        // Then
        XCTAssertEqual(storeViewModel.pointsProducts.count, 4, "Should display 4 points products")
        XCTAssertEqual(storeViewModel.subscriptionProducts.count, 2, "Should display 2 subscription products")

        // Verify product details
        let firstProduct = storeViewModel.pointsProducts.first
        XCTAssertNotNil(firstProduct)
        XCTAssertEqual(firstProduct?.type, .points)
    }

    // MARK: - Test 3: Select Product

    func testSelectProduct_NavigatesToProductDetail() async {
        // Given
        let storeViewModel = createStoreViewModel()
        _ = await loadProducts(for: storeViewModel)

        guard let product = storeViewModel.pointsProducts.first else {
            XCTFail("No products available")
            return
        }

        // When
        storeViewModel.selectProduct(product)

        // Then
        XCTAssertNotNil(storeViewModel.selectedProduct, "Selected product should not be nil")
        XCTAssertEqual(storeViewModel.selectedProduct?.id, product.id)
    }

    // MARK: - Test 4: Purchase Confirmation

    func testPurchaseConfirmation_ShowsConfirmationDialog() async {
        // Given
        let product = createMockProduct()
        let productViewModel = ProductViewModel(
            product: product,
            storeKitService: mockStoreKitService,
            paymentService: mockPaymentService,
            pointsService: mockPointsService
        )

        // When - Start purchase
        mockStoreKitService.shouldSucceedPurchase = true
        mockPaymentService.shouldSucceed = true

        // Then - Verify initial state
        XCTAssertEqual(productViewModel.purchaseState, .idle)
        XCTAssertFalse(productViewModel.isPurchasing)
    }

    // MARK: - Test 5: Handle Purchase Result - Success

    func testPurchaseResult_Success_ShowsSuccessView() async {
        // Given
        let product = createMockProduct()
        let productViewModel = ProductViewModel(
            product: product,
            storeKitService: mockStoreKitService,
            paymentService: mockPaymentService,
            pointsService: mockPointsService
        )

        // Configure mocks for success
        mockPaymentService.shouldSucceed = true

        // When
        await productViewModel.purchase()

        // Then
        XCTAssertEqual(productViewModel.purchaseState, .success)
        XCTAssertTrue(productViewModel.showPaymentResult)
    }

    // MARK: - Test 6: Handle Purchase Result - Failure

    func testPurchaseResult_Failure_ShowsErrorMessage() async {
        // Given
        let product = createMockProduct()
        let productViewModel = ProductViewModel(
            product: product,
            storeKitService: mockStoreKitService,
            paymentService: mockPaymentService,
            pointsService: mockPointsService
        )

        // Configure mocks for failure
        mockPaymentService.shouldSucceed = false

        // When
        await productViewModel.purchase()

        // Then
        XCTAssertEqual(productViewModel.purchaseState, .failed)
        XCTAssertNotNil(productViewModel.errorMessage)
    }

    // MARK: - Test 7: Handle Purchase Result - Pending

    func testPurchaseResult_Pending_ShowsPendingState() async {
        // Given
        let product = createMockProduct()
        let productViewModel = ProductViewModel(
            product: product,
            storeKitService: mockStoreKitService,
            paymentService: mockPaymentService,
            pointsService: mockPointsService
        )

        // Configure mocks for pending
        mockPaymentService.shouldSimulatePending = true

        // When
        await productViewModel.purchase()

        // Then
        XCTAssertEqual(productViewModel.purchaseState, .pending)
    }

    // MARK: - Test 8: Order History - Display

    func testOrderHistory_DisplaysPastOrders() async {
        // Given
        let paymentViewModel = PaymentViewModel(
            paymentService: mockPaymentService,
            storeKitService: mockStoreKitService,
            pointsService: mockPointsService
        )

        // Add mock orders
        let mockOrders = [
            createMockOrder(productId: StoreProductConfiguration.points100, points: 100),
            createMockOrder(productId: StoreProductConfiguration.points500, points: 580)
        ]
        mockPaymentService.mockOrders = mockOrders

        // When
        await paymentViewModel.loadOrderHistory()

        // Then
        XCTAssertEqual(paymentViewModel.orderHistory.count, 2, "Should display 2 orders")
    }

    // MARK: - Test 9: Order History - Empty State

    func testOrderHistory_Empty_ShowsEmptyMessage() async {
        // Given
        let paymentViewModel = PaymentViewModel(
            paymentService: mockPaymentService,
            storeKitService: mockStoreKitService,
            pointsService: mockPointsService
        )

        // No mock orders
        mockPaymentService.mockOrders = []

        // When
        await paymentViewModel.loadOrderHistory()

        // Then
        XCTAssertTrue(paymentViewModel.orderHistory.isEmpty, "Should show empty state")
    }

    // MARK: - Test 10: Loading State During Purchase

    func testPurchase_ShowsLoadingState() async {
        // Given
        let product = createMockProduct()
        let productViewModel = ProductViewModel(
            product: product,
            storeKitService: mockStoreKitService,
            paymentService: mockPaymentService,
            pointsService: mockPointsService
        )

        // Configure slow purchase
        mockPaymentService.shouldSucceed = true

        // When - Start purchase (but don't await)
        let purchaseTask = Task {
            await productViewModel.purchase()
        }

        // Wait a bit for the purchase to start
        try? await Task.sleep(nanoseconds: 100_000_000)

        // Then - Check loading state
        XCTAssertTrue(productViewModel.isPurchasing || productViewModel.purchaseState == .purchasing,
                      "Should show loading state during purchase")

        // Wait for completion
        await purchaseTask.value
    }

    // MARK: - Test 11: Cancel Purchase

    func testPurchase_Cancel_ResetsState() async {
        // Given
        let product = createMockProduct()
        let productViewModel = ProductViewModel(
            product: product,
            storeKitService: mockStoreKitService,
            paymentService: mockPaymentService,
            pointsService: mockPointsService
        )

        // When
        productViewModel.resetState()

        // Then
        XCTAssertEqual(productViewModel.purchaseState, .idle)
        XCTAssertFalse(productViewModel.isPurchasing)
        XCTAssertFalse(productViewModel.showPaymentResult)
    }

    // MARK: - Test 12: Error Handling

    func testError_ClearsProperly() async {
        // Given
        let product = createMockProduct()
        let productViewModel = ProductViewModel(
            product: product,
            storeKitService: mockStoreKitService,
            paymentService: mockPaymentService,
            pointsService: mockPointsService
        )

        // Configure failure
        mockPaymentService.shouldSucceed = false
        _ = await productViewModel.purchase()

        // When
        productViewModel.clearError()

        // Then
        XCTAssertNil(productViewModel.errorMessage)
    }

    // MARK: - Test 13: Product Type Differentiation

    func testProductTypes_PointsAndSubscription_DisplayedCorrectly() async {
        // Given
        let storeViewModel = createStoreViewModel()

        // When
        _ = await loadProducts(for: storeViewModel)

        // Then
        let pointsProducts = storeViewModel.pointsProducts
        let subscriptionProducts = storeViewModel.subscriptionProducts

        // All points products should have points value
        for product in pointsProducts {
            XCTAssertNotNil(product.points, "Points product should have points value")
            XCTAssertEqual(product.type, .points)
        }

        // All subscription products should have subscription period
        for product in subscriptionProducts {
            XCTAssertNotNil(product.subscriptionPeriod, "Subscription product should have period")
            XCTAssertEqual(product.type, .subscription)
        }
    }

    // MARK: - Test 14: Subscription Status Display

    func testSubscriptionStatus_ActiveSubscription_DisplaysCorrectly() async {
        // Given
        let storeViewModel = createStoreViewModel()

        // Configure active subscription
        let activeStatus = SubscriptionStatus(
            state: .subscribed,
            renewalInfo: nil,
            expirationDate: Date().addingTimeInterval(86400 * 30),
            willAutoRenew: true
        )
        mockStoreKitService.subscriptionStatus = activeStatus

        // When
        await storeViewModel.checkSubscriptionStatus()

        // Then
        XCTAssertTrue(storeViewModel.hasActiveSubscription)
        XCTAssertNotNil(storeViewModel.subscriptionExpiryDate)
        XCTAssertTrue(storeViewModel.willAutoRenew)
    }

    // MARK: - Test 15: Subscription Status - Expired

    func testSubscriptionStatus_ExpiredSubscription_DisplaysCorrectly() async {
        // Given
        let storeViewModel = createStoreViewModel()

        // Configure expired subscription
        let expiredStatus = SubscriptionStatus(
            state: .expired,
            renewalInfo: nil,
            expirationDate: Date().addingTimeInterval(-86400),
            willAutoRenew: false
        )
        mockStoreKitService.subscriptionStatus = expiredStatus

        // When
        await storeViewModel.checkSubscriptionStatus()

        // Then
        XCTAssertFalse(storeViewModel.hasActiveSubscription)
    }

    // MARK: - Helper Methods

    private func createStoreViewModel() -> StoreViewModel {
        let vm = StoreViewModel(
            storeKitService: mockStoreKitService,
            pointsService: mockPointsService
        )
        return vm
    }

    private func loadProducts(for viewModel: StoreViewModel) async -> Bool {
        await viewModel.loadProducts()
        // Wait for products to be categorized
        try? await Task.sleep(nanoseconds: 100_000_000)
        return !viewModel.pointsProducts.isEmpty || !viewModel.subscriptionProducts.isEmpty
    }

    private func createMockProduct() -> StoreProduct {
        StoreProduct(
            id: StoreProductConfiguration.points100,
            name: "100 Points",
            description: "Starter pack",
            price: "¥6.00",
            priceLocale: Locale(identifier: "zh_CN"),
            type: .points,
            points: 100,
            subscriptionPeriod: nil,
            product: MockProductForUI()
        )
    }

    private func createMockOrder(productId: String, points: Int) -> Order {
        Order(
            id: UUID().uuidString,
            userId: "test-user",
            productId: productId,
            productType: .points,
            amount: 6.0,
            currency: "CNY",
            status: .completed,
            paymentMethod: .applePay,
            transactionId: "txn_\(UUID().uuidString.prefix(8))",
            points: points,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}

// MARK: - View Model Helper Extension

#if DEBUG
extension StoreViewModel {
    /// Create preview view model with mock services
    static func createForTesting(
        storeKitService: StoreKitServiceProtocol = MockStoreKitServiceForUI(),
        pointsService: PointsServiceProtocol = MockPointsServiceForUI()
    ) -> StoreViewModel {
        StoreViewModel(
            storeKitService: storeKitService,
            pointsService: pointsService
        )
    }
}
#endif
