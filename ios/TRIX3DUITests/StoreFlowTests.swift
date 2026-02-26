//
//  StoreFlowTests.swift
//  TRIX3DUITests
//
//  UI automation tests for store flow
//

import XCTest

/// UI tests for store flow
final class StoreFlowTests: XCTestCase {

    // MARK: - Properties

    var app: XCUIApplication!

    // MARK: - Lifecycle

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Store Screen Tests

    func test_storeScreen_displaysProducts() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-store"]
        app.launch()

        // Navigate to store
        app.buttons["Store"].tap()

        // Wait for products to load
        let collectionView = app.collectionViews["Store Products"]
        XCTAssertTrue(collectionView.waitForExistence(timeout: 10))
    }

    func test_storeScreen_displaysPointsProducts() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-store"]
        app.launch()

        // Navigate to store
        app.buttons["Store"].tap()

        // Verify points products section
        let pointsHeader = app.staticTexts["Points"]
        XCTAssertTrue(pointsHeader.waitForExistence(timeout: 5))
    }

    func test_storeScreen_displaysSubscriptionProducts() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-store"]
        app.launch()

        // Navigate to store
        app.buttons["Store"].tap()

        // Verify subscription products section
        let subscriptionHeader = app.staticTexts["Premium"]
        XCTAssertTrue(subscriptionHeader.waitForExistence(timeout: 5))
    }

    // MARK: - Product Selection Tests

    func test_productSelection_navigatesToDetail() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-store"]
        app.launch()

        // Navigate to store
        app.buttons["Store"].tap()

        // Tap on a product
        let firstProduct = app.collectionViews.cells.firstMatch
        firstProduct.tap()

        // Verify detail screen
        let buyButton = app.buttons["Buy Now"]
        XCTAssertTrue(buyButton.waitForExistence(timeout: 5))
    }

    // MARK: - Purchase Flow Tests

    func test_purchase_pointsProduct_showsPaymentOptions() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-store"]
        app.launch()

        // Navigate to store and select product
        app.buttons["Store"].tap()
        app.collectionViews.cells.firstMatch.tap()

        // Tap buy
        app.buttons["Buy Now"].tap()

        // Verify payment options
        let applePayButton = app.buttons["Apple Pay"]
        let wechatPayButton = app.buttons["WeChat Pay"]
        let alipayButton = app.buttons["Alipay"]

        // At least one should exist
        XCTAssertTrue(applePayButton.exists || wechatPayButton.exists || alipayButton.exists)
    }

    // MARK: - Subscription Tests

    func test_subscriptionProduct_showsSubscriptionInfo() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-store"]
        app.launch()

        // Navigate to store
        app.buttons["Store"].tap()

        // Scroll to subscription section
        app.swipeUp()

        // Tap subscription product
        app.collectionViews.cells["Monthly Premium"].tap()

        // Verify subscription info
        let subscribeButton = app.buttons["Subscribe"]
        XCTAssertTrue(subscribeButton.waitForExistence(timeout: 5))
    }

    // MARK: - Points Balance Tests

    func test_storeScreen_displaysCurrentPoints() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-store", "--mock-points:1000"]
        app.launch()

        // Navigate to store
        app.buttons["Store"].tap()

        // Verify points balance
        let pointsLabel = app.staticTexts["1,000 Points"]
        XCTAssertTrue(pointsLabel.waitForExistence(timeout: 5))
    }

    // MARK: - Error Handling Tests

    func test_storeLoadError_showsRetryOption() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-store-error"]
        app.launch()

        // Navigate to store
        app.buttons["Store"].tap()

        // Wait for error
        let errorMessage = app.staticTexts["Failed to load products"]
        XCTAssertTrue(errorMessage.waitForExistence(timeout: 5))

        // Verify retry button
        let retryButton = app.buttons["Retry"]
        XCTAssertTrue(retryButton.waitForExistence(timeout: 5))
    }
}
