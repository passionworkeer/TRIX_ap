//
//  DataSyncService.swift
//  TRIX3DCompanion
//
//  Data synchronization service for offline-to-online data sync with conflict resolution
//

import Foundation
import Combine

// MARK: - Sync Status

/// Current synchronization status
enum SyncStatus: String, CaseIterable {
    case idle = "idle"
    case syncing = "syncing"
    case success = "success"
    case failed = "failed"
    case partial = "partial"

    var displayName: String {
        switch self {
        case .idle:
            return "Idle"
        case .syncing:
            return "Syncing"
        case .success:
            return "Success"
        case .failed:
            return "Failed"
        case .partial:
            return "Partial"
        }
    }

    var isActive: Bool {
        self == .syncing
    }
}

// MARK: - Sync Error

/// Synchronization error types
enum SyncError: Error, LocalizedError {
    case networkUnavailable
    case authenticationRequired
    case conflict(resolution: ConflictResolution)
    case serverError(underlying: Error)
    case clientError(underlying: Error)
    case timeout
    case cancelled
    case unknown(underlying: Error?)

    var errorDescription: String? {
        switch self {
        case .networkUnavailable:
            return "Network is currently unavailable"
        case .authenticationRequired:
            return "Authentication required for synchronization"
        case .conflict(let resolution):
            return "Data conflict: \(resolution.description)"
        case .serverError(let error):
            return "Server error: \(error.localizedDescription)"
        case .clientError(let error):
            return "Client error: \(error.localizedDescription)"
        case .timeout:
            return "Synchronization timed out"
        case .cancelled:
            return "Synchronization cancelled"
        case .unknown(let error):
            return error?.localizedDescription ?? "Unknown synchronization error"
        }
    }
}

// MARK: - Sync Priority

/// Priority for sync operations
enum SyncPriority: Int, CaseIterable, Comparable {
    case low = 0
    case normal = 1
    case high = 2
    case urgent = 3

    static func < (lhs: SyncPriority, rhs: SyncPriority) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
}

// MARK: - Sync Strategy

/// Synchronization strategy based on network conditions
enum SyncStrategy {
    case immediate          // Sync immediately on data change
    case deferred           // Wait for optimal conditions
    case manual             // Only sync on user request
    case adaptive           // Automatically choose based on context

    var description: String {
        switch self {
        case .immediate:
            return "Immediate"
        case .deferred:
            return "Deferred"
        case .manual:
            return "Manual"
        case .adaptive:
            return "Adaptive"
        }
    }
}

// MARK: - Conflict Resolution

/// Strategy for resolving sync conflicts
enum ConflictResolution: String, CaseIterable {
    case clientWins = "client_wins"
    case serverWins = "server_wins"
    case mostRecent = "most_recent"
    case manual = "manual"

    var description: String {
        switch self {
        case .clientWins:
            return "Client version takes precedence"
        case .serverWins:
            return "Server version takes precedence"
        case .mostRecent:
            return "Most recently modified version"
        case .manual:
            return "Manual resolution required"
        }
    }
}

// MARK: - Sync Result

/// Result of a synchronization operation
struct SyncResult {
    let status: SyncStatus
    let syncedItems: Int
    let failedItems: Int
    let conflicts: Int
    let timestamp: Date
    let error: SyncError?

    var isSuccessful: Bool {
        status == .success || status == .partial
    }

    var isComplete: Bool {
        status == .success && failedItems == 0 && conflicts == 0
    }
}

// MARK: - Syncable Item

/// Protocol for items that can be synchronized
protocol Syncable {
    var id: String { get }
    var lastModified: Date { get }
    var isSynced: Bool { get }
    var syncPriority: SyncPriority { get }
}

// MARK: - Sync Batch

/// Batch of items to sync
struct SyncBatch {
    let type: SyncType
    let items: [Syncable]
    let priority: SyncPriority
    let timestamp: Date

    var count: Int {
        items.count
    }
}

// MARK: - Sync Type

/// Types of data that can be synchronized
enum SyncType: String, CaseIterable {
    case messages = "messages"
    case studySessions = "study_sessions"
    case userProfile = "user_profile"
    case points = "points"
    case settings = "settings"

    var displayName: String {
        switch self {
        case .messages:
            return "Messages"
        case .studySessions:
            return "Study Sessions"
        case .userProfile:
            return "User Profile"
        case .points:
            return "Points"
        case .settings:
            return "Settings"
        }
    }
}

// MARK: - Data Sync Service Protocol

protocol DataSyncServiceProtocol {
    var currentStatus: SyncStatus { get }
    var statusPublisher: AnyPublisher<SyncStatus, Never> { get }
    var lastSyncDate: Date? { get }

    func sync(type: SyncType, priority: SyncPriority) async throws -> SyncResult
    func syncAll(priority: SyncPriority) async throws -> SyncResult
    func cancelSync()
    func setStrategy(_ strategy: SyncStrategy)
    func setConflictResolution(_ resolution: ConflictResolution)
    func getPendingSyncCount() async -> Int
}

// MARK: - Data Sync Service

/// Main data synchronization service for offline-to-online sync
@MainActor
final class DataSyncService: ObservableObject, DataSyncServiceProtocol {

    // MARK: - Singleton

    static let shared = DataSyncService()

    // MARK: - Published Properties

    @Published private(set) var currentStatus: SyncStatus = .idle

    @Published private(set) var lastSyncDate: Date?

    @Published private(set) var isSyncing: Bool = false

    @Published private(set) var progress: Double = 0.0

    @Published private(set) var lastError: SyncError?

    @Published private(set) var pendingItems: Int = 0

    // MARK: - Dependencies

    private let networkMonitor: NetworkMonitor
    private let offlineCache: OfflineCacheService
    private let databaseManager: DatabaseManager
    private let apiClient: APIClient
    private let authService: AuthService

    // MARK: - Private Properties

    private var syncTask: Task<Void, Never>?

    private var strategy: SyncStrategy = .adaptive

    private var conflictResolution: ConflictResolution = .mostRecent

    private var syncQueue: [SyncBatch] = []

    private var cancellables = Set<AnyCancellable>()

    private var lastNetworkStatus: NetworkStatus?

    // MARK: - Publishers

    var statusPublisher: AnyPublisher<SyncStatus, Never> {
        $currentStatus.eraseToAnyPublisher()
    }

    // MARK: - Initialization

    init(
        networkMonitor: NetworkMonitor = .shared,
        offlineCache: OfflineCacheService = .shared,
        databaseManager: DatabaseManager = .shared,
        apiClient: APIClient = .shared,
        authService: AuthService = .shared
    ) {
        self.networkMonitor = networkMonitor
        self.offlineCache = offlineCache
        self.databaseManager = databaseManager
        self.apiClient = apiClient
        self.authService = authService

        setupNetworkMonitoring()
    }

    // MARK: - Public Methods - Sync Operations

    /// Sync specific data type
    /// - Parameters:
    ///   - type: Type of data to sync
    ///   - priority: Priority of sync operation
    /// - Returns: Sync result
    func sync(type: SyncType, priority: SyncPriority = .normal) async throws -> SyncResult {
        // Check network availability
        guard networkMonitor.isConnected else {
            throw SyncError.networkUnavailable
        }

        // Check authentication
        guard authService.isLoggedIn else {
            throw SyncError.authenticationRequired
        }

        // Update status
        await updateStatus(.syncing)
        isSyncing = true
        progress = 0.0

        defer {
            isSyncing = false
        }

        do {
            let result = try await performSync(type: type, priority: priority)

            // Update status based on result
            if result.isComplete {
                await updateStatus(.success)
            } else if result.isSuccessful {
                await updateStatus(.partial)
            } else {
                await updateStatus(.failed)
            }

            lastSyncDate = Date()

            return result

        } catch let error as SyncError {
            await updateStatus(.failed)
            lastError = error
            throw error

        } catch {
            await updateStatus(.failed)
            let syncError = SyncError.unknown(underlying: error)
            lastError = syncError
            throw syncError
        }
    }

    /// Sync all data types
    /// - Parameter priority: Priority of sync operation
    /// - Returns: Overall sync result
    func syncAll(priority: SyncPriority = .normal) async throws -> SyncResult {
        guard networkMonitor.isConnected else {
            throw SyncError.networkUnavailable
        }

        guard authService.isLoggedIn else {
            throw SyncError.authenticationRequired
        }

        await updateStatus(.syncing)
        isSyncing = true
        progress = 0.0

        defer {
            isSyncing = false
        }

        var totalSynced = 0
        var totalFailed = 0
        var totalConflicts = 0
        var hasFailures = false

        // Sync each type
        for (index, type) in SyncType.allCases.enumerated() {
            do {
                let result = try await sync(type: type, priority: priority)

                totalSynced += result.syncedItems
                totalFailed += result.failedItems
                totalConflicts += result.conflicts

                if result.failedItems > 0 {
                    hasFailures = true
                }

                // Update progress
                progress = Double(index + 1) / Double(SyncType.allCases.count)

            } catch {
                totalFailed += 1
                hasFailures = true
            }
        }

        // Determine overall status
        let finalStatus: SyncStatus
        if totalFailed == 0 && totalConflicts == 0 {
            finalStatus = .success
        } else if totalSynced > 0 {
            finalStatus = .partial
        } else {
            finalStatus = .failed
        }

        await updateStatus(finalStatus)
        lastSyncDate = Date()

        return SyncResult(
            status: finalStatus,
            syncedItems: totalSynced,
            failedItems: totalFailed,
            conflicts: totalConflicts,
            timestamp: Date(),
            error: hasFailures ? lastError : nil
        )
    }

    /// Cancel ongoing sync operation
    func cancelSync() {
        syncTask?.cancel()
        syncTask = nil
        isSyncing = false
        currentStatus = .idle
        lastError = .cancelled
    }

    // MARK: - Public Methods - Configuration

    /// Set sync strategy
    func setStrategy(_ strategy: SyncStrategy) {
        self.strategy = strategy
    }

    /// Set conflict resolution strategy
    func setConflictResolution(_ resolution: ConflictResolution) {
        self.conflictResolution = resolution
    }

    /// Get count of pending sync items
    func getPendingSyncCount() async -> Int {
        // Count unsynced items from database
        do {
            let unsyncedSessions = try databaseManager.getUnsyncedStudySessions()
            return unsyncedSessions.count
        } catch {
            return 0
        }
    }

    // MARK: - Private Methods - Sync Implementation

    private func performSync(type: SyncType, priority: SyncPriority) async throws -> SyncResult {
        switch type {
        case .messages:
            return try await syncMessages()
        case .studySessions:
            return try await syncStudySessions()
        case .userProfile:
            return try await syncUserProfile()
        case .points:
            return try await syncPoints()
        case .settings:
            // Settings are typically synced separately
            return SyncResult(status: .success, syncedItems: 0, failedItems: 0, conflicts: 0, timestamp: Date(), error: nil)
        }
    }

    private func syncMessages() async throws -> SyncResult {
        var syncedCount = 0
        var failedCount = 0

        // Get unsynced messages from cache/database
        // This is a simplified implementation

        // TODO: Implement actual message sync logic
        // 1. Fetch pending messages from local storage
        // 2. Send to server
        // 3. Handle conflicts
        // 4. Update local status

        return SyncResult(
            status: .success,
            syncedItems: syncedCount,
            failedItems: failedCount,
            conflicts: 0,
            timestamp: Date(),
            error: nil
        )
    }

    private func syncStudySessions() async throws -> SyncResult {
        var syncedCount = 0
        var failedCount = 0

        // Get unsynced study sessions
        let unsyncedSessions = try databaseManager.getUnsyncedStudySessions()

        for session in unsyncedSessions {
            do {
                // TODO: Implement API call to sync session
                // let result = try await apiClient.syncStudySession(session)

                // Mark as synced
                try databaseManager.markStudySessionSynced(session.id)
                syncedCount += 1

            } catch {
                failedCount += 1
            }
        }

        return SyncResult(
            status: failedCount == 0 ? .success : (syncedCount > 0 ? .partial : .failed),
            syncedItems: syncedCount,
            failedItems: failedCount,
            conflicts: 0,
            timestamp: Date(),
            error: failedCount > 0 ? .clientError(underlying: NSError(domain: "Sync", code: -1)) : nil
        )
    }

    private func syncUserProfile() async throws -> SyncResult {
        // Fetch latest user profile from server
        let user = try await apiClient.getCurrentUser()

        // Cache locally
        try await offlineCache.cacheUserProfile(user)

        return SyncResult(
            status: .success,
            syncedItems: 1,
            failedItems: 0,
            conflicts: 0,
            timestamp: Date(),
            error: nil
        )
    }

    private func syncPoints() async throws -> SyncResult {
        // TODO: Implement points sync
        return SyncResult(
            status: .success,
            syncedItems: 0,
            failedItems: 0,
            conflicts: 0,
            timestamp: Date(),
            error: nil
        )
    }

    // MARK: - Private Methods - Network Monitoring

    private func setupNetworkMonitoring() {
        networkMonitor.statusPublisher
            .sink { [weak self] status in
                Task { @MainActor in
                    await self?.handleNetworkStatusChange(status)
                }
            }
            .store(in: &cancellables)
    }

    private func handleNetworkStatusChange(_ status: NetworkStatus) async {
        // Store previous status
        let previousStatus = lastNetworkStatus
        lastNetworkStatus = status

        // Auto-sync when network becomes available
        if status.isConnected && previousStatus?.isConnected == false {
            if strategy == .immediate || strategy == .adaptive {
                // Check if we have pending items
                let pendingCount = await getPendingSyncCount()
                if pendingCount > 0 {
                    // Trigger background sync
                    triggerAutoSync(priority: .normal)
                }
            }
        }

        // Update pending count
        pendingItems = await getPendingSyncCount()
    }

    private func triggerAutoSync(priority: SyncPriority) {
        // Cancel existing sync task
        syncTask?.cancel()

        // Start new sync task
        syncTask = Task {
            do {
                _ = try await syncAll(priority: priority)
            } catch {
                // Log error but don't crash
                print("Auto-sync failed: \(error)")
            }
        }
    }

    private func updateStatus(_ status: SyncStatus) async {
        currentStatus = status
    }
}

// MARK: - AsyncStream Support

extension DataSyncService {

    /// Observe sync status as AsyncStream
    var statusStream: AsyncStream<SyncStatus> {
        AsyncStream { continuation in
            // Emit initial state
            continuation.yield(currentStatus)

            // Observe changes
            $currentStatus
                .dropFirst()
                .sink { status in
                    continuation.yield(status)
                }
                .store(in: &cancellables)

            continuation.onTermination = { _ in
                // Cleanup handled by cancellables
            }
        }
    }

    /// Observe sync progress as AsyncStream
    var progressStream: AsyncStream<Double> {
        AsyncStream { continuation in
            // Emit initial state
            continuation.yield(progress)

            // Observe changes
            $progress
                .dropFirst()
                .sink { progress in
                    continuation.yield(progress)
                }
                .store(in: &cancellables)

            continuation.onTermination = { _ in
                // Cleanup handled by cancellables
            }
        }
    }
}

// MARK: - Convenience Extensions

extension DataSyncService {

    /// Check if sync is needed
    var needsSync: Bool {
        guard let lastSync = lastSyncDate else {
            return true
        }

        // If hasn't synced in 1 hour
        let threshold: TimeInterval = 60 * 60
        return Date().timeIntervalSince(lastSync) > threshold
    }

    /// Time since last sync
    var timeSinceLastSync: TimeInterval? {
        guard let lastSync = lastSyncDate else {
            return nil
        }
        return Date().timeIntervalSince(lastSync)
    }

    /// Clear error state
    func clearError() {
        lastError = nil
    }
}

// MARK: - Syncable Conformance

extension StudySession: Syncable {
    var isSynced: Bool {
        // This would need to be added to the model
        return true
    }

    var syncPriority: SyncPriority {
        // Study sessions are important
        return .high
    }
}
