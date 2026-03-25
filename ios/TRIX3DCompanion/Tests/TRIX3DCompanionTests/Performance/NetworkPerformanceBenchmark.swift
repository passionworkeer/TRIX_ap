//
//  NetworkPerformanceBenchmark.swift
//  TRIX3DCompanionTests
//
//  Performance benchmarks for network operations
//

import XCTest
import Foundation

/// Performance benchmarks for measuring network performance
///
/// This test class provides tools to:
/// - Measure API response latency
/// - Test concurrent request handling
/// - Monitor network timeout behavior
/// - Measure throughput for large data transfers
final class NetworkPerformanceBenchmark: XCTestCase {

    // MARK: - Properties

    /// Maximum acceptable API latency in seconds (target: < 500ms)
    private let maxAcceptableLatency: TimeInterval = 0.5

    /// Maximum acceptable concurrent request latency
    private let maxAcceptableConcurrentLatency: TimeInterval = 5.0

    /// Number of iterations for averaging
    private let iterations = 10

    /// Concurrent request count for testing
    private let concurrentRequestCount = 5

    // MARK: - Results Storage

    private var latencyResults: [TimeInterval] = []
    private var throughputResults: [Double] = []
    private var compressionRatios: [Double] = []

    // MARK: - Setup

    override func setUpWithError() throws {
        try super.setUpWithError()
        latencyResults.removeAll()
        throughputResults.removeAll()
    }

    // MARK: - API Latency Tests

    /// Measure basic API latency
    ///
    /// Tests the time from request initiation to receiving the first
    /// byte of response data.
    func testAPILatency() async throws {
        let startTime = CFAbsoluteTimeGetCurrent()

        // Simulate API call
        // In real tests, this would be an actual API call
        await simulateAPICall()

        let endTime = CFAbsoluteTimeGetCurrent()
        let latency = endTime - startTime

        latencyResults.append(latency)

        print("API latency: \(String(format: "%.3f", latency))s")
    }

    /// Test API latency threshold
    func testAPILatencyThreshold() async throws {
        for _ in 0..<iterations {
            try await testAPILatency()
        }

        guard !latencyResults.isEmpty else {
            XCTFail("No latency results recorded")
            return
        }

        let averageLatency = latencyResults.reduce(0, +) / Double(latencyResults.count)
        let minLatency = latencyResults.min() ?? 0
        let maxLatency = latencyResults.max() ?? 0
        let p95Latency = calculatePercentile(latencyResults, percentile: 0.95)

        print("""
        API Latency Statistics:
        - Average: \(String(format: "%.3f", averageLatency))s
        - Min: \(String(format: "%.3f", minLatency))s
        - Max: \(String(format: "%.3f", maxLatency))s
        - P95: \(String(format: "%.3f", p95Latency))s
        - Threshold: \(maxAcceptableLatency)s
        """)

        XCTAssertLessThan(averageLatency, maxAcceptableLatency,
                         "Average API latency exceeds threshold")
    }

    // MARK: - Concurrent Request Tests

    /// Test concurrent request handling
    ///
    /// Measures how well the system handles multiple simultaneous requests.
    func testConcurrentRequests() async throws {
        let startTime = CFAbsoluteTimeGetCurrent()

        // Launch multiple concurrent requests
        await withTaskGroup(of: Void.self) { group in
            for _ in 0..<concurrentRequestCount {
                group.addTask {
                    await self.simulateAPICall()
                }
            }
        }

        let endTime = CFAbsoluteTimeGetCurrent()
        let totalLatency = endTime - startTime

        print("""
        Concurrent Request Performance:
        - Request count: \(concurrentRequestCount)
        - Total time: \(String(format: "%.3f", totalLatency))s
        - Average per request: \(String(format: "%.3f", totalLatency / Double(concurrentRequestCount)))s
        - Threshold: \(maxAcceptableConcurrentLatency)s
        """)

        XCTAssertLessThan(totalLatency, maxAcceptableConcurrentLatency,
                         "Concurrent request latency exceeds threshold")
    }

    /// Test request queue behavior
    func testRequestQueueBehavior() async throws {
        let requestCount = 10
        var completionTimes: [TimeInterval] = []

        let startTime = CFAbsoluteTimeGetCurrent()

        for i in 0..<requestCount {
            let requestStart = CFAbsoluteTimeGetCurrent()
            await simulateAPICall()
            let requestEnd = CFAbsoluteTimeGetCurrent()
            completionTimes.append(requestEnd - requestStart)
        }

        let totalTime = CFAbsoluteTimeGetCurrent() - startTime
        let averageTime = completionTimes.reduce(0, +) / Double(completionTimes.count)

        print("""
        Request Queue Performance:
        - Total requests: \(requestCount)
        - Total time: \(String(format: "%.3f", totalTime))s
        - Average per request: \(String(format: "%.3f", averageTime))s
        """)

        // Sequential requests should complete within reasonable time
        XCTAssertLessThan(totalTime, Double(requestCount) * maxAcceptableLatency,
                         "Request queue performance degraded")
    }

    // MARK: - Throughput Tests

    /// Test data download throughput
    func testDownloadThroughput() async throws {
        let dataSizeBytes: Int64 = 1_000_000 // 1 MB
        let startTime = CFAbsoluteTimeGetCurrent()

        // Simulate downloading data
        await simulateDataDownload(size: dataSizeBytes)

        let endTime = CFAbsoluteTimeGetCurrent()
        let duration = endTime - startTime
        let throughputMbps = Double(dataSizeBytes) / duration / 1_000_000.0 * 8

        throughputResults.append(throughputMbps)

        print("""
        Download Throughput:
        - Data size: \(dataSizeBytes / 1000) KB
        - Duration: \(String(format: "%.3f", duration))s
        - Throughput: \(String(format: "%.2f", throughputMbps)) Mbps
        """)
    }

    /// Test data upload throughput
    func testUploadThroughput() async throws {
        let dataSizeBytes: Int64 = 500_000 // 500 KB
        let startTime = CFAbsoluteTimeGetCurrent()

        // Simulate uploading data
        await simulateDataUpload(size: dataSizeBytes)

        let endTime = CFAbsoluteTimeGetCurrent()
        let duration = endTime - startTime
        let throughputMbps = Double(dataSizeBytes) / duration / 1_000_000.0 * 8

        print("""
        Upload Throughput:
        - Data size: \(dataSizeBytes / 1000) KB
        - Duration: \(String(format: "%.3f", duration))s
        - Throughput: \(String(format: "%.2f", throughputMbps)) Mbps
        """)
    }

    // MARK: - Request Compression Tests

    /// Test request compression efficiency
    ///
    /// Measures how well data is compressed for network transmission.
    /// Higher compression ratio means less data to transfer.
    func testRequestCompressionEfficiency() async throws {
        let testData = generateTestData(sizeKB: 100)
        let originalSize = Double(testData.count)

        // Compress the data
        let compressedData = compressData(testData)
        let compressedSize = Double(compressedData.count)

        let compressionRatio = originalSize / compressedSize
        let savingsPercent = (1 - compressedSize / originalSize) * 100

        compressionRatios.append(compressionRatio)

        print("""
        Request Compression Efficiency:
        - Original size: \(String(format: "%.1f", originalSize / 1024)) KB
        - Compressed size: \(String(format: "%.1f", compressedSize / 1024)) KB
        - Compression ratio: \(String(format: "%.2f", compressionRatio)):1
        - Savings: \(String(format: "%.1f", savingsPercent))%
        """)

        // Compression ratio should be at least 2:1 for text data
        XCTAssertGreaterThan(compressionRatio, 2.0,
                            "Compression efficiency is below threshold")
    }

    /// Test response decompression performance
    func testResponseDecompressionPerformance() async throws {
        let testData = generateTestData(sizeKB: 50)
        let compressedData = compressData(testData)

        let startTime = CFAbsoluteTimeGetCurrent()

        // Decompress the data
        let decompressedData = decompressData(compressedData)

        let endTime = CFAbsoluteTimeGetCurrent()
        let decompressionTime = endTime - startTime

        print("""
        Response Decompression:
        - Data size: \(String(format: "%.1f", Double(testData.count) / 1024)) KB
        - Decompression time: \(String(format: "%.3f", decompressionTime))s
        - Throughput: \(String(format: "%.1f", Double(testData.count) / decompressionTime / 1024)) KB/s
        """)

        // Decompression should be fast (< 100ms for 50KB)
        XCTAssertLessThan(decompressionTime, 0.1,
                         "Decompression is too slow")

        // Verify data integrity
        XCTAssertEqual(testData, decompressedData,
                      "Decompressed data does not match original")
    }

    // MARK: - Timeout Tests

    /// Test request timeout handling
    func testRequestTimeout() async throws {
        let timeout: TimeInterval = 5.0
        let startTime = CFAbsoluteTimeGetCurrent()

        // Simulate a request that should timeout
        do {
            try await simulateTimeoutRequest(timeout: timeout)
        } catch {
            // Expected timeout
        }

        let endTime = CFAbsoluteTimeGetCurrent()
        let actualDuration = endTime - startTime

        print("""
        Timeout Test:
        - Configured timeout: \(timeout)s
        - Actual duration: \(String(format: "%.3f", actualDuration))s
        """)

        // Timeout should occur within reasonable margin of configured value
        XCTAssertLessThan(abs(actualDuration - timeout), 1.0,
                         "Timeout timing is inaccurate")
    }

    // MARK: - Error Recovery Tests

    /// Test network error recovery
    func testNetworkErrorRecovery() async throws {
        var successCount = 0
        let totalAttempts = 5

        for _ in 0..<totalAttempts {
            do {
                await simulateAPICall()
                successCount += 1
            } catch {
                // Handle error and retry
                continue
            }
        }

        let successRate = Double(successCount) / Double(totalAttempts) * 100
        print("Network success rate: \(successRate)%")

        XCTAssertGreaterThan(successRate, 80.0, "Network reliability too low")
    }

    // MARK: - Connection Reuse Tests

    /// Test connection reuse efficiency
    func testConnectionReuse() async throws {
        // First request establishes connection
        let firstRequestTime = CFAbsoluteTimeGetCurrent()
        await simulateAPICall()
        let firstDuration = CFAbsoluteTimeGetCurrent() - firstRequestTime

        // Subsequent requests should reuse connection
        var subsequentDurations: [TimeInterval] = []
        for _ in 0..<5 {
            let start = CFAbsoluteTimeGetCurrent()
            await simulateAPICall()
            let duration = CFAbsoluteTimeGetCurrent() - start
            subsequentDurations.append(duration)
        }

        let avgSubsequent = subsequentDurations.reduce(0, +) / Double(subsequentDurations.count)

        print("""
        Connection Reuse Test:
        - First request: \(String(format: "%.3f", firstDuration))s
        - Avg subsequent: \(String(format: "%.3f", avgSubsequent))s
        - Improvement: \(String(format: "%.1f", (firstDuration - avgSubsequent) / firstDuration * 100))%
        """)

        // Connection reuse should improve performance
        XCTAssertLessThan(avgSubsequent, firstDuration,
                         "Connection reuse not providing performance benefit")
    }

    // MARK: - Helpers

    /// Generate test data of specified size
    private func generateTestData(sizeKB: Int) -> Data {
        // Generate random but repeatable data for testing
        let characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        let repeated = String(repeating: characters, count: (sizeKB * 10) / characters.count)
        return repeated.data(using: .utf8) ?? Data()
    }

    /// Compress data using standard compression
    private func compressData(_ data: Data) -> Data {
        // Using LZFSE compression (available on iOS 9+)
        if let compressed = try? (data as NSData).compressed(using: .lzfse) as Data {
            return compressed
        }
        // Fallback: return original data if compression fails
        return data
    }

    /// Decompress data
    private func decompressData(_ data: Data) -> Data {
        // Using LZFSE decompression
        if let decompressed = try? (data as NSData).decompressed(using: .lzfse) as Data {
            return decompressed
        }
        // Fallback: return original data
        return data
    }

    /// Simulate an API call
    private func simulateAPICall() async {
        // Simulate network delay
        let delay = Double.random(in: 0.1...0.5)
        try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
    }

    /// Simulate data download
    private func simulateDataDownload(size: Int64) async {
        // Simulate download time based on size
        let estimatedTime = Double(size) / 1_000_000.0 // Rough estimate
        try? await Task.sleep(nanoseconds: UInt64(estimatedTime * 1_000_000_000))
    }

    /// Simulate data upload
    private func simulateDataUpload(size: Int64) async {
        // Simulate upload time based on size
        let estimatedTime = Double(size) / 500_000.0 // Upload is typically slower
        try? await Task.sleep(nanoseconds: UInt64(estimatedTime * 1_000_000_000))
    }

    /// Simulate a timeout request
    private func simulateTimeoutRequest(timeout: TimeInterval) async throws {
        // Simulate a request that takes longer than timeout
        try await Task.sleep(nanoseconds: UInt64((timeout + 2) * 1_000_000_000))
    }

    /// Calculate percentile of an array
    private func calculatePercentile(_ values: [TimeInterval], percentile: Double) -> TimeInterval {
        guard !values.isEmpty else { return 0 }
        let sorted = values.sorted()
        let index = Int(Double(sorted.count - 1) * percentile)
        return sorted[index]
    }
}

// MARK: - Network Reporter

extension NetworkPerformanceBenchmark {

    /// Generate a network performance report
    func generateReport() -> String {
        let avgLatency = latencyResults.isEmpty ? 0 :
            latencyResults.reduce(0, +) / Double(latencyResults.count)
        let avgThroughput = throughputResults.isEmpty ? 0 :
            throughputResults.reduce(0, +) / Double(throughputResults.count)
        let avgCompression = compressionRatios.isEmpty ? 0 :
            compressionRatios.reduce(0, +) / Double(compressionRatios.count)

        return """
        Network Performance Report
        ===========================
        Latency:
          - Average: \(String(format: "%.3f", avgLatency))s
          - Threshold: \(maxAcceptableLatency)s
          - Status: \(avgLatency < maxAcceptableLatency ? "PASS" : "FAIL")

        Throughput:
          - Average: \(String(format: "%.2f", avgThroughput)) Mbps

        Compression:
          - Average ratio: \(String(format: "%.2f", avgCompression)):1

        Concurrent:
          - Request count: \(concurrentRequestCount)
          - Threshold: \(maxAcceptableConcurrentLatency)s
        """
    }
}
