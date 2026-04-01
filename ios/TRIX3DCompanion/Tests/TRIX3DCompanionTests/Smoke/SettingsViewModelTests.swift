//
//  SettingsViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for SettingsViewModel
//

import XCTest
import Combine
@testable import TRIX3DCompanion

/// Unit tests for SettingsViewModel
final class SettingsViewModelTests: XCTestCase {

    // MARK: - Properties

    var settingsViewModel: SettingsViewModel!
    var mockOfflineCacheService: MockOfflineCacheService!
    var mockDataExportService: MockDataExportService!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        mockOfflineCacheService = MockOfflineCacheService()
        mockDataExportService = MockDataExportService()

        // Note: SettingsViewModel uses UserDefaults for persistence
        // We'll need to clear UserDefaults between tests
        UserDefaults.standard.removeObject(forKey: "app_theme")
        UserDefaults.standard.removeObject(forKey: "app_language")
        UserDefaults.standard.removeObject(forKey: "notifications_enabled")
        UserDefaults.standard.removeObject(forKey: "haptic_feedback_enabled")
        UserDefaults.standard.removeObject(forKey: "auto_play_voice_enabled")

        settingsViewModel = SettingsViewModel(
            cacheService: mockOfflineCacheService,
            exportService: mockDataExportService
        )
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        settingsViewModel = nil
        mockOfflineCacheService = nil
        mockDataExportService = nil
        cancellables = nil

        // Clean up UserDefaults
        UserDefaults.standard.removeObject(forKey: "app_theme")
        UserDefaults.standard.removeObject(forKey: "app_language")
        UserDefaults.standard.removeObject(forKey: "notifications_enabled")
        UserDefaults.standard.removeObject(forKey: "haptic_feedback_enabled")
        UserDefaults.standard.removeObject(forKey: "auto_play_voice_enabled")
    }

    // MARK: - Theme Tests

    func test_selectedTheme_defaultIsSystem() {
        // Assert - default should be system
        XCTAssertEqual(settingsViewModel.selectedTheme, .system)
    }

    func test_selectedTheme_changesPersist() {
        // Act
        settingsViewModel.selectedTheme = .dark

        // Recreate to test persistence
        let newViewModel = SettingsViewModel(
            cacheService: mockOfflineCacheService,
            exportService: mockDataExportService
        )

        // Assert
        XCTAssertEqual(newViewModel.selectedTheme, .dark)
    }

    func test_selectedTheme_light() {
        // Act
        settingsViewModel.selectedTheme = .light

        // Assert
        XCTAssertEqual(settingsViewModel.selectedTheme, .light)
    }

    func test_selectedTheme_dark() {
        // Act
        settingsViewModel.selectedTheme = .dark

        // Assert
        XCTAssertEqual(settingsViewModel.selectedTheme, .dark)
    }

    func test_selectedTheme_system() {
        // Act
        settingsViewModel.selectedTheme = .system

        // Assert
        XCTAssertEqual(settingsViewModel.selectedTheme, .system)
    }

    // MARK: - Language Tests

    func test_selectedLanguage_defaultIsEnglish() {
        // Assert
        XCTAssertEqual(settingsViewModel.selectedLanguage, .english)
    }

    func test_selectedLanguage_changesPersist() {
        // Act
        settingsViewModel.selectedLanguage = .chinese

        // Recreate to test persistence
        let newViewModel = SettingsViewModel(
            cacheService: mockOfflineCacheService,
            exportService: mockDataExportService
        )

        // Assert
        XCTAssertEqual(newViewModel.selectedLanguage, .chinese)
    }

    func test_selectedLanguage_chinese() {
        // Act
        settingsViewModel.selectedLanguage = .chinese

        // Assert
        XCTAssertEqual(settingsViewModel.selectedLanguage, .chinese)
    }

    func test_selectedLanguage_japanese() {
        // Act
        settingsViewModel.selectedLanguage = .japanese

        // Assert
        XCTAssertEqual(settingsViewModel.selectedLanguage, .japanese)
    }

    // MARK: - Notification Settings Tests

    func test_notificationsEnabled_defaultIsFalse() {
        // Assert
        XCTAssertFalse(settingsViewModel.notificationsEnabled)
    }

    func test_notificationsEnabled_changesPersist() {
        // Act
        settingsViewModel.notificationsEnabled = true

        // Recreate to test persistence
        let newViewModel = SettingsViewModel(
            cacheService: mockOfflineCacheService,
            exportService: mockDataExportService
        )

        // Assert
        XCTAssertTrue(newViewModel.notificationsEnabled)
    }

    func test_notificationsEnabled_toggle() {
        // Act
        settingsViewModel.notificationsEnabled.toggle()

        // Assert
        XCTAssertTrue(settingsViewModel.notificationsEnabled)
    }

    // MARK: - Haptic Feedback Tests

    func test_hapticFeedbackEnabled_defaultIsFalse() {
        // Assert
        XCTAssertFalse(settingsViewModel.hapticFeedbackEnabled)
    }

    func test_hapticFeedbackEnabled_changesPersist() {
        // Act
        settingsViewModel.hapticFeedbackEnabled = true

        // Recreate to test persistence
        let newViewModel = SettingsViewModel(
            cacheService: mockOfflineCacheService,
            exportService: mockDataExportService
        )

        // Assert
        XCTAssertTrue(newViewModel.hapticFeedbackEnabled)
    }

    // MARK: - Auto Play Voice Tests

    func test_autoPlayVoiceEnabled_defaultIsFalse() {
        // Assert
        XCTAssertFalse(settingsViewModel.autoPlayVoiceEnabled)
    }

    func test_autoPlayVoiceEnabled_changesPersist() {
        // Act
        settingsViewModel.autoPlayVoiceEnabled = true

        // Recreate to test persistence
        let newViewModel = SettingsViewModel(
            cacheService: mockOfflineCacheService,
            exportService: mockDataExportService
        )

        // Assert
        XCTAssertTrue(newViewModel.autoPlayVoiceEnabled)
    }

    // MARK: - Clear Cache Tests

    func test_clearCache_success() async throws {
        // Arrange
        mockOfflineCacheService.setMockCacheSize(52_428_800) // 50 MB

        // Act
        await settingsViewModel.clearCache()

        // Assert
        XCTAssertEqual(mockOfflineCacheService.clearAllCacheCallCount, 1)
        XCTAssertFalse(settingsViewModel.isClearingCache)
    }

    func test_clearCache_whileAlreadyClearing_doesNotDuplicate() async throws {
        // Arrange
        settingsViewModel.isClearingCache = true

        // Act
        await settingsViewModel.clearCache()

        // Assert - Should not call service again
        XCTAssertEqual(mockOfflineCacheService.clearAllCacheCallCount, 0)
    }

    func test_clearCache_successMessage() async throws {
        // Act
        await settingsViewModel.clearCache()

        // Assert
        XCTAssertNotNil(settingsViewModel.successMessage)
        XCTAssertTrue(settingsViewModel.successMessage!.contains("cleared"))
    }

    func test_clearCache_error_setsErrorMessage() async throws {
        // Arrange
        mockOfflineCacheService.mockCacheResult = .failure(.storageError(underlying: NSError(domain: "test", code: 0)))

        // Act
        await settingsViewModel.clearCache()

        // Assert
        XCTAssertNotNil(settingsViewModel.errorMessage)
    }

    // MARK: - Load Cache Size Tests

    func test_loadCacheSize_updatesCacheSize() async throws {
        // Arrange
        let expectedSize: Int64 = 100_000_000
        mockOfflineCacheService.setMockCacheSize(expectedSize)

        // Act
        await settingsViewModel.loadCacheSize()

        // Assert
        XCTAssertEqual(settingsViewModel.cacheSize, expectedSize)
        XCTAssertEqual(mockOfflineCacheService.getCacheSizeCallCount, 1)
    }

    func test_formattedCacheSize_formatsCorrectly() {
        // Arrange
        settingsViewModel = SettingsViewModel(
            cacheService: mockOfflineCacheService,
            exportService: mockDataExportService
        )
        mockOfflineCacheService.setMockCacheSize(52_428_800) // ~50 MB

        // Act
        await settingsViewModel.loadCacheSize()

        // Assert
        XCTAssertTrue(settingsViewModel.formattedCacheSize.contains("MB"))
    }

    // MARK: - Export Data Tests

    func test_exportData_success() async throws {
        // Arrange
        mockDataExportService.mockExportResult = ExportResult(
            fileURL: URL(fileURLWithPath: "/tmp/export.json"),
            format: .json
        )

        // Act
        await settingsViewModel.exportData(format: .json)

        // Assert
        XCTAssertEqual(mockDataExportService.exportDataCallCount, 1)
        XCTAssertFalse(settingsViewModel.isExportingData)
    }

    func test_exportData_progressUpdates() async throws {
        // Arrange
        mockDataExportService.mockExportResult = ExportResult(
            fileURL: URL(fileURLWithPath: "/tmp/export.json"),
            format: .json
        )

        var progressUpdates: [Double] = []
        settingsViewModel.$exportProgress
            .sink { progress in
                progressUpdates.append(progress)
            }
            .store(in: &cancellables)

        // Act
        await settingsViewModel.exportData(format: .json)

        // Assert
        XCTAssertTrue(progressUpdates.contains(100))
    }

    func test_exportData_error_setsErrorMessage() async throws {
        // Arrange
        mockDataExportService.shouldThrowError = true

        // Act
        await settingsViewModel.exportData(format: .json)

        // Assert
        XCTAssertNotNil(settingsViewModel.errorMessage)
        XCTAssertFalse(settingsViewModel.isExportingData)
    }

    // MARK: - Clear Messages Tests

    func test_clearMessages_clearsErrorAndSuccess() {
        // Arrange
        settingsViewModel.errorMessage = "Error"
        settingsViewModel.successMessage = "Success"

        // Act
        settingsViewModel.clearMessages()

        // Assert
        XCTAssertNil(settingsViewModel.errorMessage)
        XCTAssertNil(settingsViewModel.successMessage)
    }

    // MARK: - App Theme Display Name Tests

    func test_lightDisplayName() {
        // Assert
        XCTAssertEqual(AppTheme.light.displayName, "Light")
    }

    func test_darkDisplayName() {
        // Assert
        XCTAssertEqual(AppTheme.dark.displayName, "Dark")
    }

    func test_systemDisplayName() {
        // Assert
        XCTAssertEqual(AppTheme.system.displayName, "System")
    }

    // MARK: - App Language Display Name Tests

    func test_englishDisplayName() {
        // Assert
        XCTAssertEqual(AppLanguage.english.displayName, "English")
    }

    func test_chineseDisplayName() {
        // Assert
        XCTAssertEqual(AppLanguage.chinese.displayName, "中文")
    }

    func test_japaneseDisplayName() {
        // Assert
        XCTAssertEqual(AppLanguage.japanese.displayName, "日本語")
    }

    func test_languageCode() {
        // Assert
        XCTAssertEqual(AppLanguage.english.code, "en")
        XCTAssertEqual(AppLanguage.chinese.code, "zh")
        XCTAssertEqual(AppLanguage.japanese.code, "ja")
    }
}

// MARK: - Mock Data Export Service

/// Mock DataExportService for testing
@MainActor
final class MockDataExportService: ObservableObject {

    @Published var exportProgress: ExportProgress = ExportProgress(percentage: 0, bytesProcessed: 0, totalBytes: 0)

    var mockExportResult: Result<ExportResult, Error>?
    var shouldThrowError: Bool = false

    var exportDataCallCount: Int = 0

    func exportAllData(format: ExportFormat) async throws -> ExportResult {
        exportDataCallCount += 1
        isExportingData = true

        // Simulate progress
        exportProgress = ExportProgress(percentage: 50, bytesProcessed: 50, totalBytes: 100)

        try await Task.sleep(nanoseconds: 100_000_000)

        exportProgress = ExportProgress(percentage: 100, bytesProcessed: 100, totalBytes: 100)

        isExportingData = false

        if shouldThrowError {
            throw ExportError.exportFailed(underlying: NSError(domain: "test", code: 0))
        }

        if let result = mockExportResult {
            switch result {
            case .success(let exportResult):
                return exportResult
            case .failure(let error):
                throw error
            }
        }

        return ExportResult(
            fileURL: URL(fileURLWithPath: "/tmp/export.json"),
            format: format
        )
    }

    @Published private(set) var isExportingData: Bool = false
}

// MARK: - Export Models

struct ExportResult {
    let fileURL: URL
    let format: ExportFormat
}

enum ExportFormat: String, CaseIterable {
    case json = "json"
    case csv = "csv"
}

struct ExportProgress {
    let percentage: Double
    let bytesProcessed: Int64
    let totalBytes: Int64
}

enum ExportError: Error {
    case exportFailed(underlying: Error?)
    case noDataToExport
    case encodingFailed
}
