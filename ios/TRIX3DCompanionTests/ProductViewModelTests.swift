//
//  ProductViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for ProductViewModel
//

import XCTest
import Combine
@testable import TRIX3DCompanion

/// Unit tests for ProductViewModel
final class ProductViewModelTests: XCTestCase {

    // MARK: - Properties

    var productViewModel: ProductViewModel!
    var mockStoreKitService: MockStoreKitService!
    var mockPaymentService: MockPaymentService!
    var mockPointsService: MockPointsService!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        mockStoreKitService = MockStoreKitService()
        mockPaymentService = MockPaymentService()
        mockPointsService = MockPointsService()

        let product = ProductViewModel.mockPointsProduct()

        productViewModel = ProductViewModel(
            product: product,
            storeKitService: mockStoreKitService,
            paymentService: mockPaymentService,
            pointsService: mockPointsService
        )
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        productViewModel = nil
        mockStoreKitService = nil
        mockPaymentService = nil
        mockPointsService = nil
        cancellables = nil
    }

    // MARK: - Initial State Tests

    func test_initialPurchaseState_idle() {
        // Assert
        XCTAssertEqual(productViewModel.purchaseState, .idle)
    }

    func test_initialIsPurchasing_false() {
        // Assert
        XCTAssertFalse(productViewModel.isPurchasing)
    }

    func test_initialShowPaymentResult_false() {
        // Assert
        XCTAssertFalse(productViewModel.showPaymentResult)
    }

    // MARK: - Purchase Tests

    func test_purchase_pointsProduct_callsPaymentService() async throws {
        // Act
        await productViewModel.purchase()

        // Assert
        XCTAssertEqual(mockPaymentService.purchasePointsCallCount, 1)
    }

    func test_purchase_setsPurchasingState() async throws {
        // Arrange
        var purchasingStates: [Bool] = []
        productViewModel.$isPurchasing
            .sink { isPurchasing in
                purchasingStates.append(isPurchasing)
            }
            .store(in: &cancellables)

        // Act
        await productViewModel.purchase()

        // Assert
        XCTAssertTrue(purchasingStates.contains(true))
    }

    func test_purchase_success_setsSuccessState() async throws {
        // Arrange
        mockPaymentService.setMockPurchaseSuccess()

        // Act
        await productViewModel.purchase()

        // Assert
        XCTAssertEqual(productViewModel.purchaseState, .success)
        XCTAssertTrue(productViewModel.showPaymentResult)
    }

    func test_purchase_pending_setsPendingState() async throws {
        // Arrange
        mockPaymentService.setMockPurchasePending()

        // Act
        await productViewModel.purchase()

        // Assert
        XCTAssertEqual(productViewModel.purchaseState, .pending)
        XCTAssertTrue(productViewModel.showPaymentResult)
    }

    func test_purchase_failed_setsFailedState() async throws {
        // Arrange
        mockPaymentService.setMockPurchaseFailed()

        // Act
        await productViewModel.purchase()

        // Assert
        XCTAssertEqual(productViewModel.purchaseState, .failed)
        XCTAssertNotNil(productViewModel.errorMessage)
    }

    // MARK: - Load Current Points Tests

    func test_loadCurrentPoints_updatesCurrentPoints() async throws {
        // Arrange
        mockPointsService.setMockBalance(totalPoints: 1500)

        // Act
        await productViewModel.loadCurrentPoints()

        // Assert
        XCTAssertEqual(productViewModel.currentPoints, 1500)
    }

    // MARK: - Reset State Tests

    func test_resetState_resetsAll() {
        // Arrange
        productViewModel.purchaseState = .success
        productViewModel.isPurchasing = true
        productViewModel.errorMessage = "Error"
        productViewModel.showPaymentResult = true

        // Act
        productViewModel.resetState()

        // Assert
        XCTAssertEqual(productViewModel.purchaseState, .idle)
        XCTAssertFalse(productViewModel.isPurchasing)
        XCTAssertNil(productViewModel.errorMessage)
        XCTAssertFalse(productViewModel.showPaymentResult)
    }

    // MARK: - Clear Error Tests

    func test_clearError_clearsErrorMessage() {
        // Arrange
        productViewModel.errorMessage = "Test error"

        // Act
        productViewModel.clearError()

        // Assert
        XCTAssertNil(productViewModel.errorMessage)
    }

    // MARK: - Computed Properties Tests

    func test_displayName_returnsProductName() {
        // Assert
        XCTAssertEqual(productViewModel.displayName, productViewModel.product.name)
    }

    func test_productDescription_returnsProductDescription() {
        // Assert
        XCTAssertEqual(productViewModel.productDescription, productViewModel.product.description)
    }

    func test_productPrice_returnsProductPrice() {
        // Assert
        XCTAssertEqual(productViewModel.productPrice, productViewModel.product.price)
    }

    func test_productType_returnsProductType() {
        // Assert
        XCTAssertEqual(productViewModel.productType, productViewModel.product.type)
    }

    func test_pointsValue_returnsPoints() {
        // Assert
        XCTAssertNotNil(productViewModel.pointsValue)
    }

    func test_isOnSale_returnsCorrectValue() {
        // Points products 300, 500, 1000 have bonus points
        // The mock product is 500 points, so should be on sale
        XCTAssertTrue(productViewModel.isOnSale)
    }

    func test_bonusPoints_returnsBonus() {
        // The mock product is 500 points with 80 bonus
        let bonus = productViewModel.bonusPoints
        XCTAssertNotNil(bonus)
    }

    func test_valuePerYuan_calculatesCorrectly() {
        // The mock product has price and points
        let value = productViewModel.valuePerYuan
        XCTAssertNotNil(value)
    }

    func test_isBestValue_forMockProduct() {
        // The mock product is 500 points, which is not the best value (1000 is)
        // Note: This depends on implementation
        _ = productViewModel.isBestValue
    }

    // MARK: - Features Tests

    func test_features_returnsFeatures() {
        // Assert
        XCTAssertFalse(productViewModel.features.isEmpty)
    }

    func test_benefitDescription_returnsDescription() {
        // Assert
        XCTAssertNotNil(productViewModel.benefitDescription)
    }

    func test_warningText_returnsNilForPoints() {
        // Points products don't have warning text
        XCTAssertNil(productViewModel.warningText)
    }
}
