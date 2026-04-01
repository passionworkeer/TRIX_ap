//
//  PurchasePointsFlowTests.swift
//  TRIX3DCompanionE2ETests
//
//  E2E tests for purchase points flow
//

import XCTest

/// E2E tests for purchase points flow
final class PurchasePointsFlowTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
    }

    // MARK: - Complete Purchase Flow

    func test_completePointsPurchaseFlow() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-store", "--mock-payment"]
        app.launch()

        // Navigate to store
        app.buttons["Store"].tap()

        // Select points product
        let productCell = app.collectionViews.cells.firstMatch
        productCell.tap()

        // Tap buy
        let buyButton = app.buttons["Buy Now"]
        buyButton.tap()

        // Select payment method
        let paymentMethod = app.buttons["Apple Pay"]
        if paymentMethod.exists {
            paymentMethod.tap()
        }

        // Complete purchase (mock)
        // Wait for success
        let successMessage = app.staticTexts["Purchase successful!"]
        XCTAssertTrue(successMessage.waitForExistence(timeout: 15))
    }

    func test_purchaseSubscriptionFlow() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-store", "--mock-payment"]
        app.launch()

        // Navigate to store
        app.buttons["Store"].tap()

        // Scroll to subscriptions
        app.swipeUp()

        // Select subscription
        let subscriptionCell = app.collectionViews.cells["Monthly Premium"]
        subscriptionCell.tap()

        // Tap subscribe
        let subscribeButton = app.buttons["Subscribe"]
        subscribeButton.tap()

        // Confirm subscription
        let confirmButton = app.buttons["Confirm"]
        confirmButton.tap()

        // Wait for success
        let successMessage = app.staticTexts["Subscription activated!"]
        XCTAssertTrue(successMessage.waitForExistence(timeout: 15))
    }

    func test_viewOrderHistory() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-store"]
        app.launch()

        // Navigate to store
        app.buttons["Store"].tap()

        // Open order history
        let historyButton = app.buttons["Order History"]
        historyButton.tap()

        // Verify history screen
        let historyTitle = app.staticTexts["Order History"]
        XCTAssertTrue(historyTitle.waitForExistence(timeout: 5))
    }

    func test_insufficientPaymentMethod_handling() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-store", "--mock-payment-failure"]
        app.launch()

        // Navigate to store and select product
        app.buttons["Store"].tap()
        app.collectionViews.cells.firstMatch.tap()
        app.buttons["Buy Now"].tap()

        // Try payment (will fail)
        let paymentMethod = app.buttons["Apple Pay"]
        if paymentMethod.exists {
            paymentMethod.tap()
        }

        // Should show error
        let errorMessage = app.staticTexts["Payment failed"]
        XCTAssertTrue(errorMessage.waitForExistence(timeout: 10))
    }
}
