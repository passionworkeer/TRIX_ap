//
//  MockOfflineCacheService.swift
//  TRIX3DCompanionTests
//
//  Mock implementation of OfflineCacheService for testing
//

import Foundation
import Combine
@testable import TRIX3DCompanion

/// Mock implementation of OfflineCacheService for unit testing
@MainActor
final class MockOfflineCacheService: ObservableObject {

    // MARK: - Published Properties

    @Published private(set) var totalCacheSize: Int64 = 0
    @Published private(set) var isCleaning: Bool = false
    @Published private(set) var lastCleanupDate: Date?

    // MARK: - Mock Configuration

    var mockCacheResult: Result<Void, CacheError>?
    var mockRetrieveResult: Result<Any, CacheError>?
    var mockStatistics: CacheStatistics?
    var mockGetSizeResult: Int64 = 0

    // Call tracking
    var cacheCallCount: Int = 0
    var retrieveCallCount: Int = 0
    var removeCallCount: Int = 0
    var clearCallCount: Int = 0
    var clearAllCallCount: Int = 0
    var getStatisticsCallCount: Int = 0
    var cleanExpiredCallCount: Int = 0
    var getCacheSizeCallCount: Int = 0
    var clearAllCacheCallCount: Int = 0

    // Internal storage for testing
    private var cachedData: [String: Any] = [:]
    private var cacheTypes: [CacheType: Int64] = [:]

    // MARK: - Initialization

    init() {
        // Initialize with some default cache size
        totalCacheSize = 52_428_800 // 50 MB
        mockGetSizeResult = totalCacheSize
    }

    // MARK: - Public Methods

    func cache<T: Codable>(_ data: T, forKey key: String, type: CacheType) async throws {
        cacheCallCount += 1

        if let result = mockCacheResult {
            switch result {
            case .success:
                cachedData[key] = data
            case .failure(let error):
                throw error
            }
            return
        }

        // Default: succeed
        cachedData[key] = data
        cacheTypes[type, default: 0] += Int64(MemoryLayout<T>.size)
        await recalculateTotalSize()
    }

    func retrieve<T: Codable>(key: String, type: CacheType) async throws -> T {
        retrieveCallCount += 1

        if let result = mockRetrieveResult {
            switch result {
            case .success(let data):
                if let typedData = data as? T {
                    return typedData }
                throw CacheError.decodingFailed
            case .failure(let error):
                throw error
            }
        }

        // Default: return cached data
        if let data = cachedData[key] as? T {
            return data
        }
        throw CacheError.notFound
    }

    func remove(key: String, type: CacheType) async throws {
        removeCallCount += 1
        cachedData.removeValue(forKey: key)
        await recalculateTotalSize()
    }

    func clear(type: CacheType) async throws {
        clearCallCount += 1

        // Clear all cached data for this type
        cachedData = cachedData.filter { _, _ in false }
        cacheTypes[type] = 0
        await recalculateTotalSize()
    }

    func clearAll() async throws {
        clearAllCallCount += 1
        cachedData.removeAll()
        cacheTypes.removeAll()
        totalCacheSize = 0
    }

    func clearAllCache() async throws {
        clearAllCacheCallCount += 1
        cachedData.removeAll()
        cacheTypes.removeAll()
        totalCacheSize = 0
    }

    func getStatistics(type: CacheType) async throws -> CacheStatistics {
        getStatisticsCallCount += 1

        if let stats = mockStatistics {
            return stats
        }

        // Default: return mock statistics
        return CacheStatistics(
            totalEntries: cachedData.count,
            totalSizeBytes: cacheTypes[type] ?? 0,
            expiredEntries: 0,
            type: type
        )
    }

    func cleanExpired() async throws {
        cleanExpiredCallCount += 1
        isCleaning = true

        defer {
            isCleaning = false
            lastCleanupDate = Date()
        }

        // Mock: do nothing
    }

    func cleanExpired(type: CacheType) async throws {
        cleanExpiredCallCount += 1
        isCleaning = true

        defer {
            isCleaning = false
            lastCleanupDate = Date()
        }

        // Mock: do nothing
    }

    func getCurrentSize(type: CacheType) async throws -> Int64 {
        return cacheTypes[type] ?? 0
    }

    func getCacheSize() async -> Int64 {
        getCacheSizeCallCount += 1
        return mockGetSizeResult
    }

    // MARK: - Private Methods

    private func recalculateTotalSize() async {
        totalCacheSize = cacheTypes.values.reduce(0, +)
    }

    // MARK: - Helper Methods

    func setMockCacheSize(_ size: Int64) {
        mockGetSizeResult = size
        totalCacheSize = size
    }

    func setMockStatistics(_ stats: CacheStatistics) {
        mockStatistics = stats
    }

    func setMockCacheSuccess() {
        mockCacheResult = .success(())
    }

    func setMockCacheError(_ error: CacheError) {
        mockCacheResult = .failure(error)
    }

    func setMockRetrieveSuccess<T: Codable>(_ data: T) {
        mockRetrieveResult = .success(data)
    }

    func setMockRetrieveError(_ error: CacheError) {
        mockRetrieveResult = .failure(error)
    }

    func resetCallCounts() {
        cacheCallCount = 0
        retrieveCallCount = 0
        removeCallCount = 0
        clearCallCount = 0
        clearAllCallCount = 0
        getStatisticsCallCount = 0
        cleanExpiredCallCount = 0
        getCacheSizeCallCount = 0
        clearAllCacheCallCount = 0
    }

    func reset() {
        resetCallCounts()
        cachedData.removeAll()
        cacheTypes.removeAll()
        totalCacheSize = 0
        isCleaning = false
        lastCleanupDate = nil
        mockCacheResult = nil
        mockRetrieveResult = nil
        mockStatistics = nil
    }
}
