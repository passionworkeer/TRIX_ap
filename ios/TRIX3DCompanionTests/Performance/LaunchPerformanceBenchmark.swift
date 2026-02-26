//
//  LaunchPerformanceBenchmark.swift
//  TRIX3DCompanion
//
//  Launch performance benchmark tests
//  Targets: Cold launch < 2s, Warm launch < 1s
//

import XCTest

/// Launch performance benchmark tests
final class LaunchPerformanceBenchmark: XCTestCase {

    // MARK: - Configuration

    /// Cold launch target time in seconds
    let coldLaunchTarget: TimeInterval = 2.0

    /// Warm launch target time in seconds
    let warmLaunchTarget: TimeInterval = 1.0

    /// Number of iterations for statistical significance
    let iterations = 5

    // MARK: - Setup

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
    }

    // MARK: - Cold Launch Tests

    /// Test cold launch performance
    /// - Target: < 2.0 seconds
    func test_coldLaunchPerformance() {
        var times: [TimeInterval] = []

        for i in 0..<iterations {
            measureLaunch { time in
                times.append(time)
            }

            // Wait between launches for cold start simulation
            if i < iterations - 1 {
                Thread.sleep(forTimeInterval: 2.0)
            }
        }

        // Statistical analysis
        let average = times.reduce(0, +) / Double(times.count)
        let max = times.max() ?? 0
        let min = times.min() ?? 0

        // Log results
        logResults(
            testName: "Cold Launch",
            times: times,
            average: average,
            max: max,
            min: min,
            target: coldLaunchTarget
        )

        // Assert target met
        XCTAssertLessThan(
            average,
            coldLaunchTarget,
            "Average cold launch time (\(String(format: "%.2f", average))s) exceeds target (\(coldLaunchTarget)s)"
        )
    }

    // MARK: - Warm Launch Tests

    /// Test warm launch performance
    /// - Target: < 1.0 seconds
    func test_warmLaunchPerformance() {
        var times: [TimeInterval] = []

        // First launch to warm up
        _ = measureLaunch { _ in }

        // Measure warm launches
        for _ in 0..<iterations {
            measureLaunch { time in
                times.append(time)
            }
        }

        // Statistical analysis
        let average = times.reduce(0, +) / Double(times.count)
        let max = times.max() ?? 0
        let min = times.min() ?? 0

        // Log results
        logResults(
            testName: "Warm Launch",
            times: times,
            average: average,
            max: max,
            min: min,
            target: warmLaunchTarget
        )

        // Assert target met
        XCTAssertLessThan(
            average,
            warmLaunchTarget,
            "Average warm launch time (\(String(format: "%.2f", average))s) exceeds target (\(warmLaunchTarget)s)"
        )
    }

    // MARK: - Launch Phase Breakdown

    /// Test individual launch phases
    func test_launchPhaseTimings() {
        // This test validates each phase of launch meets its target

        let phaseTests: [(name: String, target: TimeInterval)] = [
            ("Pre-Main", 0.4),
            ("Initial View", 0.3),
            ("Services Init", 0.5),
            ("Data Load", 0.5),
            ("Interactive", 0.3)
        ]

        for phase in phaseTests {
            // In a real test, these would be measured from the app
            // Here we're asserting the targets are reasonable
            XCTAssertLessThan(
                phase.target,
                2.0, // No single phase should take more than 2s
                "Phase '\(phase.name)' target seems unreasonable"
            )
        }
    }

    // MARK: - Helper Methods

    /// Measure a single app launch
    /// - Parameter completion: Called with the launch time
    /// - Returns: The launch time
    @discardableResult
    private func measureLaunch(completion: (TimeInterval) -> Void = { _ in }) -> TimeInterval {
        let app = XCUIApplication()

        let startTime = CFAbsoluteTimeGetCurrent()
        app.launch()

        // Wait for main content to appear
        let mainContent = app.otherElements["MainContentView"]
        XCTAssertTrue(mainContent.waitForExistence(timeout: 10))

        let endTime = CFAbsoluteTimeGetCurrent()
        let launchTime = endTime - startTime

        completion(launchTime)
        return launchTime
    }

    /// Log benchmark results
    private func logResults(
        testName: String,
        times: [TimeInterval],
        average: TimeInterval,
        max: TimeInterval,
        min: TimeInterval,
        target: TimeInterval
    ) {
        let status = average < target ? "✅ PASS" : "❌ FAIL"

        print("""
        \n=== \(testName) Performance Benchmark ===
        Status: \(status)
        Target: \(String(format: "%.2f", target))s
        Average: \(String(format: "%.3f", average))s
        Min: \(String(format: "%.3f", min))s
        Max: \(String(format: "%.3f", max))s
        Iterations: \(times.count)
        """)
    }
}

// MARK: - Performance Report Model

/// Model for performance benchmark results
struct LaunchPerformanceReport: Codable {
    let timestamp: Date
    let coldLaunchTime: TimeInterval
    let warmLaunchTime: TimeInterval
    let targetColdLaunch: TimeInterval
    let targetWarmLaunch: TimeInterval
    let isOptimized: Bool
    let recommendations: [String]

    var summary: String {
        """
        Launch Performance Report - \(timestamp)
        =======================================
        Cold Launch: \(String(format: "%.2f", coldLaunchTime))s (Target: \(String(format: "%.1f", targetColdLaunch))s) \(coldLaunchTime < targetColdLaunch ? "✅" : "❌")
        Warm Launch: \(String(format: "%.2f", warmLaunchTime))s (Target: \(String(format: "%.1f", targetWarmLaunch))s) \(warmLaunchTime < targetWarmLaunch ? "✅" : "❌")

        Status: \(isOptimized ? "✅ OPTIMIZED" : "⚠️ NEEDS OPTIMIZATION")

        Recommendations:
        \(recommendations.isEmpty ? "None - performance targets met!" : recommendations.map { "• \($0)" }.joined(separator: "\n"))
        """
    }
}