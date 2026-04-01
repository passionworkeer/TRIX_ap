//
//  TRIX3DPerformanceTests.swift
//  TRIX3DPerformanceTests
//
//  Performance tests for app metrics
//

import XCTest
import UIKit

/// Performance tests for app metrics
final class TRIX3DPerformanceTests: XCTestCase {

    // MARK: - App Launch Performance

    func test_coldLaunchPerformance() throws {
        // Measure cold launch time
        let launchTime = measureAppLaunchTime()

        // Assert launch time is under threshold
        XCTAssertLessThan(launchTime, 2.0, "Cold launch should be under 2 seconds")
    }

    func test_warmLaunchPerformance() throws {
        // First launch
        _ = measureAppLaunchTime()

        // Measure warm launch
        let launchTime = measureAppLaunchTime()

        // Assert warm launch is faster
        XCTAssertLessThan(launchTime, 1.0, "Warm launch should be under 1 second")
    }

    // MARK: - Memory Performance

    func test_memoryUsage_underThreshold() throws {
        let app = XCUIApplication()
        app.launch()

        // Wait for app to stabilize
        Thread.sleep(forTimeInterval: 2)

        // Get memory usage
        let memoryUsage = getMemoryUsage()

        // Assert under 150MB
        XCTAssertLessThan(memoryUsage, 150 * 1024 * 1024, "Memory usage should be under 150MB")
    }

    func test_memoryUsage_stability() throws {
        let app = XCUIApplication()
        app.launch()

        // Navigate through screens
        app.buttons["Profile"].tap()
        Thread.sleep(forTimeInterval: 0.5)
        app.buttons["Store"].tap()
        Thread.sleep(forTimeInterval: 0.5)
        app.buttons["Camera"].tap()
        Thread.sleep(forTimeInterval: 0.5)

        // Check memory hasn't grown significantly
        let memoryUsage = getMemoryUsage()
        XCTAssertLessThan(memoryUsage, 200 * 1024 * 1024)
    }

    // MARK: - UI Responsiveness

    func test_screenNavigation_performance() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        // Wait for tab bar
        let tabBar = app.tabBars["Main Tab Bar"]
        XCTAssertTrue(tabBar.waitForExistence(timeout: 5))

        // Measure navigation time
        let startTime = CFAbsoluteTimeGetCurrent()

        app.buttons["Profile"].tap()
        XCTAssertTrue(app.staticTexts["Profile"].waitForExistence(timeout: 5))

        app.buttons["Store"].tap()
        XCTAssertTrue(app.staticTexts["Store"].waitForExistence(timeout: 5))

        let endTime = CFAbsoluteTimeGetCurrent()
        let navigationTime = endTime - startTime

        // Assert navigation is responsive
        XCTAssertLessThan(navigationTime, 1.0, "Navigation should be under 1 second")
    }

    func test_scroll_performance() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--skip-onboarding"]
        app.launch()

        // Navigate to store with many items
        app.buttons["Store"].tap()
        XCTAssertTrue(app.staticTexts["Store"].waitForExistence(timeout: 5))

        // Measure scroll performance
        measureScrollPerformance(in: app.collectionViews.firstMatch)
    }

    // MARK: - API Response Performance

    func test_apiResponseTime() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--skip-onboarding", "--mock-server"]
        app.launch()

        // Navigate to profile
        app.buttons["Profile"].tap()

        // Wait for data to load
        let profileLoaded = app.staticTexts["Profile"].waitForExistence(timeout: 10)

        XCTAssertTrue(profileLoaded, "Profile should load within timeout")
    }

    // MARK: - Helper Methods

    private func measureAppLaunchTime() -> TimeInterval {
        let app = XCUIApplication()

        let startTime = CFAbsoluteTimeGetCurrent()
        app.launch()
        let endTime = CFAbsoluteTimeGetCurrent()

        return endTime - startTime
    }

    private func getMemoryUsage() -> UInt64 {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4

        let result = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }

        if result == KERN_SUCCESS {
            return info.resident_size
        }

        return 0
    }

    private func measureScrollPerformance(in collectionView: XCUIElement) {
        guard collectionView.exists else { return }

        let startTime = CFAbsoluteTimeGetCurrent()

        // Perform scroll gestures
        for _ in 0..<10 {
            collectionView.swipeUp()
        }

        let endTime = CFAbsoluteTimeGetCurrent()
        let scrollTime = endTime - startTime

        // Should be smooth (average less than 100ms per scroll)
        XCTAssertLessThan(scrollTime / 10.0, 0.1, "Scroll should be smooth")
    }
}
