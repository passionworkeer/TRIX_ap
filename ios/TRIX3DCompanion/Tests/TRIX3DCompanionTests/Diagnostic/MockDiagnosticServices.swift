//
//  MockDiagnosticServices.swift
//  TRIX3DCompanionTests
//
//  Mock implementations for Diagnostic feature services
//

import Foundation
import Combine
@testable import TRIX3DCompanion

// MARK: - Mock Network Monitor

/// Mock implementation of NetworkMonitor for testing
@MainActor
final class MockDiagnosticNetworkMonitor: NetworkMonitor {

    // MARK: - Call Tracking

    var startMonitoringCalled = false
    var stopMonitoringCalled = false
    var getCurrentStatusCalled = false

    // MARK: - Initialization

    override init() {
        super.init()
    }

    // MARK: - Protocol Methods

    override func startMonitoring() {
        startMonitoringCalled = true
        super.startMonitoring()
    }

    override func stopMonitoring() {
        Task { @MainActor in
            stopMonitoringCalled = true
        }
        super.stopMonitoring()
    }

    override func getCurrentStatus() async -> NetworkStatus {
        getCurrentStatusCalled = true
        return currentStatus
    }

    // MARK: - Helper Methods

    func updateStatus(_ status: NetworkStatus) {
        currentStatus = status
    }

    func setConnected(_ connected: Bool, type: ConnectionType = .wifi, quality: ConnectionQuality = .good) {
        let status = NetworkStatus(
            isConnected: connected,
            connectionType: connected ? type : .none,
            quality: connected ? quality : .unknown,
            timestamp: Date()
        )
        updateStatus(status)
    }

    func resetCallTracking() {
        startMonitoringCalled = false
        stopMonitoringCalled = false
        getCurrentStatusCalled = false
    }
}

// MARK: - Mock Offline Cache Service

/// Mock implementation of OfflineCacheServiceProtocol for testing
@MainActor
final class MockOfflineCacheService: OfflineCacheServiceProtocol, ObservableObject, ClearCacheTracking {

    // MARK: - Published Properties

    @Published var totalCacheSize: Int64 = 0
    @Published private(set) var isCleaning: Bool = false

    // MARK: - Test Control Properties

    var shouldFailCache = false
    var shouldFailRetrieve = false
    var shouldFailClear = false
    var shouldFailClearAll = false
    var shouldFailStatistics = false
    var shouldFailCleanExpired = false
    var shouldFailGetSize = false
    var mockError: Error = CacheError.storageError(underlying: NSError(domain: "Test", code: 500))

    // Mock cache data
    private var cacheData: [String: [CacheType: Any]] = [:]
    var simulatedCacheSizes: [CacheType: Int64] = [:]
    var simulatedStatistics: [CacheType: CacheStatistics] = [:]

    // MARK: - Call Tracking

    var cacheCalled = false
    var retrieveCalled = false
    var removeCalled = false
    var clearType: DiagnosticCacheType?
    var originalClearType: DiagnosticCacheType?
    var clearAllCalled = false
    var getStatisticsCalled = false
    var cleanExpiredCalled = false
    var getSizeCalled = false

    var lastCacheKey: String?
    var lastCacheType: CacheType?
    var lastRetrieveKey: String?
    var lastRetrieveType: CacheType?

    // MARK: - Initialization

    init() {
        // Set up default cache sizes
        for type in CacheType.allCases {
            simulatedCacheSizes[type] = 0
            simulatedStatistics[type] = CacheStatistics(totalEntries: 0, totalSizeBytes: 0, expiredEntries: 0, type: type)
        }
    }

    // MARK: - Protocol Methods

    func cache<T: Codable>(_ data: T, forKey key: String, type: CacheType) async throws {
        cacheCalled = true
        lastCacheKey = key
        lastCacheType = type

        if shouldFailCache {
            throw mockError
        }

        if cacheData[key] == nil {
            cacheData[key] = [:]
        }
        cacheData[key]?[type] = data

        // Update size
        let currentSize = simulatedCacheSizes[type] ?? 0
        simulatedCacheSizes[type] = currentSize + 1024 // Simulate 1KB per item
        recalculateTotalSize()
    }

    func retrieve<T: Codable>(key: String, type: CacheType) async throws -> T {
        retrieveCalled = true
        lastRetrieveKey = key
        lastRetrieveType = type

        if shouldFailRetrieve {
            throw mockError
        }

        guard let typeCache = cacheData[key],
              let data = typeCache[type] as? T else {
            throw CacheError.notFound
        }

        return data
    }

    func remove(key: String, type: CacheType) async throws {
        removeCalled = true

        if shouldFailClear {
            throw mockError
        }

        cacheData[key]?.removeValue(forKey: type)

        // Update size
        let currentSize = simulatedCacheSizes[type] ?? 0
        simulatedCacheSizes[type] = max(0, currentSize - 1024)
        recalculateTotalSize()
    }

    func clear(type: CacheType) async throws {
        clearType = nil  // DiagnosticCacheType set via setOriginalClearType

        if shouldFailClear {
            throw mockError
        }

        // Remove all items of this type
        for key in cacheData.keys {
            cacheData[key]?.removeValue(forKey: type)
        }

        simulatedCacheSizes[type] = 0
        simulatedStatistics[type] = CacheStatistics(totalEntries: 0, totalSizeBytes: 0, expiredEntries: 0, type: type)
        recalculateTotalSize()
    }

    func clearAll() async throws {
        clearAllCalled = true

        if shouldFailClearAll {
            throw mockError
        }

        cacheData.removeAll()

        for type in CacheType.allCases {
            simulatedCacheSizes[type] = 0
            simulatedStatistics[type] = CacheStatistics(totalEntries: 0, totalSizeBytes: 0, expiredEntries: 0, type: type)
        }

        totalCacheSize = 0
    }

    func getStatistics(type: CacheType) async throws -> CacheStatistics {
        getStatisticsCalled = true

        if shouldFailStatistics {
            throw mockError
        }

        return simulatedStatistics[type] ?? CacheStatistics(totalEntries: 0, totalSizeBytes: 0, expiredEntries: 0, type: type)
    }

    func cleanExpired() async throws {
        cleanExpiredCalled = true
        isCleaning = true

        if shouldFailCleanExpired {
            isCleaning = false
            throw mockError
        }

        // Simulate cleaning
        isCleaning = false
    }

    func getCurrentSize(type: CacheType) async throws -> Int64 {
        getSizeCalled = true

        if shouldFailGetSize {
            throw mockError
        }

        return simulatedCacheSizes[type] ?? 0
    }

    func cacheUserProfile(_ user: User) async throws {
    }

    // MARK: - Helper Methods

    private func recalculateTotalSize() {
        totalCacheSize = simulatedCacheSizes.values.reduce(0, +)
    }

    func setCacheSize(_ size: Int64, for type: CacheType) {
        simulatedCacheSizes[type] = size
        recalculateTotalSize()
    }

    func setCacheSize(_ size: Int64, for type: DiagnosticCacheType) {
        let serviceType = Self.mapToCacheType(type)
        simulatedCacheSizes[serviceType] = size
        recalculateTotalSize()
    }

    private static func mapToCacheType(_ type: DiagnosticCacheType) -> CacheType {
        switch type {
        case .images: return .images
        case .data: return .userProfile
        case .sessions: return .studyRecords
        case .temporary: return .messages
        }
    }

    func setOriginalClearType(_ type: DiagnosticCacheType) {
        originalClearType = type
        clearType = type
    }

    func setStatistics(_ stats: CacheStatistics, for type: CacheType) {
        simulatedStatistics[type] = stats
    }

    func addCacheItem<T: Codable>(_ data: T, key: String, type: CacheType) {
        if cacheData[key] == nil {
            cacheData[key] = [:]
        }
        cacheData[key]?[type] = data
    }

    func resetCallTracking() {
        cacheCalled = false
        retrieveCalled = false
        removeCalled = false
        clearType = nil
        clearAllCalled = false
        getStatisticsCalled = false
        cleanExpiredCalled = false
        getSizeCalled = false
        lastCacheKey = nil
        lastCacheType = nil
        lastRetrieveKey = nil
        lastRetrieveType = nil
    }
}
