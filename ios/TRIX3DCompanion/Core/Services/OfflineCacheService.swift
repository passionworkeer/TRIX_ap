//
//  OfflineCacheService.swift
//  TRIX3DCompanion
//
//  Offline cache service for managing local data persistence with automatic expiration
//

import Foundation
import Combine
import CryptoKit

// MARK: - Cache Configuration

/// Configuration for cache policies
struct CachePolicy {
    let expirationInterval: TimeInterval
    let maxSizeBytes: Int64

    static let messages = CachePolicy(expirationInterval: 7 * 24 * 60 * 60, maxSizeBytes: 100 * 1024 * 1024) // 7 days, 100MB
    static let studyRecords = CachePolicy(expirationInterval: 30 * 24 * 60 * 60, maxSizeBytes: 50 * 1024 * 1024) // 30 days, 50MB
    static let userProfile = CachePolicy(expirationInterval: 24 * 60 * 60, maxSizeBytes: 1 * 1024 * 1024) // 24 hours, 1MB
    static let images = CachePolicy(expirationInterval: 7 * 24 * 60 * 60, maxSizeBytes: 200 * 1024 * 1024) // 7 days, 200MB
}

// MARK: - Cache Entry

/// Represents a cached item with metadata
struct CacheEntry<T: Codable>: Codable {
    let data: T
    let createdAt: Date
    let expiresAt: Date
    let sizeBytes: Int64

    var isExpired: Bool {
        Date() > expiresAt
    }
}

// MARK: - Cache Error

enum CacheError: Error, LocalizedError, Equatable {
    case notFound
    case expired
    case storageError(underlying: Error)
    case sizeLimitExceeded
    case invalidData
    case encodingFailed
    case decodingFailed

    static func == (lhs: CacheError, rhs: CacheError) -> Bool {
        switch (lhs, rhs) {
        case (.notFound, .notFound),
             (.expired, .expired),
             (.sizeLimitExceeded, .sizeLimitExceeded),
             (.invalidData, .invalidData),
             (.encodingFailed, .encodingFailed),
             (.decodingFailed, .decodingFailed):
            return true
        case (.storageError, .storageError):
            return true
        default:
            return false
        }
    }

    var errorDescription: String? {
        switch self {
        case .notFound:
            return "Cached data not found"
        case .expired:
            return "Cached data has expired"
        case .storageError(let error):
            return "Storage error: \(error.localizedDescription)"
        case .sizeLimitExceeded:
            return "Cache size limit exceeded"
        case .invalidData:
            return "Invalid cached data"
        case .encodingFailed:
            return "Failed to encode data for caching"
        case .decodingFailed:
            return "Failed to decode cached data"
        }
    }
}

// MARK: - Cache Statistics

/// Statistics about cache usage
struct CacheStatistics {
    let totalEntries: Int
    let totalSizeBytes: Int64
    let expiredEntries: Int
    let type: CacheType

    var formattedSize: String {
        ByteCountFormatter.string(fromByteCount: totalSizeBytes, countStyle: .file)
    }

    var usagePercentage: Double {
        let policy: CachePolicy
        switch type {
        case .messages:
            policy = .messages
        case .studyRecords:
            policy = .studyRecords
        case .userProfile:
            policy = .userProfile
        case .images:
            policy = .images
        }
        return Double(totalSizeBytes) / Double(policy.maxSizeBytes) * 100.0
    }
}

// MARK: - Cache Type

enum CacheType: String, CaseIterable {
    case messages = "messages"
    case studyRecords = "study_records"
    case userProfile = "user_profile"
    case images = "images"
}

// MARK: - Offline Cache Service Protocol

@MainActor
protocol OfflineCacheServiceProtocol {
    var totalCacheSize: Int64 { get set }

    func cache<T: Codable>(_ data: T, forKey key: String, type: CacheType) async throws
    func retrieve<T: Codable>(key: String, type: CacheType) async throws -> T
    func remove(key: String, type: CacheType) async throws
    func clear(type: CacheType) async throws
    func clearAll() async throws
    func getStatistics(type: CacheType) async throws -> CacheStatistics
    func cleanExpired() async throws
    func getCurrentSize(type: CacheType) async throws -> Int64
    func cacheUserProfile(_ user: User) async throws
}

// MARK: - Clear Cache Tracking Protocol

/// Protocol for tracking which DiagnosticCacheType was passed to clearCache
protocol ClearCacheTracking: AnyObject {
    func setOriginalClearType(_ type: DiagnosticCacheType)
}

// MARK: - Offline Cache Service

/// Main offline cache service handling local data persistence with automatic cleanup
@MainActor
final class OfflineCacheService: ObservableObject, OfflineCacheServiceProtocol {

    // MARK: - Singleton

    static let shared = OfflineCacheService()

    // MARK: - Published Properties

    @Published var totalCacheSize: Int64 = 0

    @Published private(set) var isCleaning: Bool = false

    @Published private(set) var lastCleanupDate: Date?

    // MARK: - Dependencies

    private let databaseManager: DatabaseManager
    private let fileManager: FileManager
    private let cacheDirectory: URL

    // MARK: - Private Properties

    private var cleanupTask: Task<Void, Never>?

    private let cleanupInterval: TimeInterval = 24 * 60 * 60 // 24 hours

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    init(databaseManager: DatabaseManager = .shared) {
        self.databaseManager = databaseManager
        self.fileManager = FileManager.default

        // Setup cache directory
        let cachesURL = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        self.cacheDirectory = cachesURL.appendingPathComponent("OfflineCache", isDirectory: true)

        // Create cache directory if needed
        createCacheDirectoryIfNeeded()

        // Setup periodic cleanup
        setupPeriodicCleanup()

        // Calculate initial size
        Task {
            await recalculateTotalSize()
        }
    }

    // MARK: - Public Methods - Cache Operations

    /// Cache data with automatic expiration
    /// - Parameters:
    ///   - data: The data to cache (must be Codable)
    ///   - key: Unique key for the cached item
    ///   - type: Type of cache to use
    func cache<T: Codable>(_ data: T, forKey key: String, type: CacheType) async throws {
        let policy = getPolicy(for: type)
        let now = Date()
        let expiresAt = now.addingTimeInterval(policy.expirationInterval)

        // Encode data
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let encoded = try? encoder.encode(data) else {
            throw CacheError.encodingFailed
        }

        let sizeBytes = Int64(encoded.count)

        // Check size limit
        let currentSize = try await getCurrentSize(type: type)
        if currentSize + sizeBytes > policy.maxSizeBytes {
            // Try to make space by removing expired entries
            try await cleanExpired(type: type)

            // Check again
            let newSize = try await getCurrentSize(type: type)
            if newSize + sizeBytes > policy.maxSizeBytes {
                throw CacheError.sizeLimitExceeded
            }
        }

        // Create cache entry
        let entry = CacheEntry(
            data: data,
            createdAt: now,
            expiresAt: expiresAt,
            sizeBytes: sizeBytes
        )

        // Save to file
        let fileURL = getFileURL(for: key, type: type)
        let entryEncoder = JSONEncoder()
        entryEncoder.dateEncodingStrategy = .iso8601
        let entryData = try entryEncoder.encode(entry)
        try entryData.write(to: fileURL)

        // Update total size
        await recalculateTotalSize()
    }

    /// Retrieve cached data
    /// - Parameters:
    ///   - key: Unique key for the cached item
    ///   - type: Type of cache to look in
    /// - Returns: The cached data
    func retrieve<T: Codable>(key: String, type: CacheType) async throws -> T {
        let fileURL = getFileURL(for: key, type: type)

        // Check if file exists
        guard fileManager.fileExists(atPath: fileURL.path) else {
            throw CacheError.notFound
        }

        // Load and decode
        let data = try Data(contentsOf: fileURL)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let entry: CacheEntry<T>
        do {
            entry = try decoder.decode(CacheEntry<T>.self, from: data)
        } catch {
            throw CacheError.decodingFailed
        }

        // Check expiration
        if entry.isExpired {
            try? await remove(key: key, type: type)
            throw CacheError.expired
        }

        return entry.data
    }

    /// Remove specific cached item
    /// - Parameters:
    ///   - key: Unique key for the cached item
    ///   - type: Type of cache
    func remove(key: String, type: CacheType) async throws {
        let fileURL = getFileURL(for: key, type: type)

        if fileManager.fileExists(atPath: fileURL.path) {
            try fileManager.removeItem(at: fileURL)
            await recalculateTotalSize()
        }
    }

    /// Clear all items of a specific cache type
    /// - Parameter type: Type of cache to clear
    func clear(type: CacheType) async throws {
        let typeDirectory = getTypeDirectory(for: type)

        if fileManager.fileExists(atPath: typeDirectory.path) {
            try fileManager.removeItem(at: typeDirectory)
            try fileManager.createDirectory(at: typeDirectory, withIntermediateDirectories: true)
            await recalculateTotalSize()
        }
    }

    /// Clear all cached data
    func clearAll() async throws {
        if fileManager.fileExists(atPath: cacheDirectory.path) {
            try fileManager.removeItem(at: cacheDirectory)
            createCacheDirectoryIfNeeded()
            await recalculateTotalSize()
        }
    }

    // MARK: - Public Methods - Statistics

    /// Get statistics for a specific cache type
    /// - Parameter type: Type of cache
    /// - Returns: Cache statistics
    func getStatistics(type: CacheType) async throws -> CacheStatistics {
        let typeDirectory = getTypeDirectory(for: type)

        guard fileManager.fileExists(atPath: typeDirectory.path) else {
            return CacheStatistics(totalEntries: 0, totalSizeBytes: 0, expiredEntries: 0, type: type)
        }

        let files = try fileManager.contentsOfDirectory(at: typeDirectory, includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey])

        var totalEntries = 0
        var totalSize: Int64 = 0
        var expiredEntries = 0
        let now = Date()

        for file in files {
            totalEntries += 1

            if let size = try file.resourceValues(forKeys: [.fileSizeKey]).fileSize {
                totalSize += Int64(size)
            }

            // Check if expired
            if let data = try? Data(contentsOf: file),
               let entry = try? JSONDecoder().decode(CacheEntry<CodableData>.self, from: data) {
                if entry.expiresAt < now {
                    expiredEntries += 1
                }
            }
        }

        return CacheStatistics(
            totalEntries: totalEntries,
            totalSizeBytes: totalSize,
            expiredEntries: expiredEntries,
            type: type
        )
    }

    /// Clean expired entries for a specific type
    /// - Parameter type: Type of cache to clean
    func cleanExpired() async throws {
        isCleaning = true
        defer { isCleaning = false }

        for type in CacheType.allCases {
            try? await cleanExpired(type: type)
        }

        lastCleanupDate = Date()
    }

    /// Get current size of a cache type
    /// - Parameter type: Type of cache
    /// - Returns: Size in bytes
    func getCurrentSize(type: CacheType) async throws -> Int64 {
        let typeDirectory = getTypeDirectory(for: type)

        guard fileManager.fileExists(atPath: typeDirectory.path) else {
            return 0
        }

        let files = try fileManager.contentsOfDirectory(at: typeDirectory, includingPropertiesForKeys: [.fileSizeKey])
        var totalSize: Int64 = 0

        for file in files {
            if let size = try file.resourceValues(forKeys: [.fileSizeKey]).fileSize {
                totalSize += Int64(size)
            }
        }

        return totalSize
    }

    // MARK: - Public Methods - Convenience

    /// Cache chat messages
    func cacheMessages(_ messages: [ChatMessage], for roomId: String) async throws {
        try await cache(messages, forKey: "room_\(roomId)", type: .messages)
    }

    /// Retrieve cached chat messages
    func getMessages(for roomId: String) async throws -> [ChatMessage] {
        return try await retrieve(key: "room_\(roomId)", type: .messages)
    }

    /// Cache study sessions
    func cacheStudySessions(_ sessions: [StudySession], for userId: String) async throws {
        try await cache(sessions, forKey: "user_\(userId)", type: .studyRecords)
    }

    /// Retrieve cached study sessions
    func getStudySessions(for userId: String) async throws -> [StudySession] {
        return try await retrieve(key: "user_\(userId)", type: .studyRecords)
    }

    /// Cache user profile
    func cacheUserProfile(_ user: User) async throws {
        try await cache(user, forKey: "current", type: .userProfile)
    }

    /// Retrieve cached user profile
    func getUserProfile() async throws -> User {
        return try await retrieve(key: "current", type: .userProfile)
    }

    /// Cache image data
    func cacheImage(_ imageData: Data, forKey key: String) async throws {
        // Create a wrapper for image data
        struct ImageWrapper: Codable {
            let data: Data
        }

        try await cache(ImageWrapper(data: imageData), forKey: key, type: .images)
    }

    /// Retrieve cached image data
    func getImage(forKey key: String) async throws -> Data {
        struct ImageWrapper: Codable {
            let data: Data
        }

        let wrapper: ImageWrapper = try await retrieve(key: key, type: .images)
        return wrapper.data
    }

    // MARK: - Private Methods

    private func getPolicy(for type: CacheType) -> CachePolicy {
        switch type {
        case .messages:
            return .messages
        case .studyRecords:
            return .studyRecords
        case .userProfile:
            return .userProfile
        case .images:
            return .images
        }
    }

    private func createCacheDirectoryIfNeeded() {
        if !fileManager.fileExists(atPath: cacheDirectory.path) {
            try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
        }

        // Create subdirectories for each type
        for type in CacheType.allCases {
            let typeDirectory = getTypeDirectory(for: type)
            if !fileManager.fileExists(atPath: typeDirectory.path) {
                try? fileManager.createDirectory(at: typeDirectory, withIntermediateDirectories: true)
            }
        }
    }

    private func getTypeDirectory(for type: CacheType) -> URL {
        return cacheDirectory.appendingPathComponent(type.rawValue, isDirectory: true)
    }

    private func getFileURL(for key: String, type: CacheType) -> URL {
        let typeDirectory = getTypeDirectory(for: type)
        let fileName = makeCacheFileName(for: key, type: type)
        return typeDirectory.appendingPathComponent(fileName)
    }

    private func makeCacheFileName(for key: String, type: CacheType) -> String {
        let keyData = Data("\(type.rawValue):\(key)".utf8)
        let digest = SHA256.hash(data: keyData)
        let hash = digest.map { String(format: "%02x", $0) }.joined()
        return "\(type.rawValue)_\(hash).json"
    }

    private func cleanExpired(type: CacheType) async throws {
        let typeDirectory = getTypeDirectory(for: type)

        guard fileManager.fileExists(atPath: typeDirectory.path) else {
            return
        }

        let files = try fileManager.contentsOfDirectory(at: typeDirectory, includingPropertiesForKeys: [.contentModificationDateKey])
        let now = Date()

        for file in files {
            // Try to decode and check expiration
            if let data = try? Data(contentsOf: file),
               let entry = try? JSONDecoder().decode(CacheEntry<CodableData>.self, from: data) {
                if entry.expiresAt < now {
                    try? fileManager.removeItem(at: file)
                }
            }
        }

        await recalculateTotalSize()
    }

    private func recalculateTotalSize() async {
        var total: Int64 = 0

        for type in CacheType.allCases {
            do {
                let size = try await getCurrentSize(type: type)
                total += size
            } catch {
                SecureLogger.shared.error("Failed to calculate size for \(type.rawValue): \(error)")
            }
        }

        totalCacheSize = total
    }

    private func setupPeriodicCleanup() {
        // Schedule periodic cleanup
        Timer.publish(every: cleanupInterval, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                Task { @MainActor in
                    try? await self?.cleanExpired()
                }
            }
            .store(in: &cancellables)
    }
}

// MARK: - Codable Data Helper

/// Helper type for decoding generic cache entries
private struct CodableData: Codable {}
