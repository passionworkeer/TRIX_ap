//
//  StudyListViewModelTests.swift
//  TRIX3DCompanionTests
//
//  Test suite for StudyListView create room functionality
//
//  Test Coverage:
//  - CreateStudyRoomView form validation
//  - Room name validation
//  - Subject selection validation
//  - Max participants setting
//  - Duration selection
//  - Private room toggle
//  - Form state management
//  - Create room button state
//

import XCTest
import SwiftUI
import Combine
@testable import TRIX3DCompanion

// MARK: - Create Study Room View Model

@MainActor
final class CreateStudyRoomViewModel: ObservableObject {
    // Form fields
    @Published var roomName: String = ""
    @Published var subject: String = ""
    @Published var description: String = ""
    @Published var maxParticipants: Int = 10
    @Published var duration: Int = 60
    @Published var isPrivate: Bool = false

    // State
    @Published var isCreating: Bool = false
    @Published var showError: Bool = false
    @Published var errorMessage: String = ""
    @Published var showSuccess: Bool = false

    // Available options
    let subjects = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "History", "Computer Science", "Other"]
    let durations = [30, 45, 60, 90, 120, 180]

    // MARK: - Computed Properties

    var isFormValid: Bool {
        !roomName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !subject.isEmpty
    }

    // MARK: - Actions

    func createRoom() async {
        guard isFormValid else { return }

        isCreating = true
        errorMessage = ""

        do {
            // Simulate API call
            try await Task.sleep(nanoseconds: 1_000_000_000)

            // Success
            isCreating = false
            showSuccess = true
        } catch {
            isCreating = false
            errorMessage = "Failed to create room. Please try again."
            showError = true
        }
    }

    func validateRoomName() -> Bool {
        let trimmed = roomName.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && trimmed.count >= 2
    }

    func validateSubject() -> Bool {
        !subject.isEmpty
    }

    func validateMaxParticipants() -> Bool {
        maxParticipants >= 2 && maxParticipants <= 50
    }

    func validateDuration() -> Bool {
        durations.contains(duration)
    }

    func resetForm() {
        roomName = ""
        subject = ""
        description = ""
        maxParticipants = 10
        duration = 60
        isPrivate = false
        isCreating = false
        showError = false
        errorMessage = ""
        showSuccess = false
    }

    func clearError() {
        showError = false
        errorMessage = ""
    }
}

// MARK: - Study List View Model Tests

@MainActor
final class StudyListViewModelTests: XCTestCase {

    var sut: CreateStudyRoomViewModel!

    override func setUp() async throws {
        try await super.setUp()
        sut = CreateStudyRoomViewModel()
    }

    override func tearDown() async throws {
        sut = nil
        try await super.tearDown()
    }
}

// MARK: - Form Validation Tests

extension StudyListViewModelTests {

    func testIsFormValidWithEmptyFields() {
        // Given
        sut.roomName = ""
        sut.subject = ""

        // Then
        XCTAssertFalse(sut.isFormValid, "Should not be valid with empty fields")
    }

    func testIsFormValidWithOnlyRoomName() {
        // Given
        sut.roomName = "Test Room"
        sut.subject = ""

        // Then
        XCTAssertFalse(sut.isFormValid, "Should not be valid without subject")
    }

    func testIsFormValidWithOnlySubject() {
        // Given
        sut.roomName = ""
        sut.subject = "Mathematics"

        // Then
        XCTAssertFalse(sut.isFormValid, "Should not be valid without room name")
    }

    func testIsFormValidWithBothFields() {
        // Given
        sut.roomName = "Test Room"
        sut.subject = "Mathematics"

        // Then
        XCTAssertTrue(sut.isFormValid, "Should be valid with both fields")
    }

    func testIsFormValidWithWhitespace() {
        // Given
        sut.roomName = "   "
        sut.subject = "Mathematics"

        // Then
        XCTAssertFalse(sut.isFormValid, "Should not be valid with whitespace-only room name")
    }

    func testIsFormValidWithTrimmedName() {
        // Given
        sut.roomName = "   Test Room   "
        sut.subject = "Mathematics"

        // Then
        XCTAssertTrue(sut.isFormValid, "Should be valid with trimmed room name")
    }
}

// MARK: - Room Name Validation Tests

extension StudyListViewModelTests {

    func testValidateRoomNameEmpty() {
        // Given
        sut.roomName = ""

        // Then
        XCTAssertFalse(sut.validateRoomName(), "Empty name should be invalid")
    }

    func testValidateRoomNameWhitespace() {
        // Given
        sut.roomName = "   "

        // Then
        XCTAssertFalse(sut.validateRoomName(), "Whitespace-only should be invalid")
    }

    func testValidateRoomNameTooShort() {
        // Given
        sut.roomName = "A"

        // Then
        XCTAssertFalse(sut.validateRoomName(), "Single character should be invalid")
    }

    func testValidateRoomNameValid() {
        // Given
        sut.roomName = "AB"

        // Then
        XCTAssertTrue(sut.validateRoomName(), "Two characters should be valid")
    }

    func testValidateRoomNameLong() {
        // Given
        sut.roomName = String(repeating: "a", count: 50)

        // Then
        XCTAssertTrue(sut.validateRoomName(), "Long name should be valid")
    }

    func testValidateRoomNameWithNumbers() {
        // Given
        sut.roomName = "Room 123"

        // Then
        XCTAssertTrue(sut.validateRoomName(), "Name with numbers should be valid")
    }

    func testValidateRoomNameWithSpecialCharacters() {
        // Given
        sut.roomName = "Math Study - Fall 2024"

        // Then
        XCTAssertTrue(sut.validateRoomName(), "Name with special characters should be valid")
    }
}

// MARK: - Subject Validation Tests

extension StudyListViewModelTests {

    func testValidateSubjectEmpty() {
        // Given
        sut.subject = ""

        // Then
        XCTAssertFalse(sut.validateSubject(), "Empty subject should be invalid")
    }

    func testValidateSubjectValid() {
        // Given
        sut.subject = "Mathematics"

        // Then
        XCTAssertTrue(sut.validateSubject(), "Valid subject should be valid")
    }
}

// MARK: - Max Participants Validation Tests

extension StudyListViewModelTests {

    func testValidateMaxParticipantsBelowMin() {
        // Given
        sut.maxParticipants = 1

        // Then
        XCTAssertFalse(sut.validateMaxParticipants(), "Below min should be invalid")
    }

    func testValidateMaxParticipantsAtMin() {
        // Given
        sut.maxParticipants = 2

        // Then
        XCTAssertTrue(sut.validateMaxParticipants(), "At min should be valid")
    }

    func testValidateMaxParticipantsInRange() {
        // Given
        sut.maxParticipants = 10

        // Then
        XCTAssertTrue(sut.validateMaxParticipants(), "In range should be valid")
    }

    func testValidateMaxParticipantsAtMax() {
        // Given
        sut.maxParticipants = 50

        // Then
        XCTAssertTrue(sut.validateMaxParticipants(), "At max should be valid")
    }

    func testValidateMaxParticipantsAboveMax() {
        // Given
        sut.maxParticipants = 51

        // Then
        XCTAssertFalse(sut.validateMaxParticipants(), "Above max should be invalid")
    }
}

// MARK: - Duration Validation Tests

extension StudyListViewModelTests {

    func testValidateDurationInvalid() {
        // Given
        sut.duration = 25

        // Then
        XCTAssertFalse(sut.validateDuration(), "Invalid duration should be invalid")
    }

    func testValidateDurationAtMin() {
        // Given
        sut.duration = 30

        // Then
        XCTAssertTrue(sut.validateDuration(), "At min should be valid")
    }

    func testValidateDurationInList() {
        // Given
        sut.duration = 60

        // Then
        XCTAssertTrue(sut.validateDuration(), "In list should be valid")
    }

    func testValidateDurationAtMax() {
        // Given
        sut.duration = 180

        // Then
        XCTAssertTrue(sut.validateDuration(), "At max should be valid")
    }
}

// MARK: - Create Room State Tests

extension StudyListViewModelTests {

    func testCreateRoomWithInvalidForm() async {
        // Given
        sut.roomName = ""
        sut.subject = ""

        // When
        await sut.createRoom()

        // Then
        XCTAssertFalse(sut.isCreating, "Should not be creating")
        XCTAssertFalse(sut.showError, "Should not show error for invalid form")
    }

    func testCreateRoomSuccess() async {
        // Given
        sut.roomName = "Test Room"
        sut.subject = "Mathematics"

        // When
        await sut.createRoom()

        // Then
        XCTAssertFalse(sut.isCreating, "Should not be creating after completion")
        XCTAssertTrue(sut.showSuccess, "Should show success")
    }

    func testCreateRoomSetsIsCreating() async {
        // Given
        sut.roomName = "Test Room"
        sut.subject = "Mathematics"

        // When - start creating
        let createTask = Task {
            await sut.createRoom()
        }

        // Give time for state to update
        try? await Task.sleep(nanoseconds: 100_000_000)

        // Then
        XCTAssertTrue(sut.isCreating, "Should be creating during operation")

        await createTask.value
    }
}

// MARK: - Form Reset Tests

extension StudyListViewModelTests {

    func testResetFormClearsAllFields() {
        // Given
        sut.roomName = "Test Room"
        sut.subject = "Mathematics"
        sut.description = "Test description"
        sut.maxParticipants = 20
        sut.duration = 90
        sut.isPrivate = true
        sut.isCreating = true
        sut.showError = true
        sut.errorMessage = "Test error"

        // When
        sut.resetForm()

        // Then
        XCTAssertTrue(sut.roomName.isEmpty, "Room name should be cleared")
        XCTAssertTrue(sut.subject.isEmpty, "Subject should be cleared")
        XCTAssertTrue(sut.description.isEmpty, "Description should be cleared")
        XCTAssertEqual(sut.maxParticipants, 10, "Max participants should be reset to default")
        XCTAssertEqual(sut.duration, 60, "Duration should be reset to default")
        XCTAssertFalse(sut.isPrivate, "Private should be reset to default")
        XCTAssertFalse(sut.isCreating, "IsCreating should be reset")
        XCTAssertFalse(sut.showError, "ShowError should be reset")
        XCTAssertTrue(sut.errorMessage.isEmpty, "Error message should be cleared")
    }
}

// MARK: - Clear Error Tests

extension StudyListViewModelTests {

    func testClearErrorResetsErrorState() {
        // Given
        sut.showError = true
        sut.errorMessage = "Test error"

        // When
        sut.clearError()

        // Then
        XCTAssertFalse(sut.showError, "ShowError should be cleared")
        XCTAssertTrue(sut.errorMessage.isEmpty, "Error message should be cleared")
    }
}

// MARK: - Initial State Tests

extension StudyListViewModelTests {

    func testInitialRoomName() {
        // Then
        XCTAssertTrue(sut.roomName.isEmpty, "Initial room name should be empty")
    }

    func testInitialSubject() {
        // Then
        XCTAssertTrue(sut.subject.isEmpty, "Initial subject should be empty")
    }

    func testInitialDescription() {
        // Then
        XCTAssertTrue(sut.description.isEmpty, "Initial description should be empty")
    }

    func testInitialMaxParticipants() {
        // Then
        XCTAssertEqual(sut.maxParticipants, 10, "Initial max participants should be 10")
    }

    func testInitialDuration() {
        // Then
        XCTAssertEqual(sut.duration, 60, "Initial duration should be 60")
    }

    func testInitialIsPrivate() {
        // Then
        XCTAssertFalse(sut.isPrivate, "Initial isPrivate should be false")
    }

    func testInitialIsCreating() {
        // Then
        XCTAssertFalse(sut.isCreating, "Initial isCreating should be false")
    }

    func testInitialShowError() {
        // Then
        XCTAssertFalse(sut.showError, "Initial showError should be false")
    }

    func testInitialErrorMessage() {
        // Then
        XCTAssertTrue(sut.errorMessage.isEmpty, "Initial error message should be empty")
    }

    func testInitialSubjects() {
        // Then
        XCTAssertEqual(sut.subjects.count, 8, "Should have 8 subjects")
    }

    func testInitialDurations() {
        // Then
        XCTAssertEqual(sut.durations.count, 6, "Should have 6 duration options")
    }
}

// MARK: - Field Update Tests

extension StudyListViewModelTests {

    func testUpdateRoomName() {
        // When
        sut.roomName = "Updated Room"

        // Then
        XCTAssertEqual(sut.roomName, "Updated Room", "Room name should be updated")
    }

    func testUpdateSubject() {
        // When
        sut.subject = "Physics"

        // Then
        XCTAssertEqual(sut.subject, "Physics", "Subject should be updated")
    }

    func testUpdateDescription() {
        // When
        sut.description = "This is a test description"

        // Then
        XCTAssertEqual(sut.description, "This is a test description", "Description should be updated")
    }

    func testUpdateMaxParticipants() {
        // When
        sut.maxParticipants = 25

        // Then
        XCTAssertEqual(sut.maxParticipants, 25, "Max participants should be updated")
    }

    func testUpdateDuration() {
        // When
        sut.duration = 120

        // Then
        XCTAssertEqual(sut.duration, 120, "Duration should be updated")
    }

    func testUpdateIsPrivate() {
        // When
        sut.isPrivate = true

        // Then
        XCTAssertTrue(sut.isPrivate, "IsPrivate should be updated")
    }
}

// MARK: - Edge Cases Tests

extension StudyListViewModelTests {

    func testRoomNameWithEmoji() {
        // Given
        sut.roomName = "Study Room 🎓"

        // Then
        XCTAssertTrue(sut.validateRoomName(), "Room name with emoji should be valid")
    }

    func testRoomNameWithChinese() {
        // Given
        sut.roomName = "数学学习小组"

        // Then
        XCTAssertTrue(sut.validateRoomName(), "Room name with Chinese should be valid")
    }

    func testDescriptionWithVeryLongText() {
        // Given
        let longDescription = String(repeating: "This is a test description. ", count: 50)

        // When
        sut.description = longDescription

        // Then
        XCTAssertEqual(sut.description.count, longDescription.count, "Should handle long description")
    }

    func testFormValidationAfterPartialReset() {
        // Given
        sut.roomName = "Test Room"
        sut.subject = "Mathematics"
        sut.maxParticipants = 5

        // When - reset partially
        sut.roomName = ""
        sut.subject = ""

        // Then
        XCTAssertFalse(sut.isFormValid, "Should not be valid after clearing fields")
    }
}

// MARK: - Available Options Tests

extension StudyListViewModelTests {

    func testSubjectsContainsExpectedValues() {
        // Then
        XCTAssertTrue(sut.subjects.contains("Mathematics"), "Should contain Mathematics")
        XCTAssertTrue(sut.subjects.contains("Physics"), "Should contain Physics")
        XCTAssertTrue(sut.subjects.contains("Chemistry"), "Should contain Chemistry")
        XCTAssertTrue(sut.subjects.contains("Computer Science"), "Should contain Computer Science")
    }

    func testDurationsContainsExpectedValues() {
        // Then
        XCTAssertTrue(sut.durations.contains(30), "Should contain 30")
        XCTAssertTrue(sut.durations.contains(60), "Should contain 60")
        XCTAssertTrue(sut.durations.contains(120), "Should contain 120")
        XCTAssertTrue(sut.durations.contains(180), "Should contain 180")
    }

    func testDurationsAreSorted() {
        // Then
        XCTAssertEqual(sut.durations, sut.durations.sorted(), "Durations should be sorted")
    }
}
