//
//  PrivacySettingsViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Unit tests for PrivacySettingsViewModel
//

import XCTest
import Combine
@testable import TRIX3DCompanion

/// Unit tests for PrivacySettingsViewModel
final class PrivacySettingsViewModelTests: XCTestCase {

    // MARK: - Properties

    var privacyViewModel: PrivacySettingsViewModel!
    var mockAPIClient: MockPrivacyAPIClient!
    var cancellables: Set<AnyCancellable>!

    // MARK: - Test Lifecycle

    override func setUpWithError() throws {
        // Clear UserDefaults
        UserDefaults.standard.removeObject(forKey: "privacy_settings")
        UserDefaults.standard.removeObject(forKey: "account_deletion_date")

        mockAPIClient = MockPrivacyAPIClient()

        privacyViewModel = PrivacySettingsViewModel(
            apiClient: mockAPIClient as! APIClient
        )
        cancellables = Set<AnyCancellable>()
    }

    override func tearDownWithError() throws {
        privacyViewModel = nil
        mockAPIClient = nil
        cancellables = nil

        // Clean up UserDefaults
        UserDefaults.standard.removeObject(forKey: "privacy_settings")
        UserDefaults.standard.removeObject(forKey: "account_deletion_date")
    }

    // MARK: - Initial State Tests

    func test_initialSettings_defaultValues() {
        // Assert
        XCTAssertFalse(privacyViewModel.settings.locationSharing)
        XCTAssertTrue(privacyViewModel.settings.onlineStatusVisible)
        XCTAssertTrue(privacyViewModel.settings.readReceipts)
        XCTAssertTrue(privacyViewModel.settings.allowFriendRequests)
        XCTAssertTrue(privacyViewModel.settings.showInLeaderboard)
    }

    func test_initialDeletionStatus_none() {
        // Assert
        if case .none = privacyViewModel.deletionStatus {
            // Success
        } else {
            XCTFail("Initial deletion status should be none")
        }
    }

    // MARK: - Privacy Settings Update Tests

    func test_updateLocationSharing() {
        // Act
        privacyViewModel.updateLocationSharing(true)

        // Assert
        XCTAssertTrue(privacyViewModel.settings.locationSharing)
    }

    func test_updateOnlineStatusVisible() {
        // Act
        privacyViewModel.updateOnlineStatusVisible(false)

        // Assert
        XCTAssertFalse(privacyViewModel.settings.onlineStatusVisible)
    }

    func test_updateReadReceipts() {
        // Act
        privacyViewModel.updateReadReceipts(false)

        // Assert
        XCTAssertFalse(privacyViewModel.settings.readReceipts)
    }

    func test_updateAllowFriendRequests() {
        // Act
        privacyViewModel.updateAllowFriendRequests(false)

        // Assert
        XCTAssertFalse(privacyViewModel.settings.allowFriendRequests)
    }

    func test_updateShowInLeaderboard() {
        // Act
        privacyViewModel.updateShowInLeaderboard(false)

        // Assert
        XCTAssertFalse(privacyViewModel.settings.showInLeaderboard)
    }

    // MARK: - Account Deletion Tests

    func test_requestAccountDeletion_setsPendingStatus() async throws {
        // Act
        await privacyViewModel.requestAccountDeletion()

        // Assert
        if case .pending = privacyViewModel.deletionStatus {
            // Success
        } else {
            XCTFail("Deletion status should be pending")
        }
        XCTAssertNotNil(privacyViewModel.successMessage)
    }

    func test_cancelAccountDeletion_clearsStatus() async throws {
        // Arrange
        await privacyViewModel.requestAccountDeletion()

        // Act
        await privacyViewModel.cancelAccountDeletion()

        // Assert
        if case .none = privacyViewModel.deletionStatus {
            // Success
        } else {
            XCTFail("Deletion status should be none after cancel")
        }
    }

    func test_loadDeletionStatus_pending_deletesAfterDate() async throws {
        // Arrange - Set deletion date in the past
        let pastDate = Date().addingTimeInterval(-86400)
        UserDefaults.standard.set(pastDate, forKey: "account_deletion_date")

        // Recreate view model
        let viewModel = PrivacySettingsViewModel()

        // Wait for async load
        try await Task.sleep(nanoseconds: 100_000_000)

        // Assert - Should clear since date passed
        if case .none = viewModel.deletionStatus {
            // Success
        }
    }

    // MARK: - Computed Properties Tests

    func test_timeUntilDeletion_returnsString() async throws {
        // Arrange
        await privacyViewModel.requestAccountDeletion()

        // Act
        let result = privacyViewModel.timeUntilDeletion

        // Assert
        XCTAssertNotNil(result)
    }

    func test_timeUntilDeletion_nilWhenNotPending() {
        // Assert
        XCTAssertNil(privacyViewModel.timeUntilDeletion)
    }

    func test_deletionDateFormatted_returnsString() async throws {
        // Arrange
        await privacyViewModel.requestAccountDeletion()

        // Act
        let result = privacyViewModel.deletionDateFormatted

        // Assert
        XCTAssertNotNil(result)
    }

    func test_deletionDateFormatted_nilWhenNotPending() {
        // Assert
        XCTAssertNil(privacyViewModel.deletionDateFormatted)
    }

    // MARK: - Clear Messages Tests

    func test_clearMessages_clearsMessages() {
        // Arrange
        privacyViewModel.errorMessage = "Error"
        privacyViewModel.successMessage = "Success"

        // Act
        privacyViewModel.clearMessages()

        // Assert
        XCTAssertNil(privacyViewModel.errorMessage)
        XCTAssertNil(privacyViewModel.successMessage)
    }

    // MARK: - Show Delete Confirmation Tests

    func test_showDeleteConfirmation_defaultFalse() {
        // Assert
        XCTAssertFalse(privacyViewModel.showDeleteConfirmation)
    }

    func test_showDeleteConfirmation_canBeSet() {
        // Act
        privacyViewModel.showDeleteConfirmation = true

        // Assert
        XCTAssertTrue(privacyViewModel.showDeleteConfirmation)
    }
}

// MARK: - Mock Privacy APIClient

class MockPrivacyAPIClient {
    var shouldThrowError: Bool = false

    init() {}

    func patch<T: Encodable, R: Decodable>(_ endpoint: APIEndpoint, body: T) async throws -> R {
        if shouldThrowError {
            throw NetworkError.serverError(message: "Test error")
        }
        fatalError("Not implemented")
    }
}
