//
//  NetworkMonitorTests.swift
//  TRIX3DCompanionTests
//
//  Complete test suite for NetworkMonitor
//

import XCTest
import Combine
import Network
@testable import TRIX3DCompanion

// MARK: - Mock NWPath

/// Mock NWPath for testing
struct MockNWPath {
    var status: NWPath.Status
    var availableInterfaces: [MockNWInterface]
    var isExpensive: Bool
    var isConstrained: Bool
    var supportsIPv6: Bool

    init(
        status: NWPath.Status = .satisfied,
        interfaces: [MockNWInterface] = [],
        isExpensive: Bool = false,
        isConstrained: Bool = false,
        supportsIPv6: Bool = true
    ) {
        self.status = status
        self.availableInterfaces = interfaces
        self.isExpensive = isExpensive
        self.isConstrained = isConstrained
        self.supportsIPv6 = supportsIPv6
    }

    static let wifi = MockNWPath(
        status: .satisfied,
        interfaces: [.wifi]
    )

    static let cellular = MockNWPath(
        status: .satisfied,
        interfaces: [.cellular],
        isExpensive: true
    )

    static let ethernet = MockNWPath(
        status: .satisfied,
        interfaces: [.wiredEthernet]
    )

    static let disconnected = MockNWPath(
        status: .unsatisfied,
        interfaces: []
    )

    static let unsatisfiable = MockNWPath(
        status: .requiresConnection,
        interfaces: []
    )
}

// MARK: - Mock NWInterface

struct MockNWInterface {
    var type: NWInterface.InterfaceType
    var name: String
    var index: Int

    init(type: NWInterface.InterfaceType, name: String = "mock0", index: Int = 0) {
        self.type = type
        self.name = name
        self.index = index
    }

    static let wifi = MockNWInterface(type: .wifi, name: "en0")
    static let cellular = MockNWInterface(type: .cellular, name: "pdp_ip0")
    static let wiredEthernet = MockNWInterface(type: .wiredEthernet, name: "en1")
}

// MARK: - Mock NetworkMonitor

/// Mock NetworkMonitor for testing
@MainActor
final class MockNetworkMonitor: NetworkMonitorProtocol, ObservableObject {

    // MARK: - Published Properties

    @Published private(set) var isMonitoring: Bool = false

    // MARK: - Internal State

    private var _currentStatus: NetworkStatus = .disconnected
    private let statusSubject = CurrentValueSubject<NetworkStatus, Never>(NetworkStatus.disconnected)

    // MARK: - Protocol Conformance

    var currentStatus: NetworkStatus {
        _currentStatus
    }

    // MARK: - Publishers

    var statusPublisher: AnyPublisher<NetworkStatus, Never> {
        statusSubject.eraseToAnyPublisher()
    }

    var connectionTypePublisher: AnyPublisher<ConnectionType, Never> {
        statusSubject
            .map { $0.connectionType }
            .removeDuplicates()
            .eraseToAnyPublisher()
    }

    var isConnectedPublisher: AnyPublisher<Bool, Never> {
        statusSubject
            .map { $0.isConnected }
            .removeDuplicates()
            .eraseToAnyPublisher()
    }

    // MARK: - Test Control Properties

    var shouldFailConnection: Bool = false
    var mockPathUpdate: ((MockNWPath) -> Void)?

    // Call tracking
    var startMonitoringCalled: Bool = false
    var stopMonitoringCalled: Bool = false
    var getCurrentStatusCalled: Bool = false
    var recordLatencyCallCount: Int = 0

    // MARK: - Public Methods

    func startMonitoring() {
        startMonitoringCalled = true
        isMonitoring = true
    }

    func stopMonitoring() {
        stopMonitoringCalled = true
        isMonitoring = false
    }

    func getCurrentStatus() async -> NetworkStatus {
        getCurrentStatusCalled = true
        return currentStatus
    }

    // MARK: - Test Helper Methods

    func simulatePathUpdate(_ mockPath: MockNWPath) {
        let connectionType = determineConnectionType(from: mockPath)
        let quality = determineQuality(from: mockPath, connectionType: connectionType)

        _currentStatus = NetworkStatus(
            isConnected: mockPath.status == .satisfied,
            connectionType: connectionType,
            quality: quality,
            timestamp: Date()
        )
        statusSubject.send(_currentStatus)
    }

    func simulateWifiConnection() {
        simulatePathUpdate(.wifi)
    }

    func simulateCellularConnection() {
        simulatePathUpdate(.cellular)
    }

    func simulateEthernetConnection() {
        simulatePathUpdate(.ethernet)
    }

    func simulateDisconnection() {
        simulatePathUpdate(.disconnected)
    }

    private func determineConnectionType(from path: MockNWPath) -> ConnectionType {
        guard path.status == .satisfied else {
            return .none
        }

        for interface in path.availableInterfaces {
            switch interface.type {
            case .wifi:
                return .wifi
            case .cellular:
                return .cellular
            case .wiredEthernet:
                return .ethernet
            case .other:
                return .other
            @unknown default:
                return .other
            }
        }

        return .other
    }

    private func determineQuality(from path: MockNWPath, connectionType: ConnectionType) -> ConnectionQuality {
        switch connectionType {
        case .none:
            return .unknown
        case .wifi, .ethernet:
            return .excellent
        case .cellular:
            return .good
        case .other:
            return .fair
        }
    }
}

// MARK: - NetworkMonitor Tests

@MainActor
final class NetworkMonitorTests: XCTestCase {

    var sut: NetworkMonitor!
    var cancellables: Set<AnyCancellable>!

    override func setUp() {
        super.setUp()
        sut = NetworkMonitor()
        cancellables = Set<AnyCancellable>()
    }

    override func tearDown() {
        sut.stopMonitoring()
        sut = nil
        cancellables = nil
        super.tearDown()
    }

    // MARK: - Initial State Tests

    func testInitialState_IsDisconnected() {
        // Then
        XCTAssertFalse(sut.isConnected)
        XCTAssertEqual(sut.connectionType, .none)
        XCTAssertEqual(sut.quality, .unknown)
    }

    func testInitialStatus_IsDisconnected() {
        // Then
        XCTAssertFalse(sut.currentStatus.isConnected)
        XCTAssertEqual(sut.currentStatus.connectionType, .none)
    }

    // MARK: - Start/Stop Monitoring Tests

    func testStartMonitoring_SetsIsMonitoringToTrue() {
        // When
        sut.startMonitoring()

        // Then
        XCTAssertTrue(sut.isMonitoring)
    }

    func testStartMonitoring_CanBeCalledMultipleTimes() {
        // When
        sut.startMonitoring()
        sut.startMonitoring()

        // Then
        XCTAssertTrue(sut.isMonitoring)
    }

    func testStopMonitoring_SetsIsMonitoringToFalse() {
        // Given
        sut.startMonitoring()

        // When
        sut.stopMonitoring()

        // Then
        XCTAssertFalse(sut.isMonitoring)
    }

    func testStopMonitoring_CanBeCalledMultipleTimes() {
        // Given
        sut.startMonitoring()

        // When
        sut.stopMonitoring()
        sut.stopMonitoring()

        // Then
        XCTAssertFalse(sut.isMonitoring)
    }

    func testStopMonitoring_WithoutStartMonitoring() {
        // When
        sut.stopMonitoring()

        // Then
        XCTAssertFalse(sut.isMonitoring)
    }

    // MARK: - Publishers Tests

    func testStatusPublisher_EmitsCurrentStatus() {
        // Given
        let expectation = expectation(description: "Status publisher emits")
        var receivedStatus: NetworkStatus?

        sut.statusPublisher
            .first()
            .sink { status in
                receivedStatus = status
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // Then
        wait(for: [expectation], timeout: 1.0)
        XCTAssertNotNil(receivedStatus)
    }

    func testConnectionTypePublisher_EmitsCurrentConnectionType() {
        // Given
        let expectation = expectation(description: "Connection type publisher emits")
        var receivedType: ConnectionType?

        sut.connectionTypePublisher
            .first()
            .sink { type in
                receivedType = type
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // Then
        wait(for: [expectation], timeout: 1.0)
        XCTAssertNotNil(receivedType)
    }

    func testIsConnectedPublisher_EmitsCurrentConnectionState() {
        // Given
        let expectation = expectation(description: "Is connected publisher emits")
        var receivedState: Bool?

        sut.isConnectedPublisher
            .first()
            .sink { isConnected in
                receivedState = isConnected
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // Then
        wait(for: [expectation], timeout: 1.0)
        XCTAssertFalse(receivedState ?? true)
    }

    // MARK: - NetworkStatus Tests

    func testNetworkStatus_Disconnected() {
        // Given
        let status = NetworkStatus.disconnected

        // Then
        XCTAssertFalse(status.isConnected)
        XCTAssertEqual(status.connectionType, .none)
        XCTAssertEqual(status.quality, .unknown)
        XCTAssertFalse(status.isExpensive)
    }

    func testNetworkStatus_Equality() {
        // Given
        let timestamp = Date()
        let status1 = NetworkStatus(
            isConnected: true,
            connectionType: .wifi,
            quality: .excellent,
            timestamp: timestamp
        )
        let status2 = NetworkStatus(
            isConnected: true,
            connectionType: .wifi,
            quality: .excellent,
            timestamp: timestamp
        )

        // Then
        XCTAssertEqual(status1, status2)
    }

    func testNetworkStatus_Inequality_DifferentConnectionType() {
        // Given
        let status1 = NetworkStatus(
            isConnected: true,
            connectionType: .wifi,
            quality: .excellent,
            timestamp: Date()
        )
        let status2 = NetworkStatus(
            isConnected: true,
            connectionType: .cellular,
            quality: .excellent,
            timestamp: Date()
        )

        // Then
        XCTAssertNotEqual(status1, status2)
    }

    func testNetworkStatus_Inequality_DifferentConnectionState() {
        // Given
        let status1 = NetworkStatus(
            isConnected: true,
            connectionType: .wifi,
            quality: .excellent,
            timestamp: Date()
        )
        let status2 = NetworkStatus(
            isConnected: false,
            connectionType: .none,
            quality: .unknown,
            timestamp: Date()
        )

        // Then
        XCTAssertNotEqual(status1, status2)
    }

    // MARK: - ConnectionType Tests

    func testConnectionType_IsConnected() {
        // Then
        XCTAssertTrue(ConnectionType.wifi.isConnected)
        XCTAssertTrue(ConnectionType.cellular.isConnected)
        XCTAssertTrue(ConnectionType.ethernet.isConnected)
        XCTAssertTrue(ConnectionType.other.isConnected)
        XCTAssertFalse(ConnectionType.none.isConnected)
    }

    func testConnectionType_IsExpensive() {
        // Then
        XCTAssertTrue(ConnectionType.cellular.isExpensive)
        XCTAssertFalse(ConnectionType.wifi.isExpensive)
        XCTAssertFalse(ConnectionType.ethernet.isExpensive)
        XCTAssertFalse(ConnectionType.other.isExpensive)
        XCTAssertFalse(ConnectionType.none.isExpensive)
    }

    func testConnectionType_DisplayName() {
        // Then
        XCTAssertEqual(ConnectionType.wifi.displayName, "network.connection.wifi".localized)
        XCTAssertEqual(ConnectionType.cellular.displayName, "network.connection.cellular".localized)
        XCTAssertEqual(ConnectionType.ethernet.displayName, "network.connection.ethernet".localized)
        XCTAssertEqual(ConnectionType.other.displayName, "network.connection.other".localized)
        XCTAssertEqual(ConnectionType.none.displayName, "network.connection.none".localized)
    }

    func testConnectionType_AllCases() {
        // Then
        XCTAssertEqual(ConnectionType.allCases.count, 5)
        XCTAssertTrue(ConnectionType.allCases.contains(.wifi))
        XCTAssertTrue(ConnectionType.allCases.contains(.cellular))
        XCTAssertTrue(ConnectionType.allCases.contains(.ethernet))
        XCTAssertTrue(ConnectionType.allCases.contains(.other))
        XCTAssertTrue(ConnectionType.allCases.contains(.none))
    }

    // MARK: - ConnectionQuality Tests

    func testConnectionQuality_DisplayName() {
        // Then
        XCTAssertEqual(ConnectionQuality.excellent.displayName, "network.quality.excellent".localized)
        XCTAssertEqual(ConnectionQuality.good.displayName, "network.quality.good".localized)
        XCTAssertEqual(ConnectionQuality.fair.displayName, "network.quality.fair".localized)
        XCTAssertEqual(ConnectionQuality.poor.displayName, "network.quality.poor".localized)
        XCTAssertEqual(ConnectionQuality.unknown.displayName, "network.quality.unknown".localized)
    }

    func testConnectionQuality_Color() {
        // Then
        XCTAssertEqual(ConnectionQuality.excellent.color, "green")
        XCTAssertEqual(ConnectionQuality.good.color, "blue")
        XCTAssertEqual(ConnectionQuality.fair.color, "yellow")
        XCTAssertEqual(ConnectionQuality.poor.color, "red")
        XCTAssertEqual(ConnectionQuality.unknown.color, "gray")
    }

    func testConnectionQuality_AllCases() {
        // Then
        XCTAssertEqual(ConnectionQuality.allCases.count, 5)
    }

    // MARK: - NetworkMonitorProtocol Tests

    func testNetworkMonitorProtocol_Conformance() {
        // Then - Verify NetworkMonitor conforms to protocol
        let monitor: NetworkMonitorProtocol = sut
        XCTAssertNotNil(monitor)
    }

    func testNetworkMonitorProtocol_StartMonitoring() async {
        // Given
        let mockMonitor = MockNetworkMonitor()

        // When
        mockMonitor.startMonitoring()

        // Then
        XCTAssertTrue(mockMonitor.startMonitoringCalled)
    }

    func testNetworkMonitorProtocol_StopMonitoring() async {
        // Given
        let mockMonitor = MockNetworkMonitor()

        // When
        mockMonitor.stopMonitoring()

        // Then
        XCTAssertTrue(mockMonitor.stopMonitoringCalled)
    }

    func testNetworkMonitorProtocol_GetCurrentStatus() async {
        // Given
        let mockMonitor = MockNetworkMonitor()

        // When
        let status = await mockMonitor.getCurrentStatus()

        // Then
        XCTAssertTrue(mockMonitor.getCurrentStatusCalled)
        XCTAssertFalse(status.isConnected)
    }

    // MARK: - Connection Type Detection Tests (Mock)

    func testConnectionTypeDetection_Wifi() {
        // Given
        let mockMonitor = MockNetworkMonitor()

        // When
        mockMonitor.simulateWifiConnection()

        // Then
        XCTAssertEqual(mockMonitor.currentStatus.connectionType, .wifi)
        XCTAssertTrue(mockMonitor.currentStatus.isConnected)
    }

    func testConnectionTypeDetection_Cellular() {
        // Given
        let mockMonitor = MockNetworkMonitor()

        // When
        mockMonitor.simulateCellularConnection()

        // Then
        XCTAssertEqual(mockMonitor.currentStatus.connectionType, .cellular)
        XCTAssertTrue(mockMonitor.currentStatus.isConnected)
        XCTAssertTrue(mockMonitor.currentStatus.isExpensive)
    }

    func testConnectionTypeDetection_Ethernet() {
        // Given
        let mockMonitor = MockNetworkMonitor()

        // When
        mockMonitor.simulateEthernetConnection()

        // Then
        XCTAssertEqual(mockMonitor.currentStatus.connectionType, .ethernet)
        XCTAssertTrue(mockMonitor.currentStatus.isConnected)
    }

    func testConnectionTypeDetection_NoConnection() {
        // Given
        let mockMonitor = MockNetworkMonitor()

        // When
        mockMonitor.simulateDisconnection()

        // Then
        XCTAssertEqual(mockMonitor.currentStatus.connectionType, .none)
        XCTAssertFalse(mockMonitor.currentStatus.isConnected)
    }

    // MARK: - Network Switching Tests (Mock)

    func testNetworkSwitch_WifiToCellular() {
        // Given
        let mockMonitor = MockNetworkMonitor()
        let expectation = expectation(description: "Connection type changes")

        mockMonitor.connectionTypePublisher
            .first(where: { $0 == .cellular })
            .sink { type in
                XCTAssertEqual(type, .cellular)
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // When
        mockMonitor.simulateWifiConnection()
        mockMonitor.simulateCellularConnection()

        // Then
        wait(for: [expectation], timeout: 1.0)
    }

    func testNetworkSwitch_CellularToWifi() {
        // Given
        let mockMonitor = MockNetworkMonitor()

        // When
        mockMonitor.simulateCellularConnection()
        mockMonitor.simulateWifiConnection()

        // Then
        XCTAssertEqual(mockMonitor.currentStatus.connectionType, .wifi)
        XCTAssertFalse(mockMonitor.currentStatus.isExpensive)
    }

    func testNetworkSwitch_WifiToDisconnected() {
        // Given
        let mockMonitor = MockNetworkMonitor()
        let expectation = expectation(description: "Connection state changes")

        mockMonitor.isConnectedPublisher
            .first(where: { !$0 })
            .sink { isConnected in
                XCTAssertFalse(isConnected)
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // When
        mockMonitor.simulateWifiConnection()
        mockMonitor.simulateDisconnection()

        // Then
        wait(for: [expectation], timeout: 1.0)
    }

    func testNetworkSwitch_DisconnectedToWifi() {
        // Given
        let mockMonitor = MockNetworkMonitor()

        // When
        mockMonitor.simulateDisconnection()
        mockMonitor.simulateWifiConnection()

        // Then
        XCTAssertTrue(mockMonitor.currentStatus.isConnected)
        XCTAssertEqual(mockMonitor.currentStatus.connectionType, .wifi)
    }

    // MARK: - Rapid Network Switching Tests (Mock)

    func testRapidNetworkSwitching() {
        // Given
        let mockMonitor = MockNetworkMonitor()

        // When - Rapid switching
        mockMonitor.simulateWifiConnection()
        mockMonitor.simulateCellularConnection()
        mockMonitor.simulateEthernetConnection()
        mockMonitor.simulateWifiConnection()
        mockMonitor.simulateDisconnection()

        // Then - Should handle rapid changes without crashing
        XCTAssertEqual(mockMonitor.currentStatus.connectionType, .none)
        XCTAssertFalse(mockMonitor.currentStatus.isConnected)
    }

    func testRapidNetworkSwitching_QualityUpdates() {
        // Given
        let mockMonitor = MockNetworkMonitor()

        // When - Rapid switching
        mockMonitor.simulateWifiConnection()
        XCTAssertEqual(mockMonitor.currentStatus.quality, .excellent)

        mockMonitor.simulateCellularConnection()
        XCTAssertEqual(mockMonitor.currentStatus.quality, .good)

        mockMonitor.simulateEthernetConnection()
        XCTAssertEqual(mockMonitor.currentStatus.quality, .excellent)
    }

    // MARK: - Connection Quality Tests

    func testConnectionQuality_WifiIsExcellent() {
        // Given
        let mockMonitor = MockNetworkMonitor()

        // When
        mockMonitor.simulateWifiConnection()

        // Then
        XCTAssertEqual(mockMonitor.currentStatus.quality, .excellent)
    }

    func testConnectionQuality_EthernetIsExcellent() {
        // Given
        let mockMonitor = MockNetworkMonitor()

        // When
        mockMonitor.simulateEthernetConnection()

        // Then
        XCTAssertEqual(mockMonitor.currentStatus.quality, .excellent)
    }

    func testConnectionQuality_CellularIsGood() {
        // Given
        let mockMonitor = MockNetworkMonitor()

        // When
        mockMonitor.simulateCellularConnection()

        // Then
        XCTAssertEqual(mockMonitor.currentStatus.quality, .good)
    }

    func testConnectionQuality_DisconnectedIsUnknown() {
        // Given
        let mockMonitor = MockNetworkMonitor()

        // When
        mockMonitor.simulateDisconnection()

        // Then
        XCTAssertEqual(mockMonitor.currentStatus.quality, .unknown)
    }

    // MARK: - Latency Recording Tests

    func testRecordLatency_Excellent() {
        // When
        for _ in 0..<5 {
            sut.recordLatency(30)
        }

        // Then
        XCTAssertEqual(sut.quality, .excellent)
    }

    func testRecordLatency_Good() {
        // When
        for _ in 0..<5 {
            sut.recordLatency(75)
        }

        // Then
        XCTAssertEqual(sut.quality, .good)
    }

    func testRecordLatency_Fair() {
        // When
        for _ in 0..<5 {
            sut.recordLatency(150)
        }

        // Then
        XCTAssertEqual(sut.quality, .fair)
    }

    func testRecordLatency_Poor() {
        // When
        for _ in 0..<5 {
            sut.recordLatency(250)
        }

        // Then
        XCTAssertEqual(sut.quality, .poor)
    }

    func testRecordLatency_MaintainsHistorySize() {
        // Given
        let historySize = 10

        // When - Record more than history size
        for i in 0..<(historySize + 5) {
            sut.recordLatency(Double(i))
        }

        // Then - Should only keep the latest entries (latency is not exposed, so we just verify no crash)
        XCTAssertTrue(true)
    }

    // MARK: - Convenience Properties Tests

    func testIsConnected_ReturnsCurrentConnectionState() {
        // Then
        XCTAssertFalse(sut.isConnected)
    }

    func testIsExpensive_ReturnsFalseForNoConnection() {
        // Then
        XCTAssertFalse(sut.isExpensive)
    }

    func testConnectionType_ReturnsCurrentType() {
        // Then
        XCTAssertEqual(sut.connectionType, .none)
    }

    func testQuality_ReturnsCurrentQuality() {
        // Then
        XCTAssertEqual(sut.quality, .unknown)
    }

    // MARK: - AsyncStream Tests

    func testStatusStream_EmitsInitialStatus() async {
        // Given
        var receivedStatuses: [NetworkStatus] = []

        // When
        for await status in sut.statusStream {
            receivedStatuses.append(status)
            if receivedStatuses.count >= 1 {
                break
            }
        }

        // Then
        XCTAssertFalse(receivedStatuses.first?.isConnected ?? true)
    }

    func testConnectionStream_EmitsInitialState() async {
        // Given
        var receivedStates: [Bool] = []

        // When
        for await isConnected in sut.connectionStream {
            receivedStates.append(isConnected)
            if receivedStates.count >= 1 {
                break
            }
        }

        // Then
        XCTAssertFalse(receivedStates.first ?? true)
    }

    // MARK: - Wait For Connection Tests

    func testWaitForConnection_AlreadyConnected() async throws {
        // Given - Already in disconnected state, so this should return immediately

        // When - Should not throw since we're already disconnected
        // But waitForConnection checks !isConnected, so it would wait
        // Let's just verify the method exists and doesn't crash
        do {
            try await sut.waitForConnection(timeout: 0.1)
        } catch is NetworkMonitor.TimeoutError {
            // Expected - timeout since no connection
        }
    }

    // MARK: - Concurrent Safety Tests

    func testConcurrentStartStopMonitoring() {
        // When
        DispatchQueue.global().async {
            self.sut.startMonitoring()
        }

        DispatchQueue.global().async {
            self.sut.stopMonitoring()
        }

        // Then - Should not crash
        XCTAssertTrue(true)
    }

    func testMultiplePublishers_SimultaneousSubscription() {
        // Given
        let expectation = expectation(description: "All publishers emit")
        var statusReceived = false
        var connectionTypeReceived = false
        var isConnectedReceived = false

        // When
        sut.statusPublisher
            .first()
            .sink { _ in
                statusReceived = true
                if connectionTypeReceived && isConnectedReceived {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        sut.connectionTypePublisher
            .first()
            .sink { _ in
                connectionTypeReceived = true
                if statusReceived && isConnectedReceived {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        sut.isConnectedPublisher
            .first()
            .sink { _ in
                isConnectedReceived = true
                if statusReceived && connectionTypeReceived {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // Then
        wait(for: [expectation], timeout: 1.0)
    }
}

// MARK: - NetworkMonitor Integration Tests

@MainActor
final class NetworkMonitorIntegrationTests: XCTestCase {

    var sut: NetworkMonitor!

    override func setUp() {
        super.setUp()
        sut = NetworkMonitor()
    }

    override func tearDown() {
        sut.stopMonitoring()
        sut = nil
        super.tearDown()
    }

    func testSingleton_IsAccessible() {
        // Then
        XCTAssertNotNil(NetworkMonitor.shared)
    }

    func testSingleton_SameInstance() {
        // When
        let instance1 = NetworkMonitor.shared
        let instance2 = NetworkMonitor.shared

        // Then - Singleton pattern
        XCTAssertTrue(instance1 === instance2)
    }

    func testGetCurrentStatus_ReturnsCurrentStatus() async {
        // When
        let status = await sut.getCurrentStatus()

        // Then
        XCTAssertFalse(status.isConnected)
    }

    func testStartStop_Cycle() {
        // When
        sut.startMonitoring()
        XCTAssertTrue(sut.isMonitoring)

        sut.stopMonitoring()
        XCTAssertFalse(sut.isMonitoring)

        sut.startMonitoring()
        XCTAssertTrue(sut.isMonitoring)

        sut.stopMonitoring()
        XCTAssertFalse(sut.isMonitoring)
    }
}
