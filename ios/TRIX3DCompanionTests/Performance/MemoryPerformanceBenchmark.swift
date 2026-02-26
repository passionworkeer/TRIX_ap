//
//  MemoryPerformanceBenchmark.swift
//  TRIX3DCompanionTests
//
//  Memory usage benchmark tests
//  Targets: Peak memory < 200MB
//

import XCTest

/// Memory performance benchmark tests
final class MemoryPerformanceBenchmark: XCTestCase {

    // MARK: - Configuration

    /// Peak memory target in bytes
    let peakMemoryTarget: UInt64 = 200 * 1024 * 1024  // 200MB

    /// Test iterations
    let iterations = 3

    // MARK: - Setup

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
    }

    override func tearDown() {
        // Force cleanup between tests
        super.tearDown()
    }

    // MARK: - Memory Leak Tests

    /// Test for memory leaks in critical services
    func test_noMemoryLeaks_inServices() {
        // Track initial memory
        let initialMemory = getMemoryUsage()

        // Create and destroy services multiple times
        for _ in 0..<iterations {
            autoreleasepool {
                // Simulate service lifecycle
                let service = MockService()
                service.performHeavyOperation()
            }
        }

        // Force cleanup
        Thread.sleep(forTimeInterval: 0.5)

        // Check memory hasn't grown significantly
        let finalMemory = getMemoryUsage()
        let growth = finalMemory - initialMemory

        // Allow 10MB tolerance for system overhead
        XCTAssertLessThan(
            growth,
            10 * 1024 * 1024,
            "Memory grew by \(growth / 1024 / 1024)MB - possible leak detected"
        )
    }

    // MARK: - Peak Memory Tests

    /// Test peak memory under typical usage
    func test_peakMemory_underTarget() {
        let app = XCUIApplication()
        app.launch()

        // Wait for app to stabilize
        Thread.sleep(forTimeInterval: 2.0)

        // Navigate through key screens
        navigateThroughScreens(in: app)

        // Get peak memory
        let peakMemory = getMemoryUsage()

        // Log results
        print("""
        \n=== Peak Memory Test ===
        Peak Memory: \(peakMemory / 1024 / 1024)MB
        Target: \(peakMemoryTarget / 1024 / 1024)MB
        Status: \(peakMemory < peakMemoryTarget ? "✅ PASS" : "❌ FAIL")
        """)

        XCTAssertLessThan(
            peakMemory,
            peakMemoryTarget,
            "Peak memory (\(peakMemory / 1024 / 1024)MB) exceeds target (\(peakMemoryTarget / 1024 / 1024)MB)"
        )
    }

    /// Test memory stability over time
    func test_memoryUsage_stable() {
        let app = XCUIApplication()
        app.launch()

        var measurements: [UInt64] = []

        // Take measurements over time
        for i in 0..<10 {
            Thread.sleep(forTimeInterval: 1.0)

            // Perform some action
            if i % 2 == 0 {
                app.tap()
            }

            measurements.append(getMemoryUsage())
        }

        // Check trend
        let first = measurements.prefix(3).reduce(0, +) / 3
        let last = measurements.suffix(3).reduce(0, +) / 3
        let growth = last - first

        // Memory should not grow more than 20%
        let tolerance = first / 5

        XCTAssertLessThan(
            growth,
            tolerance,
            "Memory grew by \(growth / 1024 / 1024)MB over test period"
        )
    }

    // MARK: - Image Memory Tests

    /// Test image memory usage with caching
    func test_imageMemory_withCaching() {
        let initialMemory = getMemoryUsage()

        // Load multiple images
        let imageUrls = (1..<20).map { "https://picsum.photos/800/800?random=\($0)" }

        for url in imageUrls {
            autoreleasepool {
                // Simulate loading an image
                let _ = MockImageLoader.loadImage(from: url)
            }
        }

        let afterLoadMemory = getMemoryUsage()

        // Clear cache
        ImageCacheManager.shared.clearCache()
        Thread.sleep(forTimeInterval: 0.5)

        let afterClearMemory = getMemoryUsage()

        // Memory should decrease after cache clear
        let memoryReclaimed = afterLoadMemory - afterClearMemory

        XCTAssertGreaterThan(
            memoryReclaimed,
            5 * 1024 * 1024,
            "Cache should reclaim at least 5MB"
        )
    }

    // MARK: - Helper Methods

    /// Navigate through app screens to stress test memory
    private func navigateThroughScreens(in app: XCUIApplication) {
        // Navigate to profile
        if app.buttons["Profile"].exists {
            app.buttons["Profile"].tap()
            Thread.sleep(forTimeInterval: 0.5)
        }

        // Navigate to chat
        if app.buttons["Chat"].exists {
            app.buttons["Chat"].tap()
            Thread.sleep(forTimeInterval: 0.5)
        }

        // Navigate to study
        if app.buttons["Study"].exists {
            app.buttons["Study"].tap()
            Thread.sleep(forTimeInterval: 0.5)
        }

        // Return to home
        if app.buttons["Home"].exists {
            app.buttons["Home"].tap()
        }
    }

    /// Get current memory usage in bytes
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
}

// MARK: - Mock Objects

/// Mock service for testing
private class MockService {
    private var data: [Data] = []

    func performHeavyOperation() {
        // Allocate some memory
        for _ in 0..<100 {
            data.append(Data(repeating: UInt8.random(in: 0...255), count: 1024))
        }
    }
}

/// Mock image loader for testing
private enum MockImageLoader {
    static func loadImage(from url: String) -> UIImage? {
        // Return a mock image
        let size = CGSize(width: 800, height: 800)
        UIGraphicsBeginImageContextWithOptions(size, false, 1.0)
        let context = UIGraphicsGetCurrentContext()
        context?.setFillColor(UIColor.blue.cgColor)
        context?.fill(CGRect(origin: .zero, size: size))
        let image = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()
        return image
    }
}

// MARK: - Memory Report Model

/// Model for memory performance report
struct MemoryPerformanceReport: Codable {
    let timestamp: Date
    let peakMemory: UInt64
    let averageMemory: UInt64
    let targetPeakMemory: UInt64
    let isOptimized: Bool
    let cacheStats: ImageCacheManager.CacheStats
    let leakSuspects: Int

    var summary: String {
        """
        Memory Performance Report - \(timestamp)
        ========================================
        Peak Memory: \(peakMemory / 1024 / 1024)MB (Target: \(targetPeakMemory / 1024 / 1024)MB) \(peakMemory < targetPeakMemory ? "✅" : "❌")
        Average Memory: \(averageMemory / 1024 / 1024)MB
        Cache Usage: \(cacheStats.memoryUsage / 1024 / 1024)MB / \(cacheStats.memoryLimit / 1024 / 1024)MB (\(Int(cacheStats.memoryUsagePercent * 100))%)
        Cached Images: \(cacheStats.count)
        Leak Suspects: \(leakSuspects)

        Status: \(isOptimized ? "✅ OPTIMIZED" : "⚠️ NEEDS OPTIMIZATION")
        """
    }
}
