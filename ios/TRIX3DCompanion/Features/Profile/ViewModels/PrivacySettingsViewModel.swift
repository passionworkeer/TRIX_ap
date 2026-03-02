//
//  PrivacySettingsViewModel.swift
//  TRIX3DCompanion
//
//  Privacy settings feature ViewModel - manages privacy and security settings
//

import Foundation
import Combine

// MARK: - Privacy Settings

/// Privacy settings model
struct PrivacySettings: Codable {
    var locationSharing: Bool
    var onlineStatusVisible: Bool
    var readReceipts: Bool
    var allowFriendRequests: Bool
    var showInLeaderboard: Bool

    static var `default`: PrivacySettings {
        PrivacySettings(
            locationSharing: false,
            onlineStatusVisible: true,
            readReceipts: true,
            allowFriendRequests: true,
            showInLeaderboard: true
        )
    }
}

// MARK: - Account Deletion Status

/// Account deletion status
enum AccountDeletionStatus: Equatable {
    case none
    case pending(deletionDate: Date)
    case error(message: String)

    var isPending: Bool {
        if case .pending = self {
            return true
        }
        return false
    }
}

// MARK: - Privacy Settings View Model

/// Privacy settings view model managing privacy and security preferences
@MainActor
final class PrivacySettingsViewModel: ObservableObject {

    // MARK: - Published Properties

    /// Privacy settings
    @Published var settings: PrivacySettings {
        didSet {
            Task {
                await saveSettings()
            }
        }
    }

    /// Account deletion status
    @Published private(set) var deletionStatus: AccountDeletionStatus = .none

    /// Whether currently loading
    @Published private(set) var isLoading: Bool = false

    /// Whether showing delete confirmation
    @Published var showDeleteConfirmation: Bool = false

    /// Error message to display
    @Published var errorMessage: String?

    /// Success message to display
    @Published var successMessage: String?

    // MARK: - Constants

    /// Cooling period in days before account deletion
    private let coolingPeriodDays: Int = 7

    // MARK: - Dependencies

    private let apiClient: APIClient
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    /// Initialize PrivacySettingsViewModel
    /// - Parameter apiClient: API client dependency
    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
        self.settings = Self.loadSettings()

        Task {
            await loadDeletionStatus()
        }
    }

    // MARK: - Public Methods

    /// Load deletion status from server
    func loadDeletionStatus() async {
        // In a real app, this would check the server for pending deletion
        // For now, we'll check UserDefaults
        if let deletionDate = UserDefaults.standard.object(forKey: "account_deletion_date") as? Date {
            if deletionDate > Date() {
                deletionStatus = .pending(deletionDate: deletionDate)
            } else {
                // Deletion date passed, clear it
                await cancelAccountDeletion()
            }
        }
    }

    /// Request account deletion
    func requestAccountDeletion() async {
        isLoading = true
        errorMessage = nil
        successMessage = nil

        do {
            // Calculate deletion date (7 days from now)
            let deletionDate = Calendar.current.date(
                byAdding: .day,
                value: coolingPeriodDays,
                to: Date()
            ) ?? Date().addingTimeInterval(Double(coolingPeriodDays) * 86400)

            // In a real app, this would send a request to the server
            // For now, we'll save it locally
            UserDefaults.standard.set(deletionDate, forKey: "account_deletion_date")

            deletionStatus = .pending(deletionDate: deletionDate)
            successMessage = "Account deletion scheduled. You can cancel within \(coolingPeriodDays) days."

        } catch {
            deletionStatus = .error(message: error.localizedDescription)
            errorMessage = "Failed to request account deletion: \(error.localizedDescription)"
        }

        isLoading = false
    }

    /// Cancel account deletion
    func cancelAccountDeletion() async {
        isLoading = true
        errorMessage = nil
        successMessage = nil

        do {
            // In a real app, this would send a request to the server
            UserDefaults.standard.removeObject(forKey: "account_deletion_date")

            deletionStatus = .none
            successMessage = "Account deletion cancelled successfully"

        } catch {
            deletionStatus = .error(message: error.localizedDescription)
            errorMessage = "Failed to cancel deletion: \(error.localizedDescription)"
        }

        isLoading = false
    }

    /// Update location sharing setting
    /// - Parameter enabled: Whether location sharing is enabled
    func updateLocationSharing(_ enabled: Bool) {
        settings.locationSharing = enabled
    }

    /// Update online status visibility
    /// - Parameter visible: Whether online status is visible
    func updateOnlineStatusVisible(_ visible: Bool) {
        settings.onlineStatusVisible = visible
    }

    /// Update read receipts setting
    /// - Parameter enabled: Whether read receipts are enabled
    func updateReadReceipts(_ enabled: Bool) {
        settings.readReceipts = enabled
    }

    /// Update allow friend requests setting
    /// - Parameter allowed: Whether friend requests are allowed
    func updateAllowFriendRequests(_ allowed: Bool) {
        settings.allowFriendRequests = allowed
    }

    /// Update show in leaderboard setting
    /// - Parameter show: Whether to show in leaderboard
    func updateShowInLeaderboard(_ show: Bool) {
        settings.showInLeaderboard = show
    }

    /// Clear messages
    func clearMessages() {
        errorMessage = nil
        successMessage = nil
    }

    // MARK: - Computed Properties

    /// Time remaining until deletion
    var timeUntilDeletion: String? {
        guard case .pending(let deletionDate) = deletionStatus else {
            return nil
        }

        let formatter = DateComponentsFormatter()
        formatter.allowedUnits = [.day, .hour, .minute]
        formatter.unitsStyle = .full
        return formatter.string(from: Date(), to: deletionDate)
    }

    /// Deletion date formatted
    var deletionDateFormatted: String? {
        guard case .pending(let deletionDate) = deletionStatus else {
            return nil
        }

        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.timeStyle = .short
        return formatter.string(from: deletionDate)
    }

    // MARK: - Private Methods

    /// Load settings from UserDefaults
    private static func loadSettings() -> PrivacySettings {
        guard let data = UserDefaults.standard.data(forKey: "privacy_settings"),
              let settings = try? JSONDecoder().decode(PrivacySettings.self, from: data) else {
            return .default
        }
        return settings
    }

    /// Save settings to UserDefaults and server
    private func saveSettings() async {
        guard let data = try? JSONEncoder().encode(settings) else {
            return
        }

        UserDefaults.standard.set(data, forKey: "privacy_settings")

        // In a real app, this would also sync with the server
        do {
            // let _: EmptyResponse = try await apiClient.patch(.userSettings, body: settings)
            // Settings synced successfully
        } catch {
            // Handle error silently for now
            SecureLogger.shared.error("Failed to sync privacy settings: \(error)")
        }
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension PrivacySettingsViewModel {
    /// Create preview view model
    static var preview: PrivacySettingsViewModel {
        let vm = PrivacySettingsViewModel()
        vm.settings = PrivacySettings(
            locationSharing: false,
            onlineStatusVisible: true,
            readReceipts: true,
            allowFriendRequests: true,
            showInLeaderboard: false
        )
        return vm
    }

    /// Create preview with pending deletion
    static var previewPendingDeletion: PrivacySettingsViewModel {
        let vm = PrivacySettingsViewModel()
        vm.deletionStatus = .pending(
            deletionDate: Date().addingTimeInterval(5 * 86400) // 5 days from now
        )
        return vm
    }
}
#endif
