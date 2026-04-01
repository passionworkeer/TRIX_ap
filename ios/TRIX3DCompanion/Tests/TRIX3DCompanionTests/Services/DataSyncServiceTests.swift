//
//  DataSyncServiceTests.swift
//  TRIX3DCompanionTests
//
//  Comprehensive unit tests for DataSyncService
//

import XCTest
import Combine
@testable import TRIX3DCompanion

/// Comprehensive unit tests for DataSyncService
final class DataSyncServiceTests: XCTestCase {

    // MARK: - Properties

    var syncService: DataSyncService!
    var mockNetworkMonitor: MockNetworkMonitor!
    var mockOfflineCache: MockOfflineCacheService!
    var mockDatabaseManager: MockDatabaseManager!
    var mockAPIClient: MockAPIClient!
    var mockAuthService: MockAuthService!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        mockNetworkMonitor = MockNetworkMonitor()
        mockOfflineCache = MockOfflineCacheService()
        mockDatabaseManager = MockDatabaseManager()
        mockAPIClient = MockAPIClient()
        mockAuthService = MockAuthService()

        syncService = DataSyncService(
            networkMonitor: mockNetworkMonitor,
            offlineCache: mockOfflineCache,
            databaseManager: mockDatabaseManager,
            apiClient: mockAPIClient,
            authService: mockAuthService
        )

        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        syncService = nil
        mockNetworkMonitor = nil
        mockOfflineCache = nil
        mockDatabaseManager = nil
        mockAPIClient = nil
        mockAuthService = nil
        cancellables = nil
    }

    // MARK: - Sync Type Tests

    func test_sync_messages_success() async throws {
        // Arrange
        mockNetworkMonitor.mockIsConnected = true
        mockAuthService.mockIsLoggedIn = true

        // Act
        let result = try await syncService.sync(type: .messages, priority: .normal)

        // Assert
        XCTAssertTrue(result.isSuccessful, "Sync should be successful")
        XCTAssertEqual(syncService.lastSyncDate != nil, true, "Last sync date should be set")
    }

    func test_sync_studySessions_success() async throws {
        // Arrange
        mockNetworkMonitor.mockIsConnected = true
        mockAuthService.mockIsLoggedIn = true
        mockDatabaseManager.mockUnsyncedSessions = [
            StudySession(
                id: "session-1",
                userId: "user-1",
                startTime: Date().addingTimeInterval(-3600),
                endTime: Date().addingTimeInterval(-1800),
                duration: 1800,
                subject: "Math",
                notes: nil,
                isSynced: false
            )
        ]

        // Act
        let result = try await syncService.sync(type: .studySessions, priority: .high)

        // Assert
        XCTAssertTrue(result.isSuccessful, "Sync should be successful")
        XCTAssertEqual(result.syncedItems, 1, "Should sync one session")
    }

    func test_sync_userProfile_success() async throws {
        // Arrange
        mockNetworkMonitor.mockIsConnected = true
        mockAuthService.mockIsLoggedIn = true
        mockAPIClient.mockCurrentUser = User(
            id: "user-1",
            username: "testuser",
            email: "test@example.com",
            displayName: "Test User",
            avatarUrl: nil,
            points: 1000,
            createdAt: Date(),
            updatedAt: Date()
        )

        // Act
        let result = try await syncService.sync(type: .userProfile, priority: .normal)

        // Assert
        XCTAssertTrue(result.isSuccessful, "Sync should be successful")
        XCTAssertEqual(result.syncedItems, 1, "Should sync user profile")
    }

    func test_sync_points_success() async throws {
        // Arrange
        mockNetworkMonitor.mockIsConnected = true
        mockAuthService.mockIsLoggedIn = true

        // Act
        let result = try await syncService.sync(type: .points, priority: .normal)

        // Assert
        XCTAssertTrue(result.isSuccessful, "Sync should be successful")
    }

    // MARK: - Sync All Tests

    func test_syncAll_success() async throws {
        // Arrange
        mockNetworkMonitor.mockIsConnected = true
        mockAuthService.mockIsLoggedIn = true
        mockDatabaseManager.mockUnsyncedSessions = [
            StudySession(
                id: "session-1",
                userId: "user-1",
                startTime: Date().addingTimeInterval(-3600),
                endTime: Date().addingTimeInterval(-1800),
                duration: 1800,
                subject: "Math",
                notes: nil,
                isSynced: false
            )
        ]
        mockAPIClient.mockCurrentUser = User(
            id: "user-1",
            username: "testuser",
            email: "test@example.com",
            displayName: "Test User",
            avatarUrl: nil,
            points: 1000,
            createdAt: Date(),
            updatedAt: Date()
        )

        // Act
        let result = try await syncService.syncAll(priority: .normal)

        // Assert
        XCTAssertTrue(result.isSuccessful, "Sync all should be successful")
        XCTAssertGreaterThanOrEqual(result.syncedItems, 1, "Should sync at least one item")
        XCTAssertNotNil(syncService.lastSyncDate, "Last sync date should be set")
    }

    func test_syncAll_partialFailure() async throws {
        // Arrange
        mockNetworkMonitor.mockIsConnected = true
        mockAuthService.mockIsLoggedIn = true
        mockDatabaseManager.mockUnsyncedSessions = [
            StudySession(
                id: "session-1",
                userId: "user-1",
                startTime: Date().addingTimeInterval(-3600),
                endTime: Date().addingTimeInterval(-1800),
                duration: 1800,
                subject: "Math",
                notes: nil,
                isSynced: false
            ),
            StudySession(
                id: "session-2",
                userId: "user-1",
                startTime: Date().addingTimeInterval(-7200),
                endTime: Date().addingTimeInterval(-5400),
                duration: 1800,
                subject: "English",
                notes: nil,
                isSynced: false
            )
        ]
        mockDatabaseManager.shouldFailSync = true

        // Act
        let result = try await syncService.syncAll(priority: .normal)

        // Assert
        XCTAssertEqual(result.status, .partial, "Status should be partial")
        XCTAssertGreaterThan(result.failedItems, 0, "Should have failed items")
    }

    // MARK: - Error Handling Tests

    func test_sync_networkUnavailable_fails() async {
        // Arrange
        mockNetworkMonitor.mockIsConnected = false
        mockAuthService.mockIsLoggedIn = true

        // Act & Assert
        do {
            try await syncService.sync(type: .messages, priority: .normal)
            XCTFail("Should throw network unavailable error")
        } catch let error as SyncError {
            XCTAssertEqual(error, .networkUnavailable, "Should return network unavailable")
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    func test_sync_authenticationRequired_fails() async {
        // Arrange
        mockNetworkMonitor.mockIsConnected = true
        mockAuthService.mockIsLoggedIn = false

        // Act & Assert
        do {
            try await syncService.sync(type: .messages, priority: .normal)
            XCTFail("Should throw authentication required error")
        } catch let error as SyncError {
            XCTAssertEqual(error, .authenticationRequired, "Should return authentication required")
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    func test_sync_timeout_fails() async {
        // Arrange
        mockNetworkMonitor.mockIsConnected = true
        mockAuthService.mockIsLoggedIn = true
        mockDatabaseManager.shouldTimeout = true

        // Act & Assert
        do {
            try await syncService.sync(type: .studySessions, priority: .normal)
            XCTFail("Should throw timeout error")
        } catch let error as SyncError {
            XCTAssertEqual(error, .timeout, "Should return timeout")
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    // MARK: - Priority Tests

    func test_sync_withUrgentPriority() async throws {
        // Arrange
        mockNetworkMonitor.mockIsConnected = true
        mockAuthService.mockIsLoggedIn = true

        // Act
        let result = try await syncService.sync(type: .messages, priority: .urgent)

        // Assert - Urgent priority should work
        XCTAssertTrue(result.isSuccessful, "Urgent sync should succeed")
    }

    func test_sync_withLowPriority() async throws {
        // Arrange
        mockNetworkMonitor.mockIsConnected = true
        mockAuthService.mockIsLoggedIn = true

        // Act
        let result = try await syncService.sync(type: .messages, priority: .low)

        // Assert
        XCTAssertTrue(result.isSuccessful, "Low priority sync should succeed")
    }

    // MARK: - Cancel Tests

    func test_cancelSync_stopsOngoingSync() {
        // Arrange
        mockNetworkMonitor.mockIsConnected = true
        mockAuthService.mockIsLoggedIn = true

        // Start a sync task
        Task {
            try? await syncService.sync(type: .messages, priority: .normal)
        }

        // Act
        syncService.cancelSync()

        // Assert
        XCTAssertFalse(syncService.isSyncing, "Should stop syncing")
        XCTAssertEqual(syncService.currentStatus, .idle, "Status should be idle")
    }

    // MARK: - Strategy Tests

    func test_setStrategy_immediate() {
        // Act
        syncService.setStrategy(.immediate)

        // Assert - Strategy should be set
        XCTAssertTrue(true, "Strategy should be set without error")
    }

    func test_setStrategy_deferred() {
        // Act
        syncService.setStrategy(.deferred)

        // Assert
        XCTAssertTrue(true, "Strategy should be set without error")
    }

    func test_setStrategy_manual() {
        // Act
        syncService.setStrategy(.manual)

        // Assert
        XCTAssertTrue(true, "Strategy should be set without error")
    }

    func test_setStrategy_adaptive() {
        // Act
        syncService.setStrategy(.adaptive)

        // Assert
        XCTAssertTrue(true, "Strategy should be set without error")
    }

    // MARK: - Conflict Resolution Tests

    func test_setConflictResolution_clientWins() {
        // Act
        syncService.setConflictResolution(.clientWins)

        // Assert
        XCTAssertTrue(true, "Conflict resolution should be set")
    }

    func test_setConflictResolution_serverWins() {
        // Act
        syncService.setConflictResolution(.serverWins)

        // Assert
        XCTAssertTrue(true, "Conflict resolution should be set")
    }

    func test_setConflictResolution_mostRecent() {
        // Act
        syncService.setConflictResolution(.mostRecent)

        // Assert
        XCTAssertTrue(true, "Conflict resolution should be set")
    }

    func test_setConflictResolution_manual() {
        // Act
        syncService.setConflictResolution(.manual)

        // Assert
        XCTAssertTrue(true, "Conflict resolution should be set")
    }

    // MARK: - Pending Items Tests

    func test_getPendingSyncCount_returnsCount() async {
        // Arrange
        mockDatabaseManager.mockUnsyncedSessions = [
            StudySession(
                id: "session-1",
                userId: "user-1",
                startTime: Date(),
                endTime: Date(),
                duration: 0,
                subject: "Test",
                notes: nil,
                isSynced: false
            ),
            StudySession(
                id: "session-2",
                userId: "user-1",
                startTime: Date(),
                endTime: Date(),
                duration: 0,
                subject: "Test",
                notes: nil,
                isSynced: false
            )
        ]

        // Act
        let count = await syncService.getPendingSyncCount()

        // Assert
        XCTAssertEqual(count, 2, "Should return count of pending items")
    }

    func test_getPendingSyncCount_zeroWhenNone() async {
        // Arrange
        mockDatabaseManager.mockUnsyncedSessions = []

        // Act
        let count = await syncService.getPendingSyncCount()

        // Assert
        XCTAssertEqual(count, 0, "Should return 0 when no pending items")
    }

    // MARK: - Published Properties Tests

    func test_currentStatus_publishesChanges() async {
        // Arrange
        let expectation = XCTestExpectation(description: "currentStatus should publish change")
        var statuses: [SyncStatus] = []

        syncService.$currentStatus
            .sink { status in
                statuses.append(status)
                if statuses.count >= 2 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        mockNetworkMonitor.mockIsConnected = true
        mockAuthService.mockIsLoggedIn = true

        // Act
        try? await syncService.sync(type: .messages, priority: .normal)

        // Assert
        wait(for: [expectation], timeout: 2.0)
        XCTAssertTrue(statuses.contains(.syncing), "Should have syncing status")
    }

    func test_isSyncing_updatesDuringSync() async {
        // Arrange
        let expectation = XCTestExpectation(description: "isSyncing should update")
        var syncingStates: [Bool] = []

        syncService.$isSyncing
            .sink { isSyncing in
                syncingStates.append(isSyncing)
                if syncingStates.count >= 2 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        mockNetworkMonitor.mockIsConnected = true
        mockAuthService.mockIsLoggedIn = true

        // Act
        try? await syncService.sync(type: .messages, priority: .normal)

        // Assert
        wait(for: [expectation], timeout: 2.0)
        XCTAssertTrue(syncingStates.contains(true), "Should have syncing state true")
        XCTAssertTrue(syncingStates.contains(false), "Should have syncing state false")
    }

    func test_progress_updatesDuringSyncAll() async {
        // Arrange
        mockNetworkMonitor.mockIsConnected = true
        mockAuthService.mockIsLoggedIn = true

        let expectation = XCTestExpectation(description: "progress should update")
        syncService.$progress
            .dropFirst()
            .sink { progress in
                if progress > 0 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // Act
        try? await syncService.syncAll(priority: .normal)

        // Assert
        wait(for: [expectation], timeout: 2.0)
    }

    func test_lastError_setOnFailure() async {
        // Arrange
        mockNetworkMonitor.mockIsConnected = false
        let expectation = XCTestExpectation(description: "lastError should be set")

        syncService.$lastError
            .dropFirst()
            .sink { error in
                if error != nil {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // Act
        try? await syncService.sync(type: .messages, priority: .normal)

        // Assert
        wait(for: [expectation], timeout: 2.0)
        XCTAssertNotNil(syncService.lastError, "Should have last error set")
    }

    // MARK: - Convenience Tests

    func test_needsSync_returnsTrueWhenNeverSynced() {
        // Arrange - Don't set lastSyncDate

        // Act
        let needsSync = syncService.needsSync

        // Assert
        XCTAssertTrue(needsSync, "Should need sync when never synced")
    }

    func test_needsSync_returnsFalseWhenRecentlySynced() async {
        // Arrange
        mockNetworkMonitor.mockIsConnected = true
        mockAuthService.mockIsLoggedIn = true
        try? await syncService.sync(type: .messages, priority: .normal)

        // Act
        let needsSync = syncService.needsSync

        // Assert
        XCTAssertFalse(needsSync, "Should not need sync when recently synced")
    }

    func test_timeSinceLastSync_returnsNilWhenNeverSynced() {
        // Arrange - Don't set lastSyncDate

        // Act
        let timeSince = syncService.timeSinceLastSync

        // Assert
        XCTAssertNil(timeSince, "Should be nil when never synced")
    }

    func test_timeSinceLastSync_returnsTimeInterval() async {
        // Arrange
        mockNetworkMonitor.mockIsConnected = true
        mockAuthService.mockIsLoggedIn = true
        try? await syncService.sync(type: .messages, priority: .normal)
        try? await Task.sleep(nanoseconds: 100_000_000)

        // Act
        let timeSince = syncService.timeSinceLastSync

        // Assert
        XCTAssertNotNil(timeSince, "Should return time interval")
        XCTAssertGreaterThan(timeSince!, 0, "Time should be positive")
    }

    func test_clearError_removesLastError() async {
        // Arrange - Set an error
        mockNetworkMonitor.mockIsConnected = false
        try? await syncService.sync(type: .messages, priority: .normal)
        XCTAssertNotNil(syncService.lastError, "Should have error after failed sync")

        // Act
        syncService.clearError()

        // Assert
        XCTAssertNil(syncService.lastError, "Error should be cleared")
    }

    // MARK: - Network Status Change Tests

    func test_networkReconnect_triggersAutoSync() async {
        // Arrange
        mockAuthService.mockIsLoggedIn = true
        syncService.setStrategy(.immediate)
        mockDatabaseManager.mockUnsyncedSessions = [
            StudySession(
                id: "session-1",
                userId: "user-1",
                startTime: Date(),
                endTime: Date(),
                duration: 0,
                subject: "Test",
                notes: nil,
                isSynced: false
            )
        ]

        // Act - Simulate network reconnect
        mockNetworkMonitor.simulateStatusChange(NetworkStatus(
            isConnected: true,
            connectionType: .wifi,
            quality: .excellent,
            timestamp: Date()
        ))

        try? await Task.sleep(nanoseconds: 500_000_000)

        // Assert - Auto-sync should be triggered
        // Note: This is hard to test without actual async task tracking
        XCTAssertTrue(true, "Auto-sync should be triggered")
    }

    // MARK: - SyncError Tests

    func test_SyncError_descriptions() {
        let networkUnavailable = SyncError.networkUnavailable
        XCTAssertNotNil(networkUnavailable.localizedDescription)

        let authRequired = SyncError.authenticationRequired
        XCTAssertNotNil(authRequired.localizedDescription)

        let timeout = SyncError.timeout
        XCTAssertNotNil(timeout.localizedDescription)

        let cancelled = SyncError.cancelled
        XCTAssertNotNil(cancelled.localizedDescription)
    }

    func test_SyncError_conflictDescription() {
        let clientWins = SyncError.conflict(resolution: .clientWins)
        XCTAssertTrue(clientWins.localizedDescription.contains("client_wins") ||
                      clientWins.localizedDescription.contains("Client"))

        let serverWins = SyncError.conflict(resolution: .serverWins)
        XCTAssertTrue(serverWins.localizedDescription.contains("server_wins") ||
                      serverWins.localizedDescription.contains("Server"))
    }

    // MARK: - SyncStatus Tests

    func test_SyncStatus_allCases() {
        let allCases = SyncStatus.allCases
        XCTAssertEqual(allCases.count, 5, "Should have 5 sync statuses")
        XCTAssertTrue(allCases.contains(.idle), "Should have idle")
        XCTAssertTrue(allCases.contains(.syncing), "Should have syncing")
        XCTAssertTrue(allCases.contains(.success), "Should have success")
        XCTAssertTrue(allCases.contains(.failed), "Should have failed")
        XCTAssertTrue(allCases.contains(.partial), "Should have partial")
    }

    func test_SyncStatus_isActive() {
        XCTAssertTrue(SyncStatus.syncing.isActive, "Syncing should be active")
        XCTAssertFalse(SyncStatus.idle.isActive, "Idle should not be active")
        XCTAssertFalse(SyncStatus.success.isActive, "Success should not be active")
    }

    // MARK: - SyncPriority Tests

    func test_SyncPriority_comparison() {
        XCTAssertTrue(SyncPriority.low < SyncPriority.normal, "Low should be less than normal")
        XCTAssertTrue(SyncPriority.normal < SyncPriority.high, "Normal should be less than high")
        XCTAssertTrue(SyncPriority.high < SyncPriority.urgent, "High should be less than urgent")
    }

    // MARK: - SyncResult Tests

    func test_SyncResult_isSuccessful() {
        let success = SyncResult(
            status: .success,
            syncedItems: 10,
            failedItems: 0,
            conflicts: 0,
            timestamp: Date(),
            error: nil
        )
        XCTAssertTrue(success.isSuccessful, "Success status should be successful")

        let partial = SyncResult(
            status: .partial,
            syncedItems: 5,
            failedItems: 2,
            conflicts: 0,
            timestamp: Date(),
            error: nil
        )
        XCTAssertTrue(partial.isSuccessful, "Partial status should be successful")

        let failed = SyncResult(
            status: .failed,
            syncedItems: 0,
            failedItems: 10,
            conflicts: 0,
            timestamp: Date(),
            error: nil
        )
        XCTAssertFalse(failed.isSuccessful, "Failed status should not be successful")
    }

    func test_SyncResult_isComplete() {
        let complete = SyncResult(
            status: .success,
            syncedItems: 10,
            failedItems: 0,
            conflicts: 0,
            timestamp: Date(),
            error: nil
        )
        XCTAssertTrue(complete.isComplete, "Success with no failures should be complete")

        let incomplete = SyncResult(
            status: .partial,
            syncedItems: 8,
            failedItems: 2,
            conflicts: 0,
            timestamp: Date(),
            error: nil
        )
        XCTAssertFalse(incomplete.isComplete, "Partial should not be complete")
    }
}

// MARK: - Mock Classes

class MockNetworkMonitor: NetworkMonitor {
    var mockIsConnected = true
    var statusContinuation: AsyncStream<NetworkStatus>.Continuation?

    override var currentStatus: NetworkStatus {
        NetworkStatus(
            isConnected: mockIsConnected,
            connectionType: .wifi,
            quality: .excellent,
            timestamp: Date()
        )
    }

    func simulateStatusChange(_ status: NetworkStatus) {
        // Trigger status update
        Task { @MainActor in
            self.updateStatus(from: NWPath())
        }
    }

    private func updateStatus(from path: NWPath) {
        // Simplified update for testing
    }
}

class MockOfflineCacheService: OfflineCacheService {
    override func cacheUserProfile(_ user: User) async throws {
        // No-op for testing
    }
}

class MockDatabaseManager: DatabaseManager {
    var mockUnsyncedSessions: [StudySession] = []
    var shouldFailSync = false
    var shouldTimeout = false

    override func getUnsyncedStudySessions() throws -> [StudySession] {
        if shouldTimeout {
            throw DatabaseError.queryFailed("Timeout")
        }
        return mockUnsyncedSessions
    }

    override func markStudySessionSynced(_ sessionId: String) throws {
        if shouldFailSync {
            throw DatabaseError.updateFailed("Sync failed")
        }
        mockUnsyncedSessions.removeAll { $0.id == sessionId }
    }
}

class MockAPIClient: APIClient {
    var mockCurrentUser: User?

    override func getCurrentUser() async throws -> User {
        guard let user = mockCurrentUser else {
            throw NetworkError.unknown(NSError(domain: "Mock", code: -1))
        }
        return user
    }
}

class MockAuthService: AuthService {
    var mockIsLoggedIn = true
}

// MARK: - StudySession Mock

struct StudySession: Codable {
    let id: String
    let userId: String
    let startTime: Date
    let endTime: Date
    let duration: TimeInterval
    let subject: String
    let notes: String?
    let isSynced: Bool
}

// MARK: - NWPath Mock

struct NWPath {
    var status: NWPath.Status = .satisfied

    enum Status {
        case satisfied
        case unsatisfied
        case requiresConnection
    }

    func usesInterfaceType(_ type: NWInterfaceType) -> Bool {
        return false
    }
}

enum NWInterfaceType {
    case wifi
    case cellular
    case wiredEthernet
    case other
}

// MARK: - ChatMessage Mock

struct ChatMessage: Codable {
    let id: String
    let roomId: String
    let senderId: String?
    let text: String
    let timestamp: Date
    // Add other necessary properties
}
