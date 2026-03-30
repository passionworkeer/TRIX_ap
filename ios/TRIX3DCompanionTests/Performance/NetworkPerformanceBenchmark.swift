//
//  NetworkPerformanceBenchmark.swift
//  TRIX3DCompanionTests
//
//  Network performance benchmark tests
//  Targets: Request latency < 500ms, Throughput optimized
//

import XCTest

/// Network performance benchmark tests
final class NetworkPerformanceBenchmark: XCTestCase {

    // MARK: - Configuration

    /// Target latency for API requests in seconds
    let targetLatency: TimeInterval = 0.5  // 500ms

    /// Target throughput for uploads (bytes/sec)
    let targetUploadThroughput: Int = 1_000_000  // 1MB/s

    /// Target throughput for downloads (bytes/sec)
    let targetDownloadThroughput: Int = 2_000_000  // 2MB/s

    /// Timeout for requests
    let requestTimeout: TimeInterval = 10.0

    // MARK: - Setup

    override func setUp() {
        super.setUp()
        continueAfterFailure = false

        // Ensure network is available
        let expectation = self.expectation(description: "Network check")
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { path in
            if path.status == .satisfied {
                expectation.fulfill()
            }
            monitor.cancel()
        }
        monitor.start(queue: DispatchQueue.global())
        waitForExpectations(timeout: 5.0)
    }

    // MARK: - Latency Tests

    /// Test API latency for typical endpoints
    func test_apiLatency_withinTarget() async throws {
        let endpoints: [(String, String, HTTPMethod)] = [
            ("User Profile", "/api/v1/users/me", .get),
            ("Chat Rooms", "/api/v1/chat/rooms", .get),
            ("Study Rooms", "/api/v1/study/rooms", .get),
        ]

        var results: [(name: String, latency: TimeInterval)] = []

        for (name, path, method) in endpoints {
            let latency = try await measureLatency(path: path, method: method)
            results.append((name, latency))
        }

        // Log results
        print("\n=== API Latency Results ===")
        for (name, latency) in results {
            let status = latency < targetLatency ? "✅" : "❌"
            print("\(status) \(name): \(String(format: "%.0f", latency * 1000))ms (target: \(String(format: "%.0f", targetLatency * 1000))ms)")
        }

        // Assert all latencies are within target
        let slowest = results.max(by: { $0.latency < $1.latency })?.latency ?? 0
        XCTAssertLessThan(
            slowest,
            targetLatency * 1.5,  // Allow 50% tolerance
            "Some API requests exceed latency target"
        )
    }

    /// Test request latency under concurrent load
    func test_concurrentRequestLatency_stable() async throws {
        let requestCount = 20
        let startTime = CFAbsoluteTimeGetCurrent()

        // Fire concurrent requests
        try await withThrowingTaskGroup(of: Void.self) { group in
            for i in 0..<requestCount {
                group.addTask {
                    let _ = try await self.measureLatency(
                        path: "/api/v1/health",
                        method: .get
                    )
                }
            }

            try await group.waitForAll()
        }

        let totalTime = CFAbsoluteTimeGetCurrent() - startTime
        let averageLatency = totalTime / Double(requestCount)

        print("\n=== Concurrent Latency Results ===")
        print("Requests: \(requestCount)")
        print("Total time: \(String(format: "%.2f", totalTime))s")
        print("Average latency: \(String(format: "%.0f", averageLatency * 1000))ms")
        print("Throughput: \(Int(Double(requestCount) / totalTime)) req/s")

        // Average latency should still be reasonable under load
        XCTAssertLessThan(
            averageLatency,
            targetLatency * 2,  // Allow 2x under load
            "Concurrent requests too slow"
        )
    }

    // MARK: - Throughput Tests

    /// Test download throughput
    func test_downloadThroughput_withinTarget() async throws {
        // Download a test file (1MB)
        let downloadSize: Int64 = 1_048_576  // 1MB
        let startTime = CFAbsoluteTimeGetCurrent()

        let url = URL(string: "https://httpbin.org/bytes/\(downloadSize)")!
        let (data, response) = try await URLSession.shared.data(from: url)

        let duration = CFAbsoluteTimeGetCurrent() - startTime
        let throughput = Double(data.count) / duration

        // Verify download size
        XCTAssertEqual(Int64(data.count), downloadSize)

        print("\n=== Download Throughput ===")
        print("Size: \(downloadSize / 1024 / 1024)MB")
        print("Duration: \(String(format: "%.2f", duration))s")
        print("Throughput: \(Int(throughput / 1024 / 1024))MB/s")
        print("Target: \(targetDownloadThroughput / 1024 / 1024)MB/s")

        XCTAssertGreaterThan(
            Int(throughput),
            Int(Double(targetDownloadThroughput) * 0.5),  // 50% of target
            "Download throughput too slow"
        )
    }

    /// Test upload throughput
    func test_uploadThroughput_withinTarget() async throws {
        // Upload a test file (100KB)
        let uploadSize = 102_400  // 100KB
        let testData = Data(repeating: 0, count: uploadSize)
        let startTime = CFAbsoluteTimeGetCurrent()

        let url = URL(string: "https://httpbin.org/post")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")

        let (_, response) = try await URLSession.shared.upload(for: request, from: testData)

        let duration = CFAbsoluteTimeGetCurrent() - startTime
        let throughput = Double(uploadSize) / duration

        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)

        print("\n=== Upload Throughput ===")
        print("Size: \(uploadSize / 1024)KB")
        print("Duration: \(String(format: "%.2f", duration))s")
        print("Throughput: \(Int(throughput / 1024))KB/s")
        print("Target: \(targetUploadThroughput / 1024 / 1024)MB/s")

        XCTAssertGreaterThan(
            Int(throughput),
            Int(Double(targetUploadThroughput) * 0.3),  // 30% of target
            "Upload throughput too slow"
        )
    }

    // MARK: - Helper Methods

    private func measureLatency(path: String, method: HTTPMethod) async throws -> TimeInterval {
        let url = URL(string: "https://trix.love")!.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue

        let startTime = CFAbsoluteTimeGetCurrent()
        let (_, response) = try await URLSession.shared.data(for: request)
        let duration = CFAbsoluteTimeGetCurrent() - startTime

        // Verify success status
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }

        return duration
    }
}

// MARK: - HTTPMethod

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

// MARK: - Network Performance Report

struct NetworkPerformanceReport: Codable {
    let timestamp: Date

    // Latency
    let averageLatency: TimeInterval
    let p95Latency: TimeInterval
    let p99Latency: TimeInterval
    let targetLatency: TimeInterval

    // Throughput
    let downloadThroughput: Double
    let uploadThroughput: Double
    let targetDownloadThroughput: Double
    let targetUploadThroughput: Double

    // Status
    let requestsSucceeded: Int
    let requestsFailed: Int

    var isOptimized: Bool {
        averageLatency < targetLatency &&
        downloadThroughput >= targetDownloadThroughput * 0.5
    }

    var summary: String {
        """
        Network Performance Report - \(timestamp)
        ==========================================
        Latency:
          Average: \(String(format: "%.0f", averageLatency * 1000))ms (Target: \(String(format: "%.0f", targetLatency * 1000))ms) \(averageLatency < targetLatency ? "✅" : "❌")
          P95: \(String(format: "%.0f", p95Latency * 1000))ms
          P99: \(String(format: "%.0f", p99Latency * 1000))ms

        Throughput:
          Download: \(String(format: "%.1f", downloadThroughput / 1024 / 1024))MB/s (Target: \(String(format: "%.1f", targetDownloadThroughput / 1024 / 1024))MB/s)
          Upload: \(String(format: "%.1f", uploadThroughput / 1024 / 1024))MB/s (Target: \(String(format: "%.1f", targetUploadThroughput / 1024 / 1024))MB/s)

        Success Rate: \(String(format: "%.1f", Double(requestsSucceeded) / Double(requestsSucceeded + requestsFailed) * 100))% (\(requestsSucceeded)/\(requestsSucceeded + requestsFailed))

        Status: \(isOptimized ? "✅ OPTIMIZED" : "⚠️ NEEDS OPTIMIZATION")
        """
    }
}
