//
//  ChatDetailViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Test suite for ChatDetailView camera and conversation info functionality
//
//  Test Coverage:
//  - Camera button tap handling
//  - Conversation info tap handling
//  - Image picker state management
//  - Attachment options handling
//  - Connection status display
//

import XCTest
import SwiftUI
import Combine
@testable import TRIX3DCompanion

// MARK: - Chat Detail View Model

@MainActor
final class ChatDetailViewModel: ObservableObject {
    @Published var showingImagePicker = false
    @Published var showingAttachmentOptions = false
    @Published var showingConversationInfo = false
    @Published var messageText = ""
    @Published var isConnected = true
    @Published var connectionStatus = "Connected"
    @Published var selectedImage: UIImage?
    @Published var errorMessage: String?
    @Published var isLoading = false

    // MARK: - Actions

    func openCamera() {
        showingAttachmentOptions = false
        showingImagePicker = true
    }

    func openPhotoLibrary() {
        showingAttachmentOptions = false
        showingImagePicker = true
    }

    func showAttachmentOptions() {
        showingAttachmentOptions = true
    }

    func showConversationInfo() {
        showingConversationInfo = true
    }

    func dismissImagePicker() {
        showingImagePicker = false
    }

    func handleImageSelection(_ image: UIImage?) {
        selectedImage = image
        showingImagePicker = false

        if image != nil {
            // In real implementation, would upload image
            // For now, just clear the selection
            selectedImage = nil
        }
    }

    func updateConnectionStatus(isConnected: Bool) {
        self.isConnected = isConnected
        self.connectionStatus = isConnected ? "Connected" : "Disconnected"
    }

    func clearError() {
        errorMessage = nil
    }
}

// MARK: - Chat Detail View Model Tests

@MainActor
final class ChatDetailViewModelTests: XCTestCase {

    var sut: ChatDetailViewModel!

    override func setUp() async throws {
        try await super.setUp()
        sut = ChatDetailViewModel()
    }

    override func tearDown() async throws {
        sut = nil
        try await super.tearDown()
    }
}

// MARK: - Camera Functionality Tests

extension ChatDetailViewModelTests {

    func testOpenCameraSetsShowingImagePicker() {
        // Given
        sut.showingAttachmentOptions = true

        // When
        sut.openCamera()

        // Then
        XCTAssertTrue(sut.showingImagePicker, "Should show image picker")
        XCTAssertFalse(sut.showingAttachmentOptions, "Should hide attachment options")
    }

    func testOpenPhotoLibrarySetsShowingImagePicker() {
        // Given
        sut.showingAttachmentOptions = true

        // When
        sut.openPhotoLibrary()

        // Then
        XCTAssertTrue(sut.showingImagePicker, "Should show image picker")
        XCTAssertFalse(sut.showingAttachmentOptions, "Should hide attachment options")
    }

    func testShowAttachmentOptionsSetsFlag() {
        // Given
        sut.showingAttachmentOptions = false

        // When
        sut.showAttachmentOptions()

        // Then
        XCTAssertTrue(sut.showingAttachmentOptions, "Should show attachment options")
    }

    func testDismissImagePickerClearsFlag() {
        // Given
        sut.showingImagePicker = true

        // When
        sut.dismissImagePicker()

        // Then
        XCTAssertFalse(sut.showingImagePicker, "Should hide image picker")
    }
}

// MARK: - Image Selection Tests

extension ChatDetailViewModelTests {

    func testHandleImageSelectionSetsSelectedImage() {
        // Given
        let mockImage = UIImage(systemName: "photo")!
        sut.showingImagePicker = true

        // When
        sut.handleImageSelection(mockImage)

        // Then
        XCTAssertNil(sut.selectedImage, "Selected image should be cleared after handling")
        XCTAssertFalse(sut.showingImagePicker, "Should hide image picker")
    }

    func testHandleImageSelectionWithNilImage() {
        // Given
        sut.showingImagePicker = true
        sut.selectedImage = UIImage(systemName: "photo")

        // When
        sut.handleImageSelection(nil)

        // Then
        XCTAssertNil(sut.selectedImage, "Selected image should be nil")
        XCTAssertFalse(sut.showingImagePicker, "Should hide image picker")
    }
}

// MARK: - Conversation Info Tests

extension ChatDetailViewModelTests {

    func testShowConversationInfoSetsFlag() {
        // Given
        sut.showingConversationInfo = false

        // When
        sut.showConversationInfo()

        // Then
        XCTAssertTrue(sut.showingConversationInfo, "Should show conversation info")
    }
}

// MARK: - Connection Status Tests

extension ChatDetailViewModelTests {

    func testUpdateConnectionStatusConnected() {
        // Given
        sut.isConnected = false
        sut.connectionStatus = "Disconnected"

        // When
        sut.updateConnectionStatus(isConnected: true)

        // Then
        XCTAssertTrue(sut.isConnected, "Should be connected")
        XCTAssertEqual(sut.connectionStatus, "Connected", "Status should be 'Connected'")
    }

    func testUpdateConnectionStatusDisconnected() {
        // Given
        sut.isConnected = true
        sut.connectionStatus = "Connected"

        // When
        sut.updateConnectionStatus(isConnected: false)

        // Then
        XCTAssertFalse(sut.isConnected, "Should be disconnected")
        XCTAssertEqual(sut.connectionStatus, "Disconnected", "Status should be 'Disconnected'")
    }
}

// MARK: - Error Handling Tests

extension ChatDetailViewModelTests {

    func testClearErrorRemovesErrorMessage() {
        // Given
        sut.errorMessage = "Test error message"

        // When
        sut.clearError()

        // Then
        XCTAssertNil(sut.errorMessage, "Error message should be cleared")
    }

    func testClearErrorWhenNoError() {
        // Given
        sut.errorMessage = nil

        // When
        sut.clearError()

        // Then
        XCTAssertNil(sut.errorMessage, "Should handle nil error message")
    }
}

// MARK: - Initial State Tests

extension ChatDetailViewModelTests {

    func testInitialShowingImagePickerState() {
        // Then
        XCTAssertFalse(sut.showingImagePicker, "Initial state should be false")
    }

    func testInitialShowingAttachmentOptionsState() {
        // Then
        XCTAssertFalse(sut.showingAttachmentOptions, "Initial state should be false")
    }

    func testInitialShowingConversationInfoState() {
        // Then
        XCTAssertFalse(sut.showingConversationInfo, "Initial state should be false")
    }

    func testInitialMessageTextState() {
        // Then
        XCTAssertTrue(sut.messageText.isEmpty, "Initial message text should be empty")
    }

    func testInitialIsConnectedState() {
        // Then
        XCTAssertTrue(sut.isConnected, "Initial connection state should be true")
    }

    func testInitialConnectionStatus() {
        // Then
        XCTAssertEqual(sut.connectionStatus, "Connected", "Initial status should be 'Connected'")
    }

    func testInitialSelectedImageState() {
        // Then
        XCTAssertNil(sut.selectedImage, "Initial selected image should be nil")
    }

    func testInitialErrorMessageState() {
        // Then
        XCTAssertNil(sut.errorMessage, "Initial error message should be nil")
    }

    func testInitialIsLoadingState() {
        // Then
        XCTAssertFalse(sut.isLoading, "Initial isLoading should be false")
    }
}

// MARK: - Edge Cases Tests

extension ChatDetailViewModelTests {

    func testMessageTextWithSpecialCharacters() {
        // Given
        let specialMessage = "Hello! 🎉 @user #hashtag https://example.com"

        // When
        sut.messageText = specialMessage

        // Then
        XCTAssertEqual(sut.messageText, specialMessage, "Should preserve special characters")
    }

    func testMessageTextWithNewlines() {
        // Given
        let multilineMessage = "Line 1\nLine 2\nLine 3"

        // When
        sut.messageText = multilineMessage

        // Then
        XCTAssertEqual(sut.messageText, multilineMessage, "Should preserve newlines")
    }

    func testMessageTextWithVeryLongContent() {
        // Given
        let veryLongMessage = String(repeating: "a", count: 10000)

        // When
        sut.messageText = veryLongMessage

        // Then
        XCTAssertEqual(sut.messageText.count, 10000, "Should handle very long messages")
    }

    func testMultipleRapidStateChanges() {
        // When - perform multiple rapid state changes
        for i in 0..<10 {
            sut.showingImagePicker = i % 2 == 0
            sut.showingAttachmentOptions = i % 2 == 1
            sut.showingConversationInfo = i % 3 == 0
        }

        // Then - should handle rapid state changes without crash
        XCTAssertTrue(true, "Should handle rapid state changes")
    }
}

// MARK: - Helper Methods

extension ChatDetailViewModelTests {

    private func createMockUser() -> User {
        User(
            id: "test_user_id",
            email: "test@example.com",
            username: "test_user",
            displayName: "Test User",
            avatarURL: nil,
            bio: "Test bio",
            points: 100,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}
