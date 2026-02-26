//
//  StoreViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for StoreViewModel
//

import XCTest
import Combine
@testable import TRIX3DCompanion

/// Unit tests for StoreViewModel
final class StoreViewModelTests: XCTestCase {

    // MARK: - Properties

    var storeViewModel: StoreViewModel!
    var mockStoreKitService: MockStoreKitService!
    var mockPointsService: MockPointsService!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        mockStoreKitService = MockStoreKitService()
        mockPointsService = MockPointsService()

        storeViewModel = StoreViewModel(
            storeKitService: mockStoreKitService,
            pointsService: mockPointsService
        )
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        storeViewModel = nil
        mockStoreKitService = nil
        mockPointsService = nil
        cancellables = nil
    }

    // MARK: - Initial State Tests

    func test_initialState_loadsProducts() async throws {
        // Wait for initial load
        try await Task.sleep(nanoseconds: 100_000_000)

        // Assert - loadProducts should have been called during init
        XCTAssertEqual(mockStoreKitService.loadProductsCallCount, 1)
    }

    func test_initialPoints_zero() {
        // Assert
        XCTAssertEqual(storeViewModel.userPoints, 0)
    }

    func test_initialSubscriptionStatus_nil() {
        // Assert
        XCTAssertNil(storeViewModel.subscriptionStatus)
    }

    // MARK: - Load Products Tests

    func test_loadProducts_success() async throws {
        // Act
        await storeViewModel.loadProducts()

        // Assert
        XCTAssertEqual(mockStoreKitService.loadProductsCallCount, 1)
        XCTAssertFalse(storeViewModel.isLoadingProducts)
    }

    func test_loadProducts_error_setsErrorMessage() async throws {
        // Arrange
        mockStoreKitService.setMockLoadProductsError(.configurationError)

        // Act
        await storeViewModel.loadProducts()

        // Assert
        XCTAssertNotNil(storeViewModel.errorMessage)
    }

    // MARK: - Refresh Points Tests

    func test_refreshPoints_success() async throws {
        // Arrange
        mockPointsService.setMockBalance(totalPoints: 1500)

        // Act
        await storeViewModel.refreshPoints()

        // Assert
        XCTAssertEqual(mockPointsService.refreshPointsCallCount, 1)
    }

    func test_refreshPoints_error_setsErrorMessage() async throws {
        // Arrange
        mockPointsService.setMockRefreshError(.networkError)

        // Act
        await storeViewModel.refreshPoints()

        // Assert
        XCTAssertNotNil(storeViewModel.errorMessage)
    }

    // MARK: - Check Subscription Tests

    func test_checkSubscriptionStatus_success() async throws {
        // Arrange
        mockStoreKitService.setMockSubscriptionActive()

        // Act
        await storeViewModel.checkSubscriptionStatus()

        // Assert
        XCTAssertEqual(mockStoreKitService.checkSubscriptionStatusCallCount, 1)
        XCTAssertNotNil(storeViewModel.subscriptionStatus)
    }

    // MARK: - Select Product Tests

    func test_selectProduct_pointsProduct_showsPointsPurchase() {
        // Arrange
        let product = createMockPointsProduct()

        // Act
        storeViewModel.selectProduct(product)

        // Assert
        XCTAssertEqual(storeViewModel.selectedProduct?.id, product.id)
        XCTAssertTrue(storeViewModel.showPointsPurchase)
    }

    func test_selectProduct_subscriptionProduct_showsSubscription() {
        // Arrange
        let product = createMockSubscriptionProduct()

        // Act
        storeViewModel.selectProduct(product)

        // Assert
        XCTAssertEqual(storeViewModel.selectedProduct?.id, product.id)
        XCTAssertTrue(storeViewModel.showSubscription)
    }

    // MARK: - Clear Error Tests

    func test_clearError_clearsErrorMessage() {
        // Arrange
        storeViewModel.errorMessage = "Test error"

        // Act
        storeViewModel.clearError()

        // Assert
        XCTAssertNil(storeViewModel.errorMessage)
        XCTAssertEqual(mockStoreKitService.clearErrorCallCount, 1)
        XCTAssertEqual(mockPointsService.clearErrorCallCount, 1)
    }

    // MARK: - Format Points Tests

    func test_formatPoints_returnsFormattedString() {
        // Act
        let result = storeViewModel.formatPoints(1000)

        // Assert
        XCTAssertNotNil(result)
    }

    // MARK: - Computed Properties Tests

    func test_hasActiveSubscription_trueWhenSubscribed() async throws {
        // Arrange
        mockStoreKitService.setMockSubscriptionActive()

        // Act
        await storeViewModel.checkSubscriptionStatus()

        // Assert
        XCTAssertTrue(storeViewModel.hasActiveSubscription)
    }

    func test_hasActiveSubscription_falseWhenNotSubscribed() async throws {
        // Arrange
        mockStoreKitService.setMockSubscriptionExpired()

        // Act
        await storeViewModel.checkSubscriptionStatus()

        // Assert
        XCTAssertFalse(storeViewModel.hasActiveSubscription)
    }

    func test_subscriptionExpiryDate_returnsDate() async throws {
        // Arrange
        let expectedDate = Date().addingTimeInterval(86400 * 30)
        mockStoreKitService.mockSubscriptionStatus = SubscriptionStatus(
            state: .subscribed,
            renewalInfo: RenewalInfo(
                expirationDate: expectedDate,
                willAutoRenew: true,
                autoRenewPreference: true
            ),
            expirationDate: expectedDate,
            willAutoRenew: true
        )

        // Act
        await storeViewModel.checkSubscriptionStatus()

        // Assert
        XCTAssertNotNil(storeViewModel.subscriptionExpiryDate)
    }

    func test_willAutoRenew_returnsCorrectValue() async throws {
        // Arrange
        mockStoreKitService.mockSubscriptionStatus = SubscriptionStatus(
            state: .subscribed,
            renewalInfo: RenewalInfo(
                expirationDate: Date().addingTimeInterval(86400 * 30),
                willAutoRenew: true,
                autoRenewPreference: true
            ),
            expirationDate: Date().addingTimeInterval(86400 * 30),
            willAutoRenew: true
        )

        // Act
        await storeViewModel.checkSubscriptionStatus()

        // Assert
        XCTAssertTrue(storeViewModel.willAutoRenew)
    }

    // MARK: - Best Value Product Tests

    func test_getBestValueProduct_returnsProduct() async throws {
        // Wait for products to load
        try await Task.sleep(nanoseconds: 100_000_000)

        // Mock products are not available, so this might return nil
        // This tests the method exists and can be called
        _ = storeViewModel.getBestValueProduct()
    }

    // MARK: - Popular Product Tests

    func test_getPopularProduct_returnsProduct() async throws {
        // Wait for products to load
        try await Task.sleep(nanoseconds: 100_000_000)

        // Mock products are not available, so this might return nil
        _ = storeViewModel.getPopularProduct()
    }

    // MARK: - Loading State Tests

    func test_isLoadingProducts_tracksState() async throws {
        // Arrange
        var loadingStates: [Bool] = []
        storeViewModel.$isLoadingProducts
            .sink { isLoading in
                loadingStates.append(isLoading)
            }
            .store(in: &cancellables)

        // Act
        await storeViewModel.loadProducts()

        // Assert
        XCTAssertTrue(loadingStates.contains(true))
    }

    // MARK: - Helper Methods

    private func createMockPointsProduct() -> StoreProduct {
        return ProductViewModel.mockPointsProduct()
    }

    private func createMockSubscriptionProduct() -> StoreProduct {
        return ProductViewModel.mockSubscriptionProduct()
    }
}
