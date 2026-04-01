//
//  DiagnosticViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Complete test suite for DiagnosticViewModel
//

import XCTest
import Combine
@testable import TRIX3DCompanion

// MARK: - DiagnosticViewModel Tests

@MainActor
final class DiagnosticViewModelTests: XCTestCase {

    // MARK: - Properties

    var sut: DiagnosticViewModel!
    var mockNetworkMonitor: MockDiagnosticNetworkMonitor!
    var mockCacheService: MockOfflineCacheServiceForDiagnostic!
    var cancellables: Set<AnyCancellable>!
    var endpointLatencyMs: Double!

    // MARK: - Test Lifecycle

    override func setUp() {
        super.setUp()

        mockNetworkMonitor = MockDiagnosticNetworkMonitor()
        mockCacheService = MockOfflineCacheServiceForDiagnostic()
        endpointLatencyMs = 42
        let simulatedLatency = endpointLatencyMs ?? 42

        sut = DiagnosticViewModel(
            networkMonitor: mockNetworkMonitor,
            cacheService: mockCacheService,
            endpointLatencyMeasurer: { _ in simulatedLatency }
        )

        cancellables = Set<AnyCancellable>()
    }

    override func tearDown() {
        sut = nil
        mockNetworkMonitor = nil
        mockCacheService = nil
        cancellables = nil
        endpointLatencyMs = nil
        super.tearDown()
    }

    // MARK: - Initial State Tests

    func testInitialState_NetworkDisconnected() {
        XCTAssertEqual(sut.networkStatus, .disconnected)
    }

    func testInitialState_EmptyNetworkTests() {
        XCTAssertTrue(sut.networkTests.isEmpty)
    }

    func testInitialState_NotTestingNetwork() {
        XCTAssertFalse(sut.isTestingNetwork)
    }

    func testInitialState_EmptyStorageResults() {
        XCTAssertTrue(sut.storageResults.isEmpty)
    }

    func testInitialState_NotCheckingStorage() {
        XCTAssertFalse(sut.isCheckingStorage)
    }

    func testInitialState_EmptyCacheInfo() {
        XCTAssertTrue(sut.cacheInfo.isEmpty)
    }

    func testInitialState_EmptyPerformanceMetrics() {
        XCTAssertTrue(sut.performanceMetrics.isEmpty)
    }

    func testInitialState_NotCollectingMetrics() {
        XCTAssertFalse(sut.isCollectingMetrics)
    }

    func testInitialState_EmptyLogEntries() {
        XCTAssertTrue(sut.logEntries.isEmpty)
    }

    func testInitialState_NoLogLevelFilter() {
        XCTAssertNil(sut.selectedLogLevel)
    }

    func testInitialState_NotRefreshing() {
        XCTAssertFalse(sut.isRefreshing)
    }

    func testInitialState_NoError() {
        XCTAssertNil(sut.errorMessage)
    }

    func testInitialState_NoSuccessMessage() {
        XCTAssertNil(sut.successMessage)
    }

    func testInitialState_ZeroTotalCacheSize() {
        XCTAssertEqual(sut.totalCacheSize, 0)
    }

    // MARK: - Network Monitoring Tests

    func testNetworkStatus_BindingUpdates() {
        // Given
        let expectation = expectation(description: "Network status updates")
        let newStatus = NetworkStatus(
            isConnected: true,
            connectionType: .wifi,
            quality: .excellent,
            timestamp: Date()
        )

        // When
        self.sut.$networkStatus
            .dropFirst()
            .sink { status in
                if status.isConnected {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        mockNetworkMonitor.updateStatus(newStatus)

        // Then
        wait(for: [expectation], timeout: 2.0)
        XCTAssertTrue(sut.networkStatus.isConnected)
        XCTAssertEqual(sut.networkStatus.connectionType, .wifi)
    }

    func testNetworkStatus_DisconnectUpdates() {
        // Given
        let expectation = expectation(description: "Network status updates to disconnected")
        mockNetworkMonitor.setConnected(true)
        self.sut.$networkStatus
            .dropFirst()
            .filter { !$0.isConnected }
            .prefix(1)
            .sink { status in
                XCTAssertFalse(status.isConnected)
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // When
        mockNetworkMonitor.setConnected(false)

        // Then
        wait(for: [expectation], timeout: 2.0)
        XCTAssertFalse(sut.networkStatus.isConnected)
    }

    func testNetworkMonitor_StartMonitoringCalled() {
        // Then
        XCTAssertTrue(mockNetworkMonitor.startMonitoringCalled)
    }

    // MARK: - Network Diagnostics Tests

    func testRunNetworkDiagnostics_SetsTestingState() async {
        // Given
        let expectation = expectation(description: "Testing state changes")
        var testingStates: [Bool] = []

        sut.$isTestingNetwork
            .dropFirst()
            .sink { isTesting in
                testingStates.append(isTesting)
                if testingStates.count >= 2 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        await sut.runNetworkDiagnostics()

        // Then
        await fulfillment(of: [expectation], timeout: 2.0)
        XCTAssertTrue(testingStates.first == true)
        XCTAssertTrue(testingStates.last == false)
    }

    func testRunNetworkDiagnostics_PopulatesNetworkTests() async {
        // When
        await sut.runNetworkDiagnostics()

        // Then
        XCTAssertFalse(sut.networkTests.isEmpty)
        XCTAssertEqual(sut.networkTests.count, DiagnosticAPIEndpoint.defaultEndpoints.count)
    }

    func testRunNetworkDiagnostics_ClearsPreviousResults() async {
        // Given
        await sut.runNetworkDiagnostics()
        XCTAssertFalse(sut.networkTests.isEmpty)

        // When
        await sut.runNetworkDiagnostics()

        // Then
        // Results should be refreshed (may be same count)
        XCTAssertFalse(sut.networkTests.isEmpty)
    }

    func testRunNetworkDiagnostics_PreventsConcurrentExecution() async {
        // Given
        sut.isTestingNetwork = true

        // When
        await sut.runNetworkDiagnostics()

        // Then
        // Should not execute if already testing
        XCTAssertTrue(sut.networkTests.isEmpty)
    }

    func testRunNetworkDiagnostics_ClearsErrorMessage() async {
        // Given
        sut.errorMessage = "Previous Error"

        // When
        await sut.runNetworkDiagnostics()

        // Then
        XCTAssertNil(sut.errorMessage)
    }

    // MARK: - Storage Diagnostics Tests

    func testRunStorageDiagnostics_SetsCheckingState() async {
        // Given
        let expectation = expectation(description: "Checking state changes")
        var checkingStates: [Bool] = []

        sut.$isCheckingStorage
            .dropFirst()
            .sink { isChecking in
                checkingStates.append(isChecking)
                if checkingStates.count >= 2 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        await sut.runStorageDiagnostics()

        // Then
        await fulfillment(of: [expectation], timeout: 2.0)
        XCTAssertTrue(checkingStates.first == true)
        XCTAssertTrue(checkingStates.last == false)
    }

    func testRunStorageDiagnostics_PopulatesStorageResults() async {
        // When
        await sut.runStorageDiagnostics()

        // Then
        XCTAssertFalse(sut.storageResults.isEmpty)
        XCTAssertEqual(sut.storageResults.count, 3) // UserDefaults, FileStorage, Cache
    }

    func testRunStorageDiagnostics_CalculatesTotalCacheSize() async {
        // When
        await sut.runStorageDiagnostics()

        // Then
        XCTAssertGreaterThanOrEqual(sut.totalCacheSize, 0)
    }

    func testRunStorageDiagnostics_PopulatesCacheInfo() async {
        // When
        await sut.runStorageDiagnostics()

        // Then
        XCTAssertFalse(sut.cacheInfo.isEmpty)
        XCTAssertEqual(sut.cacheInfo.count, 4) // Images, Data, Sessions, Temporary
    }

    func testRunStorageDiagnostics_PreventsConcurrentExecution() async {
        // Given
        sut.isCheckingStorage = true

        // When
        await sut.runStorageDiagnostics()

        // Then
        XCTAssertTrue(sut.storageResults.isEmpty)
    }

    func testRunStorageDiagnostics_ClearsErrorMessage() async {
        // Given
        sut.errorMessage = "Previous Error"

        // When
        await sut.runStorageDiagnostics()

        // Then
        XCTAssertNil(sut.errorMessage)
    }

    func testRunStorageDiagnostics_LargeCacheShowsWarning() async {
        // Given
        mockCacheService.setCacheSize(150 * 1024 * 1024, for: DiagnosticCacheType.images)

        // When
        await sut.runStorageDiagnostics()

        // Then
        let cacheResult = sut.storageResults.first { $0.type == .cache }
        XCTAssertEqual(cacheResult?.status, .warning)
    }

    // MARK: - Performance Metrics Tests

    func testCollectPerformanceMetrics_SetsCollectingState() async {
        // Given
        let expectation = expectation(description: "Collecting state changes")
        var collectingStates: [Bool] = []

        sut.$isCollectingMetrics
            .dropFirst()
            .sink { isCollecting in
                collectingStates.append(isCollecting)
                if collectingStates.count >= 2 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        await sut.collectPerformanceMetrics()

        // Then
        await fulfillment(of: [expectation], timeout: 2.0)
        XCTAssertTrue(collectingStates.first == true)
        XCTAssertTrue(collectingStates.last == false)
    }

    func testCollectPerformanceMetrics_PopulatesMetrics() async {
        // When
        await sut.collectPerformanceMetrics()

        // Then
        XCTAssertFalse(sut.performanceMetrics.isEmpty)
        XCTAssertEqual(sut.performanceMetrics.count, 4) // Memory, CPU, Disk, Network Latency
    }

    func testCollectPerformanceMetrics_MemoryMetricIncluded() async {
        // When
        await sut.collectPerformanceMetrics()

        // Then
        let memoryMetric = sut.performanceMetrics.first { $0.type == .memoryUsage }
        XCTAssertNotNil(memoryMetric)
        XCTAssertTrue(memoryMetric!.value > 0)
    }

    func testCollectPerformanceMetrics_CPUMetricIncluded() async {
        // When
        await sut.collectPerformanceMetrics()

        // Then
        let cpuMetric = sut.performanceMetrics.first { $0.type == .cpuUsage }
        XCTAssertNotNil(cpuMetric)
    }

    func testCollectPerformanceMetrics_DiskMetricIncluded() async {
        // When
        await sut.collectPerformanceMetrics()

        // Then
        let diskMetric = sut.performanceMetrics.first { $0.type == .diskUsage }
        XCTAssertNotNil(diskMetric)
    }

    func testCollectPerformanceMetrics_NetworkLatencyMetricIncluded() async {
        // Given
        sut.networkTests = [
            NetworkDiagnosticResult(endpoint: "Test", status: .success, latencyMs: 50)
        ]

        // When
        await sut.collectPerformanceMetrics()

        // Then
        let latencyMetric = sut.performanceMetrics.first { $0.type == .networkLatency }
        XCTAssertNotNil(latencyMetric)
    }

    func testCollectPerformanceMetrics_PreventsConcurrentExecution() async {
        // Given
        sut.isCollectingMetrics = true

        // When
        await sut.collectPerformanceMetrics()

        // Then
        XCTAssertTrue(sut.performanceMetrics.isEmpty)
    }

    func testCollectPerformanceMetrics_ClearsErrorMessage() async {
        // Given
        sut.errorMessage = "Previous Error"

        // When
        await sut.collectPerformanceMetrics()

        // Then
        XCTAssertNil(sut.errorMessage)
    }

    // MARK: - Log Management Tests

    func testLoadLogs_PopulatesLogEntries() {
        // When
        sut.loadLogs()

        // Then
        XCTAssertFalse(sut.logEntries.isEmpty)
        XCTAssertTrue(sut.logEntries.count >= 1)
    }

    func testLoadLogs_GeneratesMultipleEntries() {
        // When
        sut.loadLogs()

        // Then
        XCTAssertGreaterThan(sut.logEntries.count, 1)
    }

    func testClearLogs_EmptiesEntries() {
        // Given
        sut.loadLogs()
        XCTAssertFalse(sut.logEntries.isEmpty)

        // When
        sut.clearLogs()

        // Then
        XCTAssertTrue(sut.logEntries.isEmpty)
        XCTAssertEqual(sut.successMessage, NSLocalizedString("diagnostic.logs.cleared", comment: ""))
    }

    func testFilteredLogs_NoFilter_ReturnsAll() {
        // Given
        sut.loadLogs()
        sut.selectedLogLevel = nil

        // Then
        XCTAssertEqual(sut.filteredLogs.count, sut.logEntries.count)
    }

    func testFilteredLogs_ByLevel() {
        // Given
        sut.loadLogs()
        sut.selectedLogLevel = .error

        // Then
        let filtered = sut.filteredLogs
        XCTAssertTrue(filtered.allSatisfy { $0.level == .error })
    }

    func testFilteredLogs_MultipleLevels() {
        // Given
        sut.loadLogs()

        // When/Then for each log level
        for level in DiagnosticLogLevel.allCases {
            sut.selectedLogLevel = level
            let filtered = sut.filteredLogs
            XCTAssertTrue(filtered.allSatisfy { $0.level == level })
        }
    }

    // MARK: - Cache Management Tests

    func testClearAllCaches_CallsCacheService() async {
        // When
        await sut.clearAllCaches()

        // Then
        XCTAssertTrue(mockCacheService.clearAllCalled)
    }

    func testClearAllCaches_SetsRefreshingState() async {
        // Given
        let expectation = expectation(description: "Refreshing state changes")
        var refreshingStates: [Bool] = []

        sut.$isRefreshing
            .dropFirst()
            .sink { isRefreshing in
                refreshingStates.append(isRefreshing)
                if refreshingStates.count >= 2 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        await sut.clearAllCaches()

        // Then
        await fulfillment(of: [expectation], timeout: 2.0)
    }

    func testClearAllCaches_Failure_SetsErrorMessage() async {
        // Given
        mockCacheService.shouldFailClearAll = true

        // When
        await sut.clearAllCaches()

        // Then
        XCTAssertNotNil(sut.errorMessage)
    }

    func testClearCache_ImagesType() async {
        // When
        await sut.clearCache(type: .images)

        // Then
        XCTAssertEqual(mockCacheService.clearType, .images)
    }

    func testClearCache_DataType() async {
        // When
        await sut.clearCache(type: .data)

        // Then
        XCTAssertEqual(mockCacheService.clearType, .data)
    }

    func testClearCache_SessionsType() async {
        // When
        await sut.clearCache(type: .sessions)

        // Then
        XCTAssertEqual(mockCacheService.clearType, .sessions)
    }

    func testClearCache_TemporaryType() async {
        // When
        await sut.clearCache(type: .temporary)

        // Then
        XCTAssertEqual(mockCacheService.clearType, .temporary)
    }

    // MARK: - Refresh All Tests

    func testRefreshAll_ExecutesAllDiagnostics() async {
        // When
        await sut.refreshAll()

        // Then
        XCTAssertFalse(sut.networkTests.isEmpty)
        XCTAssertFalse(sut.storageResults.isEmpty)
        XCTAssertFalse(sut.performanceMetrics.isEmpty)
        XCTAssertFalse(sut.logEntries.isEmpty)
    }

    func testRefreshAll_SetsRefreshingState() async {
        // Given
        let expectation = expectation(description: "Refreshing state")
        expectation.expectedFulfillmentCount = 2
        var refreshingStates: [Bool] = []

        sut.$isRefreshing
            .dropFirst()
            .sink { isRefreshing in
                refreshingStates.append(isRefreshing)
                expectation.fulfill()
            }
            .store(in: &cancellables)

        // When
        await sut.refreshAll()

        // Then
        await fulfillment(of: [expectation], timeout: 3.0)
        XCTAssertTrue(refreshingStates.first == true)
        XCTAssertTrue(refreshingStates.last == false)
    }

    func testRefreshAll_ClearsMessages() async {
        // Given
        sut.errorMessage = "Previous Error"
        sut.successMessage = "Previous Success"

        // When
        await sut.refreshAll()

        // Then
        XCTAssertNil(sut.errorMessage)
        XCTAssertNotEqual(sut.successMessage, "Previous Success")
        XCTAssertNotNil(sut.successMessage)
    }

    // MARK: - Message Handling Tests

    func testClearMessages_ClearsBoth() {
        // Given
        sut.errorMessage = "Error"
        sut.successMessage = "Success"

        // When
        sut.clearMessages()

        // Then
        XCTAssertNil(sut.errorMessage)
        XCTAssertNil(sut.successMessage)
    }

    // MARK: - Formatted Size Tests

    func testFormattedTotalCacheSize_ReturnsString() {
        // Given
        sut.totalCacheSize = 1024 * 1024 * 50 // 50 MB

        // Then
        XCTAssertFalse(sut.formattedTotalCacheSize.isEmpty)
        XCTAssertTrue(sut.formattedTotalCacheSize.contains("MB"))
    }

    func testFormattedTotalCacheSize_ZeroBytes() {
        // Given
        sut.totalCacheSize = 0

        // Then
        let formatted = sut.formattedTotalCacheSize
        XCTAssertFalse(formatted.isEmpty)
    }

    // MARK: - Binding Tests

    func testNetworkStatusPublisher_SubscribesToNetworkMonitor() {
        // Given
        let expectation = expectation(description: "Publisher binding works")
        let newStatus = NetworkStatus(
            isConnected: true,
            connectionType: .cellular,
            quality: .good,
            timestamp: Date()
        )

        sut.$networkStatus
            .dropFirst()
            .sink { status in
                if status.connectionType == .cellular {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // When
        mockNetworkMonitor.updateStatus(newStatus)

        // Then
        wait(for: [expectation], timeout: 2.0)
    }

    // MARK: - Concurrent Operations Tests

    func testMultipleDiagnostics_ExecuteSequentially() async {
        // Given
        let networkExpectation = expectation(description: "Network diagnostics complete")
        let storageExpectation = expectation(description: "Storage diagnostics complete")

        // When - Run both
        async let network = sut.runNetworkDiagnostics()
        async let storage = sut.runStorageDiagnostics()

        await network
        networkExpectation.fulfill()

        await storage
        storageExpectation.fulfill()

        // Then
        await fulfillment(of: [networkExpectation, storageExpectation], timeout: 5.0)
        XCTAssertFalse(sut.networkTests.isEmpty)
        XCTAssertFalse(sut.storageResults.isEmpty)
    }

    // MARK: - Deinit Tests

    func testDeinit_CancelsSubscriptions() {
        // Given
        var vm: DiagnosticViewModel? = DiagnosticViewModel(
            networkMonitor: mockNetworkMonitor,
            cacheService: mockCacheService
        )

        var cancellables = Set<AnyCancellable>()
        vm?.$networkStatus
            .sink { _ in }
            .store(in: &cancellables)

        // When
        vm = nil
        cancellables.removeAll()

        // Then - Should not crash
        XCTAssertNil(vm)
    }

    // MARK: - Diagnostic API Endpoint Tests

    func testDefaultEndpoints_HasExpectedCount() {
        // Then
        XCTAssertEqual(DiagnosticAPIEndpoint.defaultEndpoints.count, 5)
    }

    func testDefaultEndpoints_ContainsHealthEndpoint() {
        // Then
        let healthEndpoint = DiagnosticAPIEndpoint.defaultEndpoints.first { $0.id == "health" }
        XCTAssertNotNil(healthEndpoint)
        XCTAssertEqual(healthEndpoint?.method, "GET")
    }

    func testDefaultEndpoints_ContainsAuthEndpoint() {
        // Then
        let authEndpoint = DiagnosticAPIEndpoint.defaultEndpoints.first { $0.id == "auth" }
        XCTAssertNotNil(authEndpoint)
    }

    // MARK: - Storage Type Tests

    func testStorageTypes_AllCasesHaveIcon() {
        // Then
        for type in StorageType.allCases {
            XCTAssertFalse(type.icon.isEmpty)
        }
    }

    func testStorageTypes_AllCasesHaveDescription() {
        // Then
        for type in StorageType.allCases {
            XCTAssertFalse(type.description.isEmpty)
        }
    }

    // MARK: - Cache Type Tests

    func testDiagnosticCacheTypes_AllCases() {
        // Then
        XCTAssertEqual(DiagnosticCacheType.allCases.count, 4)
    }

    func testDiagnosticCacheTypes_HasIcons() {
        // Then
        for type in DiagnosticCacheType.allCases {
            XCTAssertFalse(type.icon.isEmpty)
        }
    }

    // MARK: - Performance Metric Type Tests

    func testPerformanceMetricTypes_AllCases() {
        // Then
        XCTAssertEqual(PerformanceMetricType.allCases.count, 5)
    }

    func testPerformanceMetricTypes_HasHealthyThreshold() {
        // Then
        for type in PerformanceMetricType.allCases {
            XCTAssertTrue(type.healthyThreshold >= 0)
        }
    }

    // MARK: - Diagnostic Status Tests

    func testDiagnosticStatus_AllCases() {
        // Then
        XCTAssertEqual(DiagnosticStatus.allCases.count, 5)
    }

    func testDiagnosticStatus_HasDisplayName() {
        // Then
        for status in DiagnosticStatus.allCases {
            XCTAssertFalse(status.displayName.isEmpty)
        }
    }

    func testDiagnosticStatus_HasIconName() {
        // Then
        for status in DiagnosticStatus.allCases {
            XCTAssertFalse(status.iconName.isEmpty)
        }
    }

    // MARK: - Diagnostic Log Level Tests

    func testDiagnosticLogLevel_AllCases() {
        // Then
        XCTAssertEqual(DiagnosticLogLevel.allCases.count, 4)
    }

    func testDiagnosticLogLevel_HasIconName() {
        // Then
        for level in DiagnosticLogLevel.allCases {
            XCTAssertFalse(level.iconName.isEmpty)
        }
    }

    func testDiagnosticLogLevel_HasColor() {
        // Then
        for level in DiagnosticLogLevel.allCases {
            XCTAssertFalse(level.color.isEmpty)
        }
    }

    // MARK: - Network Diagnostic Result Tests

    func testNetworkDiagnosticResult_FormattedLatency_WithValue() {
        // Given
        let result = NetworkDiagnosticResult(
            endpoint: "Test",
            status: .success,
            latencyMs: 50.5
        )

        // Then
        XCTAssertFalse(result.formattedLatency.isEmpty)
        XCTAssertTrue(result.formattedLatency.contains("50"))
    }

    func testNetworkDiagnosticResult_FormattedLatency_WithoutValue() {
        // Given
        let result = NetworkDiagnosticResult(
            endpoint: "Test",
            status: .error,
            latencyMs: nil
        )

        // Then
        XCTAssertFalse(result.formattedLatency.isEmpty)
        XCTAssertTrue(result.formattedLatency.contains("N/A") || result.formattedLatency.contains("-"))
    }

    // MARK: - Cache Info Tests

    func testCacheInfo_FormattedSize() {
        // Given
        let info = CacheInfo(
            id: UUID(),
            type: .images,
            sizeBytes: 1024 * 1024, // 1 MB
            entryCount: 10,
            lastCleared: nil
        )

        // Then
        XCTAssertFalse(info.formattedSize.isEmpty)
    }

    func testCacheInfo_FormattedLastCleared_Never() {
        // Given
        let info = CacheInfo(
            id: UUID(),
            type: .images,
            sizeBytes: 0,
            entryCount: 0,
            lastCleared: nil
        )

        // Then
        XCTAssertFalse(info.formattedLastCleared.isEmpty)
    }

    func testCacheInfo_FormattedLastCleared_WithDate() {
        // Given
        let info = CacheInfo(
            id: UUID(),
            type: .images,
            sizeBytes: 0,
            entryCount: 0,
            lastCleared: Date()
        )

        // Then
        XCTAssertFalse(info.formattedLastCleared.isEmpty)
    }

    // MARK: - Storage Diagnostic Result Tests

    func testStorageDiagnosticResult_FormattedSize() {
        // Given
        let result = StorageDiagnosticResult(
            id: UUID(),
            type: .cache,
            status: .success,
            sizeBytes: 50 * 1024 * 1024, // 50 MB
            details: nil,
            errorMessage: nil
        )

        // Then
        XCTAssertFalse(result.formattedSize.isEmpty)
        XCTAssertTrue(result.formattedSize.contains("M"))
    }

    // MARK: - Performance Metrics Tests

    func testPerformanceMetrics_FormattedValue_MemoryUsage() {
        // Given
        let metrics = PerformanceMetrics(
            id: UUID(),
            type: .memoryUsage,
            value: 150 * 1024 * 1024, // 150 MB
            unit: "MB",
            timestamp: Date(),
            isHealthy: true
        )

        // Then
        XCTAssertFalse(metrics.formattedValue.isEmpty)
        XCTAssertTrue(metrics.formattedValue.contains("MB"))
    }

    func testPerformanceMetrics_FormattedValue_CPUUsage() {
        // Given
        let metrics = PerformanceMetrics(
            id: UUID(),
            type: .cpuUsage,
            value: 25.5,
            unit: "%",
            timestamp: Date(),
            isHealthy: true
        )

        // Then
        XCTAssertFalse(metrics.formattedValue.isEmpty)
        XCTAssertTrue(metrics.formattedValue.contains("%"))
    }

    func testPerformanceMetrics_FormattedValue_FPS() {
        // Given
        let metrics = PerformanceMetrics(
            id: UUID(),
            type: .fps,
            value: 60,
            unit: "fps",
            timestamp: Date(),
            isHealthy: true
        )

        // Then
        XCTAssertFalse(metrics.formattedValue.isEmpty)
        XCTAssertTrue(metrics.formattedValue.contains("60"))
    }

    func testPerformanceMetrics_FormattedValue_NetworkLatency() {
        // Given
        let metrics = PerformanceMetrics(
            id: UUID(),
            type: .networkLatency,
            value: 120,
            unit: "ms",
            timestamp: Date(),
            isHealthy: true
        )

        // Then
        XCTAssertFalse(metrics.formattedValue.isEmpty)
        XCTAssertTrue(metrics.formattedValue.contains("ms"))
    }
}
