//
//  MockProfileServices.swift
//  TRIX3DCompanionTests
//
//  Mock services for Profile and Settings module testing
//

import Foundation
import UIKit
import Combine
@testable import TRIX3DCompanion

// MARK: - Mock API Client for Profile Tests

@MainActor
final class MockAPIClientForProfileTests: APIClientProtocol {
    // MARK: - State

    var shouldFailRequests: Bool = false
    var mockError: NetworkError = .unauthorized
    var mockUser: User?
    var mockUserStats: UserStats?
    var mockPointsResponse: PointsResponse?

    // MARK: - Call Tracking

    var getUserProfileCallCount: Int = 0
    var getUserStatsCallCount: Int = 0
    var getPointsCallCount: Int = 0
    var updateUserProfileCallCount: Int = 0
    var lastUpdateProfile: ProfileUpdate?

    // MARK: - APIClientProtocol

    func get<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError
        }

        if let user = mockUser, T.self == User.self {
            return user as! T
        }

        if let stats = mockUserStats, T.self == UserStats.self {
            return stats as! T
        }

        if let points = mockPointsResponse, T.self == PointsResponse.self {
            return points as! T
        }

        throw NetworkError.custom(message: "No mock data for \(T.self)")
    }

    func get<T>(_ endpoint: APIEndpoint, parameters: [String: Any]) async throws -> T where T: Decodable {
        return try await get(endpoint)
    }

    func post<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError
        }

        if T.self == User.self, let user = mockUser {
            return user as! T
        }

        if T.self == PointsResponse.self, let points = mockPointsResponse {
            return points as! T
        }

        throw NetworkError.custom(message: "No mock data for \(T.self)")
    }

    func put<T>(_ endpoint: APIEndpoint, body: Encodable) async throws -> T where T: Decodable {
        updateUserProfileCallCount += 1

        if shouldFailRequests {
            throw mockError
        }

        if let user = mockUser {
            return user as! T
        }

        throw NetworkError.custom(message: "No mock data for \(T.self)")
    }

    func delete<T>(_ endpoint: APIEndpoint) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError
        }

        if T.self == User.self, let user = mockUser {
            return user as! T
        }

        throw NetworkError.custom(message: "Not implemented")
    }

    func upload<T>(_ endpoint: APIEndpoint, data: Data, fileName: String) async throws -> T where T: Decodable {
        if shouldFailRequests {
            throw mockError
        }

        throw NetworkError.custom(message: "Upload not implemented in mock")
    }

    func download(from url: String) async throws -> Data {
        if shouldFailRequests {
            throw mockError
        }

        return Data()
    }

    func reset() {
        shouldFailRequests = false
        mockError = .unauthorized
        mockUser = nil
        mockUserStats = nil
        mockPointsResponse = nil
        getUserProfileCallCount = 0
        getUserStatsCallCount = 0
        getPointsCallCount = 0
        updateUserProfileCallCount = 0
        lastUpdateProfile = nil
    }
}

// MARK: - Mock Image Upload Service for Profile Tests

@MainActor
final class MockImageUploadServiceForProfile: ImageUploadServiceProtocol {
    var shouldFailUpload: Bool = false
    var uploadCallCount: Int = 0
    var lastUploadedData: Data?
    var mockUploadedURL: String = "https://example.com/uploaded.jpg"

    @Published var uploadProgressValue: Double = 0.0
    @Published var isUploadingValue: Bool = false

    var uploadProgress: Double {
        uploadProgressValue
    }

    var isUploading: Bool {
        isUploadingValue
    }

    var uploadProgressPublisher: Published<Double>.Publisher { $uploadProgressValue }
    var isUploadingPublisher: Published<Bool>.Publisher { $isUploadingValue }

    func uploadImage(_ image: UIImage, quality: CGFloat?) async -> Result<String, UploadError> {
        uploadCallCount += 1
        isUploadingValue = true

        if shouldFailUpload {
            isUploadingValue = false
            return .failure(.unknown(nil))
        }

        isUploadingValue = false
        return .success(mockUploadedURL)
    }

    func reset() {
        shouldFailUpload = false
        uploadCallCount = 0
        lastUploadedData = nil
        mockUploadedURL = "https://example.com/uploaded.jpg"
        uploadProgressValue = 0.0
        isUploadingValue = false
    }
}

// MARK: - Mock Offline Cache Service for Settings Tests

@MainActor
final class MockOfflineCacheServiceForProfile: OfflineCacheServiceProtocol {
    var shouldFailClearAll: Bool = false
    var clearAllCallCount: Int = 0
    var totalCacheSizeValue: Int64 = 0

    var totalCacheSize: Int64 {
        get { totalCacheSizeValue }
        set { totalCacheSizeValue = newValue }
    }

    func cache<T: Codable>(_ data: T, forKey key: String, type: CacheType) async throws {}
    func retrieve<T: Codable>(key: String, type: CacheType) async throws -> T {
        throw CacheError.notFound
    }
    func remove(key: String, type: CacheType) async throws {}
    func clear(type: CacheType) async throws {}

    func clearAll() async throws {
        clearAllCallCount += 1

        if shouldFailClearAll {
            throw CacheError.clearFailed(underlying: nil)
        }

        totalCacheSizeValue = 0
    }

    func getStatistics(type: CacheType) async throws -> CacheStatistics {
        CacheStatistics(totalEntries: 0, totalSizeBytes: 0, expiredEntries: 0, type: type)
    }

    func cleanExpired() async throws {}
    func getCurrentSize(type: CacheType) async throws -> Int64 { 0 }

    func cacheUserProfile(_ user: User) async throws {}

    func reset() {
        shouldFailClearAll = false
        clearAllCallCount = 0
        totalCacheSizeValue = 0
    }
}

// MARK: - Mock Export Service for Settings Tests

@MainActor
final class MockDataExportService: DataExportServiceProtocol {
    var shouldFailExport: Bool = false
    var exportCallCount: Int = 0
    var lastExportFormat: ExportFormat?
    var currentProgressValue: ExportProgress?

    var isExporting: Bool { false }
    var currentProgress: ExportProgress? { currentProgressValue }
    var progressPublisher: AnyPublisher<ExportProgress?, Never> {
        Just(currentProgressValue).eraseToAnyPublisher()
    }

    func export(type: ExportType, format: ExportFormat) async throws -> ExportResult {
        exportCallCount += 1
        lastExportFormat = format

        if shouldFailExport {
            throw ExportError.exportFailed(underlying: nil)
        }

        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("export.\(format.fileExtension)")
        return ExportResult(
            type: .allData,
            format: format,
            fileURL: tempURL,
            itemCount: 10,
            fileSizeBytes: 0,
            timestamp: Date(),
            duration: 0
        )
    }

    func exportAll(format: ExportFormat) async throws -> ExportResult {
        exportCallCount += 1
        lastExportFormat = format

        if shouldFailExport {
            throw ExportError.exportFailed(underlying: nil)
        }

        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("export.\(format.fileExtension)")
        return ExportResult(
            type: .allData,
            format: format,
            fileURL: tempURL,
            itemCount: 10,
            fileSizeBytes: 0,
            timestamp: Date(),
            duration: 0
        )
    }

    func cancelExport() {}

    func getExportHistory() -> [ExportResult] { [] }

    func reset() {
        shouldFailExport = false
        exportCallCount = 0
        lastExportFormat = nil
        currentProgressValue = nil
    }
}

// MARK: - Cache Error Extension for Mock

extension CacheError {
    static func clearFailed(underlying: Error?) -> CacheError {
        return .clearFailed(underlying: underlying)
    }
}

// MARK: - Export Error Extension for Mock

extension ExportError {
    static func exportFailed(underlying: Error?) -> ExportError {
        return .exportFailed(underlying: underlying)
    }
}

// MARK: - Helper Extensions

extension MockAPIClientForProfileTests {
    static func createMockUser(
        id: String = "test_user_id",
        username: String = "test_user",
        email: String = "test@example.com",
        displayName: String? = "Test User",
        points: Int = 100,
        isStudying: Bool = false
    ) -> User {
        User(
            id: id,
            username: username,
            email: email,
            avatarUrl: nil,
            avatarConfig: nil,
            fullName: nil,
            displayName: displayName,
            bio: nil,
            website: nil,
            points: points,
            isStudying: isStudying,
            companionId: nil,
            totalStudyTime: 3600,
            lastActiveAt: Date(),
            currentStreak: 5,
            daysActive: 30,
            interactionCount: 100,
            showOnlineStatus: true,
            school: nil,
            grade: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    static func createMockUserStats(
        totalStudyTime: Int = 3600,
        sessionCount: Int = 42,
        averageDuration: Int = 30,
        streakDays: Int = 7,
        todayDuration: Int = 120,
        weekDuration: Int = 540
    ) -> UserStats {
        UserStats(
            totalStudyTime: totalStudyTime,
            sessionCount: sessionCount,
            averageDuration: averageDuration,
            streakDays: streakDays,
            todayDuration: todayDuration,
            weekDuration: weekDuration
        )
    }

    static func createMockPointsResponse(
        totalPoints: Int = 2450,
        level: Int = 3,
        todayEarned: Int = 150,
        weekEarned: Int = 520,
        totalTransactions: Int = 45
    ) -> PointsResponse {
        PointsResponse(
            totalPoints: totalPoints,
            level: level,
            todayEarned: todayEarned,
            weekEarned: weekEarned,
            totalTransactions: totalTransactions
        )
    }
}
