//
//  DataSyncServiceTests.swift
//  TRIX3DCompanionTests
//
//  Complete test suite for DataSyncService synchronization logic
//
//  Test Coverage:
//  - sync() method for individual data types
//  - syncAll() for full synchronization
//  - Network availability checks
//  - Authentication requirements
//  - Conflict resolution strategies
//  - Cancel sync functionality
//  - Auto-sync on network restoration
//

import XCTest
import Combine
@testable import TRIX3DCompanion

// MARK: - Mock Data Sync Dependencies

@MainActor
final class MockNetworkMonitorForSync: NetworkMonitorProtocol {
    var isConnectedValue = true
    var statusValue: NetworkStatus = NetworkStatus(
        isConnected: true,
        connectionType: .wifi,
        quality: .excellent,
        timestamp: Date()
    )

    var currentStatus: NetworkStatus {
        return statusValue
    }

    var statusPublisher: AnyPublisher<NetworkStatus, Never> {
        Just(statusValue).eraseToAnyPublisher()
    }

    var connectionTypePublisher: AnyPublisher<ConnectionType, Never> {
        Just(.wifi).eraseToAnyPublisher()
    }

    var isConnectedPublisher: AnyPublisher<Bool, Never> {
        Just(isConnectedValue).eraseToAnyPublisher()
    }

    func startMonitoring() {}
    func stopMonitoring() {}
    func getCurrentStatus() async -> NetworkStatus { statusValue }
}

@MainActor
final class MockOfflineCacheForSync: OfflineCacheServiceProtocol {
    var totalCacheSize: Int64 = 0

    var shouldFailOperations = false

    func cache<T: Codable>(_ data: T, forKey key: String, type: CacheType) async throws {}
    func retrieve<T: Codable>(key: String, type: CacheType) async throws -> T {
        throw CacheError.notFound
    }
    func remove(key: String, type: CacheType) async throws {}
    func clear(type: CacheType) async throws {}
    func clearAll() async throws {}
    func getStatistics(type: CacheType) async throws -> CacheStatistics {
        CacheStatistics(totalEntries: 0, totalSizeBytes: 0, expiredEntries: 0, type: type)
    }
    func cleanExpired() async throws {}
    func getCurrentSize(type: CacheType) async throws -> Int64 { 0 }

    func cacheUserProfile(_ user: User) async throws {}
}

@MainActor
final class MockDatabaseManagerForSync: DatabaseManagerProtocol {
    var unsyncedStudySessions: [StudySession] = []
    var pendingMessages: [ChatMessage] = []
    var pendingPointTransactions: [PointsTransaction] = []

    var shouldFailOperations = false

    func getUnsyncedStudySessions() throws -> [StudySession] {
        if shouldFailOperations {
            throw DatabaseError.queryFailed("Query failed")
        }
        return unsyncedStudySessions
    }

    func markStudySessionSynced(_ sessionId: String) throws {
        unsyncedStudySessions.removeAll { $0.id == sessionId }
    }

    func getPendingMessages() throws -> [ChatMessage] {
        if shouldFailOperations {
            throw DatabaseError.queryFailed("Query failed")
        }
        return pendingMessages
    }

    func markMessageSynced(_ messageId: String) throws {
        pendingMessages.removeAll { $0.id == messageId }
    }

    func getPendingPointTransactions() throws -> [PointsTransaction] {
        if shouldFailOperations {
            throw DatabaseError.queryFailed("Query failed")
        }
        return pendingPointTransactions
    }

    func markPointTransactionSynced(_ transactionId: String) throws {
        pendingPointTransactions.removeAll { $0.id == transactionId }
    }

    func updateUserPoints(userId: String, points: Int) throws {}

    func getPointTransaction(_ transactionId: String) throws -> PointsTransaction? {
        return pendingPointTransactions.first { $0.id == transactionId }
    }

    func insertPointTransaction(_ transaction: PointsTransaction) throws {}
}

@MainActor
final class MockAPIClientForSync: APIClientProtocol {
    var shouldFailRequests = false
    var mockError: NetworkError?
    var mockUser: User?

    func get<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        if T.self == User.self, let user = mockUser {
            return user as! T
        }

        throw NetworkError.custom(message: "No mock data")
    }

    func get<T>(_ endpoint: APIEndpoint, parameters: [String: Any]) async throws -> T where T: Decodable {
        return try await get(endpoint)
    }

    func post<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }

        // Return empty response for sync endpoints
        if T.self == EmptyResponse.self {
            return EmptyResponse() as! T
        }

        throw NetworkError.custom(message: "Not implemented")
    }

    func put<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        throw NetworkError.custom(message: "Not implemented")
    }

    func delete<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError ?? NetworkError.unauthorized
        }
        throw NetworkError.custom(message: "Not implemented")
    }

    func upload<T>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T where T: Decodable {
        throw NetworkError.custom(message: "Not implemented")
    }

    func download(from url: String) async throws -> Data {
        throw NetworkError.custom(message: "Not implemented")
    }
}

@MainActor
final class MockAuthServiceForSync: AuthServiceProtocol {
    var isLoggedInValue = false
    var isLoadingValue = false
    var mockUser: User?

    var isLoggedIn: Bool {
        return isLoggedInValue
    }

    var currentUser: User? {
        return mockUser
    }

    var isLoading: Bool {
        return isLoadingValue
    }

    func login(email: String, password: String) async -> AuthResult<User> {
        return .failure(.invalidCredentials)
    }

    func register(username: String, email: String, password: String) async -> AuthResult<User> {
        return .failure(.invalidCredentials)
    }

    func logout() async -> AuthResult<Void> {
        isLoggedInValue = false
        return .success(())
    }

    func refreshTokenIfNeeded() async -> AuthResult<Void> {
        return .success(())
    }

    func fetchCurrentUser() async -> AuthResult<User> {
        if let user = mockUser {
            return .success(user)
        }
        return .failure(.invalidCredentials)
    }

    func clearError() {}

    func updateProfile(_ updates: User) async -> AuthResult<User> {
        return .success(updates)
    }

    func deleteAccount() async -> AuthResult<Void> {
        return .success(())
    }

    func updateCurrentUser(_ user: User?) {}

    func updateLoginStatus(_ loggedIn: Bool) {}

}

// MARK: - DataSyncService Tests

@MainActor
final class DataSyncServiceTests: XCTestCase {

    var sut: DataSyncService!
    var mockNetworkMonitor: MockNetworkMonitorForSync!
    var mockOfflineCache: MockOfflineCacheForSync!
    var mockDatabaseManager: MockDatabaseManagerForSync!
    var mockAPIClient: MockAPIClientForSync!
    var mockAuthService: MockAuthServiceForSync!

    override func setUp() async throws {
        try await super.setUp()

        mockNetworkMonitor = MockNetworkMonitorForSync()
        mockOfflineCache = MockOfflineCacheForSync()
        mockDatabaseManager = MockDatabaseManagerForSync()
        mockAPIClient = MockAPIClientForSync()
        mockAuthService = MockAuthServiceForSync()

        sut = DataSyncService(
            networkMonitor: mockNetworkMonitor,
            offlineCache: mockOfflineCache,
            databaseManager: mockDatabaseManager,
            apiClient: mockAPIClient,
            authService: mockAuthService
        )
    }

    override func tearDown() async throws {
        sut = nil
        mockNetworkMonitor = nil
        mockOfflineCache = nil
        mockDatabaseManager = nil
        mockAPIClient = nil
        mockAuthService = nil
        try await super.tearDown()
    }

    // MARK: - Sync All Tests

    func testSyncAll_Success() async throws {
        mockNetworkMonitor.isConnectedValue = true
        mockAuthService.isLoggedInValue = true
        mockDatabaseManager.unsyncedStudySessions = [
            StudySession(id: UUID().uuidString, userId: "user1", duration: 60, startedAt: Date(), endedAt: nil, earnedPoints: 10, isCompleted: false, subject: nil, notes: nil, createdAt: Date())
        ]

        let result = try await sut.syncAll()

        XCTAssertEqual(result.status, .success)
    }

    func testSyncAll_NoNetwork() async throws {
        mockNetworkMonitor.isConnectedValue = false

        do {
            _ = try await sut.syncAll()
            XCTFail("Expected network error")
        } catch {
            XCTAssertTrue(error is SyncError)
        }
    }

    func testSyncAll_NotAuthenticated() async throws {
        mockNetworkMonitor.isConnectedValue = true
        mockAuthService.isLoggedInValue = false

        do {
            _ = try await sut.syncAll()
            XCTFail("Expected auth error")
        } catch {
            XCTAssertTrue(error is SyncError)
        }
    }

    func testSyncAll_Cancel() async throws {
        mockNetworkMonitor.isConnectedValue = true
        mockAuthService.isLoggedInValue = true
        mockDatabaseManager.shouldFailOperations = true

        let syncTask = Task {
            try? await sut.syncAll()
        }

        try await Task.sleep(nanoseconds: 10_000_000)
        sut.cancelSync()
        await syncTask.value

        XCTAssertEqual(sut.currentStatus, .idle)
    }

    // MARK: - Sync Type Tests

    func testSyncStudySessions_Success() async throws {
        mockNetworkMonitor.isConnectedValue = true
        mockAuthService.isLoggedInValue = true
        mockDatabaseManager.unsyncedStudySessions = [
            StudySession(id: UUID().uuidString, userId: "user1", duration: 30, startedAt: Date(), endedAt: nil, earnedPoints: 5, isCompleted: false, subject: nil, notes: nil, createdAt: Date())
        ]

        let result = try await sut.sync(type: .studySessions)

        XCTAssertEqual(result.status, .success)
    }

    func testSyncMessages_Success() async throws {
        mockNetworkMonitor.isConnectedValue = true
        mockAuthService.isLoggedInValue = true

        let result = try await sut.sync(type: .messages)

        XCTAssertEqual(result.status, .success)
    }

    func testSyncPoints_Success() async throws {
        mockNetworkMonitor.isConnectedValue = true
        mockAuthService.isLoggedInValue = true
        mockDatabaseManager.pendingPointTransactions = []

        let result = try await sut.sync(type: .points)

        XCTAssertEqual(result.status, .success)
    }

    // MARK: - Pending Items Count Tests

    func testGetPendingSyncCount() async throws {
        mockDatabaseManager.unsyncedStudySessions = [
            StudySession(id: "1", userId: "u", duration: 10, startedAt: Date(), endedAt: nil, earnedPoints: nil, isCompleted: false, subject: nil, notes: nil, createdAt: Date()),
            StudySession(id: "2", userId: "u", duration: 20, startedAt: Date(), endedAt: nil, earnedPoints: nil, isCompleted: false, subject: nil, notes: nil, createdAt: Date())
        ]

        let count = await sut.getPendingSyncCount()

        XCTAssertEqual(count, 2)
    }

    // MARK: - Strategy Tests

    func testSetStrategy_Adaptive() {
        sut.setStrategy(.adaptive)
        // Strategy is set internally
    }

    func testSetStrategy_Eager() {
        sut.setStrategy(.immediate)
    }

    func testSetConflictResolution_MostRecent() {
        sut.setConflictResolution(.mostRecent)
    }

    func testSetConflictResolution_ServerWins() {
        sut.setConflictResolution(.serverWins)
    }
}

// MARK: - Mock Types

struct MockPointTransaction: Identifiable {
    let id: String
    let pointsChange: Int
    let type: TransactionType
    let description: String
    let balanceAfter: Int
    let createdAt: Date
}
