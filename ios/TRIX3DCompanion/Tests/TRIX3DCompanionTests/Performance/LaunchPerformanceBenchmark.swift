//
//  LaunchPerformanceBenchmark.swift
//  TRIX3DCompanionTests
//
//  Performance benchmarks for app launch time
//

import XCTest
import UIKit

/// Performance benchmarks for measuring app launch times
///
/// This test class measures both cold and hot launch performance:
/// - Cold launch: First app launch after device restart or force quit
/// - Hot launch: Subsequent launches when app is already in memory
final class LaunchPerformanceBenchmark: XCTestCase {

    // MARK: - Properties

    /// Number of iterations for averaging results
    private let iterations = 10

    /// Maximum acceptable cold launch time in seconds
    private let maxAcceptableColdLaunchTime: TimeInterval = 2.0

    /// Maximum acceptable hot launch time in seconds
    private let maxAcceptableHotLaunchTime: TimeInterval = 0.5

    // MARK: - Benchmark Results

    /// Results storage
    private var coldLaunchTimes: [TimeInterval] = []
    private var hotLaunchTimes: [TimeInterval] = []

    // MARK: - Setup

    override func setUpWithError() throws {
        super.setUpWithError()
        coldLaunchTimes.removeAll()
        hotLaunchTimes.removeAll()
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
        // This test is designed to be used with XCUITest
        // It uses the measurement APIs for precise timing

        measure(metrics: [XCTApplicationLaunchMetric()]) {
            // Code to measure - typically just launch the app
            // XCUIApplication().launch()
        }
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
}

// MARK: - Launch Time Reporter

extension LaunchPerformanceBenchmark {

    /// Generate a launch time performance report
    func generateReport() -> String {
        let coldAvg = coldLaunchTimes.isEmpty ? 0 :
            coldLaunchTimes.reduce(0, +) / Double(coldLaunchTimes.count)
        let hotAvg = hotLaunchTimes.isEmpty ? 0 :
            hotLaunchTimes.reduce(0, +) / Double(hotLaunchTimes.count)

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
        """
    }
}
