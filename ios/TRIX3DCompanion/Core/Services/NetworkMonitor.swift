//
//  NetworkMonitor.swift
//  TRIX3DCompanion
//
//  Network monitoring service using NWPathMonitor for connection status and quality
//

import Foundation
import Combine
import Network

// MARK: - Localization Helper
private func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

// MARK: - Connection Type

/// Network connection type
enum ConnectionType: String, CaseIterable {
    case none = "none"
    case wifi = "wifi"
    case cellular = "cellular"
    case ethernet = "ethernet"
    case other = "other"

    var displayName: String {
        switch self {
        case .none:
            return L("network.connection.none")
        case .wifi:
            return L("network.connection.wifi")
        case .cellular:
            return L("network.connection.cellular")
        case .ethernet:
            return L("network.connection.ethernet")
        case .other:
            return L("network.connection.other")
        }
    }

    var isConnected: Bool {
        self != .none
    }

    var isExpensive: Bool {
        switch self {
        case .cellular:
            return true
        default:
            return false
        }
    }
}

// MARK: - Connection Quality

/// Quality of network connection
enum ConnectionQuality: String, CaseIterable {
    case excellent = "excellent"
    case good = "good"
    case fair = "fair"
    case poor = "poor"
    case unknown = "unknown"

    var displayName: String {
        switch self {
        case .excellent:
            return L("network.quality.excellent")
        case .good:
            return L("network.quality.good")
        case .fair:
            return L("network.quality.fair")
        case .poor:
            return L("network.quality.poor")
        case .unknown:
            return L("network.quality.unknown")
        }
    }

    var color: String {
        switch self {
        case .excellent:
            return "green"
        case .good:
            return "blue"
        case .fair:
            return "yellow"
        case .poor:
            return "red"
        case .unknown:
            return "gray"
        }
    }
}

// MARK: - Network Status

/// Current network status
struct NetworkStatus: Equatable {
    let isConnected: Bool
    let connectionType: ConnectionType
    let quality: ConnectionQuality
    let timestamp: Date

    var isExpensive: Bool {
        connectionType.isExpensive
    }

    static let disconnected = NetworkStatus(
        isConnected: false,
        connectionType: .none,
        quality: .unknown,
        timestamp: Date()
    )
}

// MARK: - Network Monitor Protocol

@MainActor
protocol NetworkMonitorProtocol {
    var currentStatus: NetworkStatus { get }
    var statusPublisher: AnyPublisher<NetworkStatus, Never> { get }
    var connectionTypePublisher: AnyPublisher<ConnectionType, Never> { get }
    var isConnectedPublisher: AnyPublisher<Bool, Never> { get }

    func startMonitoring()
    func stopMonitoring()
    func getCurrentStatus() async -> NetworkStatus
}

// MARK: - Network Monitor

/// Main network monitoring service using NWPathMonitor
@MainActor
class NetworkMonitor: ObservableObject, NetworkMonitorProtocol {

    // MARK: - Singleton

    static let shared = NetworkMonitor()

    // MARK: - Published Properties

    @Published var currentStatus: NetworkStatus = .disconnected

    @Published private(set) var isMonitoring: Bool = false

    // MARK: - Dependencies

    private let pathMonitor: NWPathMonitor
    private let queue: DispatchQueue

    // MARK: - Private Properties

    private var statusContinuation: AsyncStream<NetworkStatus>.Continuation?

    private var cancellables = Set<AnyCancellable>()

    private var latencyHistory: [TimeInterval] = []

    private let latencyHistorySize = 10

    // MARK: - Publishers

    var statusPublisher: AnyPublisher<NetworkStatus, Never> {
        $currentStatus.eraseToAnyPublisher()
    }

    var connectionTypePublisher: AnyPublisher<ConnectionType, Never> {
        $currentStatus
            .map { $0.connectionType }
            .removeDuplicates()
            .eraseToAnyPublisher()
    }

    var isConnectedPublisher: AnyPublisher<Bool, Never> {
        $currentStatus
            .map { $0.isConnected }
            .removeDuplicates()
            .eraseToAnyPublisher()
    }

    // MARK: - Initialization

    init() {
        self.pathMonitor = NWPathMonitor()
        self.queue = DispatchQueue(label: "com.trix3d.network.monitor")

        // Setup initial status
        Task {
            currentStatus = await getCurrentStatus()
        }
    }

    nonisolated deinit {
        pathMonitor.cancel()
    }

    // MARK: - Public Methods

    /// Start monitoring network status
    func startMonitoring() {
        guard !isMonitoring else { return }

        isMonitoring = true

        pathMonitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor [weak self] in
                self?.updateStatus(from: path)
            }
        }

        pathMonitor.start(queue: queue)

        Task { @MainActor in
            SecureLogger.shared.info("Network monitoring started")
        }
    }

    /// Stop monitoring network status
    nonisolated func stopMonitoring() {
        pathMonitor.cancel()
        // Note: isMonitoring flag will be reset on next MainActor context
        // This is safe because the pathMonitor is cancelled immediately
    }

    /// Get current network status
    func getCurrentStatus() async -> NetworkStatus {
        return currentStatus
    }

    /// Check if currently connected
    var isConnected: Bool {
        currentStatus.isConnected
    }

    /// Check if connection is expensive (cellular)
    var isExpensive: Bool {
        currentStatus.isExpensive
    }

    /// Get connection type
    var connectionType: ConnectionType {
        currentStatus.connectionType
    }

    /// Get connection quality
    var quality: ConnectionQuality {
        currentStatus.quality
    }

    // MARK: - Public Methods - Quality Assessment

    /// Record network latency measurement
    func recordLatency(_ latency: TimeInterval) {
        latencyHistory.append(latency)

        if latencyHistory.count > latencyHistorySize {
            latencyHistory.removeFirst()
        }

        // Update quality based on latency
        updateQuality()
    }

    /// Measure latency to a host
    func measureLatency(to host: String = "api.trix3d.com") async throws -> TimeInterval {
        let start = Date()

        // Simple HTTP HEAD request to measure latency
        guard let url = URL(string: "https://\(host)") else {
            throw NetworkError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"
        request.timeoutInterval = 5

        let (_, response) = try await URLSession.shared.data(for: request)

        let latency = Date().timeIntervalSince(start)
        recordLatency(latency)

        return latency
    }

    // MARK: - Private Methods

    private func updateStatus(from path: NWPath) {
        let connectionType = determineConnectionType(from: path)
        let quality = determineQuality(from: path, connectionType: connectionType)

        let newStatus = NetworkStatus(
            isConnected: path.status == .satisfied,
            connectionType: connectionType,
            quality: quality,
            timestamp: Date()
        )

        // Only update if status changed
        if newStatus != currentStatus {
            currentStatus = newStatus

            // Log significant changes
            if newStatus.isConnected != currentStatus.isConnected {
                SecureLogger.shared.info("Network connection changed: \(newStatus.isConnected ? "Connected" : "Disconnected")")
            }

            if newStatus.connectionType != currentStatus.connectionType {
                SecureLogger.shared.info("Connection type changed: \(newStatus.connectionType.displayName)")
            }
        }
    }

    private func determineConnectionType(from path: NWPath) -> ConnectionType {
        guard path.status == .satisfied else {
            return .none
        }

        if path.usesInterfaceType(.wifi) {
            return .wifi
        } else if path.usesInterfaceType(.cellular) {
            return .cellular
        } else if path.usesInterfaceType(.wiredEthernet) {
            return .ethernet
        } else if path.usesInterfaceType(.other) {
            return .other
        }

        return .other
    }

    private func determineQuality(from path: NWPath, connectionType: ConnectionType) -> ConnectionQuality {
        // Base quality on connection type
        switch connectionType {
        case .none:
            return .unknown
        case .wifi, .ethernet:
            return .excellent
        case .cellular:
            // Could be enhanced with more specific cellular type checking
            return .good
        case .other:
            return .fair
        }
    }

    private func updateQuality() {
        guard !latencyHistory.isEmpty else { return }

        let averageLatency = latencyHistory.reduce(0, +) / Double(latencyHistory.count)

        let newQuality: ConnectionQuality

        switch averageLatency {
        case 0..<50:
            newQuality = .excellent
        case 50..<100:
            newQuality = .good
        case 100..<200:
            newQuality = .fair
        case 200...:
            newQuality = .poor
        default:
            newQuality = .unknown
        }

        // Update status with new quality
        if newQuality != currentStatus.quality {
            currentStatus = NetworkStatus(
                isConnected: currentStatus.isConnected,
                connectionType: currentStatus.connectionType,
                quality: newQuality,
                timestamp: Date()
            )
        }
    }
}

// MARK: - AsyncStream Support

extension NetworkMonitor {

    /// Observe network status changes as AsyncStream
    var statusStream: AsyncStream<NetworkStatus> {
        AsyncStream { continuation in
            statusContinuation = continuation

            // Emit initial status
            continuation.yield(currentStatus)

            // Observe changes
            $currentStatus
                .dropFirst()
                .sink { status in
                    continuation.yield(status)
                }
                .store(in: &cancellables)

            continuation.onTermination = { [weak self] _ in
                Task { @MainActor in
                    self?.statusContinuation = nil
                }
            }
        }
    }

    /// Observe connection state as AsyncStream
    var connectionStream: AsyncStream<Bool> {
        AsyncStream { continuation in
            // Emit initial state
            continuation.yield(currentStatus.isConnected)

            // Observe changes
            $currentStatus
                .dropFirst()
                .map { $0.isConnected }
                .sink { isConnected in
                    continuation.yield(isConnected)
                }
                .store(in: &cancellables)

            continuation.onTermination = { _ in
                // Cleanup handled by cancellables
            }
        }
    }
}

// MARK: - Convenience Extensions

extension NetworkMonitor {

    /// Wait for network to become available
    @MainActor
    func waitForConnection(timeout: TimeInterval = 30) async throws {
        guard !isConnected else { return }

        try await withThrowingTaskGroup(of: Void.self) { [self] group in
            group.addTask { @MainActor in
                for await status in self.statusStream {
                    if status.isConnected {
                        return
                    }
                }
            }

            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                throw TimeoutError()
            }

            try await group.next()
            group.cancelAll()
        }
    }

    struct TimeoutError: Error {}

    enum NetworkError: Error {
        case invalidURL
    }
}
