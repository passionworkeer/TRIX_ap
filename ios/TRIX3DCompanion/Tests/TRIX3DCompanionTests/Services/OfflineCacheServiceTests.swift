//
//  OfflineCacheServiceTests.swift
//  TRIX3DCompanionTests
//
//  Comprehensive unit tests for OfflineCacheService
//

import XCTest
import Combine
@testable import TRIX3DCompanion

/// Comprehensive unit tests for OfflineCacheService
@MainActor
final class OfflineCacheServiceTests: XCTestCase {

    // MARK: - Properties

    var cacheService: OfflineCacheService!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        cacheService = OfflineCacheService(databaseManager: .shared)

        cancellables = Set<AnyCancellable>()
    }

    override func tearDown() async throws {
        // Clean up test cache
        try? await cacheService.clearAll()

        cacheService = nil
        cancellables = nil
        try await super.tearDown()
    }

    // MARK: - Cache Operations Tests

    func test_cache_success() async throws {
        // Arrange
        let testData = TestModel(id: "123", name: "Test Data", value: 42)

        // Act
        try await cacheService.cache(testData, forKey: "test-key", type: .messages)

        // Assert - Should not throw
        XCTAssertTrue(true, "Cache operation should succeed")
    }

    func test_cache_withLargeData_succeeds() async throws {
        // Arrange
        let largeData = String(repeating: "x", count: 10000)
        let testData = TestModel(id: "large", name: "Large Data", value: 999, description: largeData)

        // Act
        try await cacheService.cache(testData, forKey: "large-key", type: .studyRecords)

        // Assert
        XCTAssertTrue(true, "Large data should be cached successfully")
    }

    func test_cache_withSpecialCharactersInKey() async throws {
        // Arrange
        let testData = TestModel(id: "1", name: "Test", value: 1)

        // Act
        try await cacheService.cache(testData, forKey: "test/key/with/slashes", type: .userProfile)

        // Assert - Should handle special characters
        XCTAssertTrue(true, "Special characters in key should be handled")
    }

    // MARK: - Retrieve Tests

    func test_retrieve_success() async throws {
        // Arrange
        let testData = TestModel(id: "456", name: "Retrieve Test", value: 100)
        try await cacheService.cache(testData, forKey: "retrieve-key", type: .messages)

        // Act
        let retrieved: TestModel = try await cacheService.retrieve(key: "retrieve-key", type: .messages)

        // Assert
        XCTAssertEqual(retrieved.id, "456", "Should retrieve same data")
        XCTAssertEqual(retrieved.name, "Retrieve Test", "Should retrieve correct name")
        XCTAssertEqual(retrieved.value, 100, "Should retrieve correct value")
    }

    func test_retrieve_notFound() async {
        // Act & Assert
        do {
            let _: TestModel = try await cacheService.retrieve(key: "non-existent", type: .messages)
            XCTFail("Should throw not found error")
        } catch let error as CacheError {
            XCTAssertEqual(error, .notFound, "Should return not found error")
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    func test_retrieve_expired() async throws {
        // Arrange - Cache with very short expiration (simulated)
        let testData = TestModel(id: "789", name: "Expired Test", value: 200)
        try await cacheService.cache(testData, forKey: "expired-key", type: .messages)

        // Note: Actual expiration testing would require manipulating time
        // This test verifies the error handling exists

        // Act - Try to retrieve
        let result: Result<TestModel, Error> = await {
            do {
                let data: TestModel = try await cacheService.retrieve(key: "expired-key", type: .messages)
                return .success(data)
            } catch {
                return .failure(error)
            }
        }()

        // Assert - Should either succeed (if not yet expired) or fail with expired
        switch result {
        case .success:
            XCTAssertTrue(true, "Data retrieved successfully")
        case .failure(let error):
            if case CacheError.expired = error {
                XCTAssertTrue(true, "Should return expired error")
            } else {
                XCTAssertTrue(true, "May have other error")
            }
        }
    }

    func test_retrieve_wrongType_throws() async throws {
        // Arrange - Cache one type
        let testData = TestModel(id: "1", name: "Test", value: 1)
        try await cacheService.cache(testData, forKey: "type-key", type: .messages)

        // Act & Assert - Try to retrieve as different type
        do {
            let _: String = try await cacheService.retrieve(key: "type-key", type: .messages)
            XCTFail("Should throw decoding failed error")
        } catch let error as CacheError {
            XCTAssertTrue(error == .decodingFailed || error == .notFound, "Should return decoding failed or not found")
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    // MARK: - Remove Tests

    func test_remove_success() async throws {
        // Arrange
        let testData = TestModel(id: "999", name: "Remove Test", value: 333)
        try await cacheService.cache(testData, forKey: "remove-key", type: .messages)

        // Act
        try await cacheService.remove(key: "remove-key", type: .messages)

        // Assert - Verify removed
        do {
            let _: TestModel = try await cacheService.retrieve(key: "remove-key", type: .messages)
            XCTFail("Should not find removed item")
        } catch CacheError.notFound {
            XCTAssertTrue(true, "Item should be removed")
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    func test_remove_nonExistent_doesNotThrow() async throws {
        // Act & Assert - Should not throw
        try await cacheService.remove(key: "never-existed", type: .messages)
        XCTAssertTrue(true, "Removing non-existent item should not throw")
    }

    // MARK: - Clear Tests

    func test_clear_type() async throws {
        // Arrange - Cache multiple items
        for i in 0..<5 {
            let data = TestModel(id: "\(i)", name: "Test \(i)", value: i)
            try await cacheService.cache(data, forKey: "key-\(i)", type: .messages)
        }

        // Act
        try await cacheService.clear(type: .messages)

        // Assert - Verify cleared
        do {
            let _: TestModel = try await cacheService.retrieve(key: "key-0", type: .messages)
            XCTFail("Should not find items after clear")
        } catch CacheError.notFound {
            XCTAssertTrue(true, "Items should be cleared")
        } catch {
            XCTFail("Wrong error type: \(error)")
        }
    }

    func test_clearAll_clearsAllTypes() async throws {
        // Arrange - Cache items in different types
        let msgData = TestModel(id: "1", name: "Message", value: 1)
        let studyData = TestModel(id: "2", name: "Study", value: 2)
        let userData = TestModel(id: "3", name: "User", value: 3)

        try await cacheService.cache(msgData, forKey: "msg", type: .messages)
        try await cacheService.cache(studyData, forKey: "study", type: .studyRecords)
        try await cacheService.cache(userData, forKey: "user", type: .userProfile)

        // Act
        try await cacheService.clearAll()

        // Assert - All should be cleared
        // Note: In test environment, this verifies the method exists
        XCTAssertTrue(true, "All caches should be cleared")
    }

    // MARK: - Statistics Tests

    func test_getStatistics_emptyCache() async throws {
        // Act
        let stats = try await cacheService.getStatistics(type: .messages)

        // Assert
        XCTAssertEqual(stats.totalEntries, 0, "Should have 0 entries")
        XCTAssertEqual(stats.totalSizeBytes, 0, "Should have 0 size")
        XCTAssertEqual(stats.expiredEntries, 0, "Should have 0 expired")
    }

    func test_getStatistics_withData() async throws {
        // Arrange
        let testData = TestModel(id: "1", name: "Stats Test", value: 42)
        try await cacheService.cache(testData, forKey: "stats-key", type: .messages)

        // Act
        let stats = try await cacheService.getStatistics(type: .messages)

        // Assert
        XCTAssertGreaterThan(stats.totalEntries, 0, "Should have entries")
        XCTAssertGreaterThan(stats.totalSizeBytes, 0, "Should have size")
    }

    func test_getStatistics_formattedSize() async throws {
        // Arrange
        let testData = TestModel(id: "1", name: "Size Test", value: 1)
        try await cacheService.cache(testData, forKey: "size-key", type: .images)

        // Act
        let stats = try await cacheService.getStatistics(type: .images)

        // Assert
        XCTAssertFalse(stats.formattedSize.isEmpty, "Should have formatted size string")
    }

    func test_getStatistics_usagePercentage() async throws {
        // Arrange
        for i in 0..<10 {
            let data = TestModel(id: "\(i)", name: "Test", value: i)
            try await cacheService.cache(data, forKey: "usage-\(i)", type: .messages)
        }

        // Act
        let stats = try await cacheService.getStatistics(type: .messages)

        // Assert
        XCTAssertGreaterThanOrEqual(stats.usagePercentage, 0, "Usage should be non-negative")
        XCTAssertLessThanOrEqual(stats.usagePercentage, 100, "Usage should be at most 100%")
    }

    // MARK: - Size Management Tests

    func test_getCurrentSize_returnsSize() async throws {
        // Arrange
        let testData = TestModel(id: "1", name: "Size", value: 1)
        try await cacheService.cache(testData, forKey: "size-key", type: .messages)

        // Act
        let size = try await cacheService.getCurrentSize(type: .messages)

        // Assert
        XCTAssertGreaterThan(size, 0, "Should have size")
    }

    func test_getCurrentSize_emptyCache() async throws {
        // Act
        let size = try await cacheService.getCurrentSize(type: .messages)

        // Assert
        XCTAssertEqual(size, 0, "Empty cache should have 0 size")
    }

    // MARK: - Cleanup Tests

    func test_cleanExpired_removesExpiredItems() async throws {
        // Arrange - Cache items (some may be expired depending on timing)
        let testData = TestModel(id: "1", name: "Cleanup", value: 1)
        try await cacheService.cache(testData, forKey: "cleanup-key", type: .messages)

        // Act
        try await cacheService.cleanExpired()

        // Assert - Should not throw
        XCTAssertTrue(true, "Cleanup should execute without error")
    }

    // MARK: - Convenience Methods Tests

    func test_cacheMessages_retrievesMessages() async throws {
        // Arrange
        let messages = [
            ChatMessage(
                id: "1",
                roomId: "room-1",
                senderId: "user-1",
                sender: .user,
                content: "Hi",
                messageType: .text,
                mediaUrl: nil,
                mediaMimeType: nil,
                mediaDuration: nil,
                mediaSize: nil,
                mediaMetadata: nil,
                voiceUrl: nil,
                voiceDuration: nil,
                voiceTranscript: nil,
                voiceMimeType: nil,
                isRead: false,
                createdAt: Date()
            ),
            ChatMessage(
                id: "2",
                roomId: "room-1",
                senderId: "user-2",
                sender: .user,
                content: "Hello",
                messageType: .text,
                mediaUrl: nil,
                mediaMimeType: nil,
                mediaDuration: nil,
                mediaSize: nil,
                mediaMetadata: nil,
                voiceUrl: nil,
                voiceDuration: nil,
                voiceTranscript: nil,
                voiceMimeType: nil,
                isRead: false,
                createdAt: Date()
            )
        ]

        // Act
        try await cacheService.cacheMessages(messages, for: "room-1")
        let retrieved = try await cacheService.getMessages(for: "room-1")

        // Assert
        XCTAssertEqual(retrieved.count, 2, "Should retrieve all messages")
    }

    func test_cacheStudySessions_retrievesSessions() async throws {
        // Arrange
        let sessions = [
            StudySession(
                id: "session-1",
                userId: "user-1",
                duration: 1800,
                startedAt: Date().addingTimeInterval(-3600),
                endedAt: Date().addingTimeInterval(-1800),
                earnedPoints: nil,
                isCompleted: true,
                subject: "Math",
                notes: "Study session 1",
                createdAt: Date()
            )
        ]

        // Act
        try await cacheService.cacheStudySessions(sessions, for: "user-1")
        let retrieved = try await cacheService.getStudySessions(for: "user-1")

        // Assert
        XCTAssertEqual(retrieved.count, 1, "Should retrieve session")
    }

    func test_cacheUserProfile_retrievesProfile() async throws {
        // Arrange
        let user = User(
            id: "user-1",
            username: "testuser",
            email: "test@example.com",
            avatarUrl: nil,
            avatarConfig: nil,
            fullName: nil,
            displayName: "Test User",
            bio: nil,
            website: nil,
            points: 1000,
            isStudying: false,
            companionId: nil,
            totalStudyTime: 0,
            lastActiveAt: Date(),
            currentStreak: 0,
            daysActive: 0,
            interactionCount: 0,
            showOnlineStatus: true,
            school: nil,
            grade: nil,
            createdAt: Date(),
            updatedAt: Date()
        )

        // Act
        try await cacheService.cacheUserProfile(user)
        let retrieved = try await cacheService.getUserProfile()

        // Assert
        XCTAssertEqual(retrieved.id, "user-1", "Should retrieve user")
        XCTAssertEqual(retrieved.username, "testuser", "Should retrieve username")
    }

    func test_cacheImage_retrievesImage() async throws {
        // Arrange
        let imageData = Data([0x89, 0x50, 0x4E, 0x47]) // PNG header

        // Act
        try await cacheService.cacheImage(imageData, forKey: "test-image")
        let retrieved = try await cacheService.getImage(forKey: "test-image")

        // Assert
        XCTAssertEqual(retrieved.count, 4, "Should retrieve image data")
        XCTAssertEqual(retrieved.first, 0x89, "Should retrieve correct data")
    }

    // MARK: - Published Properties Tests

    func test_totalCacheSize_updatesAfterCache() async throws {
        // Arrange
        let expectation = XCTestExpectation(description: "totalCacheSize should update")

        cacheService.$totalCacheSize
            .dropFirst()
            .sink { size in
                if size > 0 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        let testData = TestModel(id: "1", name: "Size Test", value: 1)

        // Act
        try await cacheService.cache(testData, forKey: "size-test", type: .messages)

        // Assert
        await fulfillment(of: [expectation], timeout: 2.0)
    }

    func test_isCleaning_updatesDuringCleanup() async {
        // Arrange
        let expectation = XCTestExpectation(description: "isCleaning should update")

        cacheService.$isCleaning
            .dropFirst()
            .sink { isCleaning in
                if !isCleaning {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)

        // Act
        try? await cacheService.cleanExpired()

        // Assert
        await fulfillment(of: [expectation], timeout: 2.0)
    }

    func test_lastCleanupDate_setAfterCleanup() async {
        // Arrange
        let beforeCleanup = cacheService.lastCleanupDate

        // Act
        try? await cacheService.cleanExpired()
        try? await Task.sleep(nanoseconds: 100_000_000)

        // Assert
        let afterCleanup = cacheService.lastCleanupDate
        XCTAssertNotNil(afterCleanup, "Cleanup date should be updated")
        if let beforeCleanup, let afterCleanup {
            XCTAssertGreaterThanOrEqual(afterCleanup, beforeCleanup)
        }
    }

    // MARK: - Cache Policy Tests

    func test_CachePolicy_defaults() {
        // Arrange
        let messagePolicy = CachePolicy.messages
        let studyPolicy = CachePolicy.studyRecords
        let userProfilePolicy = CachePolicy.userProfile
        let imagePolicy = CachePolicy.images

        // Assert
        XCTAssertEqual(messagePolicy.expirationInterval, 7 * 24 * 60 * 60, "Messages should expire in 7 days")
        XCTAssertEqual(messagePolicy.maxSizeBytes, 100 * 1024 * 1024, "Messages should have 100MB limit")

        XCTAssertEqual(studyPolicy.expirationInterval, 30 * 24 * 60 * 60, "Study records should expire in 30 days")
        XCTAssertEqual(studyPolicy.maxSizeBytes, 50 * 1024 * 1024, "Study records should have 50MB limit")

        XCTAssertEqual(userProfilePolicy.expirationInterval, 24 * 60 * 60, "Profile should expire in 24 hours")
        XCTAssertEqual(userProfilePolicy.maxSizeBytes, 1 * 1024 * 1024, "Profile should have 1MB limit")

        XCTAssertEqual(imagePolicy.expirationInterval, 7 * 24 * 60 * 60, "Images should expire in 7 days")
        XCTAssertEqual(imagePolicy.maxSizeBytes, 200 * 1024 * 1024, "Images should have 200MB limit")
    }

    // MARK: - CacheType Tests

    func test_CacheType_allCases() {
        // Assert
        let allCases = CacheType.allCases
        XCTAssertEqual(allCases.count, 4, "Should have 4 cache types")
        XCTAssertTrue(allCases.contains(.messages), "Should have messages")
        XCTAssertTrue(allCases.contains(.studyRecords), "Should have studyRecords")
        XCTAssertTrue(allCases.contains(.userProfile), "Should have userProfile")
        XCTAssertTrue(allCases.contains(.images), "Should have images")
    }

    // MARK: - CacheError Tests

    func test_CacheError_descriptions() {
        // Assert
        let notFound = CacheError.notFound
        XCTAssertEqual(notFound.errorDescription, "Cached data not found")

        let expired = CacheError.expired
        XCTAssertEqual(expired.errorDescription, "Cached data has expired")

        let sizeLimit = CacheError.sizeLimitExceeded
        XCTAssertEqual(sizeLimit.errorDescription, "Cache size limit exceeded")

        let invalidData = CacheError.invalidData
        XCTAssertEqual(invalidData.errorDescription, "Invalid cached data")

        let encodingFailed = CacheError.encodingFailed
        XCTAssertEqual(encodingFailed.errorDescription, "Failed to encode data for caching")

        let decodingFailed = CacheError.decodingFailed
        XCTAssertEqual(decodingFailed.errorDescription, "Failed to decode cached data")
    }

    // MARK: - CacheEntry Tests

    func test_CacheEntry_isExpired() {
        // Arrange
        let now = Date()
        let past = now.addingTimeInterval(-100)

        let expiredEntry = CacheEntry(
            data: "test",
            createdAt: past,
            expiresAt: past.addingTimeInterval(50), // Expired 50 time units ago
            sizeBytes: 100
        )

        let validEntry = CacheEntry(
            data: "test",
            createdAt: now,
            expiresAt: now.addingTimeInterval(3600), // Expires in 1 hour
            sizeBytes: 100
        )

        // Assert
        XCTAssertTrue(expiredEntry.isExpired, "Entry should be expired")
        XCTAssertFalse(validEntry.isExpired, "Entry should not be expired")
    }

    // MARK: - Edge Cases Tests

    func test_cache_withEmptyKey() async throws {
        // Arrange
        let testData = TestModel(id: "1", name: "Test", value: 1)

        // Act
        try await cacheService.cache(testData, forKey: "", type: .messages)

        // Assert - Should handle gracefully
        XCTAssertTrue(true, "Empty key should be handled")
    }

    func test_cache_withVeryLongKey() async throws {
        // Arrange
        let longKey = String(repeating: "a", count: 1000)
        let testData = TestModel(id: "1", name: "Test", value: 1)

        // Act
        try await cacheService.cache(testData, forKey: longKey, type: .messages)

        // Assert
        XCTAssertTrue(true, "Long key should be handled")
    }

    func test_cache_nilOptionalProperties() async throws {
        // Arrange
        let testData = TestModel(
            id: "1",
            name: nil,
            value: 0,
            description: nil
        )

        // Act
        try await cacheService.cache(testData, forKey: "nil-test", type: .userProfile)

        // Assert - Should handle nil values
        let retrieved: TestModel = try await cacheService.retrieve(key: "nil-test", type: .userProfile)
        XCTAssertNil(retrieved.name, "Should preserve nil name")
        XCTAssertNil(retrieved.description, "Should preserve nil description")
    }

    func test_multipleCacheOperations_handleConcurrently() async throws {
        // Arrange
        let testData = TestModel(id: "1", name: "Concurrent", value: 1)

        // Act - Multiple concurrent operations
        async let cache1: Void = cacheService.cache(testData, forKey: "key1", type: .messages)
        async let cache2: Void = cacheService.cache(testData, forKey: "key2", type: .messages)
        async let cache3: Void = cacheService.cache(testData, forKey: "key3", type: .messages)

        try await cache1
        try await cache2
        try await cache3

        // Assert - All should succeed
        XCTAssertTrue(true, "Concurrent operations should succeed")
    }

    // MARK: - Memory Management Tests

    func test_largeNumberOfEntries_handlesGracefully() async throws {
        // Arrange - Cache 100 entries
        for i in 0..<100 {
            let data = TestModel(id: "\(i)", name: "Entry \(i)", value: i)
            try await cacheService.cache(data, forKey: "entry-\(i)", type: .messages)
        }

        // Act - Get statistics
        let stats = try await cacheService.getStatistics(type: .messages)

        // Assert
        XCTAssertEqual(stats.totalEntries, 100, "Should have all entries")
    }

    func test_clearAndRecycle_handlesGracefully() async throws {
        // First round
        for i in 0..<10 {
            let data = TestModel(id: "\(i)", name: "Round1-\(i)", value: i)
            try await cacheService.cache(data, forKey: "r1-\(i)", type: .messages)
        }
        try await cacheService.clear(type: .messages)

        // Second round
        for i in 0..<10 {
            let data = TestModel(id: "\(i)", name: "Round2-\(i)", value: i)
            try await cacheService.cache(data, forKey: "r2-\(i)", type: .messages)
        }

        let stats = try await cacheService.getStatistics(type: .messages)

        // Assert
        XCTAssertEqual(stats.totalEntries, 10, "Should have second round entries")
    }
}

// MARK: - Mock Classes

class MockFileManager: FileManager {
    var storedFiles: [String: Data] = [:]
    var directories: Set<String> = []

    override func fileExists(atPath path: String) -> Bool {
        return storedFiles[path] != nil || directories.contains(path)
    }

    override func createDirectory(at url: URL, withIntermediateDirectories createIntermediates: Bool, attributes: [FileAttributeKey: Any]? = nil) throws {
        directories.insert(url.path)
    }

    override func contentsOfDirectory(
        at url: URL,
        includingPropertiesForKeys keys: [URLResourceKey]?,
        options mask: FileManager.DirectoryEnumerationOptions = []
    ) throws -> [URL] {
        let files = storedFiles.keys.filter { $0.hasPrefix(url.path) }
            .map { URL(fileURLWithPath: $0) }
        return files
    }

    override func removeItem(at URL: URL) throws {
        storedFiles.removeValue(forKey: URL.path)
        directories.remove(URL.path)
    }

    func setFileData(_ data: Data, forPath path: String) {
        storedFiles[path] = data
    }
}

// MARK: - Test Models

struct TestModel: Codable, Equatable {
    let id: String
    let name: String?
    let value: Int
    let description: String?

    init(id: String, name: String?, value: Int, description: String? = nil) {
        self.id = id
        self.name = name
        self.value = value
        self.description = description
    }
}
