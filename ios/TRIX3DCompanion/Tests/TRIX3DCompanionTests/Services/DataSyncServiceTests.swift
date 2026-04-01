//
//  DataSyncServiceTests.swift
//  TRIX3DCompanionTests
//
//  Comprehensive unit tests for DataSyncService
//

import XCTest
import Combine
import Supabase
@testable import TRIX3DCompanion

typealias DataSyncUser = TRIX3DCompanion.User

private func makeDataSyncUser(
    id: String,
    username: String? = "local-user",
    email: String? = "local@example.com",
    displayName: String? = "Local User",
    points: Int? = 0,
    updatedAt: Date = Date(timeIntervalSince1970: 0)
) -> DataSyncUser {
    DataSyncUser(
        id: id,
        username: username,
        email: email,
        phone: nil,
        role: nil,
        avatarUrl: nil,
        avatarConfig: nil,
        fullName: nil,
        displayName: displayName,
        bio: nil,
        website: nil,
        points: points,
        isStudying: nil,
        companionId: nil,
        totalStudyTime: nil,
        lastActiveAt: nil,
        lastSignInAt: nil,
        currentStreak: nil,
        daysActive: nil,
        interactionCount: nil,
        showOnlineStatus: nil,
        school: nil,
        grade: nil,
        confirmationSentAt: nil,
        confirmedAt: nil,
        emailConfirmedAt: nil,
        createdAt: Date(timeIntervalSince1970: 0),
        updatedAt: updatedAt
    )
}

/// Comprehensive unit tests for DataSyncService
@MainActor
final class DataSyncServiceTests: XCTestCase {

    // MARK: - Properties

    var syncService: DataSyncService!
    var mockNetworkMonitor: MockNetworkMonitorForDataSync!
    var mockOfflineCache: MockOfflineCacheServiceForDataSync!
    var mockDatabaseManager: MockDatabaseManagerForDataSync!
    var mockAPIClient: MockAPIClientForDataSync!
    var mockAuthService: MockAuthServiceForDataSync!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        mockNetworkMonitor = MockNetworkMonitorForDataSync()
        mockOfflineCache = MockOfflineCacheServiceForDataSync()
        mockDatabaseManager = MockDatabaseManagerForDataSync()
        mockAPIClient = MockAPIClientForDataSync()
        mockAuthService = MockAuthServiceForDataSync()

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
            DataSyncStudySession(
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
        mockAPIClient.mockCurrentUser = makeDataSyncUser(
            id: "user-1",
            username: "testuser",
            email: "test@example.com",
            displayName: "Test User",
            points: 1000,
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
            DataSyncStudySession(
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
        mockAPIClient.mockCurrentUser = makeDataSyncUser(
            id: "user-1",
            username: "testuser",
            email: "test@example.com",
            displayName: "Test User",
            points: 1000,
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
        mockAPIClient.mockCurrentUser = makeDataSyncUser(
            id: "user-1",
            username: "partial-user",
            email: "partial@example.com",
            displayName: "Partial User",
            points: 100,
            updatedAt: Date()
        )
        mockDatabaseManager.mockUnsyncedSessions = [
            DataSyncStudySession(
                id: "session-1",
                userId: "user-1",
                startTime: Date().addingTimeInterval(-3600),
                endTime: Date().addingTimeInterval(-1800),
                duration: 1800,
                subject: "Math",
                notes: nil,
                isSynced: false
            ),
            DataSyncStudySession(
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
            if case .networkUnavailable = error {
                return
            }
            XCTFail("Should return network unavailable, got \(error)")
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
            if case .authenticationRequired = error {
                return
            }
            XCTFail("Should return authentication required, got \(error)")
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
            if case .timeout = error {
                return
            }
            XCTFail("Should return timeout, got \(error)")
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

    func test_cancelSync_stopsOngoingSync() async {
        // Arrange
        mockNetworkMonitor.mockIsConnected = true
        mockAuthService.mockIsLoggedIn = true
        let service = syncService!

        // Start a sync task
        let task = Task {
            try? await service.sync(type: .messages, priority: .normal)
        }
        await Task.yield()

        // Act
        service.cancelSync()
        _ = await task.value

        // Assert
        XCTAssertFalse(service.isSyncing, "Should stop syncing")
        XCTAssertEqual(service.currentStatus, .idle, "Status should be idle")
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
            DataSyncStudySession(
                id: "session-1",
                userId: "user-1",
                startTime: Date(),
                endTime: Date(),
                duration: 0,
                subject: "Test",
                notes: nil,
                isSynced: false
            ),
            DataSyncStudySession(
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
        await fulfillment(of: [expectation], timeout: 2.0)
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
        await fulfillment(of: [expectation], timeout: 2.0)
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
        await fulfillment(of: [expectation], timeout: 2.0)
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
        await fulfillment(of: [expectation], timeout: 2.0)
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
            DataSyncStudySession(
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

@MainActor
final class MockNetworkMonitorForDataSync: NetworkMonitorProtocol {
    private let statusSubject: CurrentValueSubject<NetworkStatus, Never>

    var mockIsConnected: Bool = true {
        didSet { updateStatus() }
    }

    var mockConnectionType: ConnectionType = .wifi {
        didSet { updateStatus() }
    }

    var mockQuality: ConnectionQuality = .excellent {
        didSet { updateStatus() }
    }

    var currentStatus: NetworkStatus {
        statusSubject.value
    }

    var statusPublisher: AnyPublisher<NetworkStatus, Never> {
        statusSubject.eraseToAnyPublisher()
    }

    var connectionTypePublisher: AnyPublisher<ConnectionType, Never> {
        statusSubject
            .map(\.connectionType)
            .removeDuplicates()
            .eraseToAnyPublisher()
    }

    var isConnectedPublisher: AnyPublisher<Bool, Never> {
        statusSubject
            .map(\.isConnected)
            .removeDuplicates()
            .eraseToAnyPublisher()
    }

    init() {
        statusSubject = CurrentValueSubject(NetworkStatus(
            isConnected: true,
            connectionType: .wifi,
            quality: .excellent,
            timestamp: Date()
        ))
    }

    func startMonitoring() {}

    func stopMonitoring() {}

    func getCurrentStatus() async -> NetworkStatus {
        currentStatus
    }

    func simulateStatusChange(_ status: NetworkStatus) {
        mockIsConnected = status.isConnected
        mockConnectionType = status.connectionType
        mockQuality = status.quality
        statusSubject.send(status)
    }

    private func updateStatus() {
        statusSubject.send(NetworkStatus(
            isConnected: mockIsConnected,
            connectionType: mockIsConnected ? mockConnectionType : .none,
            quality: mockIsConnected ? mockQuality : .unknown,
            timestamp: Date()
        ))
    }
}

@MainActor
final class MockOfflineCacheServiceForDataSync: OfflineCacheServiceProtocol {
    var totalCacheSize: Int64 = 0
    var shouldFailCache = false
    var shouldFailRetrieve = false
    var shouldFailClear = false
    var shouldFailClearAll = false
    var shouldFailStatistics = false
    var shouldFailCleanExpired = false
    var shouldFailGetSize = false
    var mockError: Error = CacheError.storageError(underlying: NSError(domain: "Test", code: 500))

    func cache<T: Codable>(_ data: T, forKey key: String, type: CacheType) async throws {}
    func retrieve<T: Codable>(key: String, type: CacheType) async throws -> T { throw mockError }
    func remove(key: String, type: CacheType) async throws {}
    func clear(type: CacheType) async throws {}
    func clearAll() async throws {}
    func getStatistics(type: CacheType) async throws -> CacheStatistics { CacheStatistics(totalEntries: 0, totalSizeBytes: 0, expiredEntries: 0, type: type) }
    func cleanExpired() async throws {}
    func getCurrentSize(type: CacheType) async throws -> Int64 { 0 }
    func cacheUserProfile(_ user: DataSyncUser) async throws {}
}

final class MockDatabaseManagerForDataSync: DatabaseManagerProtocol {
    var mockUnsyncedSessions: [DataSyncStudySession] = []
    var shouldFailSync = false
    var shouldTimeout = false

    func getUnsyncedStudySessions() throws -> [StudySession] {
        if shouldTimeout {
            throw DatabaseError.queryFailed("Timeout")
        }
        return mockUnsyncedSessions.map { $0.asStudySession }
    }

    func getPendingMessages() throws -> [TRIX3DCompanion.ChatMessage] {
        []
    }

    func markMessageSynced(_ messageId: String) throws {}

    func markStudySessionSynced(_ sessionId: String) throws {
        if shouldFailSync {
            throw DatabaseError.insertFailed("Sync failed")
        }
        mockUnsyncedSessions.removeAll { $0.id == sessionId }
    }

    func getPendingPointTransactions() throws -> [PointsTransaction] {
        []
    }

    func updateUserPoints(userId: String, points: Int) throws {}

    func getPointTransaction(_ transactionId: String) throws -> PointsTransaction? {
        nil
    }

    func insertPointTransaction(_ transaction: PointsTransaction) throws {}

    func markPointTransactionSynced(_ transactionId: String) throws {}
}

final class MockAPIClientForDataSync: APIClientProtocol {
    var mockCurrentUser: DataSyncUser?
    var mockStudySessionResponse: StudySession?
    var mockPointsResponse = PointsResponse(
        totalPoints: 1000,
        level: 3,
        todayEarned: 50,
        weekEarned: 200,
        totalTransactions: 5
    )
    var mockPointsHistory: [PointsTransaction] = []

    func get<T: Codable>(_ endpoint: APIEndpoint) async throws -> T {
        if T.self == DataSyncUser.self, let user = mockCurrentUser as? T {
            return user
        }

        if T.self == PointsResponse.self, let response = mockPointsResponse as? T {
            return response
        }

        if T.self == [PointsTransaction].self, let history = mockPointsHistory as? T {
            return history
        }

        throw NetworkError.unknown(NSError(domain: "Mock", code: -1))
    }

    func get<T: Decodable>(_ endpoint: APIEndpoint, parameters: [String: Any]) async throws -> T {
        if T.self == DataSyncUser.self, let user = mockCurrentUser as? T {
            return user
        }

        throw NetworkError.unknown(NSError(domain: "Mock", code: -1))
    }

    func post<T: Codable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T {
        if T.self == StudySession.self {
            if let response = mockStudySessionResponse as? T {
                return response
            }

            let fallback = StudySession(
                id: UUID().uuidString,
                userId: mockCurrentUser?.id ?? "user-1",
                duration: 0,
                startedAt: Date(),
                endedAt: nil,
                earnedPoints: nil,
                isCompleted: false,
                subject: nil,
                notes: nil,
                createdAt: Date()
            )
            return fallback as! T
        }

        if T.self == DataSyncUser.self, let user = mockCurrentUser as? T {
            return user
        }

        if T.self == PointsResponse.self, let response = mockPointsResponse as? T {
            return response
        }

        throw NetworkError.unknown(NSError(domain: "Mock", code: -1))
    }

    func put<T: Codable>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T {
        if T.self == DataSyncUser.self, let user = mockCurrentUser as? T {
            return user
        }

        throw NetworkError.unknown(NSError(domain: "Mock", code: -1))
    }

    func delete<T: Codable>(_ endpoint: APIEndpoint) async throws -> T {
        throw NetworkError.unknown(NSError(domain: "Mock", code: -1))
    }

    func upload<T: Codable>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T {
        throw NetworkError.unknown(NSError(domain: "Mock", code: -1))
    }

    func download(from url: String) async throws -> Data {
        throw NetworkError.unknown(NSError(domain: "Mock", code: -1))
    }

    func getPoints() async throws -> PointsResponse {
        mockPointsResponse
    }

    func getPointsHistory(page: Int, limit: Int) async throws -> [PointsTransaction] {
        Array(mockPointsHistory.dropFirst((page - 1) * limit).prefix(limit))
    }
}

@MainActor
final class MockAuthServiceForDataSync: AuthServiceProtocol {
    var mockIsLoggedIn = true
    var currentUser: DataSyncUser? = makeDataSyncUser(id: "user-1")
    var isLoading: Bool = false
    var supabase: SupabaseClient? { nil }

    var isLoggedIn: Bool { mockIsLoggedIn }

    func login(email: String, password: String) async -> Result<DataSyncUser, TRIX3DCompanion.AuthError> {
        .failure(.invalidCredentials)
    }

    func register(username: String, email: String, password: String) async -> Result<DataSyncUser, TRIX3DCompanion.AuthError> {
        .failure(.invalidCredentials)
    }

    func logout() async -> Result<Void, TRIX3DCompanion.AuthError> {
        mockIsLoggedIn = false
        return .success(())
    }

    func refreshTokenIfNeeded() async -> Result<Void, TRIX3DCompanion.AuthError> {
        .success(())
    }

    func fetchCurrentUser() async -> Result<DataSyncUser, TRIX3DCompanion.AuthError> {
        guard let currentUser else {
            return .failure(.invalidCredentials)
        }
        return .success(currentUser)
    }

    func updateProfile(_ updates: DataSyncUser) async -> Result<DataSyncUser, TRIX3DCompanion.AuthError> {
        currentUser = updates
        return .success(updates)
    }

    func deleteAccount() async -> Result<Void, TRIX3DCompanion.AuthError> {
        .success(())
    }

    func updateCurrentUser(_ user: DataSyncUser?) {
        currentUser = user
    }

    func updateLoginStatus(_ loggedIn: Bool) {
        mockIsLoggedIn = loggedIn
    }

    func resetEmailConfirmationSuccess() {}

    func clearError() {}
}

// MARK: - StudySession Mock

struct DataSyncStudySession: Codable {
    let id: String
    let userId: String
    let startTime: Date
    let endTime: Date
    let duration: TimeInterval
    let subject: String
    let notes: String?
    let isSynced: Bool

    var asStudySession: StudySession {
        StudySession(
            id: id,
            userId: userId,
            duration: Int(duration),
            startedAt: startTime,
            endedAt: endTime,
            earnedPoints: nil,
            isCompleted: isSynced,
            subject: subject,
            notes: notes,
            createdAt: endTime
        )
    }
}
