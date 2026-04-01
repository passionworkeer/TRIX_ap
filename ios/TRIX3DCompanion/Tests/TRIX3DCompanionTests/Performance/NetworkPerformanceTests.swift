//
//  NetworkPerformanceTests.swift
//  TRIX3DPerformanceTests
//
//  Network performance tests
//

import XCTest

/// Network performance tests
final class NetworkPerformanceTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        app = XCUIApplication()
    }

    // MARK: - API Response Time Tests

    func test_profileAPI_responseTime() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-server"]
        app.launch()

        let startTime = CFAbsoluteTimeGetCurrent()

        app.buttons["Profile"].tap()

        // Wait for profile to fully load
        XCTAssertTrue(app.staticTexts["Profile"].waitForExistence(timeout: 10))

        let endTime = CFAbsoluteTimeGetCurrent()
        let responseTime = endTime - startTime

        // Assert API response is under 500ms
        XCTAssertLessThan(responseTime, 0.5, "Profile API should respond under 500ms")
    }

    func test_storeAPI_responseTime() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-server"]
        app.launch()

        let startTime = CFAbsoluteTimeGetCurrent()

        app.buttons["Store"].tap()

        // Wait for products to load
        XCTAssertTrue(app.staticTexts["Store"].waitForExistence(timeout: 10))

        let endTime = CFAbsoluteTimeGetCurrent()
        let responseTime = endTime - startTime

        XCTAssertLessThan(responseTime, 0.5, "Store API should respond under 500ms")
    }

    func test_snapshotsAPI_responseTime() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-server"]
        app.launch()

        let startTime = CFAbsoluteTimeGetCurrent()

        app.buttons["Camera"].tap()

        // Wait for camera
        XCTAssertTrue(app.images["Camera Preview"].waitForExistence(timeout: 10))

        let endTime = CFAbsoluteTimeGetCurrent()
        let responseTime = endTime - startTime

        XCTAssertLessThan(responseTime, 1.0, "Camera initialization should be under 1 second")
    }

    // MARK: - Image Loading Performance

    func test_imageLoading_performance() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-server"]
        app.launch()

        // Navigate to store with images
        app.buttons["Store"].tap()
        XCTAssertTrue(app.staticTexts["Store"].waitForExistence(timeout: 10))

        // Scroll to trigger image loading
        let collectionView = app.collectionViews.firstMatch

        let startTime = CFAbsoluteTimeGetCurrent()

        for _ in 0..<5 {
            collectionView.swipeUp()
        }

        let endTime = CFAbsoluteTimeGetCurrent()
        let scrollTime = endTime - startTime

        // Image loading should not significantly slow scrolling
        XCTAssertLessThan(scrollTime / 5.0, 0.3, "Image loading should not block scrolling")
    }

    // MARK: - WebSocket Performance

    func test_websocketConnection_performance() throws {
        app.launchArguments = ["--skip-onboarding", "--mock-server"]
        app.launch()

        // Navigate to chat
        app.buttons["Chat"].tap()

        // Wait for connection
        let connected = app.staticTexts["Connected"].waitForExistence(timeout: 5)

        XCTAssertTrue(connected, "WebSocket should connect within 5 seconds")
    }

    // MARK: - Caching Performance

    func test_cacheHit_performance() throws {
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        // First load - cache miss
        app.buttons["Profile"].tap()
        XCTAssertTrue(app.staticTexts["Profile"].waitForExistence(timeout: 10))

        // Go back
        app.buttons["Home"].tap()

        // Second load - should be cached
        let startTime = CFAbsoluteTimeGetCurrent()

        app.buttons["Profile"].tap()
        XCTAssertTrue(app.staticTexts["Profile"].waitForExistence(timeout: 5))

        let endTime = CFAbsoluteTimeGetCurrent()
        let loadTime = endTime - startTime

        // Cached load should be faster
        XCTAssertLessThan(loadTime, 0.3, "Cached data should load faster")
    }
}
