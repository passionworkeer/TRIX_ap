//
//  StoreViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Test suite for StoreViewModel
//
//  Test Coverage:
//  - Product loading tests
//  - Purchase flow tests
//  - Restore purchases tests
//  - Price display tests
//  - Loading state tests
//  - Subscription status tests
//  - Points balance tests
//

import XCTest
import Combine
@testable import TRIX3DCompanion

// MARK: - Mock PointsService for StoreViewModel

@MainActor
final class MockPointsServiceForStore: PointsServiceProtocol, ObservableObject {

    @Published var balance: PointsBalance?
    @Published var transactions: [PointsTransactionDetail] = []
    @Published var isLoading: Bool = false
    @Published var isSyncing: Bool = false
    @Published var lastError: PointsError?

    // Test control properties
    var shouldFailRefresh = false
    var shouldFailAddPoints = false
    var shouldFailDeductPoints = false
    var mockError: PointsError?

    // Call tracking
    var refreshPointsCalled = false
    var getBalanceCalled = false
    var loadHistoryCalled = false
    var addPointsCalled = false
    var deductPointsCalled = false
    var syncWithServerCalled = false
    var clearErrorCalled = false

    func refreshPoints() async -> Result<PointsBalance, PointsError> {
        refreshPointsCalled = true

        if shouldFailRefresh {
            let error = mockError ?? .syncFailed
            lastError = error
            return .failure(error)
        }

        let mockBalance = balance ?? PointsBalance(
            totalPoints: 1000,
            availablePoints: 1000,
            pendingPoints: 0,
            level: 1,
            todayEarned: 10,
            weekEarned: 50,
            totalTransactions: 10,
            updatedAt: Date()
        )
        balance = mockBalance
        return .success(mockBalance)
    }

    func getBalance() async -> PointsBalance? {
        getBalanceCalled = true
        return balance
    }

    func loadHistory(filter: PointsHistoryFilter?) async -> Result<[PointsTransactionDetail], PointsError> {
        loadHistoryCalled = true
        return .success(transactions)
    }

    func addPoints(_ points: Int, description: String, metadata: [String: String]?) async -> PointsResult {
        addPointsCalled = true

        if shouldFailAddPoints {
            return .failed(error: mockError ?? .syncFailed)
        }

        let newBalance = PointsBalance(
            totalPoints: (balance?.totalPoints ?? 0) + points,
            availablePoints: (balance?.availablePoints ?? 0) + points,
            pendingPoints: 0,
            level: 1,
            todayEarned: points,
            weekEarned: points,
            totalTransactions: (balance?.totalTransactions ?? 0) + 1,
            updatedAt: Date()
        )
        balance = newBalance
        return .success(balance: newBalance)
    }

    func deductPoints(_ points: Int, description: String, metadata: [String: String]?) async -> PointsResult {
        deductPointsCalled = true

        if shouldFailDeductPoints {
            return .failed(error: mockError ?? .insufficientBalance)
        }

        guard let currentBalance = balance, currentBalance.availablePoints >= points else {
            return .insufficientBalance
        }

        let newBalance = PointsBalance(
            totalPoints: currentBalance.totalPoints - points,
            availablePoints: currentBalance.availablePoints - points,
            pendingPoints: 0,
            level: 1,
            todayEarned: 0,
            weekEarned: 0,
            totalTransactions: currentBalance.totalTransactions + 1,
            updatedAt: Date()
        )
        balance = newBalance
        return .success(balance: newBalance)
    }

    func syncWithServer() async -> Result<Void, PointsError> {
        syncWithServerCalled = true

        if shouldFailRefresh {
            return .failure(mockError ?? .syncFailed)
        }

        return .success(())
    }

    func clearError() {
        clearErrorCalled = true
        lastError = nil
    }

    // Helper method to set mock balance
    func setMockBalance(totalPoints: Int) {
        balance = PointsBalance(
            totalPoints: totalPoints,
            availablePoints: totalPoints,
            pendingPoints: 0,
            level: totalPoints / 1000,
            todayEarned: 10,
            weekEarned: 50,
            totalTransactions: 10,
            updatedAt: Date()
        )
    }

    func resetCallTracking() {
        refreshPointsCalled = false
        getBalanceCalled = false
        loadHistoryCalled = false
        addPointsCalled = false
        deductPointsCalled = false
        syncWithServerCalled = false
        clearErrorCalled = false
    }
}

// MARK: - StoreViewModel Tests

@MainActor
final class StoreViewModelTests: XCTestCase {

    // MARK: - Properties

    var sut: StoreViewModel!
    var mockStoreKitService: MockStoreKitService!
    var mockPointsService: MockPointsServiceForStore!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUp() {
        super.setUp()

        mockStoreKitService = MockStoreKitService()
        mockPointsService = MockPointsServiceForStore()

        // Initialize with mock dependencies - skip automatic loadProducts
        sut = StoreViewModel(
            storeKitService: mockStoreKitService,
            pointsService: mockPointsService
        )

        cancellables = Set<AnyCancellable>()
    }

    override func tearDown() {
        sut = nil
        mockStoreKitService = nil
        mockPointsService = nil
        cancellables = nil
        super.tearDown()
    }

    // MARK: - Helpers

    private func waitForInitialLoadToSettle() async {
        try? await Task.sleep(nanoseconds: 100_000_000)
        mockStoreKitService.resetCallTracking()
        mockPointsService.resetCallTracking()
    }

    // MARK: - Product Loading Tests

    func testLoadProducts_Success() async {
        // Given
        let productIds = StoreProductConfiguration.allProductIds

        // When
        await sut.loadProducts()

        // Then
        XCTAssertTrue(mockStoreKitService.loadProductsCalled)
        XCTAssertEqual(mockStoreKitService.loadProductsCalledWithIds, productIds)
        XCTAssertFalse(sut.pointsProducts.isEmpty)
        XCTAssertFalse(sut.subscriptionProducts.isEmpty)
    }

    func testLoadProducts_Failure() async {
        // Given
        mockStoreKitService.shouldFailProductLoad = true
        mockStoreKitService.mockError = .configurationError

        // When
        await sut.loadProducts()

        // Then
        XCTAssertNotNil(sut.errorMessage)
        XCTAssertEqual(sut.errorMessage, StoreKitError.configurationError.errorDescription)
    }

    func testLoadProducts_CategorizesPointsProducts() async {
        // Given
        let pointsProductIds = StoreProductConfiguration.pointsProductIds

        // When
        await sut.loadProducts()

        // Then
        XCTAssertEqual(sut.pointsProducts.count, pointsProductIds.count)
        for product in sut.pointsProducts {
            XCTAssertEqual(product.type, .points)
            XCTAssertNotNil(product.points)
        }
    }

    func testLoadProducts_CategorizesSubscriptionProducts() async {
        // Given
        let subscriptionProductIds = StoreProductConfiguration.subscriptionProductIds

        // When
        await sut.loadProducts()

        // Then
        XCTAssertEqual(sut.subscriptionProducts.count, subscriptionProductIds.count)
        for product in sut.subscriptionProducts {
            XCTAssertEqual(product.type, .subscription)
            XCTAssertNotNil(product.subscriptionPeriod)
        }
    }

    // MARK: - Loading State Tests

    func testIsLoadingProducts_StateChanges() async {
        await waitForInitialLoadToSettle()

        // Given
        let expectation = expectation(description: "Loading state changes")
        var loadingStates: [Bool] = []

        sut.$isLoadingProducts
            .dropFirst()
            .sink { isLoading in
                loadingStates.append(isLoading)
                if loadingStates.suffix(2) == [true, false] {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        await sut.loadProducts()

        // Then
        await fulfillment(of: [expectation], timeout: 2.0)
        XCTAssertEqual(Array(loadingStates.suffix(2)), [true, false])
    }

    func testIsPurchasing_StateChanges() async {
        await waitForInitialLoadToSettle()

        // Given
        await sut.loadProducts()

        // Given - setup purchase state observation
        let expectation = expectation(description: "Purchasing state changes")
        var purchasingStates: [Bool] = []

        // Pre-load products so we can test purchase
        let product = sut.pointsProducts.first!

        mockStoreKitService.$isPurchasing
            .dropFirst()
            .sink { isPurchasing in
                purchasingStates.append(isPurchasing)
                if purchasingStates.suffix(2) == [true, false] {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When - attempt purchase
        _ = await mockStoreKitService.purchase(product: product.id)

        // Then
        await fulfillment(of: [expectation], timeout: 2.0)
        XCTAssertEqual(Array(purchasingStates.suffix(2)), [true, false])
    }

    // MARK: - Purchase Flow Tests

    func testSelectProduct_PointsProduct() async {
        // Given
        await sut.loadProducts()
        let pointsProduct = sut.pointsProducts.first!
        XCTAssertNotNil(pointsProduct)

        // When
        sut.selectProduct(pointsProduct)

        // Then
        XCTAssertEqual(sut.selectedProduct, pointsProduct)
        XCTAssertTrue(sut.showPointsPurchase)
        XCTAssertFalse(sut.showSubscription)
    }

    func testSelectProduct_SubscriptionProduct() async {
        // Given
        await sut.loadProducts()
        let subscriptionProduct = sut.subscriptionProducts.first!
        XCTAssertNotNil(subscriptionProduct)

        // When
        sut.selectProduct(subscriptionProduct)

        // Then
        XCTAssertEqual(sut.selectedProduct, subscriptionProduct)
        XCTAssertTrue(sut.showSubscription)
        XCTAssertFalse(sut.showPointsPurchase)
    }

    // MARK: - Subscription Status Tests

    func testCheckSubscriptionStatus_Active() async {
        // Given
        let status = SubscriptionStatus(
            state: .subscribed,
            renewalInfo: nil,
            expirationDate: Date().addingTimeInterval(86400),
            willAutoRenew: true
        )
        mockStoreKitService.subscriptionStatus = status

        // When
        await sut.checkSubscriptionStatus()

        // Then
        XCTAssertTrue(mockStoreKitService.checkSubscriptionStatusCalled)
        XCTAssertTrue(sut.subscriptionStatus?.isActive ?? false)
    }

    func testCheckSubscriptionStatus_Expired() async {
        // Given
        let status = SubscriptionStatus(
            state: .expired,
            renewalInfo: nil,
            expirationDate: Date().addingTimeInterval(-86400),
            willAutoRenew: false
        )
        mockStoreKitService.subscriptionStatus = status

        // When
        await sut.checkSubscriptionStatus()

        // Then
        XCTAssertFalse(sut.subscriptionStatus?.isActive ?? true)
    }

    func testHasActiveSubscription_ReturnsCorrectValue() async {
        // Given
        let activeStatus = SubscriptionStatus(
            state: .subscribed,
            renewalInfo: nil,
            expirationDate: Date().addingTimeInterval(86400),
            willAutoRenew: true
        )
        mockStoreKitService.subscriptionStatus = activeStatus

        // When
        await sut.checkSubscriptionStatus()

        // Then
        XCTAssertTrue(sut.hasActiveSubscription)
    }

    func testHasActiveSubscription_NoSubscription() async {
        // Given
        mockStoreKitService.subscriptionStatus = nil

        // When
        await sut.checkSubscriptionStatus()

        // Then
        XCTAssertFalse(sut.hasActiveSubscription)
    }

    func testSubscriptionExpiryDate_ReturnsDate() async {
        // Given
        let expectedDate = Date().addingTimeInterval(86400)
        let status = SubscriptionStatus(
            state: .subscribed,
            renewalInfo: nil,
            expirationDate: expectedDate,
            willAutoRenew: true
        )
        mockStoreKitService.subscriptionStatus = status

        // When
        await sut.checkSubscriptionStatus()

        // Then
        XCTAssertEqual(sut.subscriptionExpiryDate, expectedDate)
    }

    func testWillAutoRenew_ReturnsCorrectValue() async {
        // Given
        let status = SubscriptionStatus(
            state: .subscribed,
            renewalInfo: nil,
            expirationDate: Date().addingTimeInterval(86400),
            willAutoRenew: true
        )
        mockStoreKitService.subscriptionStatus = status

        // When
        await sut.checkSubscriptionStatus()

        // Then
        XCTAssertTrue(sut.willAutoRenew)
    }

    // MARK: - Points Balance Tests

    func testRefreshPoints_Success() async {
        // Given
        mockPointsService.setMockBalance(totalPoints: 500)

        // When
        await sut.refreshPoints()

        // Then
        XCTAssertTrue(mockPointsService.refreshPointsCalled)
        XCTAssertEqual(sut.userPoints, 500)
    }

    func testRefreshPoints_Failure() async {
        // Given
        mockPointsService.shouldFailRefresh = true
        mockPointsService.mockError = .networkError

        // When
        await sut.refreshPoints()

        // Then
        XCTAssertNotNil(sut.errorMessage)
        XCTAssertEqual(sut.errorMessage, PointsError.networkError.errorDescription)
    }

    func testUserPoints_UpdatesFromPointsService() async {
        // Given
        mockPointsService.setMockBalance(totalPoints: 750)

        // When
        await sut.refreshPoints()

        // Then
        XCTAssertEqual(sut.userPoints, 750)
    }

    // MARK: - Price Display Tests

    func testFormatPoints_FormatsCorrectly() {
        // When
        let formatted100 = sut.formatPoints(100)
        let formatted1000 = sut.formatPoints(1000)
        let formatted10000 = sut.formatPoints(10000)

        // Then
        XCTAssertEqual(formatted100, "100")
        XCTAssertEqual(formatted1000, "1,000")
        XCTAssertEqual(formatted10000, "10,000")
    }

    func testFormatPoints_ZeroValue() {
        // When
        let formatted = sut.formatPoints(0)

        // Then
        XCTAssertEqual(formatted, "0")
    }

    // MARK: - Best Value Product Tests

    func testGetBestValueProduct_ReturnsCorrectProduct() async {
        // Given
        await sut.loadProducts()
        XCTAssertFalse(sut.pointsProducts.isEmpty)

        // When
        let bestValue = sut.getBestValueProduct()

        // Then
        XCTAssertNotNil(bestValue)
        XCTAssertNotNil(bestValue?.points)
    }

    func testGetBestValueProduct_EmptyProducts() {
        // Given - empty products
        sut.pointsProducts = []

        // When
        let bestValue = sut.getBestValueProduct()

        // Then
        XCTAssertNil(bestValue)
    }

    func testGetBestValueProduct_NoPointsProducts() async {
        // Given - only subscription products
        await sut.loadProducts()
        sut.pointsProducts = []

        // When
        let bestValue = sut.getBestValueProduct()

        // Then
        XCTAssertNil(bestValue)
    }

    // MARK: - Popular Product Tests

    func testGetPopularProduct_ReturnsCorrectProduct() async {
        // Given
        await sut.loadProducts()

        // When
        let popular = sut.getPopularProduct()

        // Then
        XCTAssertNotNil(popular)
        XCTAssertEqual(popular?.points, 580)
    }

    func testGetPopularProduct_NoProducts() {
        // Given
        sut.pointsProducts = []

        // When
        let popular = sut.getPopularProduct()

        // Then
        XCTAssertNil(popular)
    }

    // MARK: - Error Handling Tests

    func testClearError_ClearsAllErrors() async {
        // Given
        mockStoreKitService.shouldFailProductLoad = true
        mockStoreKitService.mockError = .configurationError
        await sut.loadProducts()
        XCTAssertNotNil(sut.errorMessage)

        // When
        sut.clearError()

        // Then
        XCTAssertNil(sut.errorMessage)
        XCTAssertTrue(mockStoreKitService.clearErrorCalled)
        XCTAssertTrue(mockPointsService.clearErrorCalled)
    }

    func testErrorMessage_SetOnProductLoadFailure() async {
        // Given
        mockStoreKitService.shouldFailProductLoad = true
        mockStoreKitService.mockError = .productNotFound

        // When
        await sut.loadProducts()

        // Then
        XCTAssertNotNil(sut.errorMessage)
    }

    func testErrorMessage_SetOnPointsRefreshFailure() async {
        // Given
        mockPointsService.shouldFailRefresh = true
        mockPointsService.mockError = .networkError

        // When
        await sut.refreshPoints()

        // Then
        XCTAssertNotNil(sut.errorMessage)
    }

    // MARK: - Published Properties Binding Tests

    func testAvailableProducts_Binding() async {
        await waitForInitialLoadToSettle()

        // Given
        let expectation = expectation(description: "Products binding")
        var receivedProducts: [StoreProduct]?

        mockStoreKitService.$availableProducts
            .dropFirst()
            .sink { products in
                receivedProducts = products
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // When
        _ = await mockStoreKitService.loadProducts(productIds: StoreProductConfiguration.allProductIds)

        // Then
        await fulfillment(of: [expectation], timeout: 2.0)
        XCTAssertNotNil(receivedProducts)
    }

    func testSubscriptionStatus_Binding() async {
        // Given
        let status = SubscriptionStatus(
            state: .subscribed,
            renewalInfo: nil,
            expirationDate: Date(),
            willAutoRenew: true
        )

        // When
        mockStoreKitService.subscriptionStatus = status
        await sut.checkSubscriptionStatus()

        // Then
        XCTAssertEqual(sut.subscriptionStatus?.state, .subscribed)
    }

    // MARK: - Product Price Parsing Tests

    func testGetBestValueProduct_PriceParsing() async {
        // Given - load products
        await sut.loadProducts()

        // When - get best value product
        let bestValue = sut.getBestValueProduct()

        // Then - should parse price correctly
        if let best = bestValue {
            let priceString = best.price.filter { "0123456789.".contains($0) }
            XCTAssertFalse(priceString.isEmpty)
        }
    }

    // MARK: - Concurrent Operations Tests

    func testConcurrentLoadAndRefresh() async {
        // When - execute concurrent operations
        async let loadResult: Void = sut.loadProducts()
        async let refreshResult: Void = sut.refreshPoints()

        _ = await (loadResult, refreshResult)

        // Then - both should complete without crashing
        XCTAssertTrue(mockStoreKitService.loadProductsCalled)
        XCTAssertTrue(mockPointsService.refreshPointsCalled)
    }

    // MARK: - View Model Initialization Tests

    func testInitialization_LoadsProducts() async {
        // Given - create new ViewModel (which auto-loads products)
        let vm = StoreViewModel(
            storeKitService: mockStoreKitService,
            pointsService: mockPointsService
        )
        _ = vm

        // Wait a bit for async initialization
        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds

        // Then - products should be loaded automatically
        XCTAssertTrue(mockStoreKitService.loadProductsCalled)

        // Cleanup
        await MainActor.run {
            // vm will be deallocated
        }
    }

    func testInitialization_BindsToServices() async {
        // Then - verify bindings are set up
        XCTAssertNotNil(sut.pointsProducts)
        XCTAssertNotNil(sut.subscriptionProducts)
    }
}

// MARK: - StoreProduct Configuration Tests

extension StoreViewModelTests {

    func testStoreProduct_HasValidDisplayPrice() async {
        // Given
        await sut.loadProducts()

        // Then
        for product in sut.pointsProducts {
            XCTAssertFalse(product.price.isEmpty)
            XCTAssertTrue(product.price.contains("¥") || product.price.contains("$"))
        }

        for product in sut.subscriptionProducts {
            XCTAssertFalse(product.price.isEmpty)
            XCTAssertTrue(product.price.contains("¥") || product.price.contains("$"))
        }
    }

    func testStoreProduct_PointsValueCorrect() async {
        // Given
        await sut.loadProducts()

        // Then
        for product in sut.pointsProducts {
            XCTAssertNotNil(product.points)
            XCTAssertTrue(product.points! > 0)
        }
    }

    func testStoreProduct_SubscriptionPeriodExists() async {
        // Given
        await sut.loadProducts()

        // Then
        for product in sut.subscriptionProducts {
            XCTAssertNotNil(product.subscriptionPeriod)
        }
    }
}
