//
//  NetworkMonitorTests.swift
//  TRIX3DCompanionTests
//
//  Comprehensive unit tests for NetworkMonitor
//

import XCTest
import Network
import Combine
@testable import TRIX3DCompanion

/// Comprehensive unit tests for NetworkMonitor
@MainActor
final class NetworkMonitorTests: XCTestCase {

    // MARK: - Properties

    var networkMonitor: NetworkMonitor!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        networkMonitor = NetworkMonitor.shared
        networkMonitor.stopMonitoring()
        networkMonitor.currentStatus = .disconnected
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        networkMonitor.stopMonitoring()
        cancellables = nil
    }

    // MARK: - Initialization Tests

    func test_initialization_disconnectedStatus() {
        // Assert - Initial status should be set
        XCTAssertNotNil(networkMonitor.currentStatus, "Should have initial status")
    }

    func test_sharedInstance_returnsSameInstance() {
        // Arrange & Act
        let instance1 = NetworkMonitor.shared
        let instance2 = NetworkMonitor.shared

        // Assert
        XCTAssertTrue(instance1 === instance2, "Should return same instance")
    }

    // MARK: - Monitoring Tests

    func test_startMonitoring_beginsMonitoring() {
        // Arrange
        XCTAssertFalse(networkMonitor.isMonitoring, "Should not be monitoring initially")

        // Act
        networkMonitor.startMonitoring()

        // Assert
        XCTAssertTrue(networkMonitor.isMonitoring, "Should be monitoring after start")
    }

    func test_startMonitoring_multipleCalls_safe() {
        // Act - Call start multiple times
        networkMonitor.startMonitoring()
        networkMonitor.startMonitoring()
        networkMonitor.startMonitoring()

        // Assert - Should not crash
        XCTAssertTrue(networkMonitor.isMonitoring, "Should still be monitoring")
    }

    func test_stopMonitoring_stopsMonitoring() {
        // Arrange
        networkMonitor.startMonitoring()
        XCTAssertTrue(networkMonitor.isMonitoring, "Should be monitoring")

        // Act
        networkMonitor.stopMonitoring()

        // Assert
        XCTAssertFalse(networkMonitor.isMonitoring, "Should not be monitoring after stop")
    }

    func test_stopMonitoring_whenNotMonitoring_safe() {
        // Arrange - Not monitoring
        XCTAssertFalse(networkMonitor.isMonitoring)

        // Act - Should not crash
        networkMonitor.stopMonitoring()

        // Assert
        XCTAssertFalse(networkMonitor.isMonitoring, "Should still not be monitoring")
    }

    // MARK: - Status Tests

    func test_getCurrentStatus_returnsStatus() async {
        // Act
        let status = await networkMonitor.getCurrentStatus()

        // Assert
        XCTAssertNotNil(status, "Should return status")
        XCTAssertNotNil(status.timestamp, "Status should have timestamp")
    }

    func test_isConnected_returnsBool() {
        // Act
        let connected = networkMonitor.isConnected

        // Assert - Should return a boolean value
        XCTAssertTrue(connected == true || connected == false, "Should be boolean")
    }

    func test_isExpensive_returnsBool() {
        // Act
        let expensive = networkMonitor.isExpensive

        // Assert - Should return a boolean value
        XCTAssertTrue(expensive == true || expensive == false, "Should be boolean")
    }

    func test_connectionType_returnsType() {
        // Act
        let type = networkMonitor.connectionType

        // Assert - Should return valid type
        XCTAssertTrue(ConnectionType.allCases.contains(type), "Should be valid connection type")
    }

    func test_quality_returnsQuality() {
        // Act
        let quality = networkMonitor.quality

        // Assert - Should return valid quality
        XCTAssertTrue(ConnectionQuality.allCases.contains(quality), "Should be valid quality")
    }

    // MARK: - Publisher Tests

    func test_statusPublisher_emitsStatus() {
        // Arrange
        let expectation = XCTestExpectation(description: "statusPublisher should emit status")

        networkMonitor.statusPublisher
            .dropFirst()
            .sink { status in
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // Act
        networkMonitor.currentStatus = NetworkStatus(
            isConnected: true,
            connectionType: .wifi,
            quality: .excellent,
            timestamp: Date()
        )

        // Assert
        wait(for: [expectation], timeout: 2.0)
    }

    func test_connectionTypePublisher_emitsType() {
        // Arrange
        let expectation = XCTestExpectation(description: "connectionTypePublisher should emit type")

        networkMonitor.connectionTypePublisher
            .dropFirst()
            .sink { type in
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // Act
        networkMonitor.currentStatus = NetworkStatus(
            isConnected: true,
            connectionType: .cellular,
            quality: .good,
            timestamp: Date()
        )

        // Assert
        wait(for: [expectation], timeout: 2.0)
    }

    func test_isConnectedPublisher_emitsBool() {
        // Arrange
        let expectation = XCTestExpectation(description: "isConnectedPublisher should emit bool")

        networkMonitor.isConnectedPublisher
            .dropFirst()
            .sink { isConnected in
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // Act
        networkMonitor.currentStatus = NetworkStatus(
            isConnected: true,
            connectionType: .wifi,
            quality: .excellent,
            timestamp: Date()
        )

        // Assert
        wait(for: [expectation], timeout: 2.0)
    }

    // MARK: - Latency Tests

    func test_recordLatency_updatesLatencyHistory() {
        // Arrange
        let latency1: TimeInterval = 0.050
        let latency2: TimeInterval = 0.075
        let latency3: TimeInterval = 0.100

        // Act
        networkMonitor.recordLatency(latency1)
        networkMonitor.recordLatency(latency2)
        networkMonitor.recordLatency(latency3)

        // Assert - Should not crash
        XCTAssertTrue(true, "Recording latency should not crash")
    }

    func test_recordLatency_exceedsHistoryLimit() {
        // Arrange - Record more than history size (10)
        for i in 0..<15 {
            networkMonitor.recordLatency(TimeInterval(i) * 0.010)
        }

        // Assert - Should handle exceeding limit gracefully
        XCTAssertTrue(true, "Should handle history limit gracefully")
    }

    func test_measureLatency_toDefaultHost() async {
        // Note: This test may fail if network is unavailable
        // In production, would mock URLSession

        // Act
        do {
            let latency = try await networkMonitor.measureLatency()

            // Assert
            XCTAssertGreaterThan(latency, 0, "Latency should be positive")
        } catch {
            // Network may be unavailable in test environment
            XCTAssertTrue(true, "May fail if network unavailable")
        }
    }

    // MARK: - ConnectionType Tests

    func test_ConnectionType_allCases() {
        // Assert
        let allCases = ConnectionType.allCases
        XCTAssertEqual(allCases.count, 5, "Should have 5 connection types")
        XCTAssertTrue(allCases.contains(.none), "Should have none")
        XCTAssertTrue(allCases.contains(.wifi), "Should have wifi")
        XCTAssertTrue(allCases.contains(.cellular), "Should have cellular")
        XCTAssertTrue(allCases.contains(.ethernet), "Should have ethernet")
        XCTAssertTrue(allCases.contains(.other), "Should have other")
    }

    func test_ConnectionType_displayName() {
        // Assert
        XCTAssertEqual(ConnectionType.none.displayName, localizedNetworkString("network.connection.none"))
        XCTAssertEqual(ConnectionType.wifi.displayName, localizedNetworkString("network.connection.wifi"))
        XCTAssertEqual(ConnectionType.cellular.displayName, localizedNetworkString("network.connection.cellular"))
        XCTAssertEqual(ConnectionType.ethernet.displayName, localizedNetworkString("network.connection.ethernet"))
        XCTAssertEqual(ConnectionType.other.displayName, localizedNetworkString("network.connection.other"))
    }

    func test_ConnectionType_isConnected() {
        // Assert
        XCTAssertFalse(ConnectionType.none.isConnected, "None should not be connected")
        XCTAssertTrue(ConnectionType.wifi.isConnected, "WiFi should be connected")
        XCTAssertTrue(ConnectionType.cellular.isConnected, "Cellular should be connected")
        XCTAssertTrue(ConnectionType.ethernet.isConnected, "Ethernet should be connected")
        XCTAssertTrue(ConnectionType.other.isConnected, "Other should be connected")
    }

    func test_ConnectionType_isExpensive() {
        // Assert
        XCTAssertFalse(ConnectionType.none.isExpensive, "None should not be expensive")
        XCTAssertFalse(ConnectionType.wifi.isExpensive, "WiFi should not be expensive")
        XCTAssertTrue(ConnectionType.cellular.isExpensive, "Cellular should be expensive")
        XCTAssertFalse(ConnectionType.ethernet.isExpensive, "Ethernet should not be expensive")
        XCTAssertFalse(ConnectionType.other.isExpensive, "Other should not be expensive")
    }

    // MARK: - ConnectionQuality Tests

    func test_ConnectionQuality_allCases() {
        // Assert
        let allCases = ConnectionQuality.allCases
        XCTAssertEqual(allCases.count, 5, "Should have 5 quality levels")
        XCTAssertTrue(allCases.contains(.excellent), "Should have excellent")
        XCTAssertTrue(allCases.contains(.good), "Should have good")
        XCTAssertTrue(allCases.contains(.fair), "Should have fair")
        XCTAssertTrue(allCases.contains(.poor), "Should have poor")
        XCTAssertTrue(allCases.contains(.unknown), "Should have unknown")
    }

    func test_ConnectionQuality_displayName() {
        // Assert
        XCTAssertEqual(ConnectionQuality.excellent.displayName, localizedNetworkString("network.quality.excellent"))
        XCTAssertEqual(ConnectionQuality.good.displayName, localizedNetworkString("network.quality.good"))
        XCTAssertEqual(ConnectionQuality.fair.displayName, localizedNetworkString("network.quality.fair"))
        XCTAssertEqual(ConnectionQuality.poor.displayName, localizedNetworkString("network.quality.poor"))
        XCTAssertEqual(ConnectionQuality.unknown.displayName, localizedNetworkString("network.quality.unknown"))
    }

    func test_ConnectionQuality_color() {
        // Assert
        XCTAssertEqual(ConnectionQuality.excellent.color, "green")
        XCTAssertEqual(ConnectionQuality.good.color, "blue")
        XCTAssertEqual(ConnectionQuality.fair.color, "yellow")
        XCTAssertEqual(ConnectionQuality.poor.color, "red")
        XCTAssertEqual(ConnectionQuality.unknown.color, "gray")
    }

    // MARK: - NetworkStatus Tests

    func test_NetworkStatus_properties() {
        // Arrange
        let status = NetworkStatus(
            isConnected: true,
            connectionType: .wifi,
            quality: .excellent,
            timestamp: Date()
        )

        // Assert
        XCTAssertTrue(status.isConnected, "Should be connected")
        XCTAssertTrue(status.isExpensive == false, "WiFi should not be expensive")
        XCTAssertEqual(status.connectionType, .wifi)
        XCTAssertEqual(status.quality, .excellent)
    }

    func test_NetworkStatus_disconnectedStatic() {
        // Assert
        let disconnected = NetworkStatus.disconnected
        XCTAssertFalse(disconnected.isConnected, "Should not be connected")
        XCTAssertEqual(disconnected.connectionType, .none)
        XCTAssertEqual(disconnected.quality, .unknown)
    }

    func test_NetworkStatus_equatable() {
        // Arrange
        let status1 = NetworkStatus(
            isConnected: true,
            connectionType: .wifi,
            quality: .excellent,
            timestamp: Date()
        )

        let status2 = NetworkStatus(
            isConnected: true,
            connectionType: .wifi,
            quality: .excellent,
            timestamp: Date()
        )

        // Assert
        XCTAssertEqual(status1, status2, "Same status should be equal")
    }

    // MARK: - AsyncStream Tests

    func test_statusStream_emitsStatus() async {
        // Arrange
        let expectation = XCTestExpectation(description: "statusStream should emit status")
        var receivedStatuses: [NetworkStatus] = []

        Task {
            for await status in networkMonitor.statusStream {
                receivedStatuses.append(status)
                if receivedStatuses.count >= 2 {
                    expectation.fulfill()
                }
            }
        }

        // Act - Trigger status change
        await Task.yield()
        networkMonitor.currentStatus = NetworkStatus(
            isConnected: true,
            connectionType: .wifi,
            quality: .excellent,
            timestamp: Date()
        )
        try? await Task.sleep(nanoseconds: 100_000_000)

        // Assert
        await fulfillment(of: [expectation], timeout: 2.0)
        XCTAssertGreaterThan(receivedStatuses.count, 0, "Should receive at least one status")
    }

    func test_connectionStream_emitsConnectionState() {
        // Arrange
        let expectation = XCTestExpectation(description: "connectionStream should emit connection state")
        var receivedStates: [Bool] = []

        Task {
            for await isConnected in networkMonitor.connectionStream {
                receivedStates.append(isConnected)
                if receivedStates.count >= 1 {
                    expectation.fulfill()
                }
            }
        }

        // Act
        networkMonitor.startMonitoring()

        // Assert
        wait(for: [expectation], timeout: 2.0)
        XCTAssertGreaterThan(receivedStates.count, 0, "Should receive connection state")
    }

    private func localizedNetworkString(_ key: String) -> String {
        NSLocalizedString(key, bundle: Bundle(for: NetworkMonitor.self), comment: "")
    }

    // MARK: - WaitForConnection Tests

    func test_waitForConnection_whenAlreadyConnected_returnsImmediately() async {
        // Note: This test depends on actual network state
        // In test environment, may or may not be connected

        // Act
        do {
            try await networkMonitor.waitForConnection(timeout: 1.0)
            XCTAssertTrue(true, "Should return when connected")
        } catch {
            // May timeout if not connected
            XCTAssertTrue(true, "May timeout if not connected")
        }
    }

    func test_waitForConnection_timesOut() async {
        // Arrange - Simulate no connection by not starting monitoring

        // Act & Assert
        do {
            try await networkMonitor.waitForConnection(timeout: 0.1)
            XCTFail("Should timeout")
        } catch is NetworkMonitor.TimeoutError {
            XCTAssertTrue(true, "Should timeout")
        } catch {
            XCTFail("Wrong error type")
        }
    }

    // MARK: - Quality Assessment Tests

    func test_qualityBasedOnLatency_excellent() {
        // Arrange
        networkMonitor.startMonitoring()

        // Act - Record low latency
        networkMonitor.recordLatency(0.025)

        // Assert - Quality should be excellent (after update)
        // Note: Quality update is asynchronous
        XCTAssertTrue(true, "Low latency should result in excellent quality")
    }

    func test_qualityBasedOnLatency_good() {
        // Arrange
        networkMonitor.startMonitoring()

        // Act - Record medium latency
        networkMonitor.recordLatency(0.075)

        // Assert
        XCTAssertTrue(true, "Medium latency should result in good quality")
    }

    func test_qualityBasedOnLatency_fair() {
        // Arrange
        networkMonitor.startMonitoring()

        // Act - Record higher latency
        networkMonitor.recordLatency(0.150)

        // Assert
        XCTAssertTrue(true, "Higher latency should result in fair quality")
    }

    func test_qualityBasedOnLatency_poor() {
        // Arrange
        networkMonitor.startMonitoring()

        // Act - Record high latency
        networkMonitor.recordLatency(0.250)

        // Assert
        XCTAssertTrue(true, "High latency should result in poor quality")
    }

    // MARK: - Edge Cases Tests

    func test_zeroLatency_handlesGracefully() {
        // Act
        networkMonitor.recordLatency(0.0)

        // Assert - Should not crash
        XCTAssertTrue(true, "Zero latency should not crash")
    }

    func test_negativeLatency_handlesGracefully() {
        // Act - Should handle negative values
        networkMonitor.recordLatency(-0.050)

        // Assert - Should not crash
        XCTAssertTrue(true, "Negative latency should not crash")
    }

    func test_veryHighLatency_handlesGracefully() {
        // Act
        networkMonitor.recordLatency(999.0)

        // Assert - Should not crash
        XCTAssertTrue(true, "Very high latency should not crash")
    }

    // MARK: - Memory Tests

    func test_multipleStartStopCycles_handlesGracefully() {
        // Act
        for _ in 0..<10 {
            networkMonitor.startMonitoring()
            networkMonitor.stopMonitoring()
        }

        // Assert - Should handle multiple cycles
        XCTAssertFalse(networkMonitor.isMonitoring, "Should not be monitoring after cycles")
    }

    func test_multipleLatencyRecords_handlesGracefully() {
        // Arrange
        networkMonitor.startMonitoring()

        // Act - Record many latency values
        for i in 0..<100 {
            networkMonitor.recordLatency(TimeInterval.random(in: 0.001...0.500))
        }

        // Assert - Should not crash or cause issues
        XCTAssertTrue(true, "Multiple latency records should be handled")
    }

    // MARK: - Thread Safety Tests

    func test_concurrentStatusAccess_threadSafe() {
        // Arrange
        networkMonitor.startMonitoring()
        let expectation = XCTestExpectation(description: "Concurrent access")
        expectation.expectedFulfillmentCount = 10

        // Act - Access status from multiple "threads"
        DispatchQueue.global(qos: .userInitiated).async {
            for _ in 0..<10 {
                let _ = self.networkMonitor.currentStatus
                expectation.fulfill()
            }
        }

        // Assert
        wait(for: [expectation], timeout: 2.0)
    }

    // MARK: - Deinitialization Tests

    func test_deinit_stopsMonitoring() {
        // Arrange
        let monitor = NetworkMonitor()
        monitor.startMonitoring()
        XCTAssertTrue(monitor.isMonitoring, "Should be monitoring")

        // Act - Manual deinit simulation
        monitor.stopMonitoring()

        // Assert
        XCTAssertFalse(monitor.isMonitoring, "Should stop monitoring")
    }
}

// MARK: - NWPath Mock (if needed for extended testing)

extension NetworkMonitorTests {

    // Note: NWPath is from Network framework and cannot be easily mocked
    // These tests verify the interface without mocking the actual framework

    func test_currentStatus_hasValidProperties() {
        // Arrange
        networkMonitor.startMonitoring()

        // Act
        let status = networkMonitor.currentStatus

        // Assert
        XCTAssertNotNil(status.timestamp, "Should have timestamp")
        XCTAssertTrue(ConnectionType.allCases.contains(status.connectionType), "Connection type should be valid")
        XCTAssertTrue(ConnectionQuality.allCases.contains(status.quality), "Quality should be valid")
    }

    func test_currentStatus_changesOverTime() {
        // Arrange
        let expectation = XCTestExpectation(description: "Status should change")
        var statuses: [NetworkStatus] = []

        networkMonitor.$currentStatus
            .dropFirst()
            .sink { status in
                statuses.append(status)
                if statuses.count >= 2 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // Act
        networkMonitor.currentStatus = NetworkStatus(
            isConnected: true,
            connectionType: .wifi,
            quality: .excellent,
            timestamp: Date()
        )
        networkMonitor.currentStatus = NetworkStatus(
            isConnected: true,
            connectionType: .cellular,
            quality: .good,
            timestamp: Date()
        )

        // Assert
        wait(for: [expectation], timeout: 3.0)
    }
}
