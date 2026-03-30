//
//  MemoryPerformanceBenchmark.swift
//  TRIX3DCompanionTests
//
//  Performance benchmarks for memory usage and leak detection
//

import XCTest
import UIKit

/// Performance benchmarks for measuring memory usage and detecting leaks
///
/// This test class provides tools to:
/// - Measure peak memory usage
/// - Detect memory leaks through reference tracking
/// - Monitor memory warnings and app behavior
final class MemoryPerformanceBenchmark: PerformanceBenchmarkTestCase {

    // MARK: - Properties

    /// Maximum acceptable peak memory in MB
    private let maxAcceptablePeakMemoryMB: Double = 200.0

    /// Memory warning threshold in MB
    private let memoryWarningThresholdMB: Double = 150.0

    /// Baseline memory usage for comparison
    private var baselineMemoryMB: Double = 0

    // MARK: - Setup

    override func setUpWithError() throws {
        try super.setUpWithError()
        baselineMemoryMB = currentMemoryUsageMB()
        print("Baseline memory: \(String(format: "%.1f", baselineMemoryMB)) MB")
    }

    // MARK: - Memory Usage Tests

    /// Measure current memory usage
    func testCurrentMemoryUsage() throws {
        let memoryMB = currentMemoryUsageMB()
        print("Current memory usage: \(String(format: "%.1f", memoryMB)) MB")

        XCTAssertGreaterThan(memoryMB, 0, "Memory usage should be positive")
    }

    /// Measure peak memory usage during typical operations
    func testPeakMemoryUsage() throws {
        var peakMemoryMB: Double = 0

        // Simulate various app operations and track peak memory
        for _ in 0..<10 {
            // Record memory before operation
            let beforeMB = currentMemoryUsageMB()

            // Simulate operation (in real test, this would be actual app operations)
            simulateTypicalOperation()

            // Record memory after operation
            let afterMB = currentMemoryUsageMB()
            peakMemoryMB = max(peakMemoryMB, afterMB)

            print("Memory: \(String(format: "%.1f", beforeMB)) MB -> \(String(format: "%.1f", afterMB)) MB")
        }

        print("Peak memory usage: \(String(format: "%.1f", peakMemoryMB)) MB")

        XCTAssertLessThan(peakMemoryMB, maxAcceptablePeakMemoryMB,
                         "Peak memory exceeds threshold of \(maxAcceptablePeakMemoryMB) MB")
    }

    /// Test memory growth over time
    func testMemoryGrowthOverTime() throws {
        var memoryReadings: [Double] = []

        // Take memory readings over a period of operations
        for i in 0..<20 {
            simulateTypicalOperation()
            let memoryMB = currentMemoryUsageMB()
            memoryReadings.append(memoryMB)

            // Small delay between operations
            Thread.sleep(forTimeInterval: 0.1)
        }

        // Analyze memory growth
        let firstHalf = Array(memoryReadings.prefix(10))
        let secondHalf = Array(memoryReadings.suffix(10))

        let firstHalfAvg = firstHalf.reduce(0, +) / Double(firstHalf.count)
        let secondHalfAvg = secondHalf.reduce(0, +) / Double(secondHalf.count)

        let growthRate = (secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100

        print("""
        Memory Growth Analysis:
        - First half average: \(String(format: "%.1f", firstHalfAvg)) MB
        - Second half average: \(String(format: "%.1f", secondHalfAvg)) MB
        - Growth rate: \(String(format: "%.1f", growthRate))%
        """)

        // Memory should not grow more than 20% over the test period
        XCTAssertLessThan(growthRate, 20.0, "Memory growth indicates potential leak")
    }

    // MARK: - Memory Leak Detection

    /// Detect memory leaks through repeated operations
    ///
    /// If memory continuously grows without being released, it indicates
    /// a potential memory leak.
    func testMemoryLeakDetection() throws {
        let initialMemoryMB = currentMemoryUsageMB()
        print("Initial memory: \(String(format: "%.1f", initialMemoryMB)) MB")

        // Perform operations that should release memory when complete
        for _ in 0..<100 {
            autoreleasepool {
                simulateMemoryIntensiveOperation()
            }
        }

        // Force garbage collection
        Thread.sleep(forTimeInterval: 0.5)

        let finalMemoryMB = currentMemoryUsageMB()
        let memoryIncreaseMB = finalMemoryMB - initialMemoryMB

        print("""
        Memory Leak Check:
        - Initial: \(String(format: "%.1f", initialMemoryMB)) MB
        - Final: \(String(format: "%.1f", finalMemoryMB)) MB
        - Increase: \(String(format: "%.1f", memoryIncreaseMB)) MB
        """)

        // Memory increase should be less than 10 MB
        XCTAssertLessThan(memoryIncreaseMB, 10.0, "Potential memory leak detected")
    }

    /// Test reference cycle detection
    func testReferenceCycleDetection() throws {
        // Create a weak reference tracker
        weak var weakReference: AnyObject?

        autoreleasepool {
            let strongReference = createReferenceCycleObject()
            weakReference = strongReference
            XCTAssertNotNil(weakReference, "Object should exist in pool")
        }

        // After autoreleasepool, weak reference should be nil
        Thread.sleep(forTimeInterval: 0.1)

        if weakReference != nil {
            XCTFail("Reference cycle detected - object was not deallocated")
        }
    }

    // MARK: - Memory Warning Simulation

    /// Test app behavior under memory pressure
    func testMemoryWarningHandling() throws {
        // Simulate receiving a memory warning
        NotificationCenter.default.post(
            name: UIApplication.didReceiveMemoryWarningNotification,
            object: nil
        )

        // Allow time for cleanup
        Thread.sleep(forTimeInterval: 0.1)

        let memoryAfterWarningMB = currentMemoryUsageMB()
        print("Memory after warning: \(String(format: "%.1f", memoryAfterWarningMB)) MB")

        // Memory should decrease or stay stable after warning
        XCTAssertLessThanOrEqual(memoryAfterWarningMB, baselineMemoryMB + 10,
                                "Memory should be released after warning")
    }

    // MARK: - Large Object Handling

    /// Test memory usage with large data sets
    func testLargeDataSetHandling() throws {
        let initialMemoryMB = currentMemoryUsageMB()

        // Simulate loading large data set
        var largeDataSet: [Data] = []
        for _ in 0..<100 {
            largeDataSet.append(createSampleData(sizeKB: 100))
        }

        let peakMemoryMB = currentMemoryUsageMB()
        print("Peak memory with large data: \(String(format: "%.1f", peakMemoryMB)) MB")

        // Release large data
        largeDataSet.removeAll()
        Thread.sleep(forTimeInterval: 0.2)

        let finalMemoryMB = currentMemoryUsageMB()
        print("Memory after release: \(String(format: "%.1f", finalMemoryMB)) MB")

        // Memory should be significantly reduced after releasing data
        let releaseRatio = (peakMemoryMB - finalMemoryMB) / (peakMemoryMB - initialMemoryMB)
        XCTAssertGreaterThan(releaseRatio, 0.5, "Memory should be released when data is cleared")
    }

    // MARK: - Helpers

    /// Get current memory usage in MB
    private func currentMemoryUsageMB() -> Double {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4

        let result = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }

        guard result == KERN_SUCCESS else {
            return 0
        }

        return Double(info.resident_size) / 1024.0 / 1024.0
    }

    /// Simulate a typical app operation
    private func simulateTypicalOperation() {
        // In real tests, this would be actual app operations
        // For example: loading a view, processing data, etc.
        _ = Array(0..<1000).map { $0 * 2 }
    }

    /// Simulate a memory-intensive operation
    private func simulateMemoryIntensiveOperation() {
        // Create and release temporary objects
        let data = createSampleData(sizeKB: 50)
        _ = data.count
    }

    /// Create sample data of specified size
    private func createSampleData(sizeKB: Int) -> Data {
        return Data(repeating: 0, count: sizeKB * 1024)
    }

    /// Create an object that may have reference cycles
    private func createReferenceCycleObject() -> AnyObject {
        return NSObject()
    }
}

// MARK: - Memory Reporter

extension MemoryPerformanceBenchmark {

    /// Generate a memory performance report
    func generateReport() -> String {
        let currentMB = currentMemoryUsageMB()

        return """
        Memory Performance Report
        ==========================
        Current Usage:
          - Current: \(String(format: "%.1f", currentMB)) MB
          - Baseline: \(String(format: "%.1f", baselineMemoryMB)) MB
          - Delta: \(String(format: "%.1f", currentMB - baselineMemoryMB)) MB

        Thresholds:
          - Max Peak: \(maxAcceptablePeakMemoryMB) MB
          - Warning: \(memoryWarningThresholdMB) MB

        Status: \(currentMB < maxAcceptablePeakMemoryMB ? "PASS" : "FAIL")
        """
    }
}
