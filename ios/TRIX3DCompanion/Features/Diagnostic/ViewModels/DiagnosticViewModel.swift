//
//  DiagnosticViewModel.swift
//  TRIX3DCompanion
//
//  ViewModel for diagnostic screens - manages network, storage, and performance checks
//

import Foundation
import Combine
import SwiftUI

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

private func L(_ key: String, _ args: CVarArg...) -> String {
    String(format: NSLocalizedString(key, comment: ""), args)
}

typealias DiagnosticEndpointLatencyMeasurer = @Sendable (DiagnosticAPIEndpoint) async throws -> Double

// MARK: - Diagnostic ViewModel

/// Main ViewModel for diagnostic functionality
@MainActor
final class DiagnosticViewModel: ObservableObject {

    // MARK: - Published Properties

    // Network
    @Published private(set) var networkStatus: NetworkStatus = .disconnected
    @Published var networkTests: [NetworkDiagnosticResult] = []
    @Published var isTestingNetwork: Bool = false

    // Storage
    @Published var storageResults: [StorageDiagnosticResult] = []
    @Published var isCheckingStorage: Bool = false
    @Published var totalCacheSize: Int64 = 0
    @Published private(set) var cacheInfo: [CacheInfo] = []

    // Performance
    @Published var performanceMetrics: [PerformanceMetrics] = []
    @Published var isCollectingMetrics: Bool = false

    // Logs
    @Published private(set) var logEntries: [LogEntry] = []
    @Published var selectedLogLevel: DiagnosticLogLevel?

    // General
    @Published private(set) var isRefreshing: Bool = false
    @Published var errorMessage: String?
    @Published var successMessage: String?

    // MARK: - Dependencies

    private let networkMonitor: NetworkMonitorProtocol
    private let cacheService: OfflineCacheServiceProtocol
    private let endpointLatencyMeasurer: DiagnosticEndpointLatencyMeasurer
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    init(
        networkMonitor: NetworkMonitorProtocol? = nil,
        cacheService: OfflineCacheServiceProtocol? = nil,
        endpointLatencyMeasurer: @escaping DiagnosticEndpointLatencyMeasurer = { endpoint in
            try await DiagnosticViewModel.liveEndpointLatency(for: endpoint)
        }
    ) {
        self.networkMonitor = networkMonitor ?? NetworkMonitor.shared
        self.cacheService = cacheService ?? OfflineCacheService.shared
        self.endpointLatencyMeasurer = endpointLatencyMeasurer

        setupBindings()
        self.networkMonitor.startMonitoring()
    }

    deinit {
        cancellables.removeAll()
    }

    // MARK: - Setup

    private func setupBindings() {
        // Observe network status changes
        networkMonitor.statusPublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in
                self?.networkStatus = status
            }
            .store(in: &cancellables)
    }

    // MARK: - Public Methods - Network

    /// Run all network diagnostics
    func runNetworkDiagnostics() async {
        guard !isTestingNetwork else { return }

        isTestingNetwork = true
        networkTests = []
        errorMessage = nil

        // Test each endpoint
        for endpoint in DiagnosticAPIEndpoint.defaultEndpoints {
            let result = await testEndpoint(endpoint)
            networkTests.append(result)
        }

        isTestingNetwork = false

        // Check if all tests passed
        let failedCount = networkTests.filter { $0.status == .error }.count
        if failedCount == 0 {
            successMessage = L("diagnostic.network.testsPassed")
        }
    }

    /// Test a single API endpoint
    private func testEndpoint(_ endpoint: DiagnosticAPIEndpoint) async -> NetworkDiagnosticResult {
        do {
            let latency = try await endpointLatencyMeasurer(endpoint)

            if latency < 0 {
                return NetworkDiagnosticResult(
                    endpoint: endpoint.name,
                    status: .error,
                    errorMessage: L("diagnostic.network.connectionFailed")
                )
            }

            return NetworkDiagnosticResult(
                endpoint: endpoint.name,
                status: .success,
                latencyMs: latency
            )
        } catch {
            return NetworkDiagnosticResult(
                endpoint: endpoint.name,
                status: .error,
                errorMessage: error.localizedDescription
            )
        }
    }

    /// Measure latency for an endpoint
    private static func liveEndpointLatency(for endpoint: DiagnosticAPIEndpoint) async throws -> Double {
        // Use API base URL from configuration
        let baseURL = APIBaseURL.production
        guard let url = URL(string: baseURL + endpoint.url) else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method
        request.timeoutInterval = 10

        let startTime = Date()

        let (_, response) = try await URLSession.shared.data(for: request)

        let latency = Date().timeIntervalSince(startTime) * 1000 // Convert to ms

        // Check if response is successful
        if let httpResponse = response as? HTTPURLResponse {
            if httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 {
                return latency
            } else {
                return -1
            }
        }

        return latency
    }

    // MARK: - Public Methods - Storage

    /// Run all storage diagnostics
    func runStorageDiagnostics() async {
        guard !isCheckingStorage else { return }

        isCheckingStorage = true
        storageResults = []
        errorMessage = nil

        // Check UserDefaults
        let userDefaultsSize = calculateUserDefaultsSize()
        storageResults.append(StorageDiagnosticResult(
            id: UUID(),
            type: .userDefaults,
            status: .success,
            sizeBytes: userDefaultsSize,
            details: userDefaultsSize > 0 ? L("diagnostic.storage.containsData") : L("diagnostic.storage.empty"),
            errorMessage: nil
        ))

        // Check File Storage
        let fileStorageSize = await calculateFileStorageSize()
        storageResults.append(StorageDiagnosticResult(
            id: UUID(),
            type: .fileStorage,
            status: .success,
            sizeBytes: fileStorageSize,
            details: L("diagnostic.storage.documentsDir"),
            errorMessage: nil
        ))

        // Check Cache
        let cacheSize = await calculateCacheSize()
        storageResults.append(StorageDiagnosticResult(
            id: UUID(),
            type: .cache,
            status: cacheSize > 100 * 1024 * 1024 ? .warning : .success,
            sizeBytes: cacheSize,
            details: cacheSize > 100 * 1024 * 1024 ? L("diagnostic.cache.sizeLarge") : L("diagnostic.cache.sizeNormal"),
            errorMessage: nil
        ))

        // Get cache info
        await loadCacheInfo()

        totalCacheSize = userDefaultsSize + fileStorageSize + cacheSize

        isCheckingStorage = false

        successMessage = L("diagnostic.storage.checkCompleted")
    }

    /// Calculate UserDefaults size
    private func calculateUserDefaultsSize() -> Int64 {
        var totalSize: Int64 = 0

        // Estimate UserDefaults size by counting keys and their values
        if let bundleID = Bundle.main.bundleIdentifier {
            let defaults = UserDefaults.standard
            let dictionary = defaults.dictionaryRepresentation()
            totalSize = Int64(dictionary.count * 500) // Rough estimate
            _ = bundleID // Use bundleID to avoid unused warning
        }

        return totalSize
    }

    /// Calculate file storage size
    private func calculateFileStorageSize() async -> Int64 {
        let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
        guard let url = documentsURL else { return 0 }

        return calculateDirectorySize(at: url)
    }

    /// Calculate cache size
    private func calculateCacheSize() async -> Int64 {
        var totalSize: Int64 = 0

        for type in CacheType.allCases {
            do {
                totalSize += try await cacheService.getCurrentSize(type: type)
            } catch {
                SecureLogger.shared.error("Failed to read cache size for \(type.rawValue): \(error)")
            }
        }

        return totalSize
    }

    /// Calculate directory size recursively
    private func calculateDirectorySize(at url: URL) -> Int64 {
        let fileManager = FileManager.default
        var totalSize: Int64 = 0

        guard let enumerator = fileManager.enumerator(
            at: url,
            includingPropertiesForKeys: [.fileSizeKey],
            options: [.skipsHiddenFiles]
        ) else { return 0 }

        for case let fileURL as URL in enumerator {
            do {
                let resourceValues = try fileURL.resourceValues(forKeys: [.fileSizeKey])
                totalSize += Int64(resourceValues.fileSize ?? 0)
            } catch {
                continue
            }
        }

        return totalSize
    }

    /// Load cache information
    private func loadCacheInfo() async {
        var info: [CacheInfo] = []
        let mappings: [(DiagnosticCacheType, CacheType)] = [
            (.images, .images),
            (.data, .userProfile),
            (.sessions, .studyRecords),
            (.temporary, .messages)
        ]

        for (diagnosticType, cacheType) in mappings {
            let sizeBytes = (try? await cacheService.getCurrentSize(type: cacheType)) ?? 0
            let statistics = try? await cacheService.getStatistics(type: cacheType)

            info.append(CacheInfo(
                id: UUID(),
                type: diagnosticType,
                sizeBytes: sizeBytes,
                entryCount: statistics?.totalEntries ?? 0,
                lastCleared: nil
            ))
        }

        cacheInfo = info
    }

    // MARK: - Public Methods - Performance

    /// Collect performance metrics
    func collectPerformanceMetrics() async {
        guard !isCollectingMetrics else { return }

        isCollectingMetrics = true
        performanceMetrics = []
        errorMessage = nil

        // Memory usage
        let memoryUsage = await getMemoryUsage()
        performanceMetrics.append(PerformanceMetrics(
            id: UUID(),
            type: .memoryUsage,
            value: memoryUsage,
            unit: "MB",
            timestamp: Date(),
            isHealthy: memoryUsage < PerformanceMetricType.memoryUsage.healthyThreshold
        ))

        // CPU usage (simulated - actual implementation would use ProcessInfo)
        let cpuUsage = getCPUUsage()
        performanceMetrics.append(PerformanceMetrics(
            id: UUID(),
            type: .cpuUsage,
            value: cpuUsage,
            unit: "%",
            timestamp: Date(),
            isHealthy: cpuUsage < PerformanceMetricType.cpuUsage.healthyThreshold
        ))

        // Disk usage
        let diskUsage = getAvailableDiskSpace()
        performanceMetrics.append(PerformanceMetrics(
            id: UUID(),
            type: .diskUsage,
            value: diskUsage,
            unit: "GB",
            timestamp: Date(),
            isHealthy: diskUsage > 1 // At least 1GB available
        ))

        // Network latency (average from recent tests)
        let avgLatency = networkTests.compactMap { $0.latencyMs }.reduce(0, +) / Double(max(networkTests.count, 1))
        performanceMetrics.append(PerformanceMetrics(
            id: UUID(),
            type: .networkLatency,
            value: avgLatency > 0 ? avgLatency : 0,
            unit: "ms",
            timestamp: Date(),
            isHealthy: avgLatency < PerformanceMetricType.networkLatency.healthyThreshold
        ))

        isCollectingMetrics = false

        successMessage = L("diagnostic.performance.collected")
    }

    /// Get current memory usage
    private func getMemoryUsage() async -> Double {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4

        let result = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }

        if result == KERN_SUCCESS {
            return Double(info.resident_size)
        }

        return 0
    }

    /// Get CPU usage (simulated)
    private func getCPUUsage() -> Double {
        // In a real implementation, this would use ProcessInfo.processInfo.processerUsage
        // For now, return a simulated value
        return Double.random(in: 10...40)
    }

    /// Get available disk space
    private func getAvailableDiskSpace() -> Double {
        let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first

        guard let url = documentsURL else { return 0 }

        do {
            let resourceValues = try url.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
            if let capacity = resourceValues.volumeAvailableCapacityForImportantUsage {
                return Double(capacity) / (1024 * 1024 * 1024) // Convert to GB
            }
        } catch {
            SecureLogger.shared.error("Failed to get disk space: \(error)")
        }

        return 0
    }

    // MARK: - Public Methods - Logs

    /// Load recent log entries
    func loadLogs() {
        // Generate sample logs for demonstration
        // In a real implementation, this would read from SecureLogger or a log file
        logEntries = generateSampleLogs()
    }

    /// Generate sample logs
    private func generateSampleLogs() -> [LogEntry] {
        return [
            LogEntry(level: .info, message: "Application started", source: "App"),
            LogEntry(level: .debug, message: "Network monitoring initialized", source: "NetworkMonitor"),
            LogEntry(level: .info, message: "User authenticated successfully", source: "AuthService"),
            LogEntry(level: .warning, message: "Cache size approaching limit", source: "CacheService"),
            LogEntry(level: .info, message: "Study session started", source: "StudyManager"),
            LogEntry(level: .error, message: "Failed to connect to chat server", source: "ChatService"),
            LogEntry(level: .info, message: "Data sync completed", source: "DataSync"),
            LogEntry(level: .debug, message: "Memory usage: 145 MB", source: "Diagnostics")
        ]
    }

    /// Clear log entries
    func clearLogs() {
        logEntries = []
        successMessage = L("diagnostic.logs.cleared")
    }

    /// Get filtered log entries
    var filteredLogs: [LogEntry] {
        guard let level = selectedLogLevel else {
            return logEntries
        }
        return logEntries.filter { $0.level == level }
    }

    // MARK: - Public Methods - Cache Management

    /// Clear all caches
    func clearAllCaches() async {
        isRefreshing = true
        errorMessage = nil

        do {
            try await cacheService.clearAll()
            await runStorageDiagnostics()
            successMessage = L("diagnostic.cache.allCleared")
        } catch {
            errorMessage = L("diagnostic.cache.clearFailed", error.localizedDescription)
        }

        isRefreshing = false
    }

    /// Clear specific cache type
    func clearCache(type: DiagnosticCacheType) async {
        isRefreshing = true

        do {
            // Map DiagnosticCacheType to OfflineCacheService.CacheType
            let serviceCacheType: CacheType
            switch type {
            case .images:
                serviceCacheType = .images
            case .data:
                serviceCacheType = .userProfile
            case .sessions:
                serviceCacheType = .studyRecords
            case .temporary:
                serviceCacheType = .messages
            }

            // Track the original DiagnosticCacheType for testing
            if let tracking = cacheService as? ClearCacheTracking {
                tracking.setOriginalClearType(type)
            }

            try await cacheService.clear(type: serviceCacheType)
            await runStorageDiagnostics()
            successMessage = L("diagnostic.cache.typeCleared", type.rawValue)
        } catch {
            errorMessage = L("diagnostic.cache.clearFailed", error.localizedDescription)
        }

        isRefreshing = false
    }

    // MARK: - Public Methods - Refresh

    /// Refresh all diagnostics
    func refreshAll() async {
        isRefreshing = true
        errorMessage = nil
        successMessage = nil

        await runNetworkDiagnostics()
        await runStorageDiagnostics()
        await collectPerformanceMetrics()
        loadLogs()

        isRefreshing = false
    }

    // MARK: - Helpers

    /// Clear messages
    func clearMessages() {
        errorMessage = nil
        successMessage = nil
    }

    /// Get formatted total cache size
    var formattedTotalCacheSize: String {
        ByteCountFormatter.string(fromByteCount: totalCacheSize, countStyle: .file)
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension DiagnosticViewModel {
    static var preview: DiagnosticViewModel {
        let vm = DiagnosticViewModel()
        vm.networkStatus = NetworkStatus(
            isConnected: true,
            connectionType: .wifi,
            quality: .excellent,
            timestamp: Date()
        )
        vm.networkTests = [
            NetworkDiagnosticResult(endpoint: "Health Check", status: .success, latencyMs: 45),
            NetworkDiagnosticResult(endpoint: "Auth", status: .success, latencyMs: 120),
            NetworkDiagnosticResult(endpoint: "User Profile", status: .error, errorMessage: "Timeout")
        ]
        vm.storageResults = [
            StorageDiagnosticResult(id: UUID(), type: .userDefaults, status: .success, sizeBytes: 125_000, details: "UserDefaults storage", errorMessage: nil),
            StorageDiagnosticResult(id: UUID(), type: .fileStorage, status: .success, sizeBytes: 52_428_800, details: "Documents directory", errorMessage: nil),
            StorageDiagnosticResult(id: UUID(), type: .cache, status: .warning, sizeBytes: 150_000_000, details: "Cache size is large", errorMessage: nil)
        ]
        vm.performanceMetrics = [
            PerformanceMetrics(id: UUID(), type: .memoryUsage, value: 145_000_000, unit: "MB", timestamp: Date(), isHealthy: true),
            PerformanceMetrics(id: UUID(), type: .cpuUsage, value: 25, unit: "%", timestamp: Date(), isHealthy: true),
            PerformanceMetrics(id: UUID(), type: .diskUsage, value: 25.5, unit: "GB", timestamp: Date(), isHealthy: true)
        ]
        vm.loadLogs()
        return vm
    }
}
#endif
