//
//  ClawbotHistoryServiceTests.swift
//  TRIX3DCompanionTests
//
//  Test suite for ClawbotHistoryService
//
//  Test Coverage:
//  - getHistory: Success, not authenticated, network error, pagination
//  - clearHistory: Success, cache error
//  - getCachedHistory: Success, cache miss, cache error
//

import XCTest
import Combine
@testable import TRIX3DCompanion

// MARK: - Mock API Client for ClawbotHistoryService

@MainActor
final class MockAPIClientForClawbotHistory: ObservableObject {
    var shouldFailRequests = false
    var mockError: NetworkError?
    var mockMessages: [ChatMessage] = []
    var lastRequestedRoomId: String?
    var lastRequestedLimit: Int?
    var lastRequestedOffset: Int?

    func get<T>(_ endpoint: APIEndpoint, parameters: [String: Any]? = nil) async throws -> T {
        lastRequestedRoomId = endpoint.path.replacingOccurrences(of: "/clawbot/history/", with: "")
        lastRequestedLimit = parameters?["limit"] as? Int
        lastRequestedOffset = parameters?["offset"] as? Int

        if shouldFailRequests {
            throw mockError ?? NetworkError.custom("Request failed")
        }

        guard let messages = mockMessages as? T else {
            throw NetworkError.custom("Invalid mock data")
        }

        return messages
    }
}

// MARK: - Mock Offline Cache Service for ClawbotHistoryService

@MainActor
final class MockOfflineCacheServiceForClawbotHistory: OfflineCacheServiceProtocol {
    var shouldFailCache = false
    var shouldFailRemove = false
    var mockCachedMessages: [ChatMessage]?
    var mockCacheError: CacheError?
    var lastCachedKey: String?
    var lastCachedType: CacheType?

    func cache<T: Codable>(_ data: T, forKey key: String, type: CacheType) async throws {
        if shouldFailCache {
            throw mockCacheError ?? CacheError.storageError(underlying: NSError(domain: "test", code: -1))
        }
        lastCachedKey = key
        lastCachedType = type

        if let messages = data as? [ChatMessage] {
            mockCachedMessages = messages
        }
    }

    func retrieve<T: Codable>(key: String, type: CacheType) async throws -> T {
        if shouldFailCache, let error = mockCacheError {
            throw error
        }

        if mockCachedMessages == nil {
            throw CacheError.notFound
        }

        guard let messages = mockCachedMessages as? T else {
            throw CacheError.decodingFailed
        }

        return messages
    }

    func remove(key: String, type: CacheType) async throws {
        if shouldFailRemove {
            throw CacheError.storageError(underlying: NSError(domain: "test", code: -1))
        }
        mockCachedMessages = nil
    }

    func clear(type: CacheType) async throws {
        mockCachedMessages = nil
    }

    func clearAll() async throws {
        mockCachedMessages = nil
    }

    func getStatistics(type: CacheType) async throws -> CacheStatistics {
        return CacheStatistics(totalEntries: 0, totalSizeBytes: 0, expiredEntries: 0, type: type)
    }

    func cleanExpired() async throws {
    }

    func getCurrentSize(type: CacheType) async throws -> Int64 {
        return 0
    }
}

// MARK: - Mock Auth Service for ClawbotHistoryService

@MainActor
final class MockAuthServiceForClawbotHistory: AuthServiceProtocol {
    var isLoggedIn: Bool = false

    var currentUser: User? {
        isLoggedIn ? User(
            id: "test_user_id",
            username: "test_user",
            email: "test@example.com",
            avatarUrl: nil,
            fullName: nil,
            displayName: "Test User",
            bio: nil,
            points: 0,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 0,
            createdAt: Date(),
            updatedAt: Date()
        ) : nil
    }

    var isLoading: Bool = false

    var lastError: AuthError?
}

// MARK: - ClawbotHistoryService Tests

@MainActor
final class ClawbotHistoryServiceTests: XCTestCase {

    var sut: ClawbotHistoryService!
    var mockAPIClient: MockAPIClientForClawbotHistory!
    var mockCacheService: MockOfflineCacheServiceForClawbotHistory!
    var mockAuthService: MockAuthServiceForClawbotHistory!

    override func setUp() async throws {
        try await super.setUp()

        mockAPIClient = MockAPIClientForClawbotHistory()
        mockCacheService = MockOfflineCacheServiceForClawbotHistory()
        mockAuthService = MockAuthServiceForClawbotHistory()

        // Setup default mock data
        mockAPIClient.mockMessages = createMockMessages()

        sut = ClawbotHistoryService(
            apiClient: mockAPIClient as! APIClient,
            offlineCacheService: mockCacheService,
            authService: mockAuthService as! AuthService
        )
    }

    override func tearDown() async throws {
        sut = nil
        mockAPIClient = nil
        mockCacheService = nil
        mockAuthService = nil
        try await super.tearDown()
    }
}

// MARK: - GetHistory Tests

extension ClawbotHistoryServiceTests {

    func testGetHistorySuccess() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        let roomId = "test_room_1"

        // When
        let messages = try await sut.getHistory(roomId: roomId)

        // Then
        XCTAssertEqual(messages.count, 3, "Should return 3 messages")
        XCTAssertEqual(sut.history.count, 3, "Should update history state")
        XCTAssertFalse(sut.isLoading, "Should not be loading after success")
    }

    func testGetHistoryNotAuthenticated() async throws {
        // Given
        mockAuthService.isLoggedIn = false

        // When & Then
        do {
            _ = try await sut.getHistory(roomId: "test_room_1")
            XCTFail("Should throw not authenticated error")
        } catch let error as ClawbotHistoryServiceError {
            XCTAssertEqual(error, .notAuthenticated, "Should throw not authenticated error")
            XCTAssertNotNil(sut.lastError, "Should set last error")
        }
    }

    func testGetHistoryNetworkError() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        mockAPIClient.shouldFailRequests = true
        mockAPIClient.mockError = .timeout

        // When & Then
        do {
            _ = try await sut.getHistory(roomId: "test_room_1")
            XCTFail("Should throw network error")
        } catch let error as ClawbotHistoryServiceError {
            if case .networkError = error {
                XCTAssertTrue(true, "Should throw network error")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        }
    }

    func testGetHistoryWithPagination() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        let roomId = "test_room_1"

        // First request with offset 0
        let messages1 = try await sut.getHistory(roomId: roomId, limit: 2, offset: 0)
        XCTAssertEqual(messages1.count, 2, "Should return first 2 messages")

        // Second request with offset 2
        let messages2 = try await sut.getHistory(roomId: roomId, limit: 2, offset: 2)
        XCTAssertEqual(messages2.count, 1, "Should return remaining message")

        // Verify no duplicates
        let allIds = sut.history.map { $0.id }
        let uniqueIds = Set(allIds)
        XCTAssertEqual(allIds.count, uniqueIds.count, "Should have no duplicate messages")
    }

    func testGetHistoryCachesResults() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        let roomId = "test_room_1"

        // When
        _ = try await sut.getHistory(roomId: roomId)

        // Then
        XCTAssertNotNil(mockCacheService.lastCachedKey, "Should cache the results")
        XCTAssertEqual(mockCacheService.lastCachedKey, "clawbot_history_\(roomId)", "Should use correct cache key")
    }
}

// MARK: - ClearHistory Tests

extension ClawbotHistoryServiceTests {

    func testClearHistorySuccess() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        let roomId = "test_room_1"

        // First populate history
        _ = try await sut.getHistory(roomId: roomId)
        XCTAssertFalse(sut.history.isEmpty, "Should have history before clearing")

        // When
        try await sut.clearHistory(roomId: roomId)

        // Then
        XCTAssertTrue(sut.history.isEmpty, "Should clear history")
        XCTAssertFalse(sut.isLoading, "Should not be loading after success")
    }

    func testClearHistoryCacheError() async throws {
        // Given
        mockAuthService.isLoggedIn = true
        mockCacheService.shouldFailRemove = true

        // When & Then
        do {
            _ = try await sut.clearHistory(roomId: "test_room_1")
            XCTFail("Should throw clear failed error")
        } catch let error as ClawbotHistoryServiceError {
            if case .clearFailed = error {
                XCTAssertTrue(true, "Should throw clear failed error")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        }
    }
}

// MARK: - GetCachedHistory Tests

extension ClawbotHistoryServiceTests {

    func testGetCachedHistorySuccess() async throws {
        // Given
        mockCacheService.mockCachedMessages = createMockMessages()

        // When
        let messages = try await sut.getCachedHistory(roomId: "test_room_1")

        // Then
        XCTAssertEqual(messages.count, 3, "Should return cached messages")
        XCTAssertEqual(sut.history.count, 3, "Should update history state")
    }

    func testGetCachedHistoryCacheMiss() async throws {
        // Given
        mockCacheService.mockCachedMessages = nil

        // When & Then
        do {
            _ = try await sut.getCachedHistory(roomId: "test_room_1")
            XCTFail("Should throw cache error")
        } catch let error as ClawbotHistoryServiceError {
            if case .cacheError = error {
                XCTAssertTrue(true, "Should throw cache error for miss")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        }
    }

    func testGetCachedHistoryCacheError() async throws {
        // Given
        mockCacheService.shouldFailCache = true
        mockCacheService.mockCacheError = .storageError(underlying: NSError(domain: "test", code: -1))

        // When & Then
        do {
            _ = try await sut.getCachedHistory(roomId: "test_room_1")
            XCTFail("Should throw cache error")
        } catch let error as ClawbotHistoryServiceError {
            if case .cacheError = error {
                XCTAssertTrue(true, "Should throw cache error")
            } else {
                XCTFail("Wrong error type: \(error)")
            }
        }
    }
}

// MARK: - Helper Methods

extension ClawbotHistoryServiceTests {

    private func createMockMessages() -> [ChatMessage] {
        [
            ChatMessage(
                id: "msg_1",
                roomId: "test_room_1",
                senderId: "user_1",
                sender: .user,
                content: "Hello",
                messageType: .text,
                mediaUrl: nil,
                mediaMimeType: nil,
                mediaDuration: nil,
                isRead: true,
                createdAt: Date()
            ),
            ChatMessage(
                id: "msg_2",
                roomId: "test_room_1",
                senderId: "bot_1",
                sender: .bot,
                content: "Hi there!",
                messageType: .text,
                mediaUrl: nil,
                mediaMimeType: nil,
                mediaDuration: nil,
                isRead: true,
                createdAt: Date()
            ),
            ChatMessage(
                id: "msg_3",
                roomId: "test_room_1",
                senderId: "user_1",
                sender: .user,
                content: "How are you?",
                messageType: .text,
                mediaUrl: nil,
                mediaMimeType: nil,
                mediaDuration: nil,
                isRead: false,
                createdAt: Date()
            )
        ]
    }
}
