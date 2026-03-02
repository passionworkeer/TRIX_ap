//
//  SettingsViewModel.swift
//  TRIX3DCompanion
//
//  Settings feature ViewModel - manages app settings and preferences
//

import Foundation
import Combine
import SwiftUI

// MARK: - App Language

/// Supported app languages
enum AppLanguage: String, CaseIterable, Identifiable {
    case english = "en"
    case chinese = "zh"
    case japanese = "ja"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .english: return "English"
        case .chinese: return "中文"
        case .japanese: return "日本語"
        }
    }

    var code: String {
        rawValue
    }
}

// MARK: - Settings View Model

/// Settings view model managing app settings
@MainActor
final class SettingsViewModel: ObservableObject {

    // MARK: - Published Properties

    /// Current app theme
    @Published var selectedTheme: AppTheme {
        didSet {
            saveTheme()
        }
    }

    /// Current app language
    @Published var selectedLanguage: AppLanguage {
        didSet {
            saveLanguage()
        }
    }

    /// Whether notifications are enabled
    @Published var notificationsEnabled: Bool {
        didSet {
            saveNotifications()
        }
    }

    /// Whether haptic feedback is enabled
    @Published var hapticFeedbackEnabled: Bool {
        didSet {
            saveHapticFeedback()
        }
    }

    /// Whether auto-play is enabled for voice messages
    @Published var autoPlayVoiceEnabled: Bool {
        didSet {
            saveAutoPlayVoice()
        }
    }

    /// Cache size in bytes
    @Published private(set) var cacheSize: Int64 = 0

    /// Whether currently clearing cache
    @Published private(set) var isClearingCache: Bool = false

    /// Whether currently exporting data
    @Published private(set) var isExportingData: Bool = false

    /// Export progress
    @Published var exportProgress: Double = 0

    /// Error message to display
    @Published var errorMessage: String?

    /// Success message to display
    @Published var successMessage: String?

    // MARK: - Dependencies

    private let cacheService: OfflineCacheService
    private let exportService: DataExportService
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    /// Initialize SettingsViewModel
    /// - Parameters:
    ///   - cacheService: Cache service dependency
    ///   - exportService: Export service dependency
    init(
        cacheService: OfflineCacheService = .shared,
        exportService: DataExportService = .shared
    ) {
        self.cacheService = cacheService
        self.exportService = exportService

        // Load saved preferences
        self.selectedTheme = Self.loadTheme()
        self.selectedLanguage = Self.loadLanguage()
        self.notificationsEnabled = Self.loadNotifications()
        self.hapticFeedbackEnabled = Self.loadHapticFeedback()
        self.autoPlayVoiceEnabled = Self.loadAutoPlayVoice()

        // Load cache size
        Task {
            await loadCacheSize()
        }
    }

    // MARK: - Public Methods

    /// Clear app cache
    func clearCache() async {
        isClearingCache = true
        errorMessage = nil

        do {
            try await cacheService.clearAll()
            await loadCacheSize()
            successMessage = "Cache cleared successfully"
        } catch {
            errorMessage = "Failed to clear cache: \(error.localizedDescription)"
        }

        isClearingCache = false
    }

    /// Export user data
    /// - Parameter format: Export format
    func exportData(format: ExportFormat) async {
        isExportingData = true
        exportProgress = 0
        errorMessage = nil
        successMessage = nil

        do {
            // Subscribe to progress updates
            exportService.$currentProgress
                .receive(on: DispatchQueue.main)
                .sink { progress in
                    if let progress = progress {
                        self.exportProgress = progress.percentage
                    }
                }
                .store(in: &cancellables)

            let result = try await exportService.exportAll(format: format)

            isExportingData = false
            exportProgress = 100
            successMessage = "Data exported successfully to \(result.fileURL.path)"

        } catch {
            isExportingData = false
            exportProgress = 0
            errorMessage = "Failed to export data: \(error.localizedDescription)"
        }
    }

    /// Load current cache size
    func loadCacheSize() async {
        cacheSize = await cacheService.totalCacheSize
    }

    /// Get formatted cache size string
    var formattedCacheSize: String {
        ByteCountFormatter.string(fromByteCount: cacheSize, countStyle: .file)
    }

    /// Clear messages
    func clearMessages() {
        errorMessage = nil
        successMessage = nil
    }

    // MARK: - Private Methods - Load/Save Preferences

    private static func loadTheme() -> AppTheme {
        let rawValue = UserDefaults.standard.string(forKey: "app_theme") ?? AppTheme.system.rawValue
        return AppTheme(rawValue: rawValue) ?? .system
    }

    private func saveTheme() {
        UserDefaults.standard.set(selectedTheme.rawValue, forKey: "app_theme")
        applyTheme()
    }

    private static func loadLanguage() -> AppLanguage {
        let rawCode = UserDefaults.standard.string(forKey: "app_language") ?? AppLanguage.english.rawValue
        return AppLanguage(rawValue: rawCode) ?? .english
    }

    private func saveLanguage() {
        UserDefaults.standard.set(selectedLanguage.rawValue, forKey: "app_language")
        // Apply language change (would require app restart typically)
    }

    private static func loadNotifications() -> Bool {
        UserDefaults.standard.bool(forKey: "notifications_enabled")
    }

    private func saveNotifications() {
        UserDefaults.standard.set(notificationsEnabled, forKey: "notifications_enabled")
    }

    private static func loadHapticFeedback() -> Bool {
        UserDefaults.standard.bool(forKey: "haptic_feedback_enabled")
    }

    private func saveHapticFeedback() {
        UserDefaults.standard.set(hapticFeedbackEnabled, forKey: "haptic_feedback_enabled")
    }

    private static func loadAutoPlayVoice() -> Bool {
        UserDefaults.standard.bool(forKey: "auto_play_voice_enabled")
    }

    private func saveAutoPlayVoice() {
        UserDefaults.standard.set(autoPlayVoiceEnabled, forKey: "auto_play_voice_enabled")
    }

    /// Apply the selected theme
    private func applyTheme() {
        // Theme application would be handled here
        // This might involve updating a theme publisher or notifying the app
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension SettingsViewModel {
    /// Create preview view model
    static var preview: SettingsViewModel {
        let vm = SettingsViewModel()
        vm.cacheSize = 52_428_800 // 50 MB
        return vm
    }
}
#endif
