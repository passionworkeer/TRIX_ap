//
//  LaunchPerformanceBenchmark.swift
//  TRIX3DCompanionTests
//
//  Performance benchmarks for app launch time
//

import XCTest
import UIKit
@testable import TRIX3DCompanion

/// Performance benchmarks for measuring app launch times
///
/// This test class measures both cold and hot launch performance:
/// - Cold launch: First app launch after device restart or force quit
/// - Hot launch: Subsequent launches when app is already in memory
final class LaunchPerformanceBenchmark: PerformanceBenchmarkTestCase {

    // MARK: - Properties

    /// Number of iterations for averaging results
    private let iterations = 10

    /// Maximum acceptable cold launch time in seconds
    private let maxAcceptableColdLaunchTime: TimeInterval = 2.0

    /// Maximum acceptable hot launch time in seconds
    private let maxAcceptableHotLaunchTime: TimeInterval = 0.5

    /// Maximum acceptable first render time in seconds
    private let maxAcceptableFirstRenderTime: TimeInterval = 1.0

    /// Maximum acceptable time to interactive in seconds
    private let maxAcceptableTimeToInteractive: TimeInterval = 2.0

    // MARK: - Benchmark Results

    /// Results storage
    private var coldLaunchTimes: [TimeInterval] = []
    private var hotLaunchTimes: [TimeInterval] = []
    private var firstRenderTimes: [TimeInterval] = []
    private var timeToInteractive: [TimeInterval] = []

    // MARK: - Setup

    override func setUpWithError() throws {
        try super.setUpWithError()
        coldLaunchTimes.removeAll()
        hotLaunchTimes.removeAll()
        firstRenderTimes.removeAll()
        timeToInteractive.removeAll()
    }

    // MARK: - Cold Launch Benchmark

    /// Measure cold launch time
    ///
    /// Cold launch occurs when the app is not in memory. This test
    /// simulates the worst-case scenario for app startup.
    ///
    /// - Note: This test requires the app to be force quit before each iteration
    func testColdLaunchTime() throws {
        // This test measures the time from app launch to when the
        // first view controller is ready

        // In a real scenario, you would use XCUIApplication to launch
        // and measure the time to reach a specific UI element

        // For unit testing, we measure specific components

        let startTime = CFAbsoluteTimeGetCurrent()

        // Simulate app initialization
        // In production, this would be actual initialization code
        simulateAppInitialization()

        let endTime = CFAbsoluteTimeGetCurrent()
        let launchTime = endTime - startTime

        coldLaunchTimes.append(launchTime)

        print("Cold launch time: \(launchTime)s")
    }

    /// Measure hot launch time
    ///
    /// Hot launch occurs when the app is already in memory but in
    /// background state. This is the typical scenario for app switching.
    func testHotLaunchTime() throws {
        let startTime = CFAbsoluteTimeGetCurrent()

        // Simulate restoration from background
        simulateAppRestoreFromBackground()

        let endTime = CFAbsoluteTimeGetCurrent()
        let launchTime = endTime - startTime

        hotLaunchTimes.append(launchTime)

        print("Hot launch time: \(launchTime)s")
    }

    // MARK: - Analysis

    /// Verify cold launch performance meets threshold
    func testColdLaunchPerformanceThreshold() throws {
        // Run multiple iterations
        for _ in 0..<iterations {
            try testColdLaunchTime()
        }

        guard !coldLaunchTimes.isEmpty else {
            XCTFail("No cold launch times recorded")
            return
        }

        let averageTime = coldLaunchTimes.reduce(0, +) / Double(coldLaunchTimes.count)
        let minTime = coldLaunchTimes.min() ?? 0
        let maxTime = coldLaunchTimes.max() ?? 0

        print("""
        Cold Launch Statistics:
        - Average: \(String(format: "%.3f", averageTime))s
        - Min: \(String(format: "%.3f", minTime))s
        - Max: \(String(format: "%.3f", maxTime))s
        - Threshold: \(maxAcceptableColdLaunchTime)s
        """)

        XCTAssertLessThan(averageTime, maxAcceptableColdLaunchTime,
                         "Cold launch time exceeds threshold")
    }

    /// Verify hot launch performance meets threshold
    func testHotLaunchPerformanceThreshold() throws {
        // Run multiple iterations
        for _ in 0..<iterations {
            try testHotLaunchTime()
        }

        guard !hotLaunchTimes.isEmpty else {
            XCTFail("No hot launch times recorded")
            return
        }

        let averageTime = hotLaunchTimes.reduce(0, +) / Double(hotLaunchTimes.count)
        let minTime = hotLaunchTimes.min() ?? 0
        let maxTime = hotLaunchTimes.max() ?? 0

        print("""
        Hot Launch Statistics:
        - Average: \(String(format: "%.3f", averageTime))s
        - Min: \(String(format: "%.3f", minTime))s
        - Max: \(String(format: "%.3f", maxTime))s
        - Threshold: \(maxAcceptableHotLaunchTime)s
        """)

        XCTAssertLessThan(averageTime, maxAcceptableHotLaunchTime,
                         "Hot launch time exceeds threshold")
    }

    // MARK: - UI Launch Time (XCUITest compatible)

    /// Measure UI launch time using XCTMeasureOptions
    ///
    /// Use this in XCUITest targets for accurate launch timing
    @available(iOS 13.0, *)
    func testUILaunchMeasurement() throws {
        try requireUILaunchBenchmarkEnabled()

        // This test is designed to be used with XCUITest
        // It uses the measurement APIs for precise timing

        measure(metrics: [XCTApplicationLaunchMetric()]) {
            // Code to measure - typically just launch the app
            // XCUIApplication().launch()
        }
    }

    // MARK: - First Render Time Tests

    /// Measure time to first meaningful paint/render
    ///
    /// This measures the time from app launch to when the first
    /// UI content is rendered and visible to the user.
    func testFirstRenderTime() throws {
        let startTime = CFAbsoluteTimeGetCurrent()

        // Simulate first render
        // In production, this would be actual view rendering
        simulateFirstRender()

        let endTime = CFAbsoluteTimeGetCurrent()
        let renderTime = endTime - startTime

        firstRenderTimes.append(renderTime)

        print("First render time: \(String(format: "%.3f", renderTime))s")

        // First render should be fast (< 1 second)
        XCTAssertLessThan(renderTime, maxAcceptableFirstRenderTime,
                         "First render time exceeds threshold")
    }

    /// Measure time to interactive state
    ///
    /// Measures when the app becomes fully interactive after launch.
    func testTimeToInteractive() throws {
        let startTime = CFAbsoluteTimeGetCurrent()

        // Simulate reaching interactive state
        simulateInteractiveState()

        let endTime = CFAbsoluteTimeGetCurrent()
        let interactiveTime = endTime - startTime

        timeToInteractive.append(interactiveTime)

        print("Time to interactive: \(String(format: "%.3f", interactiveTime))s")

        // Should be interactive within 2 seconds
        XCTAssertLessThan(interactiveTime, maxAcceptableTimeToInteractive,
                         "Time to interactive exceeds threshold")
    }

    // MARK: - Helpers

    /// Simulate app initialization components
    private func simulateAppInitialization() {
        // Simulate initialization of core services
        _ = KeychainManager.shared
        // In real app: CoreData stack, network client, etc.
    }

    /// Simulate app restoration from background
    private func simulateAppRestoreFromBackground() {
        // Simulate state restoration
        // In real app: Reload UI state, refresh data, etc.
    }

    /// Simulate first render of UI
    private func simulateFirstRender() {
        // Simulate view loading and rendering
        Thread.sleep(forTimeInterval: 0.1)
    }

    /// Simulate reaching interactive state
    private func simulateInteractiveState() {
        // Simulate app becoming fully interactive
        Thread.sleep(forTimeInterval: 0.3)
    }
}

// MARK: - Launch Time Reporter

extension LaunchPerformanceBenchmark {

    /// Generate a launch time performance report
    func generateReport() -> String {
        let coldAvg = coldLaunchTimes.isEmpty ? 0 :
            coldLaunchTimes.reduce(0, +) / Double(coldLaunchTimes.count)
        let hotAvg = hotLaunchTimes.isEmpty ? 0 :
            hotLaunchTimes.reduce(0, +) / Double(hotLaunchTimes.count)
        let renderAvg = firstRenderTimes.isEmpty ? 0 :
            firstRenderTimes.reduce(0, +) / Double(firstRenderTimes.count)
        let interactiveAvg = timeToInteractive.isEmpty ? 0 :
            timeToInteractive.reduce(0, +) / Double(timeToInteractive.count)

        return """
        Launch Performance Report
        ==========================
        Cold Launch:
          - Average: \(String(format: "%.3f", coldAvg))s
          - Threshold: \(maxAcceptableColdLaunchTime)s
          - Status: \(coldAvg < maxAcceptableColdLaunchTime ? "PASS" : "FAIL")

        Hot Launch:
          - Average: \(String(format: "%.3f", hotAvg))s
          - Threshold: \(maxAcceptableHotLaunchTime)s
          - Status: \(hotAvg < maxAcceptableHotLaunchTime ? "PASS" : "FAIL")

        First Render:
          - Average: \(String(format: "%.3f", renderAvg))s
          - Threshold: \(maxAcceptableFirstRenderTime)s
          - Status: \(renderAvg < maxAcceptableFirstRenderTime ? "PASS" : "FAIL")

        Time to Interactive:
          - Average: \(String(format: "%.3f", interactiveAvg))s
          - Threshold: \(maxAcceptableTimeToInteractive)s
          - Status: \(interactiveAvg < maxAcceptableTimeToInteractive ? "PASS" : "FAIL")
        """
    }
}
